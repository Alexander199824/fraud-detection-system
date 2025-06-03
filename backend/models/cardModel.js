const { query, logger } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

/**
 * Modelo para gestión de tarjetas en el sistema de detección de fraude
 */
const CardModel = {
  /**
   * Crear una nueva tarjeta para un cliente
   * @param {Object} cardData - Datos de la tarjeta
   * @returns {Promise<Object>} - Tarjeta creada
   */
  async createCard(cardData) {
    try {
      const {
        clientId,
        cardNumber,
        cardType,
        bank,
        expiryDate,
        creditLimit = null,
        isActive = true
      } = cardData;

      const cardId = uuidv4();
      
      // Encriptar número de tarjeta (solo los últimos 4 dígitos visible)
      const hashedCardNumber = await bcrypt.hash(cardNumber, 10);
      const lastFourDigits = cardNumber.slice(-4);
      const maskedCardNumber = '**** **** **** ' + lastFourDigits;
      
      const queryText = `
        INSERT INTO cards (
          id, client_id, card_number_hash, card_number_masked, 
          last_four_digits, card_type, bank, expiry_date, 
          credit_limit, is_active, created_at, updated_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING id, client_id, card_number_masked, last_four_digits, 
                 card_type, bank, expiry_date, credit_limit, is_active, created_at;
      `;
      
      const result = await query(queryText, [
        cardId,
        clientId,
        hashedCardNumber,
        maskedCardNumber,
        lastFourDigits,
        cardType,
        bank,
        expiryDate,
        creditLimit,
        isActive
      ]);
      
      logger.info(`Tarjeta creada: ${cardId} - Cliente: ${clientId} - Últimos 4: ${lastFourDigits}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error al crear tarjeta:', error);
      throw error;
    }
  },

  /**
   * Obtener tarjetas de un cliente
   * @param {string} clientId - ID del cliente
   * @returns {Promise<Array>} - Lista de tarjetas
   */
  async getCardsByClientId(clientId) {
    try {
      const queryText = `
        SELECT 
          c.*,
          COUNT(t.id) as total_transactions,
          COALESCE(SUM(t.amount), 0) as total_spent,
          MAX(t.created_at) as last_transaction_date,
          COUNT(CASE WHEN fl.fraud_detected = true THEN 1 END) as fraud_incidents
        FROM cards c
        LEFT JOIN transactions t ON c.id = t.card_id
        LEFT JOIN fraud_logs fl ON t.id = fl.transaction_id
        WHERE c.client_id = $1
        GROUP BY c.id
        ORDER BY c.created_at DESC;
      `;
      
      const result = await query(queryText, [clientId]);
      return result.rows;
    } catch (error) {
      logger.error(`Error al obtener tarjetas del cliente ${clientId}:`, error);
      throw error;
    }
  },

  /**
   * Obtener tarjeta por ID
   * @param {string} cardId - ID de la tarjeta
   * @returns {Promise<Object>} - Datos de la tarjeta
   */
  async getCardById(cardId) {
    try {
      const queryText = `
        SELECT 
          c.*,
          cl.first_name,
          cl.last_name,
          cl.email,
          COUNT(t.id) as total_transactions,
          COALESCE(SUM(t.amount), 0) as total_spent,
          COALESCE(AVG(t.amount), 0) as avg_transaction_amount,
          MAX(t.created_at) as last_transaction_date
        FROM cards c
        INNER JOIN clients cl ON c.client_id = cl.id
        LEFT JOIN transactions t ON c.id = t.card_id
        WHERE c.id = $1
        GROUP BY c.id, cl.first_name, cl.last_name, cl.email;
      `;
      
      const result = await query(queryText, [cardId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error al obtener tarjeta ${cardId}:`, error);
      throw error;
    }
  },

  /**
   * Verificar si una tarjeta es válida para una transacción
   * @param {string} cardId - ID de la tarjeta
   * @param {number} amount - Monto de la transacción
   * @returns {Promise<Object>} - Resultado de validación
   */
  async validateCardForTransaction(cardId, amount) {
    try {
      const queryText = `
        SELECT 
          c.*,
          cl.risk_profile,
          -- Calcular uso actual del límite de crédito
          COALESCE(SUM(CASE 
            WHEN t.created_at >= DATE_TRUNC('month', NOW()) 
            THEN t.amount 
            ELSE 0 
          END), 0) as current_month_spent,
          
          -- Transacciones en las últimas 24 horas
          COUNT(CASE 
            WHEN t.created_at >= NOW() - INTERVAL '24 hours' 
            THEN 1 
          END) as transactions_last_24h,
          
          -- Suma de transacciones en las últimas 24 horas
          COALESCE(SUM(CASE 
            WHEN t.created_at >= NOW() - INTERVAL '24 hours' 
            THEN t.amount 
            ELSE 0 
          END), 0) as spent_last_24h
          
        FROM cards c
        INNER JOIN clients cl ON c.client_id = cl.id
        LEFT JOIN transactions t ON c.id = t.card_id
        WHERE c.id = $1
        GROUP BY c.id, cl.risk_profile;
      `;
      
      const result = await query(queryText, [cardId]);
      
      if (result.rows.length === 0) {
        return {
          valid: false,
          reason: 'Tarjeta no encontrada',
          risk_level: 'critical'
        };
      }
      
      const card = result.rows[0];
      
      // Validaciones
      const validations = [];
      
      // 1. Tarjeta activa
      if (!card.is_active) {
        return {
          valid: false,
          reason: 'Tarjeta inactiva',
          risk_level: 'critical'
        };
      }
      
      // 2. Tarjeta no expirada
      const now = new Date();
      const expiryDate = new Date(card.expiry_date);
      if (expiryDate < now) {
        return {
          valid: false,
          reason: 'Tarjeta expirada',
          risk_level: 'critical'
        };
      }
      
      // 3. Límite de crédito (si aplica)
      if (card.credit_limit && card.current_month_spent + amount > card.credit_limit) {
        return {
          valid: false,
          reason: 'Límite de crédito excedido',
          risk_level: 'high'
        };
      }
      
      // 4. Validaciones de riesgo
      let riskLevel = 'low';
      let riskFactors = [];
      
      // Muchas transacciones en 24h
      if (card.transactions_last_24h >= 10) {
        riskLevel = 'high';
        riskFactors.push('Muchas transacciones en 24 horas');
      }
      
      // Mucho gasto en 24h
      if (card.spent_last_24h >= 5000) {
        riskLevel = 'high';
        riskFactors.push('Alto gasto en 24 horas');
      }
      
      // Transacción muy grande
      if (amount >= 10000) {
        riskLevel = riskLevel === 'high' ? 'critical' : 'medium';
        riskFactors.push('Transacción de monto elevado');
      }
      
      // Cliente de alto riesgo
      if (card.risk_profile === 'high') {
        riskLevel = riskLevel === 'low' ? 'medium' : 'high';
        riskFactors.push('Cliente de perfil de alto riesgo');
      }
      
      return {
        valid: true,
        risk_level: riskLevel,
        risk_factors: riskFactors,
        card_info: {
          id: card.id,
          masked_number: card.card_number_masked,
          type: card.card_type,
          bank: card.bank,
          available_credit: card.credit_limit ? (card.credit_limit - card.current_month_spent) : null
        }
      };
      
    } catch (error) {
      logger.error(`Error al validar tarjeta ${cardId}:`, error);
      return {
        valid: false,
        reason: 'Error interno de validación',
        risk_level: 'critical'
      };
    }
  },

  /**
   * Obtener estadísticas de uso de la tarjeta
   * @param {string} cardId - ID de la tarjeta
   * @param {number} days - Días hacia atrás para analizar
   * @returns {Promise<Object>} - Estadísticas de uso
   */
  async getCardUsageStats(cardId, days = 30) {
    try {
      const queryText = `
        SELECT 
          -- Estadísticas generales
          COUNT(*) as total_transactions,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(AVG(amount), 0) as avg_amount,
          COALESCE(MAX(amount), 0) as max_amount,
          COALESCE(MIN(amount), 0) as min_amount,
          
          -- Por día de la semana
          COUNT(CASE WHEN EXTRACT(dow FROM created_at) = 0 THEN 1 END) as sunday_transactions,
          COUNT(CASE WHEN EXTRACT(dow FROM created_at) = 1 THEN 1 END) as monday_transactions,
          COUNT(CASE WHEN EXTRACT(dow FROM created_at) = 2 THEN 1 END) as tuesday_transactions,
          COUNT(CASE WHEN EXTRACT(dow FROM created_at) = 3 THEN 1 END) as wednesday_transactions,
          COUNT(CASE WHEN EXTRACT(dow FROM created_at) = 4 THEN 1 END) as thursday_transactions,
          COUNT(CASE WHEN EXTRACT(dow FROM created_at) = 5 THEN 1 END) as friday_transactions,
          COUNT(CASE WHEN EXTRACT(dow FROM created_at) = 6 THEN 1 END) as saturday_transactions,
          
          -- Por rango de hora
          COUNT(CASE WHEN EXTRACT(hour FROM created_at) BETWEEN 6 AND 12 THEN 1 END) as morning_transactions,
          COUNT(CASE WHEN EXTRACT(hour FROM created_at) BETWEEN 12 AND 18 THEN 1 END) as afternoon_transactions,
          COUNT(CASE WHEN EXTRACT(hour FROM created_at) BETWEEN 18 AND 24 THEN 1 END) as evening_transactions,
          COUNT(CASE WHEN EXTRACT(hour FROM created_at) BETWEEN 0 AND 6 THEN 1 END) as night_transactions,
          
          -- Tipos de establecimiento más usados
          COUNT(DISTINCT merchant_type) as unique_merchant_types,
          COUNT(DISTINCT location) as unique_locations,
          COUNT(DISTINCT country) as unique_countries,
          
          -- Canales
          COUNT(CASE WHEN channel = 'online' THEN 1 END) as online_transactions,
          COUNT(CASE WHEN channel = 'physical' THEN 1 END) as physical_transactions,
          COUNT(CASE WHEN channel = 'atm' THEN 1 END) as atm_transactions
          
        FROM transactions 
        WHERE card_id = $1 
        AND created_at >= NOW() - INTERVAL '${days} days';
      `;
      
      const result = await query(queryText, [cardId]);
      
      if (result.rows.length === 0) {
        return {
          has_data: false,
          message: 'No hay datos de transacciones para esta tarjeta'
        };
      }
      
      const stats = result.rows[0];
      
      // Calcular patrones adicionales
      stats.avg_transactions_per_day = parseFloat((stats.total_transactions / days).toFixed(2));
      stats.most_active_day = this.getMostActiveDay(stats);
      stats.most_active_time = this.getMostActiveTime(stats);
      stats.preferred_channel = this.getPreferredChannel(stats);
      
      return {
        has_data: true,
        period_days: days,
        ...stats
      };
      
    } catch (error) {
      logger.error(`Error al obtener estadísticas de uso de tarjeta ${cardId}:`, error);
      throw error;
    }
  },

  /**
   * Obtener día más activo
   * @param {Object} stats - Estadísticas de transacciones
   * @returns {string} - Día más activo
   */
  getMostActiveDay(stats) {
    const days = {
      'Domingo': stats.sunday_transactions,
      'Lunes': stats.monday_transactions,
      'Martes': stats.tuesday_transactions,
      'Miércoles': stats.wednesday_transactions,
      'Jueves': stats.thursday_transactions,
      'Viernes': stats.friday_transactions,
      'Sábado': stats.saturday_transactions
    };
    
    return Object.keys(days).reduce((a, b) => days[a] > days[b] ? a : b);
  },

  /**
   * Obtener horario más activo
   * @param {Object} stats - Estadísticas de transacciones
   * @returns {string} - Horario más activo
   */
  getMostActiveTime(stats) {
    const times = {
      'Mañana (6-12)': stats.morning_transactions,
      'Tarde (12-18)': stats.afternoon_transactions,
      'Noche (18-24)': stats.evening_transactions,
      'Madrugada (0-6)': stats.night_transactions
    };
    
    return Object.keys(times).reduce((a, b) => times[a] > times[b] ? a : b);
  },

  /**
   * Obtener canal preferido
   * @param {Object} stats - Estadísticas de transacciones
   * @returns {string} - Canal preferido
   */
  getPreferredChannel(stats) {
    const channels = {
      'Online': stats.online_transactions,
      'Físico': stats.physical_transactions,
      'ATM': stats.atm_transactions
    };
    
    return Object.keys(channels).reduce((a, b) => channels[a] > channels[b] ? a : b);
  },

  /**
   * Bloquear/desbloquear tarjeta
   * @param {string} cardId - ID de la tarjeta
   * @param {boolean} isActive - Estado activo/inactivo
   * @param {string} reason - Razón del bloqueo
   * @returns {Promise<Object>} - Tarjeta actualizada
   */
  async updateCardStatus(cardId, isActive, reason = null) {
    try {
      const queryText = `
        UPDATE cards 
        SET 
          is_active = $2, 
          blocked_reason = $3,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;
      
      const result = await query(queryText, [cardId, isActive, reason]);
      
      if (result.rows.length === 0) {
        throw new Error('Tarjeta no encontrada');
      }
      
      const action = isActive ? 'activada' : 'bloqueada';
      logger.info(`Tarjeta ${cardId} ${action}. Razón: ${reason || 'No especificada'}`);
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error al actualizar estado de tarjeta ${cardId}:`, error);
      throw error;
    }
  }
};

module.exports = CardModel;