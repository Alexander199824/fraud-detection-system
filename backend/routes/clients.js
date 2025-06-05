const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/clientController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { validateClient, validateCard } = require('../middleware/validation');

/**
 * Rutas para gestión de clientes
 */

// Buscar clientes
router.get('/search', 
  authenticateToken, 
  ClientController.searchClients
);

// Crear nuevo cliente
router.post('/', 
  authenticateToken,
  authorizeRole(['admin', 'agent']),
  validateClient,
  ClientController.createClient
);

// Obtener cliente por ID
router.get('/:id', 
  authenticateToken,
  ClientController.getClientById
);

// Obtener perfil de riesgo del cliente
router.get('/:id/risk-profile', 
  authenticateToken,
  ClientController.getClientRiskProfile
);

// Actualizar perfil de riesgo del cliente
router.put('/:id/risk-profile', 
  authenticateToken,
  authorizeRole(['admin', 'risk_analyst']),
  ClientController.updateRiskProfile
);

// Obtener patrones de comportamiento del cliente
router.get('/:id/behavior-patterns', 
  authenticateToken,
  ClientController.getClientBehaviorPatterns
);

// Obtener estadísticas del cliente
router.get('/:id/stats', 
  authenticateToken,
  ClientController.getClientStats
);

// Obtener tarjetas del cliente
router.get('/:id/cards', 
  authenticateToken,
  ClientController.getClientCards
);

// Crear tarjeta para cliente
router.post('/:id/cards', 
  authenticateToken,
  authorizeRole(['admin', 'agent']),
  validateCard,
  ClientController.createClientCard
);

module.exports = router;