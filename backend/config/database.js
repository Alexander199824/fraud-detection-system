const { Pool } = require('pg');
const winston = require('winston');
const path = require('path');
require('dotenv').config();

// Configuración de logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'fraud-detection-db' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/database.log' 
    })
  ],
});

// Asegurar que existe el directorio de logs
const fs = require('fs');
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Depuración de configuración
logger.info('Configuración de base de datos:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  ssl: process.env.DB_SSL || process.env.NODE_ENV === 'production'
});

// Configuración de conexión a PostgreSQL para sistema de detección de fraude
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20, // Más conexiones para el análisis de fraude
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 10000, // Más tiempo para análisis complejos
  ssl: { rejectUnauthorized: false }
});

// Evento cuando se crea un cliente
pool.on('connect', client => {
  logger.info('Nueva conexión establecida para análisis de fraude');
});

// Evento cuando hay un error
pool.on('error', (err, client) => {
  logger.error('Error inesperado en el cliente de PostgreSQL', err);
  
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'EPIPE') {
    logger.info('Intentando reconexión a la base de datos...');
  }
});

// Función para ejecutar queries con retry específica para detección de fraude
const query = async (text, params, retries = 3) => {
  const start = Date.now();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      logger.info('Query de fraude ejecutada', { 
        text: text.substring(0, 100), 
        duration, 
        rows: res.rowCount 
      });
      return res;
    } catch (error) {
      const duration = Date.now() - start;
      
      if (attempt === retries) {
        logger.error('Error en query de fraude después de todos los intentos', { 
          text: text.substring(0, 100), 
          duration,
          error: error.message 
        });
        throw error;
      }
      
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'EPIPE') {
        logger.warn(`Error de conexión en análisis de fraude, intento ${attempt}/${retries}`, {
          error: error.message
        });
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        logger.error('Error en query de análisis de fraude', { 
          text: text.substring(0, 100), 
          error: error.message 
        });
        throw error;
      }
    }
  }
};

// Función específica para análisis de fraude que requiere múltiples consultas
const analyzeWithTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error en transacción de análisis de fraude:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Verificar conexión al inicio
(async () => {
  try {
    await pool.query('SELECT NOW()');
    logger.info('Conexión inicial al sistema de detección de fraude establecida correctamente');
  } catch (error) {
    logger.error('Error en la conexión inicial al sistema de fraude:', error);
  }
})();

module.exports = {
  query,
  analyzeWithTransaction,
  pool,
  logger
};