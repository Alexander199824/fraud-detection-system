const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 2.4 - Combinador de Análisis de Montos
 * Esta red combina análisis relacionados con montos y patrones de gasto de Capa 1
 */
class AmountCombiner {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [12, 8, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'amount_combiner_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Patrones de monto sospechosos
    this.amountPatterns = {
      // Montos redondos sospechosos
      roundAmounts: [100, 200, 500, 1000, 2000, 5000, 10000],
      
      // Rangos de prueba de tarjeta
      cardTestingRanges: [
        { min: 0.01, max: 1.99 },   // Micro-transacciones
        { min: 1.00, max: 9.99 },   // Transacciones pequeñas de prueba
      ],
      
      // Rangos de lavado de dinero
      moneyLaunderingRanges: [
        { min: 9000, max: 9999 },   // Justo debajo de reportes obligatorios
        { min: 4500, max: 4999 },   // División de montos grandes
      ],
      
      // Umbrales por tipo de establecimiento
      merchantThresholds: {
        gas_station: { normal: 100, suspicious: 500, extreme: 1000 },
        grocery: { normal: 300, suspicious: 1000, extreme: 2000 },
        restaurant: { normal: 200, suspicious: 500, extreme: 1000 },
        online: { normal: 500, suspicious: 2000, extreme: 10000 },
        jewelry: { normal: 1000, suspicious: 5000, extreme: 50000 },
        electronics: { normal: 800, suspicious: 3000, extreme: 20000 }
      }
    };
  }

  /**
   * Analizo patrones de gasto del cliente
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Análisis de patrones de gasto
   */
  analyzeSpendingPatterns(transactionData) {
    const { variables } = transactionData;
    
    return {
      // Análisis de monto vs historial
      amount_deviation: this.calculateAmountDeviation(variables),
      
      // Consistencia de gasto
      spending_consistency: this.calculateSpendingConsistency(variables),
      
      // Patrones de escalamiento
      escalation_pattern: this.detectEscalationPattern(variables),
      
      // Patrones de fragmentación
      fragmentation_pattern: this.detectFragmentationPattern(variables),
      
      // Análisis de montos redondos
      round_amount_pattern: this.analyzeRoundAmountPattern(variables),
      
      // Patrones de prueba de tarjeta
      card_testing_pattern: this.detectCardTestingPattern(variables),
      
      // Análisis de velocidad de gasto
      spending_velocity: this.analyzeSpendingVelocity(variables),
      
      // Patrones de monto por establecimiento
      merchant_amount_consistency: this.analyzeMerchantAmountConsistency(variables)
    };
  }

  /**
   * Calculo desviación del monto vs historial del cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de desviación (0-1)
   */
  calculateAmountDeviation(variables) {
    if (!variables.historical_avg_amount || variables.historical_avg_amount === 0) {
      return 0.5; // Neutral si no hay historial
    }
    
    const ratio = variables.amount / variables.historical_avg_amount;
    
    // Calcular desviación normalizada
    if (ratio > 10) return 1.0;      // 10x mayor = máxima desviación
    if (ratio > 5) return 0.8;       // 5x mayor = alta desviación
    if (ratio > 2) return 0.5;       // 2x mayor = media desviación
    if (ratio < 0.1) return 0.7;     // 10x menor = alta desviación
    if (ratio < 0.2) return 0.4;     // 5x menor = media desviación
    
    return 0.1; // Dentro del rango normal
  }

  /**
   * Calculo consistencia de gasto general
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de consistencia (0-1)
   */
  calculateSpendingConsistency(variables) {
    if (variables.historical_transaction_count < 5) {
      return 0.5; // Neutral para clientes nuevos
    }
    
    let consistencyScore = 0.5; // Base
    
    // Si el monto está cerca del promedio histórico
    if (variables.historical_avg_amount > 0) {
      const ratio = variables.amount / variables.historical_avg_amount;
      if (ratio >= 0.5 && ratio <= 2.0) {
        consistencyScore += 0.3; // Consistente
      }
    }
    
    // Si el cliente tiene experiencia
    if (variables.client_age_days > 90) {
      consistencyScore += 0.2;
    }
    
    return Math.min(consistencyScore, 1);
  }

  /**
   * Detecto patrón de escalamiento de montos
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de escalamiento (0-1)
   */
  detectEscalationPattern(variables) {
    // Cliente nuevo con monto alto
    if (variables.client_age_days < 30 && variables.amount > 5000) {
      return 0.8;
    }
    
    // Monto muy superior al histórico
    if (variables.historical_avg_amount > 0) {
      const ratio = variables.amount / variables.historical_avg_amount;
      if (ratio > 8) return 1.0;
      if (ratio > 4) return 0.6;
      if (ratio > 2) return 0.3;
    }
    
    return 0;
  }

  /**
   * Detecto patrón de fragmentación (división de montos grandes)
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de fragmentación (0-1)
   */
  detectFragmentationPattern(variables) {
    let fragmentationScore = 0;
    
    // Múltiples transacciones de montos similares en poco tiempo
    if (variables.transactions_last_24h > 5 && variables.amount_last_24h > 0) {
      const avgAmountToday = variables.amount_last_24h / variables.transactions_last_24h;
      const currentVsAvgToday = Math.abs(variables.amount - avgAmountToday) / avgAmountToday;
      
      if (currentVsAvgToday < 0.1) { // Montos muy similares
        fragmentationScore += 0.6;
      }
    }
    
    // Monto justo debajo de umbrales de reporte
    if (this.isJustBelowThreshold(variables.amount)) {
      fragmentationScore += 0.4;
    }
    
    return Math.min(fragmentationScore, 1);
  }

  /**
   * Verifico si el monto está justo debajo de umbrales importantes
   * @param {number} amount - Monto de la transacción
   * @returns {boolean} - True si está justo debajo de un umbral
   */
  isJustBelowThreshold(amount) {
    // Umbrales comunes de reporte
    const thresholds = [3000, 5000, 10000, 15000];
    
    for (const threshold of thresholds) {
      if (amount >= (threshold - 100) && amount < threshold) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Analizo patrón de montos redondos
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de monto redondo sospechoso (0-1)
   */
  analyzeRoundAmountPattern(variables) {
    const amount = variables.amount;
    
    // Verificar si es un monto exactamente redondo
    if (this.amountPatterns.roundAmounts.includes(amount)) {
      return 0.6;
    }
    
    // Verificar si termina en 00
    if (amount >= 100 && amount % 100 === 0) {
      return 0.4;
    }
    
    // Verificar si termina en 50
    if (amount >= 50 && amount % 50 === 0) {
      return 0.2;
    }
    
    return 0;
  }

  /**
   * Detecto patrón de prueba de tarjeta
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de prueba de tarjeta (0-1)
   */
  detectCardTestingPattern(variables) {
    const amount = variables.amount;
    let testingScore = 0;
    
    // Verificar rangos de prueba
    for (const range of this.amountPatterns.cardTestingRanges) {
      if (amount >= range.min && amount <= range.max) {
        testingScore += 0.7;
        break;
      }
    }
    
    // Múltiples transacciones pequeñas seguidas
    if (amount < 10 && variables.transactions_last_hour > 3) {
      testingScore += 0.5;
    }
    
    // Transacción muy pequeña de cliente nuevo
    if (amount < 2 && variables.client_age_days < 7) {
      testingScore += 0.3;
    }
    
    return Math.min(testingScore, 1);
  }

  /**
   * Analizo velocidad de gasto
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de velocidad de gasto sospechosa (0-1)
   */
  analyzeSpendingVelocity(variables) {
    let velocityScore = 0;
    
    // Alto gasto en 24 horas
    if (variables.amount_last_24h > 20000) {
      velocityScore += 0.6;
    } else if (variables.amount_last_24h > 10000) {
      velocityScore += 0.4;
    } else if (variables.amount_last_24h > 5000) {
      velocityScore += 0.2;
    }
    
    // Monto actual alto en relación al gasto diario
    if (variables.amount_last_24h > 0) {
      const currentVsDailySpending = variables.amount / variables.amount_last_24h;
      if (currentVsDailySpending > 0.5) { // Más del 50% del gasto diario en una transacción
        velocityScore += 0.3;
      }
    }
    
    return Math.min(velocityScore, 1);
  }

  /**
   * Analizo consistencia de monto por tipo de establecimiento
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de inconsistencia (0-1)
   */
  analyzeMerchantAmountConsistency(variables) {
    const merchantType = variables.merchant_type || 'unknown';
    const amount = variables.amount;
    
    // Obtener umbrales para este tipo de establecimiento
    const thresholds = this.amountPatterns.merchantThresholds[merchantType] || 
                      this.amountPatterns.merchantThresholds.online;
    
    if (amount > thresholds.extreme) {
      return 1.0; // Extremadamente inconsistente
    } else if (amount > thresholds.suspicious) {
      return 0.6; // Sospechoso
    } else if (amount <= thresholds.normal) {
      return 0.1; // Normal
    }
    
    return 0.3; // Moderadamente sospechoso
  }

  /**
   * Combino análisis de montos de Capa 1
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de todas las redes de Capa 1
   * @returns {Object} - Datos preparados para la red
   */
  prepareInput(transactionData, layer1Results) {
    // Extraer scores relacionados con montos
    const amountScores = {
      amount: layer1Results.amount?.suspicion_score || 0,
      pattern: layer1Results.pattern?.suspicion_score || 0,
      merchant: layer1Results.merchant?.suspicion_score || 0,
      velocity: layer1Results.velocity?.suspicion_score || 0,
      frequency: layer1Results.frequency?.suspicion_score || 0
    };
    
    // Analizar patrones de gasto
    const spending = this.analyzeSpendingPatterns(transactionData);
    const { variables } = transactionData;
    
    const input = {
      // Scores de Capa 1 relacionados con montos
      amount_score: amountScores.amount,
      pattern_score: amountScores.pattern,
      merchant_score: amountScores.merchant,
      velocity_score: amountScores.velocity,
      frequency_score: amountScores.frequency,
      
      // Análisis de montos específico
      amount_deviation: spending.amount_deviation,
      spending_consistency: spending.spending_consistency,
      escalation_pattern: spending.escalation_pattern,
      fragmentation_pattern: spending.fragmentation_pattern,
      round_amount_pattern: spending.round_amount_pattern,
      card_testing_pattern: spending.card_testing_pattern,
      spending_velocity: spending.spending_velocity,
      merchant_amount_consistency: spending.merchant_amount_consistency,
      
      // Información de monto base
      amount_normalized: Math.min(Math.log10(variables.amount + 1) / 6, 1), // Max log10(1M)
      amount_vs_historical: variables.historical_avg_amount > 0 ? 
        Math.min(variables.amount / variables.historical_avg_amount / 10, 1) : 0.5,
      
      // Patrones de monto específicos detectados
      micro_transaction: variables.amount < 1 ? 1 : 0,
      large_transaction: variables.amount > 10000 ? 1 : 0,
      round_amount: variables.amount % 100 === 0 ? 1 : 0,
      threshold_avoidance: this.isJustBelowThreshold(variables.amount) ? 1 : 0,
      
      // Combinaciones sospechosas
      new_client_large_amount: (variables.client_age_days < 30 && variables.amount > 5000) ? 1 : 0,
      night_large_amount: (variables.is_night_transaction && variables.amount > 8000) ? 1 : 0,
      international_large_amount: (!variables.is_domestic && variables.amount > 3000) ? 1 : 0,
      
      // Información del cliente y contexto
      client_experience: Math.min(variables.client_age_days / 365, 1),
      transaction_count: Math.min(variables.historical_transaction_count / 100, 1),
      
      // Score de monto combinado
      amount_combined_score: (amountScores.amount + amountScores.pattern + amountScores.merchant) / 3,
      
      // Correlaciones de monto
      amount_merchant_correlation: this.calculateCorrelation(amountScores.amount, amountScores.merchant),
      amount_velocity_correlation: this.calculateCorrelation(amountScores.amount, amountScores.velocity),
      
      // Índice de sospecha de monto
      amount_suspicion_index: this.calculateAmountSuspicionIndex(variables, amountScores, spending)
    };
    
    return input;
  }

  /**
   * Calculo correlación entre dos scores
   * @param {number} score1 - Primer score
   * @param {number} score2 - Segundo score
   * @returns {number} - Correlación (0-1)
   */
  calculateCorrelation(score1, score2) {
    if (score1 > 0.6 && score2 > 0.6) return 1.0;
    if (score1 < 0.3 && score2 < 0.3) return 0.8;
    return Math.abs(score1 - score2) < 0.3 ? 0.7 : 0.3;
  }

  /**
   * Calculo índice de sospecha de monto
   * @param {Object} variables - Variables de la transacción
   * @param {Object} amountScores - Scores de monto
   * @param {Object} spending - Análisis de gasto
   * @returns {number} - Índice de sospecha (0-1)
   */
  calculateAmountSuspicionIndex(variables, amountScores, spending) {
    let suspicionIndex = 0;
    
    // Factor principal de monto
    suspicionIndex += amountScores.amount * 0.3;
    
    // Factor de patrón de gasto
    suspicionIndex += amountScores.pattern * 0.25;
    
    // Factor de establecimiento vs monto
    suspicionIndex += amountScores.merchant * 0.2;
    
    // Factor de escalamiento
    suspicionIndex += spending.escalation_pattern * 0.15;
    
    // Factor de prueba de tarjeta
    suspicionIndex += spending.card_testing_pattern * 0.1;
    
    return Math.min(suspicionIndex, 1);
  }

  /**
   * Analizo y combino patrones de montos
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado del análisis combinado
   */
  async analyze(transactionData, layer1Results) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red combinadora de montos no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData, layer1Results);
      }
      
      const input = this.prepareInput(transactionData, layer1Results);
      const output = this.network.run(input);
      const combinedScore = Array.isArray(output) ? output[0] : output;
      
      const patterns = this.detectAmountPatterns(transactionData, layer1Results, input);
      
      const result = {
        network_id: this.networkId,
        combined_score: combinedScore,
        confidence: this.calculateConfidence(input),
        patterns_detected: patterns,
        amount_analysis: {
          amount_risk: input.amount_combined_score,
          deviation_risk: input.amount_deviation,
          escalation_risk: input.escalation_pattern,
          testing_risk: input.card_testing_pattern,
          velocity_risk: input.spending_velocity
        },
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de montos completado: Score=${combinedScore.toFixed(3)}, Monto=$${transactionData.variables.amount}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de montos:', error);
      return this.heuristicAnalysis(transactionData, layer1Results);
    }
  }

  /**
   * Análisis heurístico de montos
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData, layer1Results) {
    const input = this.prepareInput(transactionData, layer1Results);
    let combinedScore = input.amount_suspicion_index;
    const patterns = [];
    
    // Ajustar score basado en patrones específicos
    if (input.escalation_pattern > 0.7) {
      combinedScore += 0.2;
      patterns.push('Patrón de escalamiento de montos detectado');
    }
    
    if (input.card_testing_pattern > 0.6) {
      combinedScore += 0.25;
      patterns.push('Patrón de prueba de tarjeta detectado');
    }
    
    if (input.fragmentation_pattern > 0.5) {
      combinedScore += 0.2;
      patterns.push('Patrón de fragmentación de montos');
    }
    
    if (input.threshold_avoidance) {
      combinedScore += 0.15;
      patterns.push('Evasión de umbrales de reporte');
    }
    
    if (input.new_client_large_amount) {
      combinedScore += 0.15;
      patterns.push('Cliente nuevo con monto alto');
    }
    
    if (input.night_large_amount) {
      combinedScore += 0.1;
      patterns.push('Monto alto en horario nocturno');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      combined_score: Math.min(combinedScore, 1),
      confidence: 0.8,
      patterns_detected: patterns,
      amount_analysis: {
        amount_risk: input.amount_combined_score,
        deviation_risk: input.amount_deviation,
        escalation_risk: input.escalation_pattern,
        testing_risk: input.card_testing_pattern,
        velocity_risk: input.spending_velocity
      },
      processing_time_ms: 6
    };
  }

  /**
   * Detecto patrones específicos de montos
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} input - Datos de entrada procesados
   * @returns {Array} - Lista de patrones detectados
   */
  detectAmountPatterns(transactionData, layer1Results, input) {
    const patterns = [];
    
    if (input.escalation_pattern > 0.7) {
      patterns.push('Escalamiento significativo de montos');
    }
    
    if (input.card_testing_pattern > 0.6) {
      patterns.push('Patrón de prueba de tarjeta con micro-transacciones');
    }
    
    if (input.fragmentation_pattern > 0.5) {
      patterns.push('Fragmentación de montos para evadir detección');
    }
    
    if (input.spending_consistency < 0.3) {
      patterns.push('Comportamiento de gasto altamente inconsistente');
    }
    
    if (input.round_amount_pattern > 0.5) {
      patterns.push('Patrón de montos redondos sospechoso');
    }
    
    if (input.amount_deviation > 0.8) {
      patterns.push('Desviación extrema del patrón histórico de montos');
    }
    
    if (input.merchant_amount_consistency > 0.7) {
      patterns.push('Monto inconsistente para tipo de establecimiento');
    }
    
    if (input.amount_velocity_correlation > 0.8) {
      patterns.push('Fuerte correlación monto-velocidad sospechosa');
    }
    
    return patterns;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.8; // Confianza base
    
    // Mayor confianza si tenemos historial del cliente
    if (input.transaction_count > 0.1) {
      confidence += 0.1;
    }
    
    // Mayor confianza si el cliente tiene experiencia
    if (input.client_experience > 0.2) {
      confidence += 0.1;
    }
    
    // Menor confianza si es cliente muy nuevo
    if (input.client_experience < 0.05) {
      confidence -= 0.1;
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
      logger.info(`Iniciando entrenamiento de red combinadora de montos con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => {
        const mockLayer1Results = this.generateMockLayer1Results(data);
        return {
          input: this.prepareInput(data, mockLayer1Results),
          output: [data.fraud_score || 0]
        };
      });
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red combinadora de montos completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red combinadora de montos:', error);
      throw error;
    }
  }

  /**
   * Genero resultados simulados de Capa 1 para entrenamiento
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultados simulados de Capa 1
   */
  generateMockLayer1Results(transactionData) {
    const fraudScore = transactionData.fraud_score || 0;
    
    return {
      amount: { suspicion_score: fraudScore * (0.8 + Math.random() * 0.4) },
      pattern: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      merchant: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) },
      velocity: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      frequency: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) }
    };
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
      layer: 2,
      purpose: 'amount_combination',
      amount_patterns: this.amountPatterns
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
      
      if (modelData.amount_patterns) {
        this.amountPatterns = modelData.amount_patterns;
      }
      
      logger.info(`Modelo combinador de montos cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo combinador de montos:', error);
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
      layer: 2,
      purpose: 'amount_combination',
      description: 'Combina análisis de montos de Capa 1 para detectar patrones complejos de gasto fraudulento',
      input_networks: ['amount', 'pattern', 'merchant', 'velocity', 'frequency']
    };
  }
}

module.exports = AmountCombiner;