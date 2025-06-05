const FraudModel = require('../models/fraudModel');
const TransactionModel = require('../models/transactionModel');
const NetworkManager = require('../neural-networks/networkManager');
const WhatsAppConfig = require('../config/whatsapp');
const { logger } = require('../config');

// Instancia única del administrador de redes neuronales
const networkManager = new NetworkManager();

/**
 * Controlador para análisis y gestión de fraude
 */
const FraudController = {
  /**
   * Analizar transacción para detectar fraude
   * POST /api/fraud/analyze/:transactionId
   */
  async analyzeTransaction(req, res) {
    try {
      const transactionId = req.params.transactionId;
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          message: 'ID de transacción requerido'
        });
      }

      // Obtener datos de la transacción para análisis
      const transactionData = await TransactionModel.getTransactionForFraudAnalysis(transactionId);
      
      if (!transactionData) {
        return res.status(404).json({
          success: false,
          message: 'Transacción no encontrada'
        });
      }

      // Ejecutar análisis completo con redes neuronales modulares
      const analysisResult = await networkManager.analyzeTransaction(transactionData);

      // Registrar resultado del análisis
      const fraudLog = await FraudModel.logFraudAnalysis({
        transactionId: transactionId,
        fraudScore: analysisResult.fraud_score,
        fraudDetected: analysisResult.fraud_detected,
        analysisDetails: {
          risk_level: analysisResult.risk_level,
          primary_reasons: analysisResult.primary_reasons,
          processing_time_ms: analysisResult.processing_time_ms
        },
        layer1Results: analysisResult.layer1_results,
        layer2Results: analysisResult.layer2_results,
        layer3Results: analysisResult.layer3_results,
        finalDecision: analysisResult.final_decision,
        processingTimeMs: analysisResult.processing_time_ms,
        networkVersions: analysisResult.network_versions
      });

      // Enviar notificación por WhatsApp si se detecta fraude
      if (analysisResult.fraud_detected && analysisResult.fraud_score >= 0.7) {
        await WhatsAppConfig.sendFraudAlert(
          transactionData,
          analysisResult.fraud_score,
          analysisResult
        );
      }

      res.json({
        success: true,
        message: analysisResult.fraud_detected ? 'Fraude detectado' : 'Transacción segura',
        data: {
          transaction_id: transactionId,
          fraud_detected: analysisResult.fraud_detected,
          fraud_score: analysisResult.fraud_score,
          risk_level: analysisResult.risk_level,
          confidence: analysisResult.final_decision.confidence,
          primary_reasons: analysisResult.primary_reasons,
          recommended_actions: analysisResult.final_decision.recommended_actions,
          analysis_id: fraudLog.id,
          processing_time_ms: analysisResult.processing_time_ms
        }
      });

    } catch (error) {
      logger.error(`Error al analizar transacción ${req.params.transactionId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al analizar transacción',
        error: error.message
      });
    }
  },

  /**
   * Obtener análisis de fraude por transacción
   * GET /api/fraud/analysis/:transactionId
   */
  async getFraudAnalysis(req, res) {
    try {
      const transactionId = req.params.transactionId;
      
      const analysis = await FraudModel.getFraudAnalysisByTransaction(transactionId);
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'No se encontró análisis de fraude para esta transacción'
        });
      }

      res.json({
        success: true,
        data: analysis
      });

    } catch (error) {
      logger.error(`Error al obtener análisis de fraude para transacción ${req.params.transactionId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener análisis de fraude',
        error: error.message
      });
    }
  },

  /**
   * Obtener estadísticas generales de fraude
   * GET /api/fraud/stats
   */
  async getFraudStats(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        minScore: req.query.minScore ? parseFloat(req.query.minScore) : undefined
      };

      const stats = await FraudModel.getFraudStats(filters);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error al obtener estadísticas de fraude:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message
      });
    }
  },

  /**
   * Obtener principales razones de fraude
   * GET /api/fraud/top-reasons
   */
  async getTopFraudReasons(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      const reasons = await FraudModel.getTopFraudReasons(limit);

      res.json({
        success: true,
        count: reasons.length,
        data: reasons
      });

    } catch (error) {
      logger.error('Error al obtener top razones de fraude:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener razones de fraude',
        error: error.message
      });
    }
  },

  /**
   * Obtener rendimiento de las redes neuronales
   * GET /api/fraud/network-performance
   */
  async getNetworkPerformance(req, res) {
    try {
      const performance = await FraudModel.getNetworkLayerPerformance();
      const networkStats = networkManager.getStats();

      res.json({
        success: true,
        data: {
          database_metrics: performance,
          current_network_stats: networkStats
        }
      });

    } catch (error) {
      logger.error('Error al obtener rendimiento de redes neuronales:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener rendimiento',
        error: error.message
      });
    }
  },

  /**
   * Obtener alertas de fraude recientes
   * GET /api/fraud/recent-alerts
   */
  async getRecentFraudAlerts(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      
      const alerts = await FraudModel.getRecentFraudAlerts(limit);

      res.json({
        success: true,
        count: alerts.length,
        data: alerts
      });

    } catch (error) {
      logger.error('Error al obtener alertas recientes de fraude:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener alertas',
        error: error.message
      });
    }
  },

  /**
   * Obtener tendencias de fraude
   * GET /api/fraud/trends
   */
  async getFraudTrends(req, res) {
    try {
      const period = req.query.period || 'day'; // hour, day, week, month
      const periods = parseInt(req.query.periods) || 30;
      
      const trends = await FraudModel.getFraudTrends(period, periods);

      res.json({
        success: true,
        period: period,
        count: trends.length,
        data: trends
      });

    } catch (error) {
      logger.error('Error al obtener tendencias de fraude:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener tendencias',
        error: error.message
      });
    }
  },

  /**
   * Actualizar análisis de fraude (feedback)
   * PUT /api/fraud/analysis/:fraudLogId
   */
  async updateFraudAnalysis(req, res) {
    try {
      const fraudLogId = req.params.fraudLogId;
      const updates = {
        fraudDetected: req.body.fraudDetected,
        humanReviewed: true,
        reviewerNotes: req.body.reviewerNotes,
        correctedScore: req.body.correctedScore
      };

      const updatedAnalysis = await FraudModel.updateFraudAnalysis(fraudLogId, updates);

      res.json({
        success: true,
        message: 'Análisis actualizado con feedback',
        data: updatedAnalysis
      });

    } catch (error) {
      logger.error(`Error al actualizar análisis de fraude ${req.params.fraudLogId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar análisis',
        error: error.message
      });
    }
  },

  /**
   * Obtener métricas de precisión del modelo
   * GET /api/fraud/model-accuracy
   */
  async getModelAccuracy(req, res) {
    try {
      const metrics = await FraudModel.getModelAccuracyMetrics();

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Error al obtener métricas de precisión:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener métricas',
        error: error.message
      });
    }
  },

  /**
   * Entrenar redes neuronales con datos históricos
   * POST /api/fraud/train
   */
  async trainNetworks(req, res) {
    try {
      // Este endpoint debe estar protegido y solo accesible por administradores
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para entrenar modelos'
        });
      }

      // Obtener datos de entrenamiento (implementar según necesidades)
      const trainingData = req.body.trainingData || [];
      
      if (trainingData.length < 100) {
        return res.status(400).json({
          success: false,
          message: 'Se requieren al menos 100 muestras para entrenamiento'
        });
      }

      // Entrenar todas las redes
      const trainingResult = await networkManager.trainAllNetworks(trainingData);

      res.json({
        success: true,
        message: 'Entrenamiento completado',
        data: trainingResult
      });

    } catch (error) {
      logger.error('Error al entrenar redes neuronales:', error);
      res.status(500).json({
        success: false,
        message: 'Error al entrenar modelos',
        error: error.message
      });
    }
  },

  /**
   * Obtener dashboard de fraude
   * GET /api/fraud/dashboard
   */
  async getFraudDashboard(req, res) {
    try {
      // Obtener múltiples métricas para el dashboard
      const [stats, recentAlerts, topReasons, trends, accuracy] = await Promise.all([
        FraudModel.getFraudStats(),
        FraudModel.getRecentFraudAlerts(5),
        FraudModel.getTopFraudReasons(5),
        FraudModel.getFraudTrends('day', 7),
        FraudModel.getModelAccuracyMetrics()
      ]);

      const dashboard = {
        overview: {
          total_analyses: stats.total_analyses,
          fraud_detection_rate: stats.fraud_detection_rate,
          avg_fraud_score: stats.avg_fraud_score,
          avg_processing_time: stats.avg_processing_time
        },
        risk_distribution: stats.risk_distribution,
        recent_alerts: recentAlerts,
        top_fraud_reasons: topReasons,
        weekly_trends: trends,
        model_accuracy: accuracy
      };

      res.json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      logger.error('Error al obtener dashboard de fraude:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener dashboard',
        error: error.message
      });
    }
  },

  /**
   * Enviar prueba de notificación WhatsApp
   * POST /api/fraud/test-notification
   */
  async testWhatsAppNotification(req, res) {
    try {
      // Solo para administradores
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado'
        });
      }

      const result = await WhatsAppConfig.sendSystemNotification(
        'Prueba de notificación del sistema de detección de fraude',
        'high'
      );

      res.json({
        success: result.success,
        message: result.success ? 'Notificación enviada' : 'Error al enviar notificación',
        data: result
      });

    } catch (error) {
      logger.error('Error al enviar notificación de prueba:', error);
      res.status(500).json({
        success: false,
        message: 'Error al enviar notificación',
        error: error.message
      });
    }
  }
};

module.exports = FraudController;