const { query, logger } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Modelo para gestión de análisis de fraude y logs del sistema
 */
const FraudModel = {
  /**
   * Registrar resultado de análisis de fraude
   * @param {Object} fraudData - Datos del análisis de fraude
   * @returns {Promise<Object>} - Log de fraude creado
   */
  async logFraudAnalysis(fraudData) {
    try {
      const {
        transactionId,
        fraudScore,
        fraudDetected,
        analysisDetails,
        layer1Results,
        layer2Results,
        layer3Results,
        finalDecision,
        processingTimeMs,
        networkVersions
      } = fraudData;

      const logId = uuidv4();
      
      const queryText = `
        INSERT INTO fraud_logs (
          id, transaction_id, fraud_score, fraud_detected,
          analysis_details, layer1_results, layer2_results, 
          layer3_results, final_decision, processing_time_ms,
          network_versions, created_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *;
      `;
      
      const result = await query(queryText, [
        logId,
        transactionId,
        fraudScore,
        fraudDetected,
        JSON.stringify(analysisDetails),
        JSON.stringify(layer1Results),
        JSON.stringify(layer2Results),
        JSON.stringify(layer3Results),
        JSON.stringify(finalDecision),
        processingTimeMs,
        JSON.stringify(networkVersions)
      ]);
      
      logger.info(`Análisis de fraude registrado: ${logId} - Transacción: ${transactionId} - Score: ${fraudScore}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error al registrar análisis de fraude:', error);
      throw error;
    }
  },

  /**
   * Obtener análisis de fraude por transacción
   * @param {string} transactionId - ID de la transacción
   * @returns {Promise<Object>} - Análisis de fraude
   */
  async getFraudAnalysisByTransaction(transactionId) {
    try {
      const queryText = `
        SELECT 
          fl.*,
          t.amount,
          t.merchant_name,
          t.location,
          t.created_at as transaction_date,
          c.first_name,
          c.last_name,
          c.risk_profile
        FROM fraud_logs fl
        INNER JOIN transactions t ON fl.transaction_id = t.id
        INNER JOIN clients c ON t.client_id = c.id
        WHERE fl.transaction_id = $1
        ORDER BY fl.created_at DESC
        LIMIT 1;
      `;
      
      const result = await query(queryText, [transactionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const fraudLog = result.rows[0];
      
      // Parsear JSON fields
      try {
        fraudLog.analysis_details = JSON.parse(fraudLog.analysis_details || '{}');
        fraudLog.layer1_results = JSON.parse(fraudLog.layer1_results || '{}');
        fraudLog.layer2_results = JSON.parse(fraudLog.layer2_results || '{}');
        fraudLog.layer3_results = JSON.parse(fraudLog.layer3_results || '{}');
        fraudLog.final_decision = JSON.parse(fraudLog.final_decision || '{}');
        fraudLog.network_versions = JSON.parse(fraudLog.network_versions || '{}');
      } catch (parseError) {
        logger.warn(`Error al parsear JSON en análisis de fraude ${fraudLog.id}:`, parseError);
      }
      
      return fraudLog;
    } catch (error) {
      logger.error(`Error al obtener análisis de fraude para transacción ${transactionId}:`, error);
      throw error;
    }
  },

  /**
   * Obtener estadísticas de detección de fraude
   * @param {Object} filters - Filtros para las estadísticas
   * @returns {Promise<Object>} - Estadísticas de fraude
   */
  async getFraudStats(filters = {}) {
    try {
      const { startDate, endDate, minScore } = filters;
      
      let whereConditions = ['1=1'];
      let params = [];
      let paramCounter = 1;
      
      if (startDate) {
        whereConditions.push(`fl.created_at >= $${paramCounter}`);
        params.push(startDate);
        paramCounter++;
      }
      
      if (endDate) {
        whereConditions.push(`fl.created_at <= $${paramCounter}`);
        params.push(endDate);
        paramCounter++;
      }
      
      if (minScore) {
        whereConditions.push(`fl.fraud_score >= $${paramCounter}`);
        params.push(minScore);
        paramCounter++;
      }
      
      const queryText = `
        SELECT 
          COUNT(*) as total_analyses,
          COUNT(CASE WHEN fraud_detected = true THEN 1 END) as fraud_detected_count,
          COUNT(CASE WHEN fraud_detected = false THEN 1 END) as legitimate_count,
          AVG(fraud_score) as avg_fraud_score,
          MAX(fraud_score) as max_fraud_score,
          MIN(fraud_score) as min_fraud_score,
          AVG(processing_time_ms) as avg_processing_time,
          
          -- Por rangos de score
          COUNT(CASE WHEN fraud_score < 0.3 THEN 1 END) as low_risk_count,
          COUNT(CASE WHEN fraud_score >= 0.3 AND fraud_score < 0.5 THEN 1 END) as medium_low_risk_count,
          COUNT(CASE WHEN fraud_score >= 0.5 AND fraud_score < 0.7 THEN 1 END) as medium_risk_count,
          COUNT(CASE WHEN fraud_score >= 0.7 AND fraud_score < 0.9 THEN 1 END) as high_risk_count,
          COUNT(CASE WHEN fraud_score >= 0.9 THEN 1 END) as critical_risk_count,
          
          -- Por hora del día
          COUNT(CASE WHEN EXTRACT(hour FROM fl.created_at) BETWEEN 6 AND 12 THEN 1 END) as morning_analyses,
          COUNT(CASE WHEN EXTRACT(hour FROM fl.created_at) BETWEEN 12 AND 18 THEN 1 END) as afternoon_analyses,
          COUNT(CASE WHEN EXTRACT(hour FROM fl.created_at) BETWEEN 18 AND 24 THEN 1 END) as evening_analyses,
          COUNT(CASE WHEN EXTRACT(hour FROM fl.created_at) BETWEEN 0 AND 6 THEN 1 END) as night_analyses
          
        FROM fraud_logs fl
        WHERE ${whereConditions.join(' AND ')};
      `;
      
      const result = await query(queryText, params);
      
      if (result.rows.length === 0) {
        return {
          has_data: false,
          message: 'No hay datos de análisis de fraude para el período especificado'
        };
      }
      
      const stats = result.rows[0];
      
      // Calcular métricas adicionales
      stats.fraud_detection_rate = stats.total_analyses > 0 ? 
        (stats.fraud_detected_count / stats.total_analyses) * 100 : 0;
      
      stats.risk_distribution = {
        low: (stats.low_risk_count / stats.total_analyses) * 100,
        medium_low: (stats.medium_low_risk_count / stats.total_analyses) * 100,
        medium: (stats.medium_risk_count / stats.total_analyses) * 100,
        high: (stats.high_risk_count / stats.total_analyses) * 100,
        critical: (stats.critical_risk_count / stats.total_analyses) * 100
      };
      
      return {
        has_data: true,
        period: { start_date: startDate, end_date: endDate },
        ...stats
      };
    } catch (error) {
      logger.error('Error al obtener estadísticas de fraude:', error);
      throw error;
    }
  },

  /**
   * Obtener top razones de fraude detectado
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} - Top razones de fraude
   */
  async getTopFraudReasons(limit = 10) {
    try {
      const queryText = `
        WITH fraud_reasons_expanded AS (
          SELECT 
            json_array_elements_text(
              CASE 
                WHEN json_typeof(analysis_details::json->'primary_reasons') = 'array'
                THEN analysis_details::json->'primary_reasons'
                ELSE '[]'::json
              END
            ) as reason,
            fraud_score
          FROM fraud_logs 
          WHERE fraud_detected = true 
          AND analysis_details IS NOT NULL
          AND analysis_details != '{}'
        )
        SELECT 
          reason,
          COUNT(*) as frequency,
          AVG(fraud_score) as avg_fraud_score,
          MAX(fraud_score) as max_fraud_score
        FROM fraud_reasons_expanded
        WHERE reason IS NOT NULL AND reason != ''
        GROUP BY reason
        ORDER BY frequency DESC, avg_fraud_score DESC
        LIMIT $1;
      `;
      
      const result = await query(queryText, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error al obtener top razones de fraude:', error);
      throw error;
    }
  },

  /**
   * Obtener rendimiento de las redes neuronales por capa
   * @returns {Promise<Object>} - Estadísticas de rendimiento por capa
   */
  async getNetworkLayerPerformance() {
    try {
      const queryText = `
        WITH layer_analysis AS (
          SELECT 
            fraud_score,
            fraud_detected,
            processing_time_ms,
            
            -- Extraer datos de cada capa
            COALESCE(
              json_array_length(layer1_results::json->'results'),
              0
            ) as layer1_networks_count,
            
            COALESCE(
              json_array_length(layer2_results::json->'results'),
              0
            ) as layer2_networks_count,
            
            COALESCE(
              json_array_length(layer3_results::json->'results'),
              0
            ) as layer3_networks_count,
            
            -- Extraer tiempos de procesamiento por capa
            COALESCE(
              (layer1_results::json->>'processing_time_ms')::numeric,
              0
            ) as layer1_time,
            
            COALESCE(
              (layer2_results::json->>'processing_time_ms')::numeric,
              0
            ) as layer2_time,
            
            COALESCE(
              (layer3_results::json->>'processing_time_ms')::numeric,
              0
            ) as layer3_time
            
          FROM fraud_logs 
          WHERE layer1_results IS NOT NULL 
          AND layer2_results IS NOT NULL 
          AND layer3_results IS NOT NULL
          AND created_at >= NOW() - INTERVAL '30 days'
        )
        SELECT 
          COUNT(*) as total_analyses,
          
          -- Rendimiento general
          AVG(fraud_score) as avg_fraud_score,
          AVG(processing_time_ms) as avg_total_processing_time,
          
          -- Rendimiento por capa
          AVG(layer1_time) as avg_layer1_time,
          AVG(layer2_time) as avg_layer2_time,
          AVG(layer3_time) as avg_layer3_time,
          
          -- Conteo de redes por capa
          AVG(layer1_networks_count) as avg_layer1_networks,
          AVG(layer2_networks_count) as avg_layer2_networks,
          AVG(layer3_networks_count) as avg_layer3_networks,
          
          -- Distribución de tiempo por capa
          (AVG(layer1_time) / AVG(processing_time_ms)) * 100 as layer1_time_percentage,
          (AVG(layer2_time) / AVG(processing_time_ms)) * 100 as layer2_time_percentage,
          (AVG(layer3_time) / AVG(processing_time_ms)) * 100 as layer3_time_percentage
          
        FROM layer_analysis
        WHERE processing_time_ms > 0;
      `;
      
      const result = await query(queryText);
      
      if (result.rows.length === 0) {
        return {
          has_data: false,
          message: 'No hay datos suficientes para análisis de rendimiento'
        };
      }
      
      return {
        has_data: true,
        performance: result.rows[0]
      };
    } catch (error) {
      logger.error('Error al obtener rendimiento de capas de red neuronal:', error);
      throw error;
    }
  },

  /**
   * Obtener alertas de fraude recientes
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} - Lista de alertas recientes
   */
  async getRecentFraudAlerts(limit = 20) {
    try {
      const queryText = `
        SELECT 
          fl.id,
          fl.fraud_score,
          fl.created_at as alert_time,
          fl.processing_time_ms,
          t.id as transaction_id,
          t.amount,
          t.merchant_name,
          t.location,
          t.country,
          t.created_at as transaction_time,
          c.first_name,
          c.last_name,
          c.risk_profile,
          card.card_number_masked,
          card.card_type,
          
          -- Extraer razones principales del JSON
          CASE 
            WHEN fl.analysis_details::json ? 'primary_reasons'
            THEN fl.analysis_details::json->>'primary_reasons'
            ELSE '[]'
          END as primary_reasons
          
        FROM fraud_logs fl
        INNER JOIN transactions t ON fl.transaction_id = t.id
        INNER JOIN clients c ON t.client_id = c.id
        INNER JOIN cards card ON t.card_id = card.id
        WHERE fl.fraud_detected = true
        ORDER BY fl.created_at DESC
        LIMIT $1;
      `;
      
      const result = await query(queryText, [limit]);
      
      // Procesar las razones principales para cada alerta
      const alerts = result.rows.map(alert => {
        try {
          alert.primary_reasons = JSON.parse(alert.primary_reasons || '[]');
        } catch (parseError) {
          alert.primary_reasons = [];
        }
        
        // Calcular nivel de riesgo
        alert.risk_level = this.calculateRiskLevel(alert.fraud_score);
        
        return alert;
      });
      
      return alerts;
    } catch (error) {
      logger.error('Error al obtener alertas de fraude recientes:', error);
      throw error;
    }
  },

  /**
   * Calcular nivel de riesgo basado en puntuación
   * @param {number} score - Puntuación de fraude (0-1)
   * @returns {string} - Nivel de riesgo
   */
  calculateRiskLevel(score) {
    if (score >= 0.9) return 'critical';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'minimal';
  },

  /**
   * Obtener tendencias de fraude por período
   * @param {string} period - Período ('hour', 'day', 'week', 'month')
   * @param {number} periods - Número de períodos hacia atrás
   * @returns {Promise<Array>} - Tendencias de fraude
   */
  async getFraudTrends(period = 'day', periods = 30) {
    try {
      let dateFormat, intervalText;
      
      switch (period) {
        case 'hour':
          dateFormat = 'YYYY-MM-DD HH24:00:00';
          intervalText = '1 hour';
          break;
        case 'day':
          dateFormat = 'YYYY-MM-DD';
          intervalText = '1 day';
          break;
        case 'week':
          dateFormat = 'YYYY-WW';
          intervalText = '1 week';
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          intervalText = '1 month';
          break;
        default:
          dateFormat = 'YYYY-MM-DD';
          intervalText = '1 day';
      }
      
      const queryText = `
        SELECT 
          TO_CHAR(fl.created_at, '${dateFormat}') as period_label,
          DATE_TRUNC('${period}', fl.created_at) as period_start,
          COUNT(*) as total_analyses,
          COUNT(CASE WHEN fraud_detected = true THEN 1 END) as fraud_detected,
          AVG(fraud_score) as avg_fraud_score,
          MAX(fraud_score) as max_fraud_score,
          SUM(t.amount) as total_transaction_amount,
          SUM(CASE WHEN fraud_detected = true THEN t.amount END) as fraud_amount
        FROM fraud_logs fl
        INNER JOIN transactions t ON fl.transaction_id = t.id
        WHERE fl.created_at >= NOW() - INTERVAL '${periods} ${period}s'
        GROUP BY period_label, period_start
        ORDER BY period_start DESC;
      `;
      
      const result = await query(queryText);
      
      // Calcular métricas adicionales para cada período
      const trends = result.rows.map(row => {
        row.fraud_rate = row.total_analyses > 0 ? 
          (row.fraud_detected / row.total_analyses) * 100 : 0;
        
        row.fraud_amount_percentage = row.total_transaction_amount > 0 ?
          (row.fraud_amount / row.total_transaction_amount) * 100 : 0;
        
        return row;
      });
      
      return trends;
    } catch (error) {
      logger.error('Error al obtener tendencias de fraude:', error);
      throw error;
    }
  },

  /**
   * Actualizar resultado de análisis de fraude (para feedback)
   * @param {string} fraudLogId - ID del log de fraude
   * @param {Object} updates - Actualizaciones
   * @returns {Promise<Object>} - Log actualizado
   */
  async updateFraudAnalysis(fraudLogId, updates) {
    try {
      const {
        fraudDetected,
        humanReviewed = true,
        reviewerNotes = null,
        correctedScore = null
      } = updates;
      
      const queryText = `
        UPDATE fraud_logs 
        SET 
          fraud_detected = COALESCE($2, fraud_detected),
          human_reviewed = $3,
          reviewer_notes = $4,
          corrected_score = $5,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;
      
      const result = await query(queryText, [
        fraudLogId,
        fraudDetected,
        humanReviewed,
        reviewerNotes,
        correctedScore
      ]);
      
      if (result.rows.length === 0) {
        throw new Error('Log de fraude no encontrado');
      }
      
      logger.info(`Análisis de fraude actualizado: ${fraudLogId} - Revisado por humano: ${humanReviewed}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error al actualizar análisis de fraude ${fraudLogId}:`, error);
      throw error;
    }
  },

  /**
   * Obtener métricas de precisión del modelo
   * @returns {Promise<Object>} - Métricas de precisión
   */
  async getModelAccuracyMetrics() {
    try {
      const queryText = `
        SELECT 
          COUNT(*) as total_reviewed,
          
          -- True Positives: Modelo detectó fraude Y humano confirmó fraude
          COUNT(CASE WHEN fraud_detected = true AND human_reviewed = true AND (reviewer_notes IS NULL OR reviewer_notes NOT LIKE '%falso positivo%') THEN 1 END) as true_positives,
          
          -- False Positives: Modelo detectó fraude PERO humano dice que NO es fraude
          COUNT(CASE WHEN fraud_detected = true AND human_reviewed = true AND (reviewer_notes LIKE '%falso positivo%' OR corrected_score < 0.3) THEN 1 END) as false_positives,
          
          -- True Negatives: Modelo NO detectó fraude Y humano confirmó que NO es fraude
          COUNT(CASE WHEN fraud_detected = false AND human_reviewed = true AND (reviewer_notes IS NULL OR reviewer_notes NOT LIKE '%falso negativo%') THEN 1 END) as true_negatives,
          
          -- False Negatives: Modelo NO detectó fraude PERO humano dice que SÍ es fraude
          COUNT(CASE WHEN fraud_detected = false AND human_reviewed = true AND (reviewer_notes LIKE '%falso negativo%' OR corrected_score > 0.7) THEN 1 END) as false_negatives,
          
          AVG(ABS(fraud_score - COALESCE(corrected_score, fraud_score))) as avg_score_deviation
          
        FROM fraud_logs 
        WHERE human_reviewed = true
        AND created_at >= NOW() - INTERVAL '90 days';
      `;
      
      const result = await query(queryText);
      
      if (result.rows.length === 0 || result.rows[0].total_reviewed === 0) {
        return {
          has_data: false,
          message: 'No hay suficientes datos revisados para calcular métricas de precisión'
        };
      }
      
      const metrics = result.rows[0];
      
      // Calcular métricas de rendimiento
      const tp = parseInt(metrics.true_positives);
      const fp = parseInt(metrics.false_positives);
      const tn = parseInt(metrics.true_negatives);
      const fn = parseInt(metrics.false_negatives);
      
      metrics.precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
      metrics.recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
      metrics.accuracy = (tp + tn) / (tp + fp + tn + fn);
      metrics.f1_score = (metrics.precision + metrics.recall) > 0 ? 
        2 * (metrics.precision * metrics.recall) / (metrics.precision + metrics.recall) : 0;
      
      return {
        has_data: true,
        ...metrics
      };
    } catch (error) {
      logger.error('Error al obtener métricas de precisión del modelo:', error);
      throw error;
    }
  }
};

module.exports = FraudModel;