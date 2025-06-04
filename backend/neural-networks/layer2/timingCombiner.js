const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 2.3 - Combinador de Patrones Temporales
 * Esta red combina análisis temporales de Capa 1 para detectar patrones de tiempo complejos
 */
class TimingCombiner {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [12, 8, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'timing_combiner_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Patrones temporales conocidos de fraude
    this.temporalFraudPatterns = {
      // Horarios de alto riesgo
      highRiskHours: [2, 3, 4, 5], // 2AM - 5AM
      
      // Días de alto riesgo  
      highRiskDays: [0, 6], // Domingo y Sábado
      
      // Combinaciones sospechosas
      suspiciousCombinations: [
        { day: 0, hourStart: 2, hourEnd: 6 }, // Domingo madrugada
        { day: 6, hourStart: 23, hourEnd: 24 }, // Sábado noche
        { weekend: true, hourStart: 1, hourEnd: 7 } // Cualquier fin de semana madrugada
      ],
      
      // Patrones de velocidad temporal
      rapidSuccession: {
        veryFast: 2,   // Menos de 2 minutos
        fast: 5,       // Menos de 5 minutos  
        moderate: 15   // Menos de 15 minutos
      }
    };
  }

  /**
   * Analizo patrones temporales del cliente
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Análisis temporal
   */
  analyzeTemporalPatterns(transactionData) {
    const { variables } = transactionData;
    
    return {
      // Consistencia temporal del cliente
      temporal_consistency: this.calculateTemporalConsistency(variables),
      
      // Análisis de horarios preferidos
      preferred_time_deviation: this.calculatePreferredTimeDeviation(variables),
      
      // Análisis de días preferidos
      preferred_day_deviation: this.calculatePreferredDayDeviation(variables),
      
      // Patrones de actividad
      activity_rhythm: this.analyzeActivityRhythm(variables),
      
      // Comportamiento nocturno
      nocturnal_behavior: this.analyzeNocturnalBehavior(variables),
      
      // Patrones de fin de semana
      weekend_behavior: this.analyzeWeekendBehavior(variables),
      
      // Velocidad de transacciones
      transaction_velocity: this.analyzeTransactionVelocity(variables)
    };
  }

  /**
   * Calculo consistencia temporal general del cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de consistencia (0-1)
   */
  calculateTemporalConsistency(variables) {
    if (variables.historical_transaction_count < 10) {
      return 0.5; // Neutral para clientes nuevos
    }
    
    let consistencyScore = 0.5; // Base
    
    // Si el cliente es muy activo en horarios normales
    if (!variables.is_night_transaction && !variables.is_weekend) {
      consistencyScore += 0.3;
    }
    
    // Si es cliente establecido
    if (variables.client_age_days > 90) {
      consistencyScore += 0.2;
    }
    
    return Math.min(consistencyScore, 1);
  }

  /**
   * Calculo desviación del horario preferido
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de desviación (0-1)
   */
  calculatePreferredTimeDeviation(variables) {
    const hour = variables.hour_of_day;
    
    // Horarios normales (9AM - 6PM) = baja desviación
    if (hour >= 9 && hour <= 18) {
      return 0.1;
    }
    
    // Noche temprana (6PM - 10PM) = desviación baja
    if (hour >= 18 && hour <= 22) {
      return 0.3;
    }
    
    // Noche tardía (10PM - 1AM) = desviación media
    if (hour >= 22 || hour <= 1) {
      return 0.6;
    }
    
    // Madrugada (1AM - 9AM) = alta desviación
    return 0.9;
  }

  /**
   * Calculo desviación del día preferido
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de desviación (0-1)
   */
  calculatePreferredDayDeviation(variables) {
    const dayOfWeek = variables.day_of_week;
    
    // Días laborales (Lunes-Viernes) = baja desviación
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      return 0.2;
    }
    
    // Sábado = desviación media
    if (dayOfWeek === 6) {
      return 0.5;
    }
    
    // Domingo = alta desviación
    return 0.8;
  }

  /**
   * Analizo ritmo de actividad del cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de ritmo anómalo (0-1)
   */
  analyzeActivityRhythm(variables) {
    let rhythmScore = 0;
    
    // Actividad muy alta concentrada
    if (variables.transactions_last_hour > 5) {
      rhythmScore += 0.4;
    }
    
    // Actividad muy alta en 24h
    if (variables.transactions_last_24h > 15) {
      rhythmScore += 0.3;
    }
    
    // Tiempo muy corto entre transacciones
    if (variables.time_since_prev_transaction < 2) {
      rhythmScore += 0.3;
    }
    
    return Math.min(rhythmScore, 1);
  }

  /**
   * Analizo comportamiento nocturno específico
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de comportamiento nocturno sospechoso (0-1)
   */
  analyzeNocturnalBehavior(variables) {
    if (!variables.is_night_transaction) {
      return 0; // No es nocturna
    }
    
    let nocturnalScore = 0.3; // Base por ser nocturna
    
    // Hora muy tardía/temprana
    if (this.temporalFraudPatterns.highRiskHours.includes(variables.hour_of_day)) {
      nocturnalScore += 0.4;
    }
    
    // Transacción nocturna internacional
    if (!variables.is_domestic) {
      nocturnalScore += 0.2;
    }
    
    // Monto alto nocturno
    if (variables.amount > 5000) {
      nocturnalScore += 0.1;
    }
    
    return Math.min(nocturnalScore, 1);
  }

  /**
   * Analizo comportamiento de fin de semana
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de comportamiento de fin de semana sospechoso (0-1)
   */
  analyzeWeekendBehavior(variables) {
    if (!variables.is_weekend) {
      return 0; // No es fin de semana
    }
    
    let weekendScore = 0.2; // Base por ser fin de semana
    
    // Domingo = más sospechoso que sábado
    if (variables.day_of_week === 0) {
      weekendScore += 0.2;
    }
    
    // Fin de semana nocturno
    if (variables.is_night_transaction) {
      weekendScore += 0.3;
    }
    
    // Alta actividad en fin de semana
    if (variables.transactions_last_24h > 10) {
      weekendScore += 0.2;
    }
    
    // Monto alto en fin de semana
    if (variables.amount > 8000) {
      weekendScore += 0.1;
    }
    
    return Math.min(weekendScore, 1);
  }

  /**
   * Analizo velocidad de transacciones
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de velocidad sospechosa (0-1)
   */
  analyzeTransactionVelocity(variables) {
    let velocityScore = 0;
    
    // Transacciones muy seguidas
    if (variables.time_since_prev_transaction < this.temporalFraudPatterns.rapidSuccession.veryFast) {
      velocityScore += 0.6;
    } else if (variables.time_since_prev_transaction < this.temporalFraudPatterns.rapidSuccession.fast) {
      velocityScore += 0.4;
    } else if (variables.time_since_prev_transaction < this.temporalFraudPatterns.rapidSuccession.moderate) {
      velocityScore += 0.2;
    }
    
    // Muchas transacciones por hora
    if (variables.transactions_last_hour > 8) {
      velocityScore += 0.3;
    } else if (variables.transactions_last_hour > 5) {
      velocityScore += 0.2;
    }
    
    return Math.min(velocityScore, 1);
  }

  /**
   * Combino análisis temporales de Capa 1
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de todas las redes de Capa 1
   * @returns {Object} - Datos preparados para la red
   */
  prepareInput(transactionData, layer1Results) {
    // Extraer scores relacionados con tiempo
    const timeScores = {
      time: layer1Results.time?.suspicion_score || 0,
      day: layer1Results.day?.suspicion_score || 0,
      velocity: layer1Results.velocity?.suspicion_score || 0,
      frequency: layer1Results.frequency?.suspicion_score || 0,
      pattern: layer1Results.pattern?.suspicion_score || 0 // Patrones pueden incluir tiempo
    };
    
    // Analizar patrones temporales
    const temporal = this.analyzeTemporalPatterns(transactionData);
    const { variables } = transactionData;
    
    const input = {
      // Scores de Capa 1 relacionados con tiempo
      time_score: timeScores.time,
      day_score: timeScores.day,
      velocity_score: timeScores.velocity,
      frequency_score: timeScores.frequency,
      pattern_score: timeScores.pattern,
      
      // Análisis temporal específico
      temporal_consistency: temporal.temporal_consistency,
      preferred_time_deviation: temporal.preferred_time_deviation,
      preferred_day_deviation: temporal.preferred_day_deviation,
      activity_rhythm: temporal.activity_rhythm,
      nocturnal_behavior: temporal.nocturnal_behavior,
      weekend_behavior: temporal.weekend_behavior,
      transaction_velocity: temporal.transaction_velocity,
      
      // Información temporal base
      hour_normalized: variables.hour_of_day / 24,
      day_normalized: variables.day_of_week / 7,
      is_night: variables.is_night_transaction ? 1 : 0,
      is_weekend: variables.is_weekend ? 1 : 0,
      
      // Patrones temporales específicos detectados
      critical_time_combination: this.detectCriticalTimeCombination(variables),
      rapid_succession_pattern: variables.time_since_prev_transaction < 5 ? 1 : 0,
      burst_activity_pattern: variables.transactions_last_hour > 5 ? 1 : 0,
      dormant_then_active: this.detectDormantThenActive(variables),
      
      // Combinaciones temporales sospechosas
      night_weekend_combo: (variables.is_night_transaction && variables.is_weekend) ? 1 : 0,
      early_morning_activity: (variables.hour_of_day >= 2 && variables.hour_of_day <= 6) ? 1 : 0,
      unusual_day_pattern: this.detectUnusualDayPattern(variables),
      
      // Información del cliente
      client_maturity: Math.min(variables.client_age_days / 365, 1),
      transaction_experience: Math.min(variables.historical_transaction_count / 100, 1),
      
      // Score temporal combinado
      temporal_combined_score: (timeScores.time + timeScores.day + timeScores.velocity) / 3,
      
      // Correlaciones temporales
      time_velocity_correlation: this.calculateCorrelation(timeScores.time, timeScores.velocity),
      day_frequency_correlation: this.calculateCorrelation(timeScores.day, timeScores.frequency),
      
      // Índice de anomalía temporal
      temporal_anomaly_index: this.calculateTemporalAnomalyIndex(variables, timeScores, temporal)
    };
    
    return input;
  }

  /**
   * Detecto combinación crítica de tiempo
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - 1 si se detecta, 0 si no
   */
  detectCriticalTimeCombination(variables) {
    // Domingo madrugada
    if (variables.day_of_week === 0 && variables.hour_of_day >= 2 && variables.hour_of_day <= 6) {
      return 1;
    }
    
    // Cualquier día en horario crítico con monto alto
    if (this.temporalFraudPatterns.highRiskHours.includes(variables.hour_of_day) && variables.amount > 5000) {
      return 1;
    }
    
    return 0;
  }

  /**
   * Detecto patrón de cuenta dormida que se activa
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - 1 si se detecta, 0 si no
   */
  detectDormantThenActive(variables) {
    // Mucho tiempo sin actividad y luego actividad alta
    if (variables.time_since_prev_transaction > 4320 && // Más de 3 días
        variables.transactions_last_24h > 5) {
      return 1;
    }
    
    // Cliente viejo con poca actividad histórica que se activa
    if (variables.client_age_days > 180 && 
        variables.avg_transactions_per_day < 0.1 && 
        variables.transactions_last_24h > 3) {
      return 1;
    }
    
    return 0;
  }

  /**
   * Detecto patrón de día inusual
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de patrón inusual (0-1)
   */
  detectUnusualDayPattern(variables) {
    // Domingo con alta actividad
    if (variables.day_of_week === 0 && variables.transactions_last_24h > 8) {
      return 1;
    }
    
    // Fin de semana con monto muy alto
    if (variables.is_weekend && variables.amount > 15000) {
      return 0.8;
    }
    
    return 0;
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
   * Calculo índice de anomalía temporal
   * @param {Object} variables - Variables de la transacción
   * @param {Object} timeScores - Scores temporales
   * @param {Object} temporal - Análisis temporal
   * @returns {number} - Índice de anomalía (0-1)
   */
  calculateTemporalAnomalyIndex(variables, timeScores, temporal) {
    let anomalyIndex = 0;
    
    // Factor de horario
    anomalyIndex += timeScores.time * 0.25;
    
    // Factor de día
    anomalyIndex += timeScores.day * 0.2;
    
    // Factor de velocidad
    anomalyIndex += timeScores.velocity * 0.25;
    
    // Factor de frecuencia
    anomalyIndex += timeScores.frequency * 0.2;
    
    // Factor de comportamiento nocturno
    anomalyIndex += temporal.nocturnal_behavior * 0.1;
    
    return Math.min(anomalyIndex, 1);
  }

  /**
   * Analizo y combino patrones temporales
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado del análisis combinado
   */
  async analyze(transactionData, layer1Results) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red combinadora temporal no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData, layer1Results);
      }
      
      const input = this.prepareInput(transactionData, layer1Results);
      const output = this.network.run(input);
      const combinedScore = Array.isArray(output) ? output[0] : output;
      
      const patterns = this.detectTimingPatterns(transactionData, layer1Results, input);
      
      const result = {
        network_id: this.networkId,
        combined_score: combinedScore,
        confidence: this.calculateConfidence(input),
        patterns_detected: patterns,
        timing_analysis: {
          temporal_risk: input.temporal_combined_score,
          nocturnal_risk: input.nocturnal_behavior,
          weekend_risk: input.weekend_behavior,
          velocity_risk: input.transaction_velocity,
          consistency_score: input.temporal_consistency
        },
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis temporal completado: Score=${combinedScore.toFixed(3)}, Patrones=${patterns.length}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis temporal:', error);
      return this.heuristicAnalysis(transactionData, layer1Results);
    }
  }

  /**
   * Análisis heurístico temporal
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData, layer1Results) {
    const input = this.prepareInput(transactionData, layer1Results);
    let combinedScore = input.temporal_anomaly_index;
    const patterns = [];
    
    // Ajustar score basado en patrones específicos
    if (input.critical_time_combination) {
      combinedScore += 0.3;
      patterns.push('Combinación crítica de tiempo detectada');
    }
    
    if (input.rapid_succession_pattern) {
      combinedScore += 0.2;
      patterns.push('Patrón de sucesión rápida');
    }
    
    if (input.burst_activity_pattern) {
      combinedScore += 0.2;
      patterns.push('Patrón de actividad en ráfagas');
    }
    
    if (input.dormant_then_active) {
      combinedScore += 0.2;
      patterns.push('Reactivación de cuenta dormida');
    }
    
    if (input.night_weekend_combo) {
      combinedScore += 0.15;
      patterns.push('Combinación nocturna de fin de semana');
    }
    
    if (input.early_morning_activity) {
      combinedScore += 0.15;
      patterns.push('Actividad en horas de madrugada');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      combined_score: Math.min(combinedScore, 1),
      confidence: 0.8,
      patterns_detected: patterns,
      timing_analysis: {
        temporal_risk: input.temporal_combined_score,
        nocturnal_risk: input.nocturnal_behavior,
        weekend_risk: input.weekend_behavior,
        velocity_risk: input.transaction_velocity,
        consistency_score: input.temporal_consistency
      },
      processing_time_ms: 6
    };
  }

  /**
   * Detecto patrones temporales específicos
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} input - Datos de entrada procesados
   * @returns {Array} - Lista de patrones detectados
   */
  detectTimingPatterns(transactionData, layer1Results, input) {
    const patterns = [];
    
    if (input.critical_time_combination) {
      patterns.push('Combinación temporal crítica (domingo madrugada o horario crítico)');
    }
    
    if (input.rapid_succession_pattern) {
      patterns.push('Transacciones en sucesión muy rápida');
    }
    
    if (input.burst_activity_pattern) {
      patterns.push('Patrón de actividad concentrada en ráfagas');
    }
    
    if (input.dormant_then_active) {
      patterns.push('Activación súbita de cuenta dormida');
    }
    
    if (input.temporal_consistency < 0.3) {
      patterns.push('Comportamiento temporal altamente inconsistente');
    }
    
    if (input.nocturnal_behavior > 0.7) {
      patterns.push('Patrón nocturno de alto riesgo');
    }
    
    if (input.weekend_behavior > 0.6) {
      patterns.push('Comportamiento sospechoso de fin de semana');
    }
    
    if (input.time_velocity_correlation > 0.8) {
      patterns.push('Fuerte correlación tiempo-velocidad sospechosa');
    }
    
    return patterns;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.9; // Confianza base alta para análisis temporal
    
    // Mayor confianza si el cliente tiene experiencia
    if (input.transaction_experience > 0.2) {
      confidence += 0.1;
    }
    
    // Menor confianza si el cliente es muy nuevo
    if (input.client_maturity < 0.1) {
      confidence -= 0.2;
    }
    
    return Math.max(confidence, 0.7);
  }

  /**
   * Entreno la red con datos históricos
   * @param {Array} trainingData - Datos de entrenamiento
   * @returns {Object} - Resultado del entrenamiento
   */
  async train(trainingData) {
    try {
      logger.info(`Iniciando entrenamiento de red combinadora temporal con ${trainingData.length} muestras`);
      
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
      
      logger.info('Entrenamiento de red combinadora temporal completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red combinadora temporal:', error);
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
      time: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      day: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) },
      velocity: { suspicion_score: fraudScore * (0.8 + Math.random() * 0.4) },
      frequency: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      pattern: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) }
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
      purpose: 'timing_combination',
      temporal_fraud_patterns: this.temporalFraudPatterns
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
      
      if (modelData.temporal_fraud_patterns) {
        this.temporalFraudPatterns = modelData.temporal_fraud_patterns;
      }
      
      logger.info(`Modelo combinador temporal cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo combinador temporal:', error);
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
      purpose: 'timing_combination',
      description: 'Combina análisis temporales de Capa 1 para detectar patrones de tiempo complejos de fraude',
      input_networks: ['time', 'day', 'velocity', 'frequency', 'pattern']
    };
  }
}

module.exports = TimingCombiner;