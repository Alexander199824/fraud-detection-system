const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.9 - Análisis de Frecuencia de Uso
 * Esta red analiza si la frecuencia de uso de la tarjeta es sospechosa
 */
class FrequencyAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'frequency_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Patrones normales de frecuencia
    this.normalPatterns = {
      dailyTransactions: { min: 0, max: 15, optimal: 3 },
      weeklyTransactions: { min: 0, max: 80, optimal: 20 },
      monthlyTransactions: { min: 0, max: 300, optimal: 80 },
      avgTimeBetween: { min: 30, max: 14400, optimal: 480 } // en minutos
    };
  }

  /**
   * Calculo métricas de frecuencia del cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {Object} - Métricas de frecuencia calculadas
   */
  calculateFrequencyMetrics(variables) {
    const metrics = {
      // Frecuencia actual
      current_daily_rate: variables.transactions_last_24h || 0,
      current_hourly_rate: variables.transactions_last_hour || 0,
      
      // Frecuencia histórica
      historical_daily_avg: variables.avg_transactions_per_day || 0,
      historical_total: variables.historical_transaction_count || 0,
      
      // Tiempo entre transacciones
      time_since_last: variables.time_since_prev_transaction || 0,
      
      // Días de actividad del cliente
      client_age_days: variables.client_age_days || 0,
      
      // Ratios de actividad
      daily_ratio: 0,
      burst_factor: 0,
      consistency_score: 0
    };
    
    // Calcular ratio de actividad actual vs histórica
    if (metrics.historical_daily_avg > 0) {
      metrics.daily_ratio = metrics.current_daily_rate / metrics.historical_daily_avg;
    }
    
    // Calcular factor de ráfaga (concentración de transacciones)
    if (metrics.current_daily_rate > 0) {
      metrics.burst_factor = metrics.current_hourly_rate / (metrics.current_daily_rate / 24);
    }
    
    // Calcular consistencia (qué tan predecible es el cliente)
    if (metrics.client_age_days > 7 && metrics.historical_total > 0) {
      const expected_transactions = (metrics.client_age_days * metrics.historical_daily_avg);
      metrics.consistency_score = Math.min(metrics.historical_total / expected_transactions, 2);
    }
    
    return metrics;
  }

  /**
   * Preparo los datos de frecuencia para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    const metrics = this.calculateFrequencyMetrics(variables);
    
    const input = {
      // Frecuencia actual normalizada
      daily_transactions: Math.min(metrics.current_daily_rate / 20, 1), // Max 20 por día
      hourly_transactions: Math.min(metrics.current_hourly_rate / 10, 1), // Max 10 por hora
      
      // Frecuencia histórica
      historical_avg_daily: Math.min(metrics.historical_daily_avg / 10, 1), // Max 10 promedio
      historical_total_norm: Math.min(metrics.historical_total / 1000, 1), // Max 1000 transacciones
      
      // Ratios y factores
      activity_ratio: Math.min(metrics.daily_ratio / 5, 1), // Max 5x el promedio
      burst_factor: Math.min(metrics.burst_factor / 10, 1), // Max 10x concentración
      consistency_score: Math.min(metrics.consistency_score, 1),
      
      // Tiempo entre transacciones
      time_since_last_norm: metrics.time_since_last > 0 ? 
        Math.min(metrics.time_since_last / 1440, 1) : 1, // Max 24 horas
      
      // Indicadores de patrones anómalos
      very_high_frequency: metrics.current_daily_rate > 15 ? 1 : 0,
      very_low_frequency: (metrics.current_daily_rate === 0 && metrics.client_age_days > 30) ? 1 : 0,
      rapid_succession: metrics.time_since_last < 2 ? 1 : 0, // Menos de 2 minutos
      
      // Madurez del cliente
      client_maturity: Math.min(metrics.client_age_days / 365, 1), // Max 1 año
      has_history: metrics.historical_total > 10 ? 1 : 0,
      
      // Contexto de la transacción actual
      amount_normalized: Math.min(Math.log10(variables.amount + 1) / 6, 1),
      is_high_amount: variables.amount > 5000 ? 1 : 0,
      is_weekend: variables.is_weekend ? 1 : 0,
      is_night: variables.is_night_transaction ? 1 : 0,
      
      // Patrones de actividad inusuales
      dormant_reactivation: this.isDormantReactivation(metrics),
      sudden_hyperactivity: this.isSuddenHyperactivity(metrics),
      frequency_deviation: this.calculateFrequencyDeviation(metrics)
    };
    
    return input;
  }

  /**
   * Determino si es una reactivación de cuenta dormida
   * @param {Object} metrics - Métricas de frecuencia
   * @returns {number} - 1 si es reactivación dormida, 0 si no
   */
  isDormantReactivation(metrics) {
    // Cliente viejo con poca actividad histórica que de repente se activa
    if (metrics.client_age_days > 90 && 
        metrics.historical_daily_avg < 0.1 && 
        metrics.current_daily_rate > 3) {
      return 1;
    }
    
    // Mucho tiempo sin actividad y de repente alta actividad
    if (metrics.time_since_last > 4320 && // Más de 3 días
        metrics.current_daily_rate > 5) {
      return 1;
    }
    
    return 0;
  }

  /**
   * Determino si hay hiperactividad súbita
   * @param {Object} metrics - Métricas de frecuencia
   * @returns {number} - 1 si hay hiperactividad, 0 si no
   */
  isSuddenHyperactivity(metrics) {
    // Actividad actual mucho mayor que el histórico
    if (metrics.daily_ratio > 8) {
      return 1;
    }
    
    // Muchas transacciones concentradas en poco tiempo
    if (metrics.burst_factor > 15) {
      return 1;
    }
    
    // Cliente nuevo con actividad extrema
    if (metrics.client_age_days < 7 && metrics.current_daily_rate > 10) {
      return 1;
    }
    
    return 0;
  }

  /**
   * Calculo la desviación de frecuencia
   * @param {Object} metrics - Métricas de frecuencia
   * @returns {number} - Score de desviación (0-1)
   */
  calculateFrequencyDeviation(metrics) {
    if (metrics.historical_daily_avg === 0) {
      return 0.5; // Neutral si no hay historial
    }
    
    const deviation = Math.abs(metrics.current_daily_rate - metrics.historical_daily_avg);
    const relative_deviation = deviation / Math.max(metrics.historical_daily_avg, 1);
    
    return Math.min(relative_deviation / 5, 1); // Normalizar
  }

  /**
   * Analizo la frecuencia de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis de frecuencia no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'frequency',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de frecuencia completado: Score=${suspicionScore.toFixed(3)}, Trans/día=${transactionData.variables.transactions_last_24h}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de frecuencia:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico de frecuencia
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    const metrics = this.calculateFrequencyMetrics(variables);
    let suspicionScore = 0;
    const reasons = [];
    
    // Regla 1: Actividad extremadamente alta
    if (metrics.current_daily_rate > 20) {
      suspicionScore += 0.8;
      reasons.push(`Actividad extrema: ${metrics.current_daily_rate} transacciones en 24h`);
    } else if (metrics.current_daily_rate > 15) {
      suspicionScore += 0.6;
      reasons.push(`Actividad muy alta: ${metrics.current_daily_rate} transacciones en 24h`);
    }
    
    // Regla 2: Actividad en ráfagas
    if (metrics.current_hourly_rate > 8) {
      suspicionScore += 0.7;
      reasons.push(`Ráfaga de actividad: ${metrics.current_hourly_rate} transacciones en 1 hora`);
    } else if (metrics.current_hourly_rate > 5) {
      suspicionScore += 0.4;
      reasons.push(`Alta actividad horaria: ${metrics.current_hourly_rate} transacciones`);
    }
    
    // Regla 3: Transacciones muy seguidas
    if (metrics.time_since_last < 1) {
      suspicionScore += 0.6;
      reasons.push(`Transacciones muy seguidas: ${metrics.time_since_last.toFixed(1)} minutos`);
    } else if (metrics.time_since_last < 3) {
      suspicionScore += 0.3;
      reasons.push(`Transacciones seguidas: ${metrics.time_since_last.toFixed(1)} minutos`);
    }
    
    // Regla 4: Actividad muy superior al patrón histórico
    if (metrics.daily_ratio > 10) {
      suspicionScore += 0.7;
      reasons.push(`Actividad ${metrics.daily_ratio.toFixed(1)}x mayor que patrón histórico`);
    } else if (metrics.daily_ratio > 5) {
      suspicionScore += 0.4;
      reasons.push(`Actividad ${metrics.daily_ratio.toFixed(1)}x mayor que patrón histórico`);
    }
    
    // Regla 5: Reactivación de cuenta dormida
    if (metrics.client_age_days > 90 && 
        metrics.historical_daily_avg < 0.1 && 
        metrics.current_daily_rate > 3) {
      suspicionScore += 0.6;
      reasons.push('Reactivación súbita de cuenta dormida');
    }
    
    // Regla 6: Cliente nuevo con actividad anómala
    if (metrics.client_age_days < 7 && metrics.current_daily_rate > 8) {
      suspicionScore += 0.5;
      reasons.push('Cliente nuevo con actividad extrema');
    }
    
    // Regla 7: Inconsistencia de patrón
    if (metrics.consistency_score < 0.3 && metrics.current_daily_rate > 10) {
      suspicionScore += 0.3;
      reasons.push('Patrón de actividad inconsistente');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'frequency',
      suspicion_score: Math.min(suspicionScore, 1),
      confidence: 0.8,
      reasons: reasons,
      processing_time_ms: 5
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
    const variables = transactionData.variables;
    
    if (score > 0.7) {
      if (input.very_high_frequency) {
        reasons.push(`Frecuencia extrema: ${variables.transactions_last_24h} transacciones/día`);
      }
      if (input.sudden_hyperactivity) {
        reasons.push('Hiperactividad súbita detectada');
      }
      if (input.rapid_succession) {
        reasons.push('Transacciones en rápida sucesión');
      }
    } else if (score > 0.5) {
      if (input.activity_ratio > 0.6) {
        reasons.push('Actividad muy superior al histórico');
      }
      if (input.dormant_reactivation) {
        reasons.push('Reactivación de cuenta dormida');
      }
      if (input.burst_factor > 0.6) {
        reasons.push('Patrón de actividad en ráfagas');
      }
    } else if (score > 0.3) {
      if (input.frequency_deviation > 0.5) {
        reasons.push('Desviación significativa de frecuencia normal');
      }
      if (input.daily_transactions > 0.5) {
        reasons.push('Actividad diaria elevada');
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
    let confidence = 0.7; // Confianza base
    
    // Mayor confianza si tenemos historial del cliente
    if (input.has_history) {
      confidence += 0.2;
    }
    
    // Mayor confianza si el cliente es maduro
    if (input.client_maturity > 0.3) {
      confidence += 0.1;
    }
    
    // Menor confianza si el cliente es muy nuevo
    if (input.client_maturity < 0.1) {
      confidence -= 0.2;
    }
    
    return Math.max(confidence, 0.5);
  }

  /**
   * Entreno la red con datos históricos
   * @param {Array} trainingData - Datos de entrenamiento
   * @returns {Object} - Resultado del entrenamiento
   */
  async train(trainingData) {
    try {
      logger.info(`Iniciando entrenamiento de red de análisis de frecuencia con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de frecuencia completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de frecuencia:', error);
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
      variable_analyzed: 'frequency',
      normal_patterns: this.normalPatterns
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
      
      if (modelData.normal_patterns) {
        this.normalPatterns = modelData.normal_patterns;
      }
      
      logger.info(`Modelo de análisis de frecuencia cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis de frecuencia:', error);
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
      variable: 'frequency',
      description: 'Analiza la frecuencia de uso y patrones temporales de actividad para detectar comportamientos anómalos'
    };
  }
}

module.exports = FrequencyAnalyzer;