const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 2.1 - Combinador de Comportamiento
 * Esta red combina múltiples análisis de Capa 1 para detectar patrones comportamentales complejos
 */
class BehaviorCombiner {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [12, 8, 4], // Recibe de todas las redes de Capa 1
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'behavior_combiner_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Pesos para diferentes aspectos del comportamiento
    this.behaviorWeights = {
      temporal: 0.25,    // Análisis de tiempo y día
      spending: 0.25,    // Análisis de monto y patrón
      location: 0.20,    // Análisis de ubicación y distancia
      frequency: 0.15,   // Análisis de frecuencia y velocidad
      context: 0.15      // Análisis de canal, dispositivo, país, establecimiento
    };
  }

  /**
   * Combino los resultados de Capa 1 para análisis comportamental
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de todas las redes de Capa 1
   * @returns {Object} - Datos preparados para la red
   */
  prepareInput(transactionData, layer1Results) {
    // Extraer scores de cada red de Capa 1
    const scores = {
      amount: layer1Results.amount?.suspicion_score || 0,
      location: layer1Results.location?.suspicion_score || 0,
      time: layer1Results.time?.suspicion_score || 0,
      day: layer1Results.day?.suspicion_score || 0,
      merchant: layer1Results.merchant?.suspicion_score || 0,
      velocity: layer1Results.velocity?.suspicion_score || 0,
      distance: layer1Results.distance?.suspicion_score || 0,
      pattern: layer1Results.pattern?.suspicion_score || 0,
      frequency: layer1Results.frequency?.suspicion_score || 0,
      channel: layer1Results.channel?.suspicion_score || 0,
      device: layer1Results.device?.suspicion_score || 0,
      country: layer1Results.country?.suspicion_score || 0
    };
    
    // Calcular scores combinados por categoría comportamental
    const behaviorScores = {
      temporal_behavior: (scores.time + scores.day) / 2,
      spending_behavior: (scores.amount + scores.pattern) / 2,
      location_behavior: (scores.location + scores.distance + scores.country) / 3,
      frequency_behavior: (scores.velocity + scores.frequency) / 2,
      context_behavior: (scores.channel + scores.device + scores.merchant) / 3
    };
    
    const input = {
      // Scores individuales de Capa 1
      amount_score: scores.amount,
      location_score: scores.location,
      time_score: scores.time,
      day_score: scores.day,
      merchant_score: scores.merchant,
      velocity_score: scores.velocity,
      distance_score: scores.distance,
      pattern_score: scores.pattern,
      frequency_score: scores.frequency,
      channel_score: scores.channel,
      device_score: scores.device,
      country_score: scores.country,
      
      // Scores comportamentales combinados
      temporal_behavior: behaviorScores.temporal_behavior,
      spending_behavior: behaviorScores.spending_behavior,
      location_behavior: behaviorScores.location_behavior,
      frequency_behavior: behaviorScores.frequency_behavior,
      context_behavior: behaviorScores.context_behavior,
      
      // Análisis de correlaciones entre comportamientos
      time_location_correlation: this.calculateCorrelation(scores.time, scores.location),
      amount_merchant_correlation: this.calculateCorrelation(scores.amount, scores.merchant),
      velocity_distance_correlation: this.calculateCorrelation(scores.velocity, scores.distance),
      pattern_frequency_correlation: this.calculateCorrelation(scores.pattern, scores.frequency),
      
      // Detección de patrones específicos
      night_international_pattern: this.detectNightInternationalPattern(transactionData, scores),
      high_amount_velocity_pattern: this.detectHighAmountVelocityPattern(scores),
      new_behavior_cluster: this.detectNewBehaviorCluster(transactionData, scores),
      
      // Consistencia general del comportamiento
      overall_consistency: this.calculateOverallConsistency(scores),
      anomaly_concentration: this.calculateAnomalyConcentration(scores),
      
      // Score promedio ponderado de todas las redes
      weighted_average: this.calculateWeightedAverage(behaviorScores),
      
      // Número de redes que detectaron anomalías
      anomaly_count: this.countAnomalies(scores),
      
      // Información contextual del cliente
      client_risk_factor: this.calculateClientRiskFactor(transactionData),
      transaction_risk_factor: this.calculateTransactionRiskFactor(transactionData)
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
    // Correlación simple: ambos altos = alta correlación
    if (score1 > 0.6 && score2 > 0.6) return 1.0;
    if (score1 < 0.3 && score2 < 0.3) return 0.8;
    return Math.abs(score1 - score2) < 0.3 ? 0.7 : 0.3;
  }

  /**
   * Detecto patrón de transacción nocturna internacional
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} scores - Scores de Capa 1
   * @returns {number} - 1 si se detecta el patrón, 0 si no
   */
  detectNightInternationalPattern(transactionData, scores) {
    const { variables } = transactionData;
    
    if (variables.is_night_transaction && 
        !variables.is_domestic && 
        scores.time > 0.5 && 
        scores.country > 0.5) {
      return 1;
    }
    return 0;
  }

  /**
   * Detecto patrón de monto alto con velocidad alta
   * @param {Object} scores - Scores de Capa 1
   * @returns {number} - 1 si se detecta el patrón, 0 si no
   */
  detectHighAmountVelocityPattern(scores) {
    if (scores.amount > 0.6 && scores.velocity > 0.6) {
      return 1;
    }
    return 0;
  }

  /**
   * Detecto cluster de comportamientos nuevos
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} scores - Scores de Capa 1
   * @returns {number} - Score del cluster (0-1)
   */
  detectNewBehaviorCluster(transactionData, scores) {
    const { variables } = transactionData;
    let newBehaviorCount = 0;
    
    // Contar comportamientos nuevos o inusuales
    if (scores.location > 0.6) newBehaviorCount++;
    if (scores.merchant > 0.6) newBehaviorCount++;
    if (scores.pattern > 0.6) newBehaviorCount++;
    if (scores.channel > 0.6) newBehaviorCount++;
    
    // Si es cliente nuevo con muchos comportamientos anómalos
    if (variables.client_age_days < 30 && newBehaviorCount >= 3) {
      return 1.0;
    }
    
    return newBehaviorCount / 4; // Normalizar
  }

  /**
   * Calculo consistencia general del comportamiento
   * @param {Object} scores - Scores de Capa 1
   * @returns {number} - Score de consistencia (0-1)
   */
  calculateOverallConsistency(scores) {
    const scoreValues = Object.values(scores);
    const average = scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length;
    
    // Calcular desviación estándar
    const variance = scoreValues.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scoreValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Consistencia alta = baja desviación estándar
    return Math.max(0, 1 - (stdDev * 2)); // Normalizar
  }

  /**
   * Calculo concentración de anomalías
   * @param {Object} scores - Scores de Capa 1
   * @returns {number} - Score de concentración (0-1)
   */
  calculateAnomalyConcentration(scores) {
    const highScores = Object.values(scores).filter(score => score > 0.6);
    const totalScores = Object.values(scores).length;
    
    return highScores.length / totalScores;
  }

  /**
   * Calculo promedio ponderado
   * @param {Object} behaviorScores - Scores comportamentales
   * @returns {number} - Promedio ponderado
   */
  calculateWeightedAverage(behaviorScores) {
    return (
      behaviorScores.temporal_behavior * this.behaviorWeights.temporal +
      behaviorScores.spending_behavior * this.behaviorWeights.spending +
      behaviorScores.location_behavior * this.behaviorWeights.location +
      behaviorScores.frequency_behavior * this.behaviorWeights.frequency +
      behaviorScores.context_behavior * this.behaviorWeights.context
    );
  }

  /**
   * Cuento anomalías detectadas
   * @param {Object} scores - Scores de Capa 1
   * @returns {number} - Número de anomalías normalizadas
   */
  countAnomalies(scores) {
    const anomalies = Object.values(scores).filter(score => score > 0.6).length;
    return Math.min(anomalies / Object.keys(scores).length, 1);
  }

  /**
   * Calculo factor de riesgo del cliente
   * @param {Object} transactionData - Datos de la transacción
   * @returns {number} - Factor de riesgo del cliente
   */
  calculateClientRiskFactor(transactionData) {
    const { variables } = transactionData;
    let riskFactor = 0;
    
    // Cliente nuevo
    if (variables.client_age_days < 30) riskFactor += 0.3;
    
    // Perfil de riesgo
    if (variables.risk_profile === 'high') riskFactor += 0.4;
    else if (variables.risk_profile === 'medium') riskFactor += 0.2;
    
    // Poca experiencia
    if (variables.historical_transaction_count < 10) riskFactor += 0.2;
    
    // Muchas ubicaciones (posible patrón de lavado)
    if (variables.historical_location_count > 15) riskFactor += 0.3;
    
    return Math.min(riskFactor, 1);
  }

  /**
   * Calculo factor de riesgo de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {number} - Factor de riesgo de la transacción
   */
  calculateTransactionRiskFactor(transactionData) {
    const { variables } = transactionData;
    let riskFactor = 0;
    
    // Monto alto
    if (variables.amount > 10000) riskFactor += 0.3;
    else if (variables.amount > 5000) riskFactor += 0.2;
    
    // Horario nocturno
    if (variables.is_night_transaction) riskFactor += 0.2;
    
    // Internacional
    if (!variables.is_domestic) riskFactor += 0.2;
    
    // Fin de semana
    if (variables.is_weekend) riskFactor += 0.1;
    
    // Canal de riesgo
    if (variables.channel === 'online' || variables.channel === 'phone') riskFactor += 0.2;
    
    return Math.min(riskFactor, 1);
  }

  /**
   * Analizo y combino patrones comportamentales
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado del análisis combinado
   */
  async analyze(transactionData, layer1Results) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red combinadora de comportamiento no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData, layer1Results);
      }
      
      const input = this.prepareInput(transactionData, layer1Results);
      const output = this.network.run(input);
      const combinedScore = Array.isArray(output) ? output[0] : output;
      
      const patterns = this.detectBehaviorPatterns(transactionData, layer1Results, input);
      
      const result = {
        network_id: this.networkId,
        combined_score: combinedScore,
        confidence: this.calculateConfidence(input),
        patterns_detected: patterns,
        behavior_analysis: {
          temporal_risk: input.temporal_behavior,
          spending_risk: input.spending_behavior,
          location_risk: input.location_behavior,
          frequency_risk: input.frequency_behavior,
          context_risk: input.context_behavior
        },
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de comportamiento completado: Score=${combinedScore.toFixed(3)}, Patrones=${patterns.length}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de comportamiento:', error);
      return this.heuristicAnalysis(transactionData, layer1Results);
    }
  }

  /**
   * Análisis heurístico de comportamiento
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData, layer1Results) {
    const input = this.prepareInput(transactionData, layer1Results);
    let combinedScore = input.weighted_average;
    const patterns = [];
    
    // Ajustar score basado en patrones específicos
    if (input.night_international_pattern) {
      combinedScore += 0.2;
      patterns.push('Transacción nocturna internacional');
    }
    
    if (input.high_amount_velocity_pattern) {
      combinedScore += 0.2;
      patterns.push('Monto alto con velocidad alta');
    }
    
    if (input.new_behavior_cluster > 0.7) {
      combinedScore += 0.15;
      patterns.push('Cluster de comportamientos nuevos');
    }
    
    if (input.anomaly_concentration > 0.6) {
      combinedScore += 0.1;
      patterns.push('Alta concentración de anomalías');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      combined_score: Math.min(combinedScore, 1),
      confidence: 0.7,
      patterns_detected: patterns,
      behavior_analysis: {
        temporal_risk: input.temporal_behavior,
        spending_risk: input.spending_behavior,
        location_risk: input.location_behavior,
        frequency_risk: input.frequency_behavior,
        context_risk: input.context_behavior
      },
      processing_time_ms: 8
    };
  }

  /**
   * Detecto patrones comportamentales específicos
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} input - Datos de entrada procesados
   * @returns {Array} - Lista de patrones detectados
   */
  detectBehaviorPatterns(transactionData, layer1Results, input) {
    const patterns = [];
    
    if (input.night_international_pattern) {
      patterns.push('Transacción nocturna internacional sospechosa');
    }
    
    if (input.high_amount_velocity_pattern) {
      patterns.push('Combinación de monto alto y velocidad alta');
    }
    
    if (input.new_behavior_cluster > 0.7) {
      patterns.push('Múltiples comportamientos nuevos simultáneos');
    }
    
    if (input.overall_consistency < 0.3) {
      patterns.push('Comportamiento altamente inconsistente');
    }
    
    if (input.anomaly_concentration > 0.8) {
      patterns.push('Concentración extrema de anomalías');
    }
    
    if (input.time_location_correlation > 0.8) {
      patterns.push('Fuerte correlación tiempo-ubicación sospechosa');
    }
    
    if (input.client_risk_factor > 0.7 && input.transaction_risk_factor > 0.6) {
      patterns.push('Cliente de alto riesgo con transacción de alto riesgo');
    }
    
    return patterns;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.7; // Base
    
    // Mayor confianza si tenemos muchas redes reportando
    if (input.anomaly_count > 0.5) {
      confidence += 0.2;
    }
    
    // Mayor confianza si el comportamiento es consistente
    if (input.overall_consistency > 0.7) {
      confidence += 0.1;
    }
    
    // Menor confianza si el cliente es muy nuevo
    if (input.client_risk_factor > 0.8) {
      confidence -= 0.1;
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
      logger.info(`Iniciando entrenamiento de red combinadora de comportamiento con ${trainingData.length} muestras`);
      
      // Para entrenamiento, simular resultados de Capa 1
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
      
      logger.info('Entrenamiento de red combinadora de comportamiento completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red combinadora de comportamiento:', error);
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
    
    // Simular scores de Capa 1 basados en el score de fraude real
    return {
      amount: { suspicion_score: fraudScore * (0.8 + Math.random() * 0.4) },
      location: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      time: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) },
      day: { suspicion_score: fraudScore * (0.5 + Math.random() * 1.0) },
      merchant: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      velocity: { suspicion_score: fraudScore * (0.8 + Math.random() * 0.4) },
      distance: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) },
      pattern: { suspicion_score: fraudScore * (0.9 + Math.random() * 0.2) },
      frequency: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      channel: { suspicion_score: fraudScore * (0.5 + Math.random() * 1.0) },
      device: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) },
      country: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) }
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
      purpose: 'behavior_combination',
      behavior_weights: this.behaviorWeights
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
      
      if (modelData.behavior_weights) {
        this.behaviorWeights = modelData.behavior_weights;
      }
      
      logger.info(`Modelo combinador de comportamiento cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo combinador de comportamiento:', error);
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
      purpose: 'behavior_combination',
      description: 'Combina análisis de Capa 1 para detectar patrones comportamentales complejos de fraude',
      input_networks: ['amount', 'location', 'time', 'day', 'merchant', 'velocity', 'distance', 'pattern', 'frequency', 'channel', 'device', 'country']
    };
  }
}

module.exports = BehaviorCombiner;