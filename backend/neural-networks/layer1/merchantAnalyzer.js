const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.5 - Análisis de Tipo de Establecimiento
 * Esta red analiza si el tipo de establecimiento de una transacción es sospechoso
 */
class MerchantAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'merchant_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Clasificación de establecimientos por nivel de riesgo
    this.merchantRiskClassification = {
      // Muy alto riesgo
      veryHigh: [
        'casino', 'gambling', 'betting', 'lottery', 'adult_entertainment',
        'money_transfer', 'check_cashing', 'pawn_shop', 'precious_metals',
        'cryptocurrency', 'forex', 'investment_high_risk'
      ],
      
      // Alto riesgo
      high: [
        'jewelry', 'electronics_high_value', 'luxury_goods', 'art_antiques',
        'online_gaming', 'subscription_services', 'prepaid_cards',
        'gift_cards', 'money_order', 'wire_transfer'
      ],
      
      // Riesgo medio
      medium: [
        'electronics', 'computer_software', 'online_retail', 'fashion',
        'automotive_parts', 'home_improvement', 'sporting_goods',
        'beauty_cosmetics', 'books_media', 'travel_services'
      ],
      
      // Bajo riesgo
      low: [
        'grocery', 'supermarket', 'pharmacy', 'gas_station', 'restaurant',
        'fast_food', 'coffee_shop', 'retail_general', 'clothing',
        'department_store', 'convenience_store', 'hardware_store'
      ],
      
      // Muy bajo riesgo (esenciales)
      veryLow: [
        'medical', 'hospital', 'clinic', 'emergency_services', 'utilities',
        'government', 'education', 'insurance', 'bank', 'atm'
      ]
    };
    
    // Scores de riesgo por clasificación
    this.riskScores = {
      veryHigh: 0.9,
      high: 0.7,
      medium: 0.5,
      low: 0.2,
      veryLow: 0.1,
      unknown: 0.6
    };
    
    // Umbrales de monto por tipo de establecimiento
    this.amountThresholds = {
      veryHigh: { suspicious: 1000, extreme: 5000 },
      high: { suspicious: 2000, extreme: 10000 },
      medium: { suspicious: 5000, extreme: 20000 },
      low: { suspicious: 10000, extreme: 50000 },
      veryLow: { suspicious: 20000, extreme: 100000 }
    };
  }

  /**
   * Obtengo la clasificación de riesgo de un establecimiento
   * @param {string} merchantType - Tipo de establecimiento
   * @returns {string} - Clasificación de riesgo
   */
  getMerchantRiskClassification(merchantType) {
    if (!merchantType) return 'unknown';
    
    const type = merchantType.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    for (const [classification, merchants] of Object.entries(this.merchantRiskClassification)) {
      for (const merchant of merchants) {
        if (type.includes(merchant) || merchant.includes(type)) {
          return classification;
        }
      }
    }
    
    return 'unknown';
  }

  /**
   * Analizo patrones históricos del cliente con establecimientos
   * @param {Object} variables - Variables de la transacción
   * @param {string} currentMerchant - Establecimiento actual
   * @returns {Object} - Análisis de patrones
   */
  analyzeMerchantPatterns(variables, currentMerchant) {
    const patterns = {
      // Diversidad de establecimientos usados
      merchant_diversity: variables.historical_merchant_types || 0,
      
      // Experiencia con este tipo de establecimiento
      is_familiar_merchant: this.isFamiliarMerchantType(variables, currentMerchant),
      
      // Patrón de gasto por tipo
      spending_pattern_consistency: this.calculateSpendingConsistency(variables, currentMerchant),
      
      // Frecuencia de uso de establecimientos de alto riesgo
      high_risk_frequency: this.calculateHighRiskFrequency(variables),
      
      // Primera vez usando este tipo
      is_new_merchant_type: variables.historical_merchant_types < 3 ? 1 : 0
    };
    
    return patterns;
  }

  /**
   * Determino si el cliente está familiarizado con este tipo de establecimiento
   * @param {Object} variables - Variables de la transacción
   * @param {string} merchantType - Tipo de establecimiento
   * @returns {number} - 1 si es familiar, 0 si no
   */
  isFamiliarMerchantType(variables, merchantType) {
    // Lógica simplificada - en producción se consultaría el historial real
    if (variables.historical_merchant_types > 10) return 1; // Cliente diverso
    if (variables.historical_merchant_types > 5) return 0.7; // Algo de experiencia
    return 0; // Cliente nuevo o con poca experiencia
  }

  /**
   * Calculo consistencia de gasto para este tipo de establecimiento
   * @param {Object} variables - Variables de la transacción
   * @param {string} merchantType - Tipo de establecimiento
   * @returns {number} - Score de consistencia (0-1)
   */
  calculateSpendingConsistency(variables, merchantType) {
    const classification = this.getMerchantRiskClassification(merchantType);
    const expectedRange = this.amountThresholds[classification] || this.amountThresholds.medium;
    
    // Si el monto está dentro del rango esperado para este tipo
    if (variables.amount <= expectedRange.suspicious) {
      return 0.9; // Muy consistente
    } else if (variables.amount <= expectedRange.extreme) {
      return 0.5; // Moderadamente consistente
    } else {
      return 0.1; // Inconsistente
    }
  }

  /**
   * Calculo frecuencia de uso de establecimientos de alto riesgo
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de frecuencia de alto riesgo (0-1)
   */
  calculateHighRiskFrequency(variables) {
    // Simplificado - en producción analizaría el historial real
    if (variables.historical_merchant_types > 15) {
      return 0.8; // Mucha diversidad puede incluir establecimientos de riesgo
    } else if (variables.historical_merchant_types > 8) {
      return 0.5; // Diversidad moderada
    }
    return 0.2; // Baja diversidad = probablemente bajo riesgo
  }

  /**
   * Preparo los datos de establecimiento para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    const merchantType = variables.merchant_type || 'unknown';
    const classification = this.getMerchantRiskClassification(merchantType);
    const patterns = this.analyzeMerchantPatterns(variables, merchantType);
    
    const input = {
      // Clasificación de riesgo del establecimiento
      is_very_high_risk: classification === 'veryHigh' ? 1 : 0,
      is_high_risk: classification === 'high' ? 1 : 0,
      is_medium_risk: classification === 'medium' ? 1 : 0,
      is_low_risk: classification === 'low' ? 1 : 0,
      is_very_low_risk: classification === 'veryLow' ? 1 : 0,
      is_unknown_merchant: classification === 'unknown' ? 1 : 0,
      
      // Score de riesgo del establecimiento
      merchant_risk_score: this.riskScores[classification] || 0.6,
      
      // Monto vs tipo de establecimiento
      amount_normalized: Math.min(Math.log10(variables.amount + 1) / 6, 1),
      amount_vs_merchant_threshold: this.calculateAmountThresholdRatio(variables.amount, classification),
      
      // Patrones del cliente
      merchant_diversity: Math.min(patterns.merchant_diversity / 20, 1), // Max 20 tipos
      is_familiar_merchant: patterns.is_familiar_merchant,
      spending_consistency: patterns.spending_pattern_consistency,
      high_risk_frequency: patterns.high_risk_frequency,
      is_new_merchant_type: patterns.is_new_merchant_type,
      
      // Contexto temporal y geográfico
      is_night_transaction: variables.is_night_transaction ? 1 : 0,
      is_weekend: variables.is_weekend ? 1 : 0,
      is_international: !variables.is_domestic ? 1 : 0,
      
      // Canal de transacción
      is_online: variables.channel === 'online' ? 1 : 0,
      is_physical: variables.channel === 'physical' ? 1 : 0,
      
      // Experiencia del cliente
      client_age_factor: Math.min(variables.client_age_days / 365, 1),
      
      // Actividad reciente
      recent_activity: Math.min(variables.transactions_last_24h / 20, 1),
      
      // Combinaciones de riesgo específicas
      high_risk_merchant_night: (classification === 'veryHigh' && variables.is_night_transaction) ? 1 : 0,
      high_risk_merchant_international: (classification === 'veryHigh' && !variables.is_domestic) ? 1 : 0,
      new_client_risky_merchant: (variables.client_age_days < 30 && this.riskScores[classification] > 0.6) ? 1 : 0
    };
    
    return input;
  }

  /**
   * Calculo ratio del monto vs umbral del establecimiento
   * @param {number} amount - Monto de la transacción
   * @param {string} classification - Clasificación del establecimiento
   * @returns {number} - Ratio normalizado (0-1)
   */
  calculateAmountThresholdRatio(amount, classification) {
    const thresholds = this.amountThresholds[classification] || this.amountThresholds.medium;
    
    if (amount <= thresholds.suspicious) {
      return 0.2; // Monto normal
    } else if (amount <= thresholds.extreme) {
      return 0.6; // Monto sospechoso
    } else {
      return 1.0; // Monto extremo
    }
  }

  /**
   * Analizo el establecimiento de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis de establecimiento no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'merchant',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de establecimiento completado: Score=${suspicionScore.toFixed(3)}, Tipo=${transactionData.variables.merchant_type}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de establecimiento:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico de establecimiento
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    const merchantType = variables.merchant_type || 'unknown';
    const classification = this.getMerchantRiskClassification(merchantType);
    let suspicionScore = 0;
    const reasons = [];
    
    // Regla 1: Tipo de establecimiento de alto riesgo
    if (classification === 'veryHigh') {
      suspicionScore += 0.7;
      reasons.push(`Establecimiento de muy alto riesgo: ${merchantType}`);
    } else if (classification === 'high') {
      suspicionScore += 0.5;
      reasons.push(`Establecimiento de alto riesgo: ${merchantType}`);
    } else if (classification === 'unknown') {
      suspicionScore += 0.4;
      reasons.push(`Tipo de establecimiento desconocido: ${merchantType}`);
    }
    
    // Regla 2: Monto alto en establecimiento de riesgo
    const thresholds = this.amountThresholds[classification] || this.amountThresholds.medium;
    if (variables.amount > thresholds.extreme) {
      suspicionScore += 0.6;
      reasons.push(`Monto extremo para tipo de establecimiento: $${variables.amount}`);
    } else if (variables.amount > thresholds.suspicious) {
      suspicionScore += 0.3;
      reasons.push(`Monto alto para tipo de establecimiento: $${variables.amount}`);
    }
    
    // Regla 3: Establecimiento de riesgo en horario nocturno
    if ((classification === 'veryHigh' || classification === 'high') && variables.is_night_transaction) {
      suspicionScore += 0.4;
      reasons.push(`Establecimiento de riesgo en horario nocturno: ${merchantType}`);
    }
    
    // Regla 4: Cliente nuevo usando establecimientos de alto riesgo
    if (variables.client_age_days < 30 && (classification === 'veryHigh' || classification === 'high')) {
      suspicionScore += 0.5;
      reasons.push(`Cliente nuevo en establecimiento de riesgo: ${merchantType}`);
    }
    
    // Regla 5: Establecimiento de riesgo internacional
    if ((classification === 'veryHigh' || classification === 'high') && !variables.is_domestic) {
      suspicionScore += 0.4;
      reasons.push(`Establecimiento de riesgo internacional: ${merchantType}`);
    }
    
    // Regla 6: Primera vez usando tipo de establecimiento de riesgo
    if (variables.historical_merchant_types < 3 && classification === 'veryHigh') {
      suspicionScore += 0.4;
      reasons.push(`Primera vez en establecimiento de muy alto riesgo: ${merchantType}`);
    }
    
    // Regla 7: Actividad alta con establecimientos de riesgo
    if (variables.transactions_last_24h > 10 && classification === 'veryHigh') {
      suspicionScore += 0.3;
      reasons.push(`Alta actividad en establecimientos de riesgo`);
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'merchant',
      suspicion_score: Math.min(suspicionScore, 1),
      confidence: 0.8,
      reasons: reasons,
      processing_time_ms: 4
    };
  }

  /**
   * Genero razones específicas del análisis
   * @param {Object} transactionData - Datos originales
   * @param {Object} input - Datos de entrada normalizados
   * @param {number} score - Puntuación de sospecha
   * @returns {Array} - Lista de razones
   */
  generateReasons(transactionData, input, score) {
    const reasons = [];
    const merchantType = transactionData.variables.merchant_type;
    
    if (score > 0.7) {
      if (input.is_very_high_risk) reasons.push(`Establecimiento de muy alto riesgo: ${merchantType}`);
      if (input.high_risk_merchant_night) reasons.push('Establecimiento de riesgo en horario nocturno');
      if (input.amount_vs_merchant_threshold > 0.8) reasons.push('Monto extremo para este tipo de establecimiento');
    } else if (score > 0.5) {
      if (input.is_high_risk) reasons.push(`Establecimiento de alto riesgo: ${merchantType}`);
      if (input.new_client_risky_merchant) reasons.push('Cliente nuevo en establecimiento de riesgo');
      if (input.high_risk_merchant_international) reasons.push('Establecimiento de riesgo internacional');
    } else if (score > 0.3) {
      if (input.is_unknown_merchant) reasons.push(`Tipo de establecimiento desconocido: ${merchantType}`);
      if (input.is_new_merchant_type && input.merchant_risk_score > 0.5) {
        reasons.push('Primera vez en este tipo de establecimiento de riesgo');
      }
      if (input.spending_consistency < 0.4) reasons.push('Patrón de gasto inconsistente para este establecimiento');
    }
    
    return reasons;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.8; // Confianza base alta
    
    // Mayor confianza si conocemos el tipo de establecimiento
    if (!input.is_unknown_merchant) {
      confidence += 0.1;
    }
    
    // Mayor confianza si el cliente tiene experiencia
    if (input.client_age_factor > 0.2) {
      confidence += 0.1;
    }
    
    // Menor confianza si el cliente es muy nuevo
    if (input.client_age_factor < 0.05) {
      confidence -= 0.2;
    }
    
    return Math.max(confidence, 0.6);
  }

  /**
   * Entreno la red con datos históricos
   * @param {Array} trainingData - Datos de entrenamiento
   * @returns {Object} - Resultado del entrenamiento
   */
  async train(trainingData) {
    try {
      logger.info(`Iniciando entrenamiento de red de análisis de establecimiento con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de establecimiento completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de establecimiento:', error);
      throw error;
    }
  }

  /**
   * Exporto el modelo entrenado
   * @returns {Object} - Datos del modelo
   */
  exportModel() {
    return {
      network_id: this.networkId,
      version: this.version,
      trained_model: this.network.toJSON(),
      is_trained: this.isTrained,
      last_training_date: this.lastTrainingDate,
      variable_analyzed: 'merchant',
      risk_classification: this.merchantRiskClassification,
      risk_scores: this.riskScores,
      amount_thresholds: this.amountThresholds
    };
  }

  /**
   * Importo un modelo previamente entrenado
   * @param {Object} modelData - Datos del modelo
   */
  importModel(modelData) {
    try {
      this.network.fromJSON(modelData.trained_model);
      this.isTrained = true;
      this.lastTrainingDate = new Date(modelData.last_training_date);
      this.version = modelData.version;
      
      if (modelData.risk_classification) {
        this.merchantRiskClassification = modelData.risk_classification;
      }
      if (modelData.risk_scores) {
        this.riskScores = modelData.risk_scores;
      }
      if (modelData.amount_thresholds) {
        this.amountThresholds = modelData.amount_thresholds;
      }
      
      logger.info(`Modelo de análisis de establecimiento cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis de establecimiento:', error);
      throw error;
    }
  }

  /**
   * Estadísticas del modelo
   * @returns {Object} - Estadísticas
   */
  getStats() {
    return {
      network_id: this.networkId,
      version: this.version,
      is_trained: this.isTrained,
      last_training_date: this.lastTrainingDate,
      variable: 'merchant',
      description: 'Analiza tipos de establecimiento para detectar patrones de fraude específicos por sector comercial',
      risk_levels: Object.keys(this.riskScores),
      total_merchant_types: Object.values(this.merchantRiskClassification).flat().length
    };
  }
}

module.exports = MerchantAnalyzer;