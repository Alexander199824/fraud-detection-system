const { query, logger } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Modelo para gestión de clientes en el sistema de detección de fraude
 */
const ClientModel = {
  /**
   * Crear un nuevo cliente
   * @param {Object} clientData - Datos del cliente
   * @returns {Promise<Object>} - Cliente creado
   */
  async createClient(clientData) {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        country,
        dateOfBirth,
        identificationNumber,
        riskProfile = 'low'
      } = clientData;

      const clientId = uuidv4();
      
      const queryText = `
        INSERT INTO clients (
          id, first_name, last_name, email, phone, address, 
          city, country, date_of_birth, identification_number, 
          risk_profile, created_at, updated_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING *;
      `;
      
      const result = await query(queryText, [
        clientId,
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        country,
        dateOfBirth,
        identificationNumber,
        riskProfile
      ]);
      
      logger.info(`Cliente creado: ${clientId} - ${firstName} ${lastName}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error al crear cliente:', error);
      throw error;
    }
  },

  /**
   * Obtener cliente por ID
   * @param {string} clientId - ID del cliente
   * @returns {Promise<Object>} - Datos del cliente
   */
  async getClientById(clientId) {
    try {
      const queryText = `
        SELECT 
          c.*,
          COUNT(t.id) as total_transactions,
          COALESCE(SUM(t.amount), 0) as total_spent,
          AVG(t.amount) as avg_transaction_amount,
          MAX(t.created_at) as last_transaction_date
        FROM clients c
        LEFT JOIN transactions t ON c.id = t.client_id
        WHERE c.id = $1
        GROUP BY c.id;
      `;
      
      const result = await query(queryText, [clientId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error al obtener cliente ${clientId}:`, error);
      throw error;
    }
  },

  /**
   * Obtener perfil de riesgo completo del cliente
   * @param {string} clientId - ID del cliente
   * @returns {Promise<Object>} - Perfil de riesgo
   */
  async getClientRiskProfile(clientId) {
    try {
      const queryText = `
        SELECT 
          c.id,
          c.first_name,
          c.last_name,
          c.risk_profile,
          c.created_at as client_since,
          
          -- Estadísticas de transacciones
          COUNT(t.id) as total_transactions,
          COALESCE(SUM(t.amount), 0) as total_spent,
          COALESCE(AVG(t.amount), 0) as avg_transaction_amount,
          COALESCE(MAX(t.amount), 0) as max_transaction_amount,
          COALESCE(MIN(t.amount), 0) as min_transaction_amount,
          
          -- Actividad reciente (últimos 30 días)
          COUNT(CASE WHEN t.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as transactions_last_30_days,
          COALESCE(SUM(CASE WHEN t.created_at >= NOW() - INTERVAL '30 days' THEN t.amount END), 0) as spent_last_30_days,
          
          -- Patrones de ubicación
          COUNT(DISTINCT t.location) as unique_locations,
          COUNT(DISTINCT t.country) as unique_countries,
          
          -- Patrones de tiempo
          COUNT(DISTINCT DATE_TRUNC('hour', t.created_at)) as unique_hours,
          COUNT(DISTINCT EXTRACT(dow FROM t.created_at)) as unique_days_of_week,
          
          -- Tipos de establecimiento
          COUNT(DISTINCT t.merchant_type) as unique_merchant_types,
          
          -- Historial de fraude
          COUNT(CASE WHEN fl.fraud_detected = true THEN 1 END) as fraud_incidents,
          MAX(fl.created_at) as last_fraud_check
          
        FROM clients c
        LEFT JOIN transactions t ON c.id = t.client_id
        LEFT JOIN fraud_logs fl ON t.id = fl.transaction_id
        WHERE c.id = $1
        GROUP BY c.id, c.first_name, c.last_name, c.risk_profile, c.created_at;
      `;
      
      const result = await query(queryText, [clientId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const profile = result.rows[0];
      
      // Calcular métricas adicionales
      profile.average_transactions_per_day = profile.total_transactions > 0 
        ? (profile.total_transactions / Math.max(1, Math.floor((new Date() - new Date(profile.client_since)) / (1000 * 60 * 60 * 24))))
        : 0;
      
      profile.risk_score = this.calculateRiskScore(profile);
      
      return profile;
    } catch (error) {
      logger.error(`Error al obtener perfil de riesgo del cliente ${clientId}:`, error);
      throw error;
    }
  },

  /**
   * Calcular puntuación de riesgo basada en el perfil del cliente
   * @param {Object} profile - Perfil del cliente
   * @returns {number} - Puntuación de riesgo (0-1)
   */
  calculateRiskScore(profile) {
    let score = 0;
    
    // Factor: Historial de fraude
    if (profile.fraud_incidents > 0) {
      score += 0.4;
    }
    
    // Factor: Actividad anómala
    if (profile.unique_countries > 5) {
      score += 0.2;
    }
    
    if (profile.transactions_last_30_days > 50) {
      score += 0.1;
    }
    
    // Factor: Transacciones muy grandes o muy pequeñas
    if (profile.max_transaction_amount > 10000) {
      score += 0.1;
    }
    
    if (profile.avg_transaction_amount < 10 && profile.total_transactions > 10) {
      score += 0.1;
    }
    
    // Factor: Cliente nuevo con alta actividad
    const daysSinceCreation = Math.floor((new Date() - new Date(profile.client_since)) / (1000 * 60 * 60 * 24));
    if (daysSinceCreation < 30 && profile.transactions_last_30_days > 20) {
      score += 0.1;
    }
    
    return Math.min(score, 1); // Máximo 1.0
  },

  /**
   * Actualizar perfil de riesgo del cliente
   * @param {string} clientId - ID del cliente
   * @param {string} newRiskProfile - Nuevo perfil de riesgo
   * @returns {Promise<Object>} - Cliente actualizado
   */
  async updateRiskProfile(clientId, newRiskProfile) {
    try {
      const queryText = `
        UPDATE clients 
        SET risk_profile = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;
      
      const result = await query(queryText, [clientId, newRiskProfile]);
      
      if (result.rows.length === 0) {
        throw new Error('Cliente no encontrado');
      }
      
      logger.info(`Perfil de riesgo actualizado para cliente ${clientId}: ${newRiskProfile}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error al actualizar perfil de riesgo del cliente ${clientId}:`, error);
      throw error;
    }
  },

  /**
   * Obtener patrones de comportamiento del cliente
   * @param {string} clientId - ID del cliente
   * @returns {Promise<Object>} - Patrones de comportamiento
   */
  async getClientBehaviorPatterns(clientId) {
    try {
      const queryText = `
        WITH transaction_patterns AS (
          SELECT 
            EXTRACT(hour FROM created_at) as hour_of_day,
            EXTRACT(dow FROM created_at) as day_of_week,
            merchant_type,
            location,
            amount,
            created_at
          FROM transactions 
          WHERE client_id = $1
          ORDER BY created_at DESC
          LIMIT 1000
        )
        SELECT 
          -- Patrones de hora preferida
          mode() WITHIN GROUP (ORDER BY hour_of_day) as preferred_hour,
          COUNT(DISTINCT hour_of_day) as hours_used,
          
          -- Patrones de día preferido
          mode() WITHIN GROUP (ORDER BY day_of_week) as preferred_day,
          COUNT(DISTINCT day_of_week) as days_used,
          
          -- Patrones de ubicación
          mode() WITHIN GROUP (ORDER BY location) as most_used_location,
          COUNT(DISTINCT location) as locations_used,
          
          -- Patrones de establecimiento
          mode() WITHIN GROUP (ORDER BY merchant_type) as preferred_merchant_type,
          COUNT(DISTINCT merchant_type) as merchant_types_used,
          
          -- Patrones de monto
          AVG(amount) as avg_amount,
          STDDEV(amount) as amount_stddev,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) as median_amount,
          
          -- Regularidad
          COUNT(*) as total_sample_transactions
        FROM transaction_patterns;
      `;
      
      const result = await query(queryText, [clientId]);
      
      if (result.rows.length === 0) {
        return {
          has_patterns: false,
          message: 'Insuficientes datos para análisis de patrones'
        };
      }
      
      const patterns = result.rows[0];
      
      // Calcular regularidad de patrones
      patterns.regularity_score = this.calculateRegularityScore(patterns);
      patterns.has_patterns = patterns.total_sample_transactions >= 10;
      
      return patterns;
    } catch (error) {
      logger.error(`Error al obtener patrones de comportamiento del cliente ${clientId}:`, error);
      throw error;
    }
  },

  /**
   * Calcular puntuación de regularidad de patrones
   * @param {Object} patterns - Patrones del cliente
   * @returns {number} - Puntuación de regularidad (0-1)
   */
  calculateRegularityScore(patterns) {
    let score = 0;
    
    // Más regular = menos horas/días/ubicaciones diferentes
    if (patterns.hours_used <= 8) score += 0.25;
    if (patterns.days_used <= 5) score += 0.25;
    if (patterns.locations_used <= 3) score += 0.25;
    if (patterns.merchant_types_used <= 5) score += 0.25;
    
    return score;
  },

  /**
   * Buscar clientes por criterios
   * @param {Object} criteria - Criterios de búsqueda
   * @returns {Promise<Array>} - Lista de clientes
   */
  async searchClients(criteria) {
    try {
      let whereConditions = [];
      let params = [];
      let paramCounter = 1;
      
      if (criteria.email) {
        whereConditions.push(`email ILIKE $${paramCounter}`);
        params.push(`%${criteria.email}%`);
        paramCounter++;
      }
      
      if (criteria.phone) {
        whereConditions.push(`phone ILIKE $${paramCounter}`);
        params.push(`%${criteria.phone}%`);
        paramCounter++;
      }
      
      if (criteria.riskProfile) {
        whereConditions.push(`risk_profile = $${paramCounter}`);
        params.push(criteria.riskProfile);
        paramCounter++;
      }
      
      if (criteria.country) {
        whereConditions.push(`country = $${paramCounter}`);
        params.push(criteria.country);
        paramCounter++;
      }
      
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';
      
      const queryText = `
        SELECT 
          id, first_name, last_name, email, phone, 
          city, country, risk_profile, created_at
        FROM clients
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 100;
      `;
      
      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      logger.error('Error al buscar clientes:', error);
      throw error;
    }
  }
};

module.exports = ClientModel;