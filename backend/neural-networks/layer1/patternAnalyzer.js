const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.8 - Análisis de Patrones de Gasto Histórico
 * Esta red analiza si la transacción sigue los patrones históricos del cliente
 */
class PatternAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'pattern_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
  }

  /**
   * Preparo los datos de patrones para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    
    const input = {
      // Desviación del patrón de monto
      amount_deviation: this.calculateAmountDeviation(variables),
      
      // Diversidad de patrones
      location_pattern_score: this.calculateLocationPatternScore(variables),
      merchant_pattern_score: this.calculateMerchantPatternScore(variables),
      
      // Consistencia temporal
      time_pattern_consistency: this.calculateTimePatternConsistency(variables),
      
      // Experiencia del cliente
      client_maturity: Math.min(variables.client_age_days / 730, 1), // Max 2 años
      transaction_experience: Math.min(variables.historical_transaction_count / 100, 1), // Max 100 transacciones
      
      // Variabilidad del comportamiento
      behavioral_consistency: this.calculateBehavioralConsistency(variables),
      
      // Indicadores de ruptura de patrón
      is_new_behavior: this.isNewBehavior(variables),
      pattern_break_severity: this.calculatePatternBreakSeverity(variables),
      
      // Contexto de la transacción actual
      fits_amount_pattern: variables.historical_avg_amount > 0 
        ? Math.exp(-Math.abs(variables.amount - variables.historical_avg_amount) / Math.max(variables.historical_avg_amount, 1))
        : 0.5,
      
      // Regularidad del cliente
      has_established_patterns: variables.historical_transaction_count >= 10 ? 1 : 0
    };
    
    return input;
  }

  /**
   * Calculo desviación del patrón de monto
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de desviación (0-1)
   */
  calculateAmountDeviation(variables) {
    if (!variables.historical_avg_amount || variables.historical_avg_amount === 0) {
      return 0.5; // Neutral si no hay historial
    }
    
    const deviation = Math.abs(variables.amount - variables.historical_avg_amount) / variables.historical_avg_amount;
    return Math.min(deviation / 5, 1); // Normalizar (5x = máxima desviación)
  }

  /**
   * Calculo score de patrón de ubicación
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de patrón de ubicación (0-1)
   */
  calculateLocationPatternScore(variables) {
    if (!variables.historical_location_count) {
      return 0.5; // Neutral si no hay historial
    }
    
    // Si tiene muchas ubicaciones diferentes, es menos predecible
    const diversity = variables.historical_location_count;
    if (diversity > 20) return 0.8; // Muy diverso = patrón impredecible
    if (diversity > 10) return 0.6; // Moderadamente diverso
    if (diversity > 5) return 0.4;  // Algo diverso
    return 0.2; // Muy concentrado = patrón predecible
  }

  /**
   * Calculo score de patrón de establecimiento
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de patrón de establecimiento (0-1)
   */
  calculateMerchantPatternScore(variables) {
    if (!variables.historical_merchant_types) {
      return 0.5; // Neutral si no hay historial
    }
    
    // Diversidad de tipos de establecimiento
    const diversity = variables.historical_merchant_types;
    if (diversity > 15) return 0.7; // Muy diverso
    if (diversity > 8) return 0.5;  // Moderado
    if (diversity > 3) return 0.3;  // Concentrado
    return 0.1; // Muy concentrado = patrón muy predecible
  }

  /**
   * Calculo consistencia del patrón temporal
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de consistencia temporal (0-1)
   */
  calculateTimePatternConsistency(variables) {
    // Basado en si la transacción ocurre en horarios/días usuales del cliente
    let consistency = 0.5; // Base neutral
    
    // Si es fin de semana pero el cliente no suele hacer transacciones en fin de semana
    if (variables.is_weekend) {
      consistency += 0.2; // Menos consistente
    }
    
    // Si es horario nocturno
    if (variables.is_night_transaction) {
      consistency += 0.3; // Menos consistente
    }
    
    return Math.min(consistency, 1);
  }

  /**
   * Calculo consistencia del comportamiento general
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de consistencia (0-1)
   */
  calculateBehavioralConsistency(variables) {
    if (variables.historical_transaction_count < 5) {
      return 0.5; // Insuficientes datos
    }
    
    let consistency = 0;
    
    // Consistencia de frecuencia
    if (variables.avg_transactions_per_day > 0) {
      const frequencyDeviation = Math.abs(1 - (variables.transactions_last_24h / variables.avg_transactions_per_day));
      consistency += Math.max(0, 1 - frequencyDeviation) * 0.4;
    }
    
    // Consistencia de monto
    if (variables.historical_avg_amount > 0) {
      const amountDeviation = Math.abs(variables.amount - variables.historical_avg_amount) / variables.historical_avg_amount;
      consistency += Math.max(0, 1 - amountDeviation) * 0.6;
    }
    
    return consistency;
  }

  /**
   * Determino si es un comportamiento completamente nuevo
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - 1 si es comportamiento nuevo, 0 si no
   */
  isNewBehavior(variables) {
    // Comportamiento nuevo si:
    // 1. Nueva ubicación Y cliente con historial establecido
    if (variables.historical_location_count > 0 && variables.historical_location_count < 3) {
      return 1;
    }
    
    // 2. Monto muy diferente al patrón Y cliente con historial
    if (variables.historical_avg_amount > 0 && variables.historical_transaction_count > 10) {
      const amountRatio = variables.amount / variables.historical_avg_amount;
      if (amountRatio > 5 || amountRatio < 0.2) {
        return 1;
      }
    }
    
    // 3. Nuevo tipo de establecimiento para cliente establecido
    if (variables.historical_merchant_types > 0 && variables.historical_merchant_types < 3 && variables.historical_transaction_count > 15) {
      return 1;
    }
    
    return 0;
  }

  /**
   * Calculo severidad de ruptura de patrón
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de severidad (0-1)
   */
  calculatePatternBreakSeverity(variables) {
    if (variables.historical_transaction_count < 5) {
      return 0; // No hay patrón establecido
    }
    
    let severity = 0;
    
    // Ruptura de patrón de monto
    if (variables.historical_avg_amount > 0) {
      const amountRatio = variables.amount / variables.historical_avg_amount;
      if (amountRatio > 10 || amountRatio < 0.1) {
        severity += 0.4;
      } else if (amountRatio > 5 || amountRatio < 0.2) {
        severity += 0.2;
      }
    }
    
    // Ruptura de patrón temporal
    if (variables.is_night_transaction && variables.historical_transaction_count > 20) {
      severity += 0.2;
    }
    
    // Ruptura de patrón de frecuencia
    if (variables.avg_transactions_per_day > 0) {
      const frequencyRatio = variables.transactions_last_24h / variables.avg_transactions_per_day;
      if (frequencyRatio > 5) {
        severity += 0.3;
      } else if (frequencyRatio > 3) {
        severity += 0.1;
      }
    }
    
    return Math.min(severity, 1);
  }

  /**
   * Analizo los patrones de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis de patrones no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'pattern',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de patrones completado: Score=${suspicionScore.toFixed(3)}, Consistencia=${input.behavioral_consistency.toFixed(2)}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de patrones:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico de patrones
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    let suspicionScore = 0;
    const reasons = [];
    
    // Regla 1: Ruptura severa de patrón de monto
    if (variables.historical_avg_amount > 0) {
      const amountRatio = variables.amount / variables.historical_avg_amount;
      if (amountRatio > 10) {
        suspicionScore += 0.7;
        reasons.push(`Monto ${amountRatio.toFixed(1)}x mayor que patrón histórico`);
      } else if (amountRatio > 5) {
        suspicionScore += 0.4;
        reasons.push(`Monto ${amountRatio.toFixed(1)}x mayor que patrón histórico`);
      } else if (amountRatio < 0.1) {
        suspicionScore += 0.5;
        reasons.push(`Monto ${(1/amountRatio).toFixed(1)}x menor que patrón histórico`);
      }
    }
    
    // Regla 2: Cliente establecido con comportamiento completamente nuevo
    if (variables.historical_transaction_count > 20) {
      if (variables.historical_location_count < 2) {
        suspicionScore += 0.5;
        reasons.push('Nueva ubicación para cliente establecido');
      }
      
      if (variables.is_night_transaction) {
        suspicionScore += 0.3;
        reasons.push('Transacción nocturna inusual para el patrón del cliente');
      }
    }
    
    // Regla 3: Actividad muy superior al patrón
    if (variables.avg_transactions_per_day > 0) {
      const activityRatio = variables.transactions_last_24h / variables.avg_transactions_per_day;
      if (activityRatio > 8) {
        suspicionScore += 0.6;
        reasons.push(`Actividad ${activityRatio.toFixed(1)}x mayor que patrón usual`);
      } else if (activityRatio > 4) {
        suspicionScore += 0.3;
        reasons.push(`Actividad ${activityRatio.toFixed(1)}x mayor que patrón usual`);
      }
    }
    
    // Regla 4: Cliente nuevo con comportamiento anómalo
    if (variables.client_age_days < 30) {
      if (variables.amount > 5000) {
        suspicionScore += 0.4;
        reasons.push('Cliente nuevo con transacción de monto alto');
      }
      if (variables.transactions_last_24h > 10) {
        suspicionScore += 0.3;
        reasons.push('Cliente nuevo con actividad muy alta');
      }
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'pattern',
      suspicion_score: Math.min(suspicionScore, 1),
      confidence: 0.7,
      reasons: reasons,
      processing_time_ms: 6
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
    
    if (score > 0.7) {
      if (input.pattern_break_severity > 0.6) {
        reasons.push('Ruptura severa del patrón establecido');
      }
      if (input.is_new_behavior) {
        reasons.push('Comportamiento completamente nuevo');
      }
      if (input.amount_deviation > 0.8) {
        reasons.push('Monto muy fuera del patrón histórico');
      }
    } else if (score > 0.5) {
      if (input.behavioral_consistency < 0.3) {
        reasons.push('Baja consistencia con comportamiento histórico');
      }
      if (input.location_pattern_score > 0.7) {
        reasons.push('Patrón de ubicación impredecible');
      }
      if (input.time_pattern_consistency > 0.7) {
        reasons.push('Horario inusual para el cliente');
      }
    }
    
    return reasons;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.6; // Base más baja porque los patrones son complejos
    
    // Mayor confianza si tenemos patrones establecidos
    if (input.has_established_patterns) {
      confidence += 0.2;
    }
    
    // Mayor confianza si el cliente es maduro
    if (input.client_maturity > 0.3) {
      confidence += 0.1;
    }
    
    // Mayor confianza si tenemos experiencia de transacciones
    if (input.transaction_experience > 0.2) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1);
  }

  /**
   * Entreno la red con datos históricos
   * @param {Array} trainingData - Datos de entrenamiento
   * @returns {Object} - Resultado del entrenamiento
   */
  async train(trainingData) {
    try {
      logger.info(`Iniciando entrenamiento de red de análisis de patrones con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de patrones completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de patrones:', error);
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
      variable_analyzed: 'pattern'
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
      
      logger.info(`Modelo de análisis de patrones cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis de patrones:', error);
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
      variable: 'pattern',
      description: 'Analiza patrones de comportamiento histórico para detectar desviaciones anómalas'
    };
  }
}

module.exports = PatternAnalyzer;