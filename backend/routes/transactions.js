const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/transactionController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { validateTransaction } = require('../middleware/validation');

/**
 * Rutas para gestión de transacciones
 */

// Buscar transacciones
router.get('/search', 
  authenticateToken,
  TransactionController.searchTransactions
);

// Obtener transacciones sospechosas
router.get('/suspicious', 
  authenticateToken,
  authorizeRole(['admin', 'risk_analyst']),
  TransactionController.getSuspiciousTransactions
);

// Obtener estadísticas de transacciones
router.get('/stats', 
  authenticateToken,
  TransactionController.getTransactionStats
);

// Obtener dashboard de transacciones
router.get('/dashboard', 
  authenticateToken,
  TransactionController.getTransactionDashboard
);

// Crear nueva transacción
router.post('/', 
  authenticateToken,
  validateTransaction,
  TransactionController.createTransaction
);

// Simular transacción (para testing)
router.post('/simulate', 
  authenticateToken,
  authorizeRole(['admin', 'developer']),
  TransactionController.simulateTransaction
);

// Obtener transacción por ID
router.get('/:id', 
  authenticateToken,
  TransactionController.getTransactionById
);

// Obtener transacciones de un cliente
router.get('/client/:clientId', 
  authenticateToken,
  TransactionController.getClientTransactions
);

// Obtener estadísticas de tarjeta
router.get('/card/:cardId/stats', 
  authenticateToken,
  TransactionController.getCardStats
);

// Actualizar estado de tarjeta (bloquear/desbloquear)
router.put('/card/:cardId/status', 
  authenticateToken,
  authorizeRole(['admin', 'risk_analyst']),
  TransactionController.updateCardStatus
);

module.exports = router;