const TransactionModel = require('../models/transactionModel');
const CardModel = require('../models/cardModel');
const FraudController = require('./fraudController');
const { logger } = require('../config');

/**
 * Controlador para gestión de transacciones
 */
const TransactionController = {
  /**
   * Crear nueva transacción
   * POST /api/transactions
   */
  async createTransaction(req, res) {
    try {
      const transactionData = {
        clientId: req.body.clientId,
        cardId: req.body.cardId,
        amount: parseFloat(req.body.amount),
        merchantName: req.body.merchantName,
        merchantType: req.body.merchantType,
        location: req.body.location,
        latitude: parseFloat(req.body.latitude),
        longitude: parseFloat(req.body.longitude),
        country: req.body.country || 'GT',
        channel: req.body.channel || 'physical', // 'online', 'physical', 'atm'
        deviceInfo: req.body.deviceInfo || null,
        ipAddress: req.body.ipAddress || req.ip,
        description: req.body.description || null
      };

      // Validar datos requeridos
      if (!transactionData.clientId || !transactionData.cardId || !transactionData.amount) {
        return res.status(400).json({
          success: false,
          message: 'Cliente, tarjeta y monto son requeridos'
        });
      }

      // Validar tarjeta antes de crear transacción
      const cardValidation = await CardModel.validateCardForTransaction(
        transactionData.cardId, 
        transactionData.amount
      );

      if (!cardValidation.valid) {
        return res.status(400).json({
          success: false,
          message: cardValidation.reason,
          risk_level: cardValidation.risk_level
        });
      }

      // Crear transacción
      const transaction = await TransactionModel.createTransaction(transactionData);

      // Analizar fraude automáticamente
      const fraudAnalysisReq = {
        params: { transactionId: transaction.id }
      };
      
      const fraudAnalysisRes = {
        json: (data) => data,
        status: (code) => ({ json: (data) => data })
      };

      // Ejecutar análisis de fraude de forma asíncrona
      FraudController.analyzeTransaction(fraudAnalysisReq, fraudAnalysisRes)
        .catch(error => {
          logger.error('Error en análisis de fraude automático:', error);
        });

      res.status(201).json({
        success: true,
        message: 'Transacción creada exitosamente',
        data: {
          transaction,
          card_validation: cardValidation,
          fraud_analysis: {
            status: 'in_progress',
            message: 'Análisis de fraude en proceso'
          }
        }
      });

    } catch (error) {
      logger.error('Error al crear transacción:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear transacción',
        error: error.message
      });
    }
  },

  /**
   * Obtener transacción por ID
   * GET /api/transactions/:id
   */
  async getTransactionById(req, res) {
    try {
      const transactionId = req.params.id;
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          message: 'ID de transacción requerido'
        });
      }

      const transaction = await TransactionModel.getTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transacción no encontrada'
        });
      }

      res.json({
        success: true,
        data: transaction
      });

    } catch (error) {
      logger.error(`Error al obtener transacción ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener transacción',
        error: error.message
      });
    }
  },

  /**
   * Obtener transacciones recientes de un cliente
   * GET /api/transactions/client/:clientId
   */
  async getClientTransactions(req, res) {
    try {
      const clientId = req.params.clientId;
      const limit = parseInt(req.query.limit) || 50;
      
      const transactions = await TransactionModel.getRecentTransactionsByClient(clientId, limit);

      res.json({
        success: true,
        count: transactions.length,
        data: transactions
      });

    } catch (error) {
      logger.error(`Error al obtener transacciones del cliente ${req.params.clientId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener transacciones',
        error: error.message
      });
    }
  },

  /**
   * Obtener transacciones sospechosas
   * GET /api/transactions/suspicious
   */
  async getSuspiciousTransactions(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      
      const transactions = await TransactionModel.getSuspiciousTransactions(limit);

      res.json({
        success: true,
        count: transactions.length,
        data: transactions
      });

    } catch (error) {
      logger.error('Error al obtener transacciones sospechosas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener transacciones sospechosas',
        error: error.message
      });
    }
  },

  /**
   * Obtener estadísticas de transacciones
   * GET /api/transactions/stats
   */
  async getTransactionStats(req, res) {
    try {
      const period = req.query.period || 'day';
      const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

      const stats = await TransactionModel.getTransactionStats(period, startDate, endDate);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error al obtener estadísticas de transacciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message
      });
    }
  },

  /**
   * Buscar transacciones
   * GET /api/transactions/search
   */
  async searchTransactions(req, res) {
    try {
      const criteria = {
        clientId: req.query.clientId,
        cardId: req.query.cardId,
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount) : undefined,
        country: req.query.country,
        merchantType: req.query.merchantType,
        channel: req.query.channel,
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        fraudDetected: req.query.fraudDetected !== undefined ? req.query.fraudDetected === 'true' : undefined
      };

      // Limpiar criterios no definidos
      Object.keys(criteria).forEach(key => {
        if (criteria[key] === undefined) delete criteria[key];
      });

      const transactions = await TransactionModel.searchTransactions(criteria);

      res.json({
        success: true,
        count: transactions.length,
        data: transactions
      });

    } catch (error) {
      logger.error('Error al buscar transacciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al buscar transacciones',
        error: error.message
      });
    }
  },

  /**
   * Simular transacción (para testing)
   * POST /api/transactions/simulate
   */
  async simulateTransaction(req, res) {
    try {
      const simulationData = {
        clientId: req.body.clientId,
        cardId: req.body.cardId,
        amount: parseFloat(req.body.amount),
        merchantName: req.body.merchantName || 'Comercio Simulado',
        merchantType: req.body.merchantType || 'retail',
        location: req.body.location || 'Guatemala City',
        latitude: parseFloat(req.body.latitude) || 14.6349,
        longitude: parseFloat(req.body.longitude) || -90.5069,
        country: req.body.country || 'GT',
        channel: req.body.channel || 'online',
        deviceInfo: req.body.deviceInfo || 'Simulation Device',
        ipAddress: req.body.ipAddress || '192.168.1.1',
        description: 'Transacción simulada para pruebas'
      };

      // Validar datos mínimos
      if (!simulationData.clientId || !simulationData.cardId || !simulationData.amount) {
        return res.status(400).json({
          success: false,
          message: 'Cliente, tarjeta y monto son requeridos para la simulación'
        });
      }

      // Crear transacción simulada (sin validación de tarjeta)
      const transaction = await TransactionModel.createTransaction(simulationData);

      // Obtener datos para análisis de fraude
      const transactionForAnalysis = await TransactionModel.getTransactionForFraudAnalysis(transaction.id);

      // Analizar fraude inmediatamente
      const NetworkManager = require('../neural-networks/networkManager');
      const networkManager = new NetworkManager();
      const analysisResult = await networkManager.analyzeTransaction(transactionForAnalysis);

      res.json({
        success: true,
        message: 'Transacción simulada y analizada',
        data: {
          transaction,
          fraud_analysis: {
            fraud_detected: analysisResult.fraud_detected,
            fraud_score: analysisResult.fraud_score,
            risk_level: analysisResult.risk_level,
            primary_reasons: analysisResult.primary_reasons,
            processing_time_ms: analysisResult.processing_time_ms
          }
        }
      });

    } catch (error) {
      logger.error('Error al simular transacción:', error);
      res.status(500).json({
        success: false,
        message: 'Error al simular transacción',
        error: error.message
      });
    }
  },

  /**
   * Obtener estadísticas de tarjeta
   * GET /api/transactions/card/:cardId/stats
   */
  async getCardStats(req, res) {
    try {
      const cardId = req.params.cardId;
      const days = parseInt(req.query.days) || 30;
      
      const stats = await CardModel.getCardUsageStats(cardId, days);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error(`Error al obtener estadísticas de tarjeta ${req.params.cardId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message
      });
    }
  },

  /**
   * Bloquear/desbloquear tarjeta
   * PUT /api/transactions/card/:cardId/status
   */
  async updateCardStatus(req, res) {
    try {
      const cardId = req.params.cardId;
      const { isActive, reason } = req.body;

      if (isActive === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Estado de tarjeta (isActive) es requerido'
        });
      }

      const updatedCard = await CardModel.updateCardStatus(cardId, isActive, reason);

      res.json({
        success: true,
        message: `Tarjeta ${isActive ? 'activada' : 'bloqueada'} exitosamente`,
        data: updatedCard
      });

    } catch (error) {
      logger.error(`Error al actualizar estado de tarjeta ${req.params.cardId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar estado de tarjeta',
        error: error.message
      });
    }
  },

  /**
   * Obtener dashboard de transacciones
   * GET /api/transactions/dashboard
   */
  async getTransactionDashboard(req, res) {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // Obtener estadísticas para diferentes períodos
      const [todayStats, monthStats, suspiciousTransactions] = await Promise.all([
        TransactionModel.getTransactionStats('day', startOfDay, new Date()),
        TransactionModel.getTransactionStats('month', startOfMonth, new Date()),
        TransactionModel.getSuspiciousTransactions(10)
      ]);

      const dashboard = {
        today: {
          total_transactions: todayStats.total_transactions,
          total_amount: todayStats.total_amount,
          avg_amount: todayStats.avg_amount,
          unique_clients: todayStats.unique_clients,
          fraud_rate: todayStats.fraud_rate
        },
        month: {
          total_transactions: monthStats.total_transactions,
          total_amount: monthStats.total_amount,
          avg_amount: monthStats.avg_amount,
          unique_clients: monthStats.unique_clients,
          fraud_rate: monthStats.fraud_rate
        },
        channels: {
          online: monthStats.online_transactions,
          physical: monthStats.physical_transactions,
          atm: monthStats.atm_transactions
        },
        recent_suspicious: suspiciousTransactions
      };

      res.json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      logger.error('Error al obtener dashboard de transacciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener dashboard',
        error: error.message
      });
    }
  }
};

module.exports = TransactionController;