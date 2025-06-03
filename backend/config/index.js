require('dotenv').config();
const winston = require('winston');
const path = require('path');

// Configuración de logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'fraud-detection-system' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/combined.log') 
    })
  ],
});

// Crear directorio de logs si no existe
const fs = require('fs');
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configuración principal del sistema de detección de fraude
const config = {
  // Servidor
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Base de datos
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true'
  },
  
  // JWT (autenticación)
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  
  // WhatsApp/Twilio para notificaciones
  whatsapp: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
    adminNumber: process.env.ADMIN_WHATSAPP_NUMBER
  },
  
  // Google Maps para el mapa interactivo
  maps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY
  },
  
  // Configuración de Redes Neuronales
  neuralNetworks: {
    learningRate: parseFloat(process.env.NEURAL_NETWORK_LEARNING_RATE) || 0.01,
    iterations: parseInt(process.env.NEURAL_NETWORK_ITERATIONS) || 20000,
    fraudThreshold: parseFloat(process.env.FRAUD_THRESHOLD) || 0.7,
    
    // Configuración por capas
    layers: {
      layer1: {
        networks: 12, // 12 redes neuronales en la primera capa
        neurons: [8, 6, 4], // Neuronas por red: 8 entrada, 6 oculta, 4 salida
        activation: 'sigmoid',
        description: 'Análisis individual de variables'
      },
      layer2: {
        networks: 6, // 6 redes en la segunda capa
        neurons: [12, 8, 4], // Recibe de 12 redes de capa 1
        activation: 'sigmoid',
        description: 'Combinación de patrones'
      },
      layer3: {
        networks: 4, // 4 redes en la tercera capa
        neurons: [6, 4, 2], // Recibe de 6 redes de capa 2
        activation: 'sigmoid', 
        description: 'Análisis profundo de riesgo'
      },
      output: {
        networks: 1, // 1 red final
        neurons: [4, 3, 1], // Recibe de 4 redes de capa 3, salida binaria
        activation: 'sigmoid',
        description: 'Decisión final de fraude'
      }
    },
    
    // Variables que analiza cada red de la Capa 1
    variables: {
      'amountAnalyzer': 'Análisis del monto de transacción',
      'locationAnalyzer': 'Análisis de ubicación geográfica',
      'timeAnalyzer': 'Análisis de hora del día',
      'dayAnalyzer': 'Análisis de día de la semana',
      'merchantAnalyzer': 'Análisis del tipo de establecimiento',
      'velocityAnalyzer': 'Análisis de velocidad entre transacciones',
      'distanceAnalyzer': 'Análisis de distancia desde última transacción',
      'patternAnalyzer': 'Análisis de patrón de gasto histórico',
      'frequencyAnalyzer': 'Análisis de frecuencia de uso',
      'channelAnalyzer': 'Análisis del canal de transacción',
      'deviceAnalyzer': 'Análisis de dispositivo/IP',
      'countryAnalyzer': 'Análisis de país de origen'
    }
  },
  
  // Configuración de análisis de fraude
  fraudDetection: {
    // Umbrales de alerta
    thresholds: {
      low: 0.3,      // Riesgo bajo
      medium: 0.5,   // Riesgo medio  
      high: 0.7,     // Riesgo alto
      critical: 0.9  // Riesgo crítico
    },
    
    // Configuración de análisis por variable
    analysis: {
      amount: {
        smallTransaction: 50,     // Transacciones pequeñas (sospechosas)
        largeTransaction: 10000,  // Transacciones grandes (sospechosas)
        maxNormalAmount: 5000     // Monto normal máximo
      },
      velocity: {
        maxTransactionsPerHour: 5,    // Máx transacciones por hora
        maxTransactionsPerDay: 20,    // Máx transacciones por día
        minTimeBetweenTransactions: 60 // Mín segundos entre transacciones
      },
      location: {
        maxDistanceKm: 100,           // Máx distancia normal en km
        suspiciousCountries: ['CN', 'RU', 'NG'], // Países sospechosos
        homeCountry: 'GT'             // País base (Guatemala)
      }
    }
  },
  
  // Paths
  paths: {
    logs: logDir,
    neuralNetworks: path.join(__dirname, '../neural-networks'),
    models: path.join(__dirname, '../models'),
    uploads: path.join(__dirname, '../../uploads')
  },
  
  // CORS
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://tu-dominio-frontend.com'] 
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
};

// Validar configuración crítica
const validateConfig = () => {
  const required = [
    'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error('Variables de entorno faltantes:', missing);
    process.exit(1);
  }
  
  logger.info('Configuración validada correctamente');
};

// Crear directorios necesarios
const ensureDirectories = () => {
  const dirs = [
    config.paths.logs,
    config.paths.uploads
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Directorio creado: ${dir}`);
    }
  });
};

// Inicializar configuración
validateConfig();
ensureDirectories();

module.exports = {
  config,
  logger
};