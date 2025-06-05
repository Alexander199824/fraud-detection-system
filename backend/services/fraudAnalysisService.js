const NetworkManager = require('../neural-networks/networkManager');
const TransactionModel = require('../models/transactionModel');
const FraudModel = require('../models/fraudModel');
const WhatsAppService = require('./whatsappService');
const { logger } = require('../config');

/**
 * Servicio principal de análisis de fraude
 * Coordina el análisis con las redes neuronales y gestiona las notificaciones
 */
class FraudAnalysisService {
  constructor() {
    this.networkManager = new NetworkManager();
    this.analysisQueue = [];
    this.isProcessing = false;
    
    // Configuración de análisis
    this.config = {
      batchSize: 10,
      notificationThreshold: 0.7,
      criticalThreshold: 0.9,
      autoBlockThreshold: 0.95
    };
  }

  /**
   * Analizar transacción individual
   * @param {string} transactionId - ID de la transacción
   * @returns {Promise<Object>} - Resultado del análisis
   */
  async analyzeTransaction(transactionId) {
    try {
      logger.info(`Iniciando análisis de fraude para transacción: ${transactionId}`);
      
      // Obtener datos de la transacción
      const transactionData = await TransactionModel.getTransactionForFraudAnalysis(transactionId);
      
      if (!transactionData) {
        throw new Error('Transacción no encontrada');
      }

      // Ejecutar análisis con redes neuronales
      const analysisResult = await this.networkManager.analyzeTransaction(transactionData);

      // Guardar resultado en base de datos
      const fraudLog = await this.saveFraudAnalysis(transactionId, analysisResult);

      // Procesar acciones basadas en el resultado
      await this.processAnalysisResult(transactionData, analysisResult);

      return {
        success: true,
        analysisId: fraudLog.id,
        result: analysisResult
      };

    } catch (error) {
      logger.error(`Error en análisis de fraude para transacción ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Analizar múltiples transacciones en lote
   * @param {Array<string>} transactionIds - IDs de transacciones
   * @returns {Promise<Array>} - Resultados del análisis
   */
  async analyzeTransactionBatch(transactionIds) {
    try {
      logger.info(`Iniciando análisis en lote de ${transactionIds.length} transacciones`);
      
      const results = await Promise.all(
        transactionIds.map(async (transactionId) => {
          try {
            return await this.analyzeTransaction(transactionId);
          } catch (error) {
            logger.error(`Error analizando transacción ${transactionId}:`, error);
            return {
              success: false,
              transactionId,
              error: error.message
            };
          }
        })
      );

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      logger.info(`Análisis en lote completado: ${successful} exitosos, ${failed} fallidos`);

      return results;

    } catch (error) {
      logger.error('Error en análisis en lote:', error);
      throw error;
    }
  }

  /**
   * Guardar resultado del análisis
   * @param {string} transactionId - ID de la transacción
   * @param {Object} analysisResult - Resultado del análisis
   * @returns {Promise<Object>} - Log guardado
   */
  async saveFraudAnalysis(transactionId, analysisResult) {
    try {
      return await FraudModel.logFraudAnalysis({
        transactionId: transactionId,
        fraudScore: analysisResult.fraud_score,
        fraudDetected: analysisResult.fraud_detected,
        analysisDetails: {
          risk_level: analysisResult.risk_level,
          primary_reasons: analysisResult.primary_reasons,
          confidence: analysisResult.final_decision.confidence,
          processing_time_ms: analysisResult.processing_time_ms
        },
        layer1Results: analysisResult.layer1_results,
        layer2Results: analysisResult.layer2_results,
        layer3Results: analysisResult.layer3_results,
        finalDecision: analysisResult.final_decision,
        processingTimeMs: analysisResult.processing_time_ms,
        networkVersions: analysisResult.network_versions
      });
    } catch (error) {
      logger.error('Error al guardar análisis de fraude:', error);
      throw error;
    }
  }

  /**
   * Procesar acciones basadas en el resultado del análisis
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} analysisResult - Resultado del análisis
   */
  async processAnalysisResult(transactionData, analysisResult) {
    try {
      const fraudScore = analysisResult.fraud_score;
      const actions = [];

      // Notificación por WhatsApp si supera el umbral
      if (fraudScore >= this.config.notificationThreshold) {
        actions.push(
          WhatsAppService.sendFraudAlert(transactionData, analysisResult)
            .catch(error => logger.error('Error enviando alerta WhatsApp:', error))
        );
      }

      // Bloqueo automático si es crítico
      if (fraudScore >= this.config.autoBlockThreshold) {
        actions.push(
          this.autoBlockCard(transactionData.card_id, analysisResult)
            .catch(error => logger.error('Error en bloqueo automático:', error))
        );
      }

      // Notificación adicional para casos críticos
      if (fraudScore >= this.config.criticalThreshold) {
        actions.push(
          this.notifyCriticalCase(transactionData, analysisResult)
            .catch(error => logger.error('Error en notificación crítica:', error))
        );
      }

      // Ejecutar todas las acciones en paralelo
      await Promise.all(actions);

    } catch (error) {
      logger.error('Error procesando acciones post-análisis:', error);
    }
  }

  /**
   * Bloquear tarjeta automáticamente
   * @param {string} cardId - ID de la tarjeta
   * @param {Object} analysisResult - Resultado del análisis
   */
  async autoBlockCard(cardId, analysisResult) {
    try {
      const CardModel = require('../models/cardModel');
      
      await CardModel.updateCardStatus(
        cardId, 
        false, 
        `Bloqueada automáticamente por fraude detectado. Score: ${analysisResult.fraud_score.toFixed(2)}`
      );

      logger.info(`Tarjeta ${cardId} bloqueada automáticamente por alto riesgo de fraude`);

    } catch (error) {
      logger.error(`Error al bloquear tarjeta ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Notificar caso crítico
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} analysisResult - Resultado del análisis
   */
  async notifyCriticalCase(transactionData, analysisResult) {
    const message = `
🚨 CASO CRÍTICO DE FRAUDE 🚨

Transacción: ${transactionData.id}
Cliente: ${transactionData.client_name}
Monto: $${transactionData.amount}
Score: ${(analysisResult.fraud_score * 100).toFixed(1)}%
Nivel: ${analysisResult.risk_level}

Razones principales:
${analysisResult.primary_reasons.map(r => `• ${r}`).join('\n')}

⚠️ REQUIERE ATENCIÓN INMEDIATA
    `;

    await WhatsAppService.sendHighPriorityAlert(message);
  }

  /**
   * Obtener estadísticas de rendimiento del servicio
   * @returns {Promise<Object>} - Estadísticas
   */
  async getPerformanceStats() {
    try {
      const [fraudStats, networkStats, accuracy] = await Promise.all([
        FraudModel.getFraudStats(),
        FraudModel.getNetworkLayerPerformance(),
        FraudModel.getModelAccuracyMetrics()
      ]);

      return {
        service: {
          version: '1.0.0',
          uptime: process.uptime(),
          queue_size: this.analysisQueue.length,
          is_processing: this.isProcessing
        },
        analysis: fraudStats,
        network_performance: networkStats,
        accuracy: accuracy,
        thresholds: this.config
      };

    } catch (error) {
      logger.error('Error obteniendo estadísticas de rendimiento:', error);
      throw error;
    }
  }

  /**
   * Re-analizar transacciones históricas
   * @param {Object} criteria - Criterios de búsqueda
   * @returns {Promise<Object>} - Resultado del re-análisis
   */
  async reanalyzeHistoricalTransactions(criteria) {
    try {
      logger.info('Iniciando re-análisis de transacciones históricas');

      // Buscar transacciones según criterios
      const transactions = await TransactionModel.searchTransactions(criteria);
      
      if (transactions.length === 0) {
        return {
          success: true,
          message: 'No se encontraron transacciones para re-analizar',
          count: 0
        };
      }

      // Re-analizar en lotes
      const batchSize = this.config.batchSize;
      const results = [];

      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        const batchIds = batch.map(t => t.id);
        
        const batchResults = await this.analyzeTransactionBatch(batchIds);
        results.push(...batchResults);
        
        // Pequeña pausa entre lotes para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const successful = results.filter(r => r.success).length;

      return {
        success: true,
        message: `Re-análisis completado`,
        total: transactions.length,
        successful: successful,
        failed: transactions.length - successful,
        results: results
      };

    } catch (error) {
      logger.error('Error en re-análisis histórico:', error);
      throw error;
    }
  }

  /**
   * Obtener análisis en tiempo real (streaming)
   * @param {Function} callback - Función callback para cada análisis
   */
  startRealtimeAnalysis(callback) {
    logger.info('Iniciando análisis en tiempo real');
    
    // Aquí podrías implementar una conexión con un sistema de colas
    // como RabbitMQ o Redis para procesar transacciones en tiempo real
    
    this.realtimeInterval = setInterval(async () => {
      if (this.analysisQueue.length > 0 && !this.isProcessing) {
        this.isProcessing = true;
        
        const transactionId = this.analysisQueue.shift();
        
        try {
          const result = await this.analyzeTransaction(transactionId);
          callback(null, result);
        } catch (error) {
          callback(error, null);
        }
        
        this.isProcessing = false;
      }
    }, 1000); // Verificar cada segundo
  }

  /**
   * Detener análisis en tiempo real
   */
  stopRealtimeAnalysis() {
    if (this.realtimeInterval) {
      clearInterval(this.realtimeInterval);
      this.realtimeInterval = null;
      logger.info('Análisis en tiempo real detenido');
    }
  }

  /**
   * Agregar transacción a la cola de análisis
   * @param {string} transactionId - ID de la transacción
   */
  queueTransaction(transactionId) {
    this.analysisQueue.push(transactionId);
    logger.debug(`Transacción ${transactionId} agregada a la cola. Total en cola: ${this.analysisQueue.length}`);
  }

  /**
   * Validar salud del servicio
   * @returns {Object} - Estado de salud
   */
  async healthCheck() {
    try {
      // Verificar conexión a base de datos
      const dbHealth = await FraudModel.getFraudStats({ limit: 1 });
      
      // Verificar redes neuronales
      const networkHealth = this.networkManager.getStats();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          database: dbHealth.has_data !== undefined ? 'ok' : 'error',
          neural_networks: networkHealth.networks_loaded ? 'ok' : 'error',
          queue: this.analysisQueue.length < 100 ? 'ok' : 'warning',
          processing: !this.isProcessing ? 'idle' : 'busy'
        }
      };

    } catch (error) {
      logger.error('Error en health check:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Limpiar recursos
   */
  cleanup() {
    this.stopRealtimeAnalysis();
    this.analysisQueue = [];
    logger.info('Servicio de análisis de fraude limpiado');
  }
}

// Exportar instancia única del servicio
module.exports = new FraudAnalysisService();