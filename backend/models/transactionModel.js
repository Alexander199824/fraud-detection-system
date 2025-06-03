const { query, logger } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Modelo para gestión de transacciones en el sistema de detección de fraude
 */
const TransactionModel = {
  /**
   * Crear una nueva transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Promise<Object>} - Transacción creada
   */
  async createTransaction(transactionData) {
    try {
      const {
        clientId,
        cardId,
        amount,
        merchantName,
        merchantType,
        location,
        latitude,
        longitude,
        country,
        channel, // 'online', 'physical', 'atm'
        deviceInfo = null,
        ipAddress = null,
        description = null
      } = transactionData;

      const transactionId = uuidv4();
      
      const queryText = `
        INSERT INTO transactions (
          id, client_id, card_id, amount, merchant_name, merchant_type,
          location, latitude, longitude, country, channel, device_info,
          ip_address, description, created_at, updated_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        RETURNING *;
      `;
      
      const result = await query(queryText, [
        transactionId,
        clientId,
        cardId,
        amount,
        merchantName,
        merchantType,
        location,
        latitude,
        longitude,
        country,
        channel,
        deviceInfo,
        ipAddress,
        description
      ]);
      
      logger.info(`Transacción creada: ${transactionId} - Monto: $${amount} - Cliente: ${clientId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error al crear transacción:', error);
      throw error;
    }
  },

  /**
   * Obtener transacción por ID con datos completos
   * @param {string} transactionId - ID de la transacción
   * @returns {Promise<Object>} - Datos completos de la transacción
   */
  async getTransactionById(transactionId) {
    try {
      const queryText = `
        SELECT 
          t.*,
          c.first_name,
          c.last_name,
          c.email,
          c.risk_profile,
          card.card_number_masked,
          card.card_type,
          card.bank,
          fl.fraud_detected,
          fl.fraud_score,
          fl.fraud_reasons
        FROM transactions t
        INNER JOIN clients c ON t.client_id = c.id
        INNER JOIN cards card ON t.card_id = card.id
        LEFT JOIN fraud_logs fl ON t.id = fl.transaction_id
        WHERE t.id = $1;
      `;
      
      const result = await query(queryText, [transactionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error al obtener transacción ${transactionId}:`, error);
      throw error;
    }
  },

  /**
   * Obtener transacciones recientes de un cliente para análisis de patrones
   * @param {string} clientId - ID del cliente
   * @param {number} limit - Número máximo de transacciones
   * @returns {Promise<Array>} - Lista de transacciones recientes
   */
  async getRecentTransactionsByClient(clientId, limit = 50) {
    try {
      const queryText = `
        SELECT 
          t.*,
          card.card_number_masked,
          card.card_type,
          fl.fraud_detected,
          fl.fraud_score
        FROM transactions t
        INNER JOIN cards card ON t.card_id = card.id
        LEFT JOIN fraud_logs fl ON t.id = fl.transaction_id
        WHERE t.client_id = $1
        ORDER BY t.created_at DESC
        LIMIT $2;
      `;
      
      const result = await query(queryText, [clientId, limit]);
      return result.rows;
    } catch (error) {
      logger.error(`Error al obtener transacciones recientes del cliente ${clientId}:`, error);
      throw error;
    }
  },

  /**
   * Obtener datos de transacción para análisis de fraude
   * @param {string} transactionId - ID de la transacción
   * @returns {Promise<Object>} - Datos formateados para análisis de IA
   */
  async getTransactionForFraudAnalysis(transactionId) {
    try {
      const queryText = `
        WITH transaction_context AS (
          SELECT 
            t.*,
            c.first_name,
            c.last_name,
            c.risk_profile,
            c.created_at as client_since,
            card.card_type,
            card.bank,
            
            -- Última transacción del cliente
            LAG(t2.created_at) OVER (PARTITION BY t.client_id ORDER BY t2.created_at) as prev_transaction_time,
            LAG(t2.location) OVER (PARTITION BY t.client_id ORDER BY t2.created_at) as prev_location,
            LAG(t2.latitude) OVER (PARTITION BY t.client_id ORDER BY t2.created_at) as prev_latitude,
            LAG(t2.longitude) OVER (PARTITION BY t.client_id ORDER BY t2.created_at) as prev_longitude,
            LAG(t2.amount) OVER (PARTITION BY t.client_id ORDER BY t2.created_at) as prev_amount,
            
            -- Estadísticas históricas del cliente
            (SELECT COUNT(*) FROM transactions WHERE client_id = t.client_id AND created_at < t.created_at) as historical_transaction_count,
            (SELECT AVG(amount) FROM transactions WHERE client_id = t.client_id AND created_at < t.created_at) as historical_avg_amount,
            (SELECT MAX(amount) FROM transactions WHERE client_id = t.client_id AND created_at < t.created_at) as historical_max_amount,
            (SELECT COUNT(DISTINCT location) FROM transactions WHERE client_id = t.client_id AND created_at < t.created_at) as historical_location_count,
            (SELECT COUNT(DISTINCT merchant_type) FROM transactions WHERE client_id = t.client_id AND created_at < t.created_at) as historical_merchant_types,
            
            -- Transacciones en las últimas 24 horas
            (SELECT COUNT(*) FROM transactions WHERE client_id = t.client_id AND created_at BETWEEN t.created_at - INTERVAL '24 hours' AND t.created_at) as transactions_last_24h,
            (SELECT SUM(amount) FROM transactions WHERE client_id = t.client_id AND created_at BETWEEN t.created_at - INTERVAL '24 hours' AND t.created_at) as amount_last_24h,
            
            -- Transacciones en la última hora
            (SELECT COUNT(*) FROM transactions WHERE client_id = t.client_id AND created_at BETWEEN t.created_at - INTERVAL '1 hour' AND t.created_at) as transactions_last_hour
            
          FROM transactions t
          INNER JOIN clients c ON t.client_id = c.id
          INNER JOIN cards card ON t.card_id = card.id
          LEFT JOIN transactions t2 ON t.client_id = t2.client_id AND t2.created_at <= t.created_at
          WHERE t.id = $1
        )
        SELECT * FROM transaction_context WHERE id = $1;
      `;
      
      const result = await query(queryText, [transactionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const transaction = result.rows[0];
      
      // Calcular variables adicionales para el análisis
      const analysisData = {
        // Datos básicos de la transacción
        id: transaction.id,
        amount: transaction.amount,
        merchant_type: transaction.merchant_type,
        location: transaction.location,
        country: transaction.country,
        channel: transaction.channel,
        created_at: transaction.created_at,
        
        // Información del cliente
        client_id: transaction.client_id,
        client_name: `${transaction.first_name} ${transaction.last_name}`,
        risk_profile: transaction.risk_profile,
        client_age_days: Math.floor((new Date() - new Date(transaction.client_since)) / (1000 * 60 * 60 * 24)),
        
        // Información de la tarjeta
        card_type: transaction.card_type,
        bank: transaction.bank,
        
        // Variables para análisis de IA
        variables: {
          // 1. Análisis de monto
          amount: transaction.amount,
          amount_ratio_to_avg: transaction.historical_avg_amount ? (transaction.amount / transaction.historical_avg_amount) : 1,
          amount_ratio_to_max: transaction.historical_max_amount ? (transaction.amount / transaction.historical_max_amount) : 1,
          
          // 2. Análisis de ubicación
          latitude: transaction.latitude,
          longitude: transaction.longitude,
          location: transaction.location,
          country: transaction.country,
          distance_from_prev: this.calculateDistance(
            transaction.latitude, transaction.longitude,
            transaction.prev_latitude, transaction.prev_longitude
          ),
          
          // 3. Análisis temporal
          hour_of_day: new Date(transaction.created_at).getHours(),
          day_of_week: new Date(transaction.created_at).getDay(),
          time_since_prev_transaction: transaction.prev_transaction_time ? 
            (new Date(transaction.created_at) - new Date(transaction.prev_transaction_time)) / (1000 * 60) : 0, // en minutos
          
          // 4. Análisis de establecimiento
          merchant_type: transaction.merchant_type,
          merchant_name: transaction.merchant_name,
          
          // 5. Análisis de velocidad
          transactions_last_hour: transaction.transactions_last_hour || 0,
          transactions_last_24h: transaction.transactions_last_24h || 0,
          amount_last_24h: transaction.amount_last_24h || 0,
          
          // 6. Análisis de patrón histórico
          historical_transaction_count: transaction.historical_transaction_count || 0,
          historical_avg_amount: transaction.historical_avg_amount || 0,
          historical_location_count: transaction.historical_location_count || 0,
          historical_merchant_types: transaction.historical_merchant_types || 0,
          
          // 7. Análisis de frecuencia
          client_age_days: Math.floor((new Date() - new Date(transaction.client_since)) / (1000 * 60 * 60 * 24)),
          avg_transactions_per_day: transaction.historical_transaction_count ? 
            (transaction.historical_transaction_count / Math.max(1, Math.floor((new Date() - new Date(transaction.client_since)) / (1000 * 60 * 60 * 24)))) : 0,
          
          // 8. Análisis de canal
          channel: transaction.channel,
          
          // 9. Análisis de dispositivo
          device_info: transaction.device_info,
          ip_address: transaction.ip_address,
          
          // 10. Análisis de país
          is_domestic: transaction.country === 'GT', // Guatemala como país base
          
          // 11. Análisis de perfil de riesgo
          risk_profile: transaction.risk_profile,
          
          // 12. Análisis contextual adicional
          is_weekend: [0, 6].includes(new Date(transaction.created_at).getDay()),
          is_night_transaction: [22, 23, 0, 1, 2, 3, 4, 5].includes(new Date(transaction.created_at).getHours())
        }
      };
      
      return analysisData;
    } catch (error) {
      logger.error(`Error al obtener datos de transacción para análisis ${transactionId}:`, error);
      throw error;
    }
  },

  /**
   * Calcular distancia entre dos puntos geográficos (fórmula de Haversine)
   * @param {number} lat1 - Latitud punto 1
   * @param {number} lon1 - Longitud punto 1
   * @param {number} lat2 - Latitud punto 2
   * @param {number} lon2 - Longitud punto 2
   * @returns {number} - Distancia en kilómetros
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
  },

  /**
   * Convertir grados a radianes
   * @param {number} deg - Grados
   * @returns {number} - Radianes
   */
  deg2rad(deg) {
    return deg * (Math.PI/180);
  },

  /**
   * Obtener transacciones sospechosas para revisión
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} - Lista de transacciones sospechosas
   */
  async getSuspiciousTransactions(limit = 50) {
    try {
      const queryText = `
        SELECT 
          t.*,
          c.first_name,
          c.last_name,
          c.risk_profile,
          card.card_number_masked,
          fl.fraud_score,
          fl.fraud_reasons,
          fl.created_at as analysis_date
        FROM transactions t
        INNER JOIN clients c ON t.client_id = c.id
        INNER JOIN cards card ON t.card_id = card.id
        INNER JOIN fraud_logs fl ON t.id = fl.transaction_id
        WHERE fl.fraud_score >= 0.5 -- Umbral de sospecha
        ORDER BY fl.fraud_score DESC, t.created_at DESC
        LIMIT $1;
      `;
      
      const result = await query(queryText, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error al obtener transacciones sospechosas:', error);
      throw error;
    }
  },

  /**
   * Obtener estadísticas de transacciones por período
   * @param {string} period - Período ('day', 'week', 'month')
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @returns {Promise<Object>} - Estadísticas del período
   */
  async getTransactionStats(period = 'day', startDate = new Date(), endDate = new Date()) {
    try {
      const queryText = `
        SELECT 
          COUNT(*) as total_transactions,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount,
          MAX(amount) as max_amount,
          MIN(amount) as min_amount,
          COUNT(DISTINCT client_id) as unique_clients,
          COUNT(DISTINCT card_id) as unique_cards,
          COUNT(DISTINCT country) as unique_countries,
          COUNT(DISTINCT merchant_type) as unique_merchant_types,
          
          -- Por canal
          COUNT(CASE WHEN channel = 'online' THEN 1 END) as online_transactions,
          COUNT(CASE WHEN channel = 'physical' THEN 1 END) as physical_transactions,
          COUNT(CASE WHEN channel = 'atm' THEN 1 END) as atm_transactions,
          
          -- Transacciones con fraude detectado
          COUNT(CASE WHEN fl.fraud_detected = true THEN 1 END) as fraud_transactions,
          AVG(CASE WHEN fl.fraud_score IS NOT NULL THEN fl.fraud_score END) as avg_fraud_score
          
        FROM transactions t
        LEFT JOIN fraud_logs fl ON t.id = fl.transaction_id
        WHERE t.created_at BETWEEN $1 AND $2;
      `;
      
      const result = await query(queryText, [startDate, endDate]);
      
      if (result.rows.length === 0) {
        return {
          has_data: false,
          period,
          start_date: startDate,
          end_date: endDate
        };
      }
      
      const stats = result.rows[0];
      
      // Calcular métricas adicionales
      stats.fraud_rate = stats.total_transactions > 0 ? 
        (stats.fraud_transactions / stats.total_transactions) * 100 : 0;
      
      stats.avg_transactions_per_client = stats.unique_clients > 0 ?
        stats.total_transactions / stats.unique_clients : 0;
      
      return {
        has_data: true,
        period,
        start_date: startDate,
        end_date: endDate,
        ...stats
      };
    } catch (error) {
      logger.error('Error al obtener estadísticas de transacciones:', error);
      throw error;
    }
  },

  /**
   * Buscar transacciones por criterios múltiples
   * @param {Object} criteria - Criterios de búsqueda
   * @returns {Promise<Array>} - Lista de transacciones encontradas
   */
  async searchTransactions(criteria) {
    try {
      let whereConditions = ['1=1']; // Condición base
      let params = [];
      let paramCounter = 1;
      
      if (criteria.clientId) {
        whereConditions.push(`t.client_id = $${paramCounter}`);
        params.push(criteria.clientId);
        paramCounter++;
      }
      
      if (criteria.cardId) {
        whereConditions.push(`t.card_id = $${paramCounter}`);
        params.push(criteria.cardId);
        paramCounter++;
      }
      
      if (criteria.minAmount) {
        whereConditions.push(`t.amount >= $${paramCounter}`);
        params.push(criteria.minAmount);
        paramCounter++;
      }
      
      if (criteria.maxAmount) {
        whereConditions.push(`t.amount <= $${paramCounter}`);
        params.push(criteria.maxAmount);
        paramCounter++;
      }
      
      if (criteria.country) {
        whereConditions.push(`t.country = $${paramCounter}`);
        params.push(criteria.country);
        paramCounter++;
      }
      
      if (criteria.merchantType) {
        whereConditions.push(`t.merchant_type = $${paramCounter}`);
        params.push(criteria.merchantType);
        paramCounter++;
      }
      
      if (criteria.channel) {
        whereConditions.push(`t.channel = $${paramCounter}`);
        params.push(criteria.channel);
        paramCounter++;
      }
      
      if (criteria.startDate) {
        whereConditions.push(`t.created_at >= $${paramCounter}`);
        params.push(criteria.startDate);
        paramCounter++;
      }
      
      if (criteria.endDate) {
        whereConditions.push(`t.created_at <= $${paramCounter}`);
        params.push(criteria.endDate);
        paramCounter++;
      }
      
      if (criteria.fraudDetected !== undefined) {
        whereConditions.push(`fl.fraud_detected = $${paramCounter}`);
        params.push(criteria.fraudDetected);
        paramCounter++;
      }
      
      const queryText = `
        SELECT 
          t.*,
          c.first_name,
          c.last_name,
          card.card_number_masked,
          card.card_type,
          fl.fraud_detected,
          fl.fraud_score
        FROM transactions t
        INNER JOIN clients c ON t.client_id = c.id
        INNER JOIN cards card ON t.card_id = card.id
        LEFT JOIN fraud_logs fl ON t.id = fl.transaction_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY t.created_at DESC
        LIMIT 100;
      `;
      
      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      logger.error('Error al buscar transacciones:', error);
      throw error;
    }
  }
};

module.exports = TransactionModel;