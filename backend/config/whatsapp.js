const twilio = require('twilio');
const { logger } = require('./database');
require('dotenv').config();

// Configuración del cliente de Twilio para WhatsApp
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Configuración de WhatsApp para notificaciones de fraude
 */
const WhatsAppConfig = {
  // Inicializar configuración
  init() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      logger.warn('Credenciales de Twilio no configuradas - Notificaciones WhatsApp deshabilitadas');
      return false;
    }
    
    logger.info('Configuración de WhatsApp inicializada correctamente');
    return true;
  },

  // Enviar mensaje de alerta de fraude
  async sendFraudAlert(transactionData, fraudScore, analysisDetails) {
    try {
      if (!this.init()) {
        throw new Error('WhatsApp no configurado');
      }

      const message = this.formatFraudMessage(transactionData, fraudScore, analysisDetails);
      
      const result = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: process.env.ADMIN_WHATSAPP_NUMBER,
        body: message
      });

      logger.info('Alerta de fraude enviada por WhatsApp', {
        messageSid: result.sid,
        transactionId: transactionData.id,
        fraudScore
      });

      return {
        success: true,
        messageSid: result.sid,
        message: 'Alerta enviada correctamente'
      };

    } catch (error) {
      logger.error('Error al enviar alerta de fraude por WhatsApp:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Formatear mensaje de alerta
  formatFraudMessage(transaction, fraudScore, analysis) {
    const riskLevel = this.getRiskLevel(fraudScore);
    
    return `🚨 *ALERTA DE FRAUDE DETECTADO* 🚨

⚠️ *Nivel de Riesgo: ${riskLevel}*
📊 *Puntuación: ${(fraudScore * 100).toFixed(1)}%*

💳 *Detalles de la Transacción:*
• ID: ${transaction.id}
• Cliente: ${transaction.client_name}
• Monto: $${transaction.amount}
• Ubicación: ${transaction.location}
• Fecha: ${new Date(transaction.timestamp).toLocaleString()}
• Establecimiento: ${transaction.merchant_type}

🧠 *Análisis de IA:*
• Capa 1: ${analysis.layer1_results?.anomalies || 'N/A'} anomalías
• Capa 2: ${analysis.layer2_results?.risk_factors || 'N/A'} factores de riesgo
• Capa 3: ${analysis.layer3_results?.warnings || 'N/A'} alertas

🎯 *Razones principales:*
${this.formatReasons(analysis.primary_reasons)}

⏰ Detectado: ${new Date().toLocaleString()}
🤖 Sistema: Red Neuronal Modular v1.0`;
  },

  // Obtener nivel de riesgo basado en puntuación
  getRiskLevel(score) {
    if (score >= 0.9) return 'CRÍTICO 🔴';
    if (score >= 0.7) return 'ALTO 🟠';
    if (score >= 0.5) return 'MEDIO 🟡';
    return 'BAJO 🟢';
  },

  // Formatear razones principales
  formatReasons(reasons) {
    if (!reasons || reasons.length === 0) {
      return '• Patrones anómalos detectados';
    }
    
    return reasons.slice(0, 3).map(reason => `• ${reason}`).join('\n');
  },

  // Enviar notificación de sistema
  async sendSystemNotification(message, priority = 'normal') {
    try {
      if (!this.init()) {
        return { success: false, error: 'WhatsApp no configurado' };
      }

      const formattedMessage = `🤖 *Sistema de Detección de Fraude*

${priority === 'high' ? '⚠️ PRIORIDAD ALTA ⚠️' : 'ℹ️ Información'}

${message}

⏰ ${new Date().toLocaleString()}`;

      const result = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: process.env.ADMIN_WHATSAPP_NUMBER,
        body: formattedMessage
      });

      return {
        success: true,
        messageSid: result.sid
      };

    } catch (error) {
      logger.error('Error al enviar notificación del sistema:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Validar configuración
  async validateConfig() {
    try {
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        return { valid: false, error: 'Credenciales faltantes' };
      }

      // Verificar que las credenciales sean válidas
      const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      
      return {
        valid: true,
        accountSid: account.sid,
        status: account.status
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
};

module.exports = WhatsAppConfig;