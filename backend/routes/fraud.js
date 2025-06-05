const express = require('express');
const router = express.Router();
const FraudController = require('../controllers/fraudController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

/**
 * Rutas para análisis y gestión de fraude
 */

// Analizar transacción para detectar fraude
router.post('/analyze/:transactionId', 
  authenticateToken,
  FraudController.analyzeTransaction
);

// Obtener análisis de fraude por transacción
router.get('/analysis/:transactionId', 
  authenticateToken,
  FraudController.getFraudAnalysis
);

// Obtener estadísticas generales de fraude
router.get('/stats', 
  authenticateToken,
  FraudController.getFraudStats
);

// Obtener principales razones de fraude
router.get('/top-reasons', 
  authenticateToken,
  FraudController.getTopFraudReasons
);

// Obtener rendimiento de las redes neuronales
router.get('/network-performance', 
  authenticateToken,
  authorizeRole(['admin', 'risk_analyst']),
  FraudController.getNetworkPerformance
);

// Obtener alertas de fraude recientes
router.get('/recent-alerts', 
  authenticateToken,
  FraudController.getRecentFraudAlerts
);

// Obtener tendencias de fraude
router.get('/trends', 
  authenticateToken,
  FraudController.getFraudTrends
);

// Obtener métricas de precisión del modelo
router.get('/model-accuracy', 
  authenticateToken,
  authorizeRole(['admin', 'risk_analyst']),
  FraudController.getModelAccuracy
);

// Obtener dashboard de fraude
router.get('/dashboard', 
  authenticateToken,
  FraudController.getFraudDashboard
);

// Actualizar análisis de fraude (feedback)
router.put('/analysis/:fraudLogId', 
  authenticateToken,
  authorizeRole(['admin', 'risk_analyst']),
  FraudController.updateFraudAnalysis
);

// Entrenar redes neuronales (solo admin)
router.post('/train', 
  authenticateToken,
  authorizeRole(['admin']),
  FraudController.trainNetworks
);

// Enviar prueba de notificación WhatsApp (solo admin)
router.post('/test-notification', 
  authenticateToken,
  authorizeRole(['admin']),
  FraudController.testWhatsAppNotification
);

module.exports = router;