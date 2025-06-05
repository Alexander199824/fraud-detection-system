const ClientModel = require('../models/clientModel');
const CardModel = require('../models/cardModel');
const { logger } = require('../config');

/**
 * Controlador para gestión de clientes
 */
const ClientController = {
  /**
   * Crear nuevo cliente
   * POST /api/clients
   */
  async createClient(req, res) {
    try {
      const clientData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
        address: req.body.address,
        city: req.body.city,
        country: req.body.country || 'GT',
        dateOfBirth: req.body.dateOfBirth,
        identificationNumber: req.body.identificationNumber,
        riskProfile: req.body.riskProfile || 'low'
      };

      // Validar datos requeridos
      if (!clientData.firstName || !clientData.lastName || !clientData.email) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, apellido y email son requeridos'
        });
      }

      const client = await ClientModel.createClient(clientData);

      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: client
      });

    } catch (error) {
      logger.error('Error al crear cliente:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear cliente',
        error: error.message
      });
    }
  },

  /**
   * Obtener cliente por ID
   * GET /api/clients/:id
   */
  async getClientById(req, res) {
    try {
      const clientId = req.params.id;
      
      if (!clientId) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente requerido'
        });
      }

      const client = await ClientModel.getClientById(clientId);

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      res.json({
        success: true,
        data: client
      });

    } catch (error) {
      logger.error(`Error al obtener cliente ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener cliente',
        error: error.message
      });
    }
  },

  /**
   * Obtener perfil de riesgo del cliente
   * GET /api/clients/:id/risk-profile
   */
  async getClientRiskProfile(req, res) {
    try {
      const clientId = req.params.id;
      
      const riskProfile = await ClientModel.getClientRiskProfile(clientId);

      if (!riskProfile) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      res.json({
        success: true,
        data: riskProfile
      });

    } catch (error) {
      logger.error(`Error al obtener perfil de riesgo del cliente ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener perfil de riesgo',
        error: error.message
      });
    }
  },

  /**
   * Actualizar perfil de riesgo del cliente
   * PUT /api/clients/:id/risk-profile
   */
  async updateRiskProfile(req, res) {
    try {
      const clientId = req.params.id;
      const { riskProfile } = req.body;

      if (!riskProfile || !['low', 'medium', 'high'].includes(riskProfile)) {
        return res.status(400).json({
          success: false,
          message: 'Perfil de riesgo inválido. Debe ser: low, medium o high'
        });
      }

      const updatedClient = await ClientModel.updateRiskProfile(clientId, riskProfile);

      res.json({
        success: true,
        message: 'Perfil de riesgo actualizado',
        data: updatedClient
      });

    } catch (error) {
      logger.error(`Error al actualizar perfil de riesgo del cliente ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar perfil de riesgo',
        error: error.message
      });
    }
  },

  /**
   * Obtener patrones de comportamiento del cliente
   * GET /api/clients/:id/behavior-patterns
   */
  async getClientBehaviorPatterns(req, res) {
    try {
      const clientId = req.params.id;
      
      const patterns = await ClientModel.getClientBehaviorPatterns(clientId);

      res.json({
        success: true,
        data: patterns
      });

    } catch (error) {
      logger.error(`Error al obtener patrones de comportamiento del cliente ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener patrones de comportamiento',
        error: error.message
      });
    }
  },

  /**
   * Buscar clientes
   * GET /api/clients/search
   */
  async searchClients(req, res) {
    try {
      const criteria = {
        email: req.query.email,
        phone: req.query.phone,
        riskProfile: req.query.riskProfile,
        country: req.query.country
      };

      // Limpiar criterios vacíos
      Object.keys(criteria).forEach(key => {
        if (!criteria[key]) delete criteria[key];
      });

      const clients = await ClientModel.searchClients(criteria);

      res.json({
        success: true,
        count: clients.length,
        data: clients
      });

    } catch (error) {
      logger.error('Error al buscar clientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error al buscar clientes',
        error: error.message
      });
    }
  },

  /**
   * Obtener tarjetas del cliente
   * GET /api/clients/:id/cards
   */
  async getClientCards(req, res) {
    try {
      const clientId = req.params.id;
      
      const cards = await CardModel.getCardsByClientId(clientId);

      res.json({
        success: true,
        count: cards.length,
        data: cards
      });

    } catch (error) {
      logger.error(`Error al obtener tarjetas del cliente ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener tarjetas',
        error: error.message
      });
    }
  },

  /**
   * Crear tarjeta para cliente
   * POST /api/clients/:id/cards
   */
  async createClientCard(req, res) {
    try {
      const clientId = req.params.id;
      
      // Verificar que el cliente existe
      const client = await ClientModel.getClientById(clientId);
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      const cardData = {
        clientId: clientId,
        cardNumber: req.body.cardNumber,
        cardType: req.body.cardType, // 'credit' o 'debit'
        bank: req.body.bank,
        expiryDate: req.body.expiryDate,
        creditLimit: req.body.creditLimit || null,
        isActive: true
      };

      // Validar datos requeridos
      if (!cardData.cardNumber || !cardData.cardType || !cardData.bank || !cardData.expiryDate) {
        return res.status(400).json({
          success: false,
          message: 'Todos los datos de la tarjeta son requeridos'
        });
      }

      // Validar formato de número de tarjeta (16 dígitos)
      if (!/^\d{16}$/.test(cardData.cardNumber.replace(/\s/g, ''))) {
        return res.status(400).json({
          success: false,
          message: 'Número de tarjeta inválido. Debe contener 16 dígitos'
        });
      }

      const card = await CardModel.createCard(cardData);

      res.status(201).json({
        success: true,
        message: 'Tarjeta creada exitosamente',
        data: card
      });

    } catch (error) {
      logger.error(`Error al crear tarjeta para cliente ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al crear tarjeta',
        error: error.message
      });
    }
  },

  /**
   * Obtener estadísticas del cliente
   * GET /api/clients/:id/stats
   */
  async getClientStats(req, res) {
    try {
      const clientId = req.params.id;
      
      // Obtener perfil de riesgo completo que incluye estadísticas
      const riskProfile = await ClientModel.getClientRiskProfile(clientId);
      
      if (!riskProfile) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Obtener patrones de comportamiento
      const behaviorPatterns = await ClientModel.getClientBehaviorPatterns(clientId);

      const stats = {
        general: {
          client_since: riskProfile.client_since,
          total_transactions: riskProfile.total_transactions,
          total_spent: riskProfile.total_spent,
          avg_transaction_amount: riskProfile.avg_transaction_amount,
          max_transaction_amount: riskProfile.max_transaction_amount,
          min_transaction_amount: riskProfile.min_transaction_amount
        },
        activity: {
          transactions_last_30_days: riskProfile.transactions_last_30_days,
          spent_last_30_days: riskProfile.spent_last_30_days,
          avg_transactions_per_day: riskProfile.average_transactions_per_day
        },
        diversity: {
          unique_locations: riskProfile.unique_locations,
          unique_countries: riskProfile.unique_countries,
          unique_merchant_types: riskProfile.unique_merchant_types
        },
        risk: {
          current_profile: riskProfile.risk_profile,
          calculated_score: riskProfile.risk_score,
          fraud_incidents: riskProfile.fraud_incidents,
          last_fraud_check: riskProfile.last_fraud_check
        },
        behavior: behaviorPatterns
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error(`Error al obtener estadísticas del cliente ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message
      });
    }
  }
};

module.exports = ClientController;