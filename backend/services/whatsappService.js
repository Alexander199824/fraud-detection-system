const WhatsAppConfig = require('../config/whatsapp');
const { logger } = require('../config');

/**
 * Servicio de notificaciones por WhatsApp
 * Gestiona el envío de alertas y notificaciones del sistema
 */
class WhatsAppService {
  constructor() {
    this.messageQueue = [];
    this.isProcessing = false;
    this.rateLimits = {
      messagesPerMinute: 10,
      messagesPerHour: 100,
      messagesSent: []
    };
  }

  /**
   * Enviar alerta de fraude
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} analysisResult - Resultado del análisis
   * @returns {Promise<Object>} - Resultado del envío
   */
  async sendFraudAlert(transactionData, analysisResult) {
    try {
      // Verificar límites de tasa
      if (!this.checkRateLimit()) {
        logger.warn('Límite de tasa alcanzado para mensajes de WhatsApp');
        return {
          success: false,
          message: 'Límite de mensajes alcanzado'
        };
      }

      // Formatear mensaje de alerta
      const message = this.formatFraudAlertMessage(transactionData, analysisResult);
      
      // Enviar usando la configuración de WhatsApp
      const result = await WhatsAppConfig.sendFraudAlert(
        transactionData,
        analysisResult.fraud_score,
        analysisResult
      );

      // Registrar en límites de tasa
      if (result.success) {
        this.recordMessageSent();
      }

      return result;

    } catch (error) {
      logger.error('Error al enviar alerta de fraude por WhatsApp:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enviar alerta de alta prioridad
   * @param {string} message - Mensaje a enviar
   * @returns {Promise<Object>} - Resultado del envío
   */
  async sendHighPriorityAlert(message) {
    try {
      // Las alertas de alta prioridad bypasean los límites de tasa
      return await WhatsAppConfig.sendSystemNotification(message, 'high');
    } catch (error) {
      logger.error('Error al enviar alerta de alta prioridad:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enviar resumen diario de fraudes
   * @param {Date} date - Fecha del resumen
   * @returns {Promise<Object>} - Resultado del envío
   */
  async sendDailySummary(date = new Date()) {
    try {
      const FraudModel = require('../models/fraudModel');
      
      // Obtener estadísticas del día
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const stats = await FraudModel.getFraudStats({
        startDate: startOfDay,
        endDate: endOfDay
      });

      const recentAlerts = await FraudModel.getRecentFraudAlerts(5);

      // Formatear mensaje de resumen
      const message = this.formatDailySummaryMessage(stats, recentAlerts, date);

      // Enviar notificación
      return await WhatsAppConfig.sendSystemNotification(message, 'normal');

    } catch (error) {
      logger.error('Error al enviar resumen diario:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enviar alerta de sistema
   * @param {string} type - Tipo de alerta
   * @param {Object} details - Detalles de la alerta
   * @returns {Promise<Object>} - Resultado del envío
   */
  async sendSystemAlert(type, details) {
    try {
      const messages = {
        'system_error': `⚠️ ERROR DEL SISTEMA\n\n${details.message}\n\nHora: ${new Date().toLocaleString()}`,
        'high_load': `📊 CARGA ALTA DETECTADA\n\nTransacciones en cola: ${details.queueSize}\nTiempo promedio: ${details.avgTime}ms`,
        'maintenance': `🔧 MANTENIMIENTO PROGRAMADO\n\n${details.message}\n\nInicio: ${details.startTime}`,
        'security': `🔒 ALERTA DE SEGURIDAD\n\n${details.message}\n\nAcción requerida: ${details.action}`
      };

      const message = messages[type] || `📢 ALERTA: ${type}\n\n${JSON.stringify(details, null, 2)}`;
      
      return await WhatsAppConfig.sendSystemNotification(message, 'high');

    } catch (error) {
      logger.error('Error al enviar alerta de sistema:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Formatear mensaje de alerta de fraude
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} analysisResult - Resultado del análisis
   * @returns {string} - Mensaje formateado
   */
  formatFraudAlertMessage(transactionData, analysisResult) {
    const riskLevel = this.getRiskLevelEmoji(analysisResult.risk_level);
    const scorePercentage = (analysisResult.fraud_score * 100).toFixed(1);
    
    return `
🚨 *ALERTA DE FRAUDE DETECTADO* 🚨

${riskLevel} *Nivel de Riesgo: ${analysisResult.risk_level.toUpperCase()}*
📊 *Puntuación: ${scorePercentage}%*
🎯 *Confianza: ${(analysisResult.final_decision.confidence * 100).toFixed(0)}%*

💳 *Detalles de la Transacción:*
• ID: ${transactionData.id}
• Cliente: ${transactionData.client_name}
• Monto: $${transactionData.amount.toFixed(2)}
• Comercio: ${transactionData.merchant_name}
• Ubicación: ${transactionData.location}
• Canal: ${transactionData.channel}
• Fecha: ${new Date(transactionData.created_at).toLocaleString()}

🧠 *Análisis de IA:*
${this.formatLayerResults(analysisResult)}

🎯 *Razones principales:*
${analysisResult.primary_reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

📋 *Acciones recomendadas:*
${analysisResult.final_decision.recommended_actions.map(a => `• ${a}`).join('\n')}

⏱️ Tiempo de análisis: ${analysisResult.processing_time_ms}ms
🤖 Sistema: Red Neuronal Modular v1.0
    `.trim();
  }

  /**
   * Formatear resultados por capas
   * @param {Object} analysisResult - Resultado del análisis
   * @returns {string} - Resultados formateados
   */
  formatLayerResults(analysisResult) {
    const l1 = analysisResult.layer1_results;
    const l2 = analysisResult.layer2_results;
    const l3 = analysisResult.layer3_results;
    
    return `
• Capa 1: ${l1.anomalies} anomalías detectadas
• Capa 2: ${l2.risk_factors?.length || 0} factores de riesgo
• Capa 3: ${l3.warnings?.length || 0} advertencias críticas
    `.trim();
  }

  /**
   * Formatear mensaje de resumen diario
   * @param {Object} stats - Estadísticas del día
   * @param {Array} recentAlerts - Alertas recientes
   * @param {Date} date - Fecha del resumen
   * @returns {string} - Mensaje formateado
   */
  formatDailySummaryMessage(stats, recentAlerts, date) {
    const dateStr = date.toLocaleDateString();
    
    return `
📊 *RESUMEN DIARIO DE FRAUDE*
📅 *Fecha: ${dateStr}*

📈 *Estadísticas Generales:*
• Total análisis: ${stats.total_analyses}
• Fraudes detectados: ${stats.fraud_detected_count}
• Tasa de detección: ${stats.fraud_detection_rate?.toFixed(1)}%
• Score promedio: ${(stats.avg_fraud_score * 100).toFixed(1)}%
• Tiempo promedio: ${stats.avg_processing_time?.toFixed(0)}ms

🎯 *Distribución de Riesgo:*
• Crítico: ${stats.critical_risk_count} (${stats.risk_distribution?.critical?.toFixed(1)}%)
• Alto: ${stats.high_risk_count} (${stats.risk_distribution?.high?.toFixed(1)}%)
• Medio: ${stats.medium_risk_count} (${stats.risk_distribution?.medium?.toFixed(1)}%)
• Bajo: ${stats.low_risk_count} (${stats.risk_distribution?.low?.toFixed(1)}%)

🚨 *Alertas Recientes:*
${this.formatRecentAlerts(recentAlerts)}

💡 *Recomendaciones:*
${this.generateDailyRecommendations(stats)}

🤖 Sistema de Detección de Fraude v1.0
    `.trim();
  }

  /**
   * Formatear alertas recientes
   * @param {Array} alerts - Lista de alertas
   * @returns {string} - Alertas formateadas
   */
  formatRecentAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
      return '• No hay alertas recientes';
    }

    return alerts.slice(0, 3).map(alert => 
      `• ${alert.client_first_name} ${alert.client_last_name} - $${alert.amount} - ${(alert.fraud_score * 100).toFixed(0)}%`
    ).join('\n');
  }

  /**
   * Generar recomendaciones diarias
   * @param {Object} stats - Estadísticas
   * @returns {string} - Recomendaciones
   */
  generateDailyRecommendations(stats) {
    const recommendations = [];
    
    if (stats.fraud_detection_rate > 10) {
      recommendations.push('• Alta tasa de fraude detectada - revisar patrones');
    }
    
    if (stats.critical_risk_count > 5) {
      recommendations.push('• Múltiples casos críticos - activar protocolo de emergencia');
    }
    
    if (stats.avg_processing_time > 1000) {
      recommendations.push('• Tiempo de procesamiento alto - optimizar sistema');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('• Operación normal - mantener vigilancia');
    }
    
    return recommendations.join('\n');
  }

  /**
   * Obtener emoji de nivel de riesgo
   * @param {string} riskLevel - Nivel de riesgo
   * @returns {string} - Emoji correspondiente
   */
  getRiskLevelEmoji(riskLevel) {
    const emojis = {
      'critical': '🔴',
      'high': '🟠',
      'medium': '🟡',
      'low': '🟢',
      'minimal': '⚪'
    };
    
    return emojis[riskLevel] || '⚫';
  }

  /**
   * Verificar límite de tasa
   * @returns {boolean} - Si se puede enviar mensaje
   */
  checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    
    // Limpiar mensajes antiguos
    this.rateLimits.messagesSent = this.rateLimits.messagesSent.filter(
      timestamp => timestamp > oneHourAgo
    );
    
    // Verificar límites
    const messagesLastMinute = this.rateLimits.messagesSent.filter(
      timestamp => timestamp > oneMinuteAgo
    ).length;
    
    const messagesLastHour = this.rateLimits.messagesSent.length;
    
    return messagesLastMinute < this.rateLimits.messagesPerMinute &&
           messagesLastHour < this.rateLimits.messagesPerHour;
  }

  /**
   * Registrar mensaje enviado
   */
  recordMessageSent() {
    this.rateLimits.messagesSent.push(Date.now());
  }

  /**
   * Procesar cola de mensajes
   */
  async processMessageQueue() {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.messageQueue.length > 0 && this.checkRateLimit()) {
        const message = this.messageQueue.shift();
        
        await WhatsAppConfig.sendSystemNotification(
          message.content,
          message.priority
        );
        
        this.recordMessageSent();
        
        // Esperar un poco entre mensajes
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error('Error procesando cola de mensajes:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Agregar mensaje a la cola
   * @param {string} content - Contenido del mensaje
   * @param {string} priority - Prioridad del mensaje
   */
  queueMessage(content, priority = 'normal') {
    this.messageQueue.push({ content, priority, timestamp: Date.now() });
    
    // Procesar cola automáticamente
    this.processMessageQueue();
  }

  /**
   * Obtener estadísticas del servicio
   * @returns {Object} - Estadísticas
   */
  getStats() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    
    return {
      queue_size: this.messageQueue.length,
      is_processing: this.isProcessing,
      rate_limits: {
        per_minute: {
          used: this.rateLimits.messagesSent.filter(t => t > oneMinuteAgo).length,
          limit: this.rateLimits.messagesPerMinute
        },
        per_hour: {
          used: this.rateLimits.messagesSent.filter(t => t > oneHourAgo).length,
          limit: this.rateLimits.messagesPerHour
        }
      }
    };
  }
}

// Exportar instancia única del servicio
module.exports = new WhatsAppService();