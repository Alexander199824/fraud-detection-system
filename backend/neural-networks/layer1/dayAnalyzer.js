const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.4 - Análisis de Día de la Semana
 * Esta red analiza si el día de la semana de una transacción es sospechoso
 */
class DayAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'day_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Patrones normales por día de la semana
    this.dayPatterns = {
      0: { name: 'Domingo', businessLevel: 0.3, riskLevel: 0.4 },
      1: { name: 'Lunes', businessLevel: 0.9, riskLevel: 0.2 },
      2: { name: 'Martes', businessLevel: 1.0, riskLevel: 0.1 },
      3: { name: 'Miércoles', businessLevel: 1.0, riskLevel: 0.1 },
      4: { name: 'Jueves', businessLevel: 1.0, riskLevel: 0.1 },
      5: { name: 'Viernes', businessLevel: 0.9, riskLevel: 0.2 },
      6: { name: 'Sábado', businessLevel: 0.5, riskLevel: 0.3 }
    };
  }

  /**
   * Preparo los datos de día para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    const dayOfWeek = variables.day_of_week; // 0 = Domingo, 6 = Sábado
    const dayInfo = this.dayPatterns[dayOfWeek] || this.dayPatterns[0];
    
    const input = {
      // Codificación one-hot del día
      is_sunday: dayOfWeek === 0 ? 1 : 0,
      is_monday: dayOfWeek === 1 ? 1 : 0,
      is_tuesday: dayOfWeek === 2 ? 1 : 0,
      is_wednesday: dayOfWeek === 3 ? 1 : 0,
      is_thursday: dayOfWeek === 4 ? 1 : 0,
      is_friday: dayOfWeek === 5 ? 1 : 0,
      is_saturday: dayOfWeek === 6 ? 1 : 0,
      
      // Representación cíclica del día (para capturar patrones circulares)
      day_sin: Math.sin(2 * Math.PI * dayOfWeek / 7),
      day_cos: Math.cos(2 * Math.PI * dayOfWeek / 7),
      
      // Características del día
      is_weekend: variables.is_weekend ? 1 : 0,
      is_business_day: (dayOfWeek >= 1 && dayOfWeek <= 5) ? 1 : 0,
      
      // Nivel de actividad comercial esperado
      business_level: dayInfo.businessLevel,
      day_risk_level: dayInfo.riskLevel,
      
      // Contexto de la transacción
      amount_normalized: Math.min(Math.log10(variables.amount + 1) / 6, 1),
      is_high_amount: variables.amount > 5000 ? 1 : 0,
      
      // Información temporal adicional
      hour_of_day: variables.hour_of_day / 24, // Normalizado
      is_night_transaction: variables.is_night_transaction ? 1 : 0,
      
      // Patrones del cliente
      client_age_factor: Math.min(variables.client_age_days / 365, 1),
      
      // Actividad reciente
      transactions_today: Math.min(variables.transactions_last_24h / 20, 1),
      
      // Combinaciones específicas de día + tiempo
      weekend_night: (variables.is_weekend && variables.is_night_transaction) ? 1 : 0,
      business_day_late: (dayOfWeek >= 1 && dayOfWeek <= 5 && variables.hour_of_day > 22) ? 1 : 0,
      sunday_early: (dayOfWeek === 0 && variables.hour_of_day < 8) ? 1 : 0,
      
      // Análisis de patrones históricos del cliente para este día
      day_consistency: this.calculateDayConsistency(variables, dayOfWeek)
    };
    
    return input;
  }

  /**
   * Calculo la consistencia del cliente para este día específico
   * @param {Object} variables - Variables de la transacción
   * @param {number} dayOfWeek - Día de la semana (0-6)
   * @returns {number} - Score de consistencia (0-1)
   */
  calculateDayConsistency(variables, dayOfWeek) {
    // Esto sería idealmente calculado con datos históricos reales del cliente
    // Por ahora, uso una aproximación basada en patrones generales
    
    if (variables.historical_transaction_count < 10) {
      return 0.5; // Neutral si no hay suficiente historial
    }
    
    // Simular consistencia basada en el tipo de día
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const avgTransactionsPerDay = variables.avg_transactions_per_day || 0;
    
    if (isWeekend) {
      // Los fines de semana generalmente tienen menos actividad
      return avgTransactionsPerDay > 2 ? 0.3 : 0.7;
    } else {
      // Los días laborales tienen más actividad normal
      return avgTransactionsPerDay > 0.5 ? 0.8 : 0.4;
    }
  }

  /**
   * Analizo el día de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis de día no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'day',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      const dayName = this.dayPatterns[transactionData.variables.day_of_week]?.name || 'Desconocido';
      logger.info(`Análisis de día completado: Score=${suspicionScore.toFixed(3)}, Día=${dayName}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de día:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico de día
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    const dayOfWeek = variables.day_of_week;
    const dayName = this.dayPatterns[dayOfWeek]?.name || 'Desconocido';
    let suspicionScore = 0;
    const reasons = [];
    
    // Regla 1: Transacciones de domingo muy temprano
    if (dayOfWeek === 0 && variables.hour_of_day < 7) {
      suspicionScore += 0.5;
      reasons.push('Transacción domingo muy temprano');
    }
    
    // Regla 2: Transacciones de fin de semana con montos altos
    if (variables.is_weekend && variables.amount > 10000) {
      suspicionScore += 0.4;
      reasons.push(`Monto alto en fin de semana: $${variables.amount}`);
    }
    
    // Regla 3: Mucha actividad en domingo (inusual)
    if (dayOfWeek === 0 && variables.transactions_last_24h > 10) {
      suspicionScore += 0.6;
      reasons.push(`Alta actividad dominical: ${variables.transactions_last_24h} transacciones`);
    }
    
    // Regla 4: Transacciones nocturnas en días laborales
    if (!variables.is_weekend && variables.is_night_transaction && variables.hour_of_day > 23) {
      suspicionScore += 0.3;
      reasons.push(`Transacción muy tardía en ${dayName}`);
    }
    
    // Regla 5: Cliente nuevo con patrones inusuales de día
    if (variables.client_age_days < 14) {
      if (variables.is_weekend && variables.amount > 2000) {
        suspicionScore += 0.3;
        reasons.push('Cliente nuevo con transacción significativa en fin de semana');
      }
      if (dayOfWeek === 0 && variables.transactions_last_24h > 5) {
        suspicionScore += 0.4;
        reasons.push('Cliente nuevo con alta actividad dominical');
      }
    }
    
    // Regla 6: Patrones atípicos por día específico
    if (dayOfWeek === 6 && variables.hour_of_day < 6) { // Sábado muy temprano
      suspicionScore += 0.3;
      reasons.push('Transacción sábado muy temprano');
    }
    
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && variables.hour_of_day > 23 && variables.amount > 5000) {
      suspicionScore += 0.4;
      reasons.push('Transacción de monto alto muy tarde en día laboral');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'day',
      suspicion_score: Math.min(suspicionScore, 1),
      confidence: 0.7,
      reasons: reasons,
      processing_time_ms: 3
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
    const dayOfWeek = transactionData.variables.day_of_week;
    const dayName = this.dayPatterns[dayOfWeek]?.name || 'Desconocido';
    
    if (score > 0.7) {
      if (input.weekend_night) reasons.push('Transacción nocturna de fin de semana');
      if (input.sunday_early) reasons.push('Transacción domingo muy temprano');
      if (input.day_consistency < 0.3) reasons.push(`Patrón inusual para ${dayName}`);
    } else if (score > 0.5) {
      if (input.business_day_late) reasons.push('Transacción muy tardía en día laboral');
      if (input.is_weekend && input.is_high_amount) reasons.push('Monto alto en fin de semana');
      if (input.day_risk_level > 0.3) reasons.push(`Día de riesgo: ${dayName}`);
    } else if (score > 0.3) {
      if (input.is_weekend) reasons.push('Transacción de fin de semana');
      if (input.business_level < 0.5) reasons.push('Día de baja actividad comercial');
    }
    
    return reasons;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.8; // Confianza base alta para análisis temporal
    
    // Mayor confianza si tenemos consistencia histórica
    if (input.day_consistency > 0.5) {
      confidence += 0.1;
    }
    
    // Mayor confianza si el cliente no es muy nuevo
    if (input.client_age_factor > 0.1) {
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
      logger.info(`Iniciando entrenamiento de red de análisis de día con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de día completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de día:', error);
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
      variable_analyzed: 'day',
      day_patterns: this.dayPatterns
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
      
      if (modelData.day_patterns) {
        this.dayPatterns = modelData.day_patterns;
      }
      
      logger.info(`Modelo de análisis de día cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis de día:', error);
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
      variable: 'day',
      description: 'Analiza el día de la semana de transacciones para detectar patrones temporales anómalos',
      supported_days: Object.values(this.dayPatterns).map(day => day.name)
    };
  }
}

module.exports = DayAnalyzer;