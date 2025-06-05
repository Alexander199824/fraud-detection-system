const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const { config, logger } = require('./config');
const { pool } = require('./config/database');

// Importar rutas
const clientRoutes = require('./routes/clients');
const transactionRoutes = require('./routes/transactions');
const fraudRoutes = require('./routes/fraud');

// Importar middleware
const { sanitizeInput, validatePayloadSize } = require('./middleware/validation');
const { authenticateToken, authenticateApiKey } = require('./middleware/auth');

// Importar servicios
const FraudAnalysisService = require('./services/fraudAnalysisService');
const WhatsAppService = require('./services/whatsappService');

// Crear aplicación Express
const app = express();

// === Middleware de seguridad ===
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS
app.use(cors(config.cors));

// Comprimir respuestas
app.use(compression());

// Rate limiting general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de requests
  message: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde.'
});

// Rate limiting para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Demasiados intentos de autenticación, por favor intenta más tarde.'
});

// Rate limiting para análisis de fraude
const fraudLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20,
  message: 'Límite de análisis de fraude alcanzado, por favor espera un momento.'
});

// Aplicar rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/fraud/analyze/', fraudLimiter);

// === Middleware de parsing ===
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(validatePayloadSize(10 * 1024 * 1024)); // 10MB máximo

// Sanitizar inputs
app.use(sanitizeInput);

// === Logging ===
// Morgan para desarrollo
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  // Morgan para producción
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400,
    stream: {
      write: message => logger.info(message.trim())
    }
  }));
}

// === Rutas de Health Check ===
app.get('/health', async (req, res) => {
  try {
    // Verificar base de datos
    await pool.query('SELECT 1');
    
    // Verificar servicios
    const fraudServiceHealth = await FraudAnalysisService.healthCheck();
    const whatsappStats = WhatsAppService.getStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
        fraud_analysis: fraudServiceHealth.status,
        whatsapp: whatsappStats.is_processing ? 'busy' : 'ready'
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// === Rutas de API ===
app.use('/api/clients', clientRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/fraud', fraudRoutes);

// === Rutas de autenticación (simplificadas para el ejemplo) ===
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Aquí deberías implementar la lógica real de autenticación
    // Este es solo un ejemplo básico
    if (email === 'admin@fraudsystem.com' && password === 'admin123') {
      const { generateToken } = require('./middleware/auth');
      const token = generateToken({
        id: 'admin-001',
        email: email,
        role: 'admin',
        name: 'System Admin'
      });
      
      res.json({
        success: true,
        token,
        user: {
          id: 'admin-001',
          email: email,
          role: 'admin',
          name: 'System Admin'
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }
  } catch (error) {
    logger.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error en autenticación'
    });
  }
});

// === Manejo de errores 404 ===
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    path: req.originalUrl
  });
});

// === Manejo global de errores ===
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  
  // No exponer detalles del error en producción
  const isDevelopment = config.nodeEnv === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    ...(isDevelopment && { stack: err.stack })
  });
});

// === Iniciar servidor ===
const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Servidor de Detección de Fraude iniciado en puerto ${PORT}`);
  logger.info(`📍 Entorno: ${config.nodeEnv}`);
  logger.info(`🔧 Configuración de IA: ${Object.keys(config.neuralNetworks.layers).length} capas de redes neuronales`);
  
  // Iniciar análisis en tiempo real
  FraudAnalysisService.startRealtimeAnalysis((error, result) => {
    if (error) {
      logger.error('Error en análisis en tiempo real:', error);
    } else {
      logger.debug('Análisis en tiempo real completado:', result.analysisId);
    }
  });
  
  // Programar resumen diario (a las 9 AM)
  const schedule = require('node-cron');
  schedule.schedule('0 9 * * *', async () => {
    logger.info('Ejecutando resumen diario de fraude');
    await WhatsAppService.sendDailySummary();
  });
});

// === Manejo de señales de terminación ===
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  logger.info('⏱️ Iniciando apagado graceful del servidor...');
  
  server.close(() => {
    logger.info('✅ Servidor HTTP cerrado');
    
    // Detener servicios
    FraudAnalysisService.cleanup();
    
    // Cerrar pool de base de datos
    pool.end(() => {
      logger.info('✅ Conexiones de base de datos cerradas');
      process.exit(0);
    });
  });
  
  // Forzar cierre después de 30 segundos
  setTimeout(() => {
    logger.error('❌ No se pudo cerrar las conexiones a tiempo, forzando apagado');
    process.exit(1);
  }, 30000);
}

// === Manejo de errores no capturados ===
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // En producción, podrías querer hacer un graceful shutdown aquí
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // En producción, deberías hacer un graceful shutdown aquí
  process.exit(1);
});

module.exports = app;