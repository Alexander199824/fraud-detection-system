const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 2.6 - Combinador de Patrones Generales
 * Esta red combina múltiples análisis de patrones de Capa 1 para detectar meta-patrones complejos
 */
class PatternCombiner {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [12, 8, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'pattern_combiner_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Meta-patrones de fraude conocidos
    this.metaPatterns = {
      // Patrones de prueba y escalamiento
      testingThenEscalation: {
        phase1: { smallTransactions: 3, timeWindow: 60, maxAmount: 10 },
        phase2: { largeTransaction: 1, timeWindow: 120, minAmount: 1000 }
      },
      
      // Patrones de lavado de dinero
      moneyLaundering: {
        structuring: { transactions: 5, timeWindow: 1440, amountRange: [9000, 9999] },
        layering: { locations: 3, timeWindow: 720, countries: 2 }
      },
      
      // Patrones de cuenta comprometida
      accountTakeover: {
        rapidChanges: { newBehaviors: 4, timeWindow: 180 },
        locationJumping: { distance: 1000, timeWindow: 60 }
      },
      
      // Patrones de fraude sintético
      syntheticFraud: {
        newAccount: { age: 30, highActivity: 20, diverseUsage: 5 }
      }
    };
  }

  /**
   * Analizo meta-patrones en los datos de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Análisis de meta-patrones
   */
  analyzeMetaPatterns(transactionData) {
    const { variables } = transactionData;
    
    return {
      // Patrón de prueba y escalamiento
      testing_escalation_pattern: this.detectTestingEscalationPattern(variables),
      
      // Patrón de estructuración (lavado de dinero)
      structuring_pattern: this.detectStructuringPattern(variables),
      
      // Patrón de toma de cuenta
      account_takeover_pattern: this.detectAccountTakeoverPattern(variables),
      
      // Patrón de fraude sintético
      synthetic_fraud_pattern: this.detectSyntheticFraudPattern(variables),
      
      // Análisis de cambios de comportamiento
      behavior_change_analysis: this.analyzeBehaviorChanges(variables),
      
      // Análisis de consistencia multi-dimensional
      multi_dimensional_consistency: this.analyzeMultiDimensionalConsistency(variables),
      
      // Detección de patrones temporales complejos
      complex_temporal_patterns: this.detectComplexTemporalPatterns(variables),
      
      // Análisis de anomalías correlacionadas
      correlated_anomalies: this.detectCorrelatedAnomalies(variables)
    };
  }

  /**
   * Detecto patrón de prueba seguido de escalamiento
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score del patrón (0-1)
   */
  detectTestingEscalationPattern(variables) {
    let patternScore = 0;
    
    // Cliente nuevo con actividad alta
    if (variables.client_age_days < 30 && variables.transactions_last_24h > 10) {
      patternScore += 0.4;
    }
    
    // Transacción actual grande después de actividad alta
    if (variables.amount > 2000 && variables.transactions_last_24h > 5) {
      patternScore += 0.3;
    }
    
    // Escalamiento vs promedio histórico
    if (variables.historical_avg_amount > 0) {
      const escalationRatio = variables.amount / variables.historical_avg_amount;
      if (escalationRatio > 5) {
        patternScore += 0.3;
      }
    }
    
    return Math.min(patternScore, 1);
  }

  /**
   * Detecto patrón de estructuración de dinero
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score del patrón (0-1)
   */
  detectStructuringPattern(variables) {
    let patternScore = 0;
    
    // Múltiples transacciones de monto similar justo debajo de umbrales
    if (variables.amount >= 9000 && variables.amount <= 9999) {
      patternScore += 0.6;
    }
    
    // Muchas transacciones en 24h con montos similares
    if (variables.transactions_last_24h > 8 && variables.amount_last_24h > 0) {
      const avgAmountToday = variables.amount_last_24h / variables.transactions_last_24h;
      const variance = Math.abs(variables.amount - avgAmountToday) / avgAmountToday;
      
      if (variance < 0.2) { // Montos muy similares
        patternScore += 0.4;
      }
    }
    
    return Math.min(patternScore, 1);
  }

  /**
   * Detecto patrón de toma de cuenta
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score del patrón (0-1)
   */
  detectAccountTakeoverPattern(variables) {
    let patternScore = 0;
    
    // Cliente establecido con comportamiento súbitamente diferente
    if (variables.client_age_days > 90 && variables.historical_transaction_count > 20) {
      
      // Nueva ubicación
      if (variables.historical_location_count < 3 && !variables.is_domestic) {
        patternScore += 0.4;
      }
      
      // Monto muy diferente al patrón
      if (variables.historical_avg_amount > 0) {
        const amountRatio = variables.amount / variables.historical_avg_amount;
        if (amountRatio > 8 || amountRatio < 0.1) {
          patternScore += 0.3;
        }
      }
      
      // Actividad nocturna inusual
      if (variables.is_night_transaction) {
        patternScore += 0.2;
      }
      
      // Canal diferente o sospechoso
      if (variables.channel === 'online' || variables.channel === 'phone') {
        patternScore += 0.1;
      }
    }
    
    return Math.min(patternScore, 1);
  }

  /**
   * Detecto patrón de fraude sintético
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score del patrón (0-1)
   */
  detectSyntheticFraudPattern(variables) {
    let patternScore = 0;
    
    // Cliente muy nuevo con comportamiento diverso
    if (variables.client_age_days < 60) {
      
      // Alta diversidad de ubicaciones
      if (variables.historical_location_count > 8) {
        patternScore += 0.3;
      }
      
      // Alta diversidad de establecimientos
      if (variables.historical_merchant_types > 10) {
        patternScore += 0.3;
      }
      
      // Múltiples países
      if (variables.unique_countries > 3) {
        patternScore += 0.2;
      }
      
      // Actividad muy alta para ser nuevo
      if (variables.avg_transactions_per_day > 3) {
        patternScore += 0.2;
      }
    }
    
    return Math.min(patternScore, 1);
  }

  /**
   * Analizo cambios de comportamiento
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de cambio de comportamiento (0-1)
   */
  analyzeBehaviorChanges(variables) {
    let changeScore = 0;
    
    // Cambio dramático en frecuencia
    if (variables.avg_transactions_per_day > 0) {
      const frequencyRatio = variables.transactions_last_24h / variables.avg_transactions_per_day;
      if (frequencyRatio > 10) {
        changeScore += 0.4;
      } else if (frequencyRatio > 5) {
        changeScore += 0.2;
      }
    }
    
    // Cambio dramático en monto
    if (variables.historical_avg_amount > 0) {
      const amountRatio = variables.amount / variables.historical_avg_amount;
      if (amountRatio > 15) {
        changeScore += 0.4;
      } else if (amountRatio > 8) {
        changeScore += 0.2;
      }
    }
    
    // Cambio en patrón geográfico
    if (variables.historical_location_count < 3 && variables.distance_from_prev > 500) {
      changeScore += 0.2;
    }
    
    return Math.min(changeScore, 1);
  }

  /**
   * Analizo consistencia multi-dimensional
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de inconsistencia (0-1)
   */
  analyzeMultiDimensionalConsistency(variables) {
    let inconsistencyScore = 0;
    let dimensionCount = 0;
    
    // Dimensión temporal
    if (variables.is_night_transaction || variables.is_weekend) {
      inconsistencyScore += 0.2;
    }
    dimensionCount++;
    
    // Dimensión geográfica
    if (!variables.is_domestic) {
      inconsistencyScore += 0.2;
    }
    dimensionCount++;
    
    // Dimensión de monto
    if (variables.historical_avg_amount > 0) {
      const amountRatio = variables.amount / variables.historical_avg_amount;
      if (amountRatio > 3 || amountRatio < 0.3) {
        inconsistencyScore += 0.3;
      }
    }
    dimensionCount++;
    
    // Dimensión de frecuencia
    if (variables.transactions_last_24h > 15) {
      inconsistencyScore += 0.2;
    }
    dimensionCount++;
    
    // Dimensión tecnológica
    if (variables.channel === 'phone' || !variables.device_info) {
      inconsistencyScore += 0.1;
    }
    dimensionCount++;
    
    return inconsistencyScore / dimensionCount; // Normalizar por número de dimensiones
  }

  /**
   * Detecto patrones temporales complejos
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de patrón temporal complejo (0-1)
   */
  detectComplexTemporalPatterns(variables) {
    let patternScore = 0;
    
    // Patrón de actividad nocturna de fin de semana
    if (variables.is_night_transaction && variables.is_weekend) {
      patternScore += 0.3;
    }
    
    // Patrón de actividad en ráfagas
    if (variables.transactions_last_hour > 5 && variables.time_since_prev_transaction < 10) {
      patternScore += 0.4;
    }
    
    // Patrón de reactivación después de dormancia
    if (variables.time_since_prev_transaction > 4320 && // Más de 3 días
        variables.transactions_last_24h > 8) {
      patternScore += 0.3;
    }
    
    return Math.min(patternScore, 1);
  }

  /**
   * Detecto anomalías correlacionadas
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de anomalías correlacionadas (0-1)
   */
  detectCorrelatedAnomalies(variables) {
    let correlationScore = 0;
    let anomalyCount = 0;
    
    // Anomalía de monto
    if (variables.historical_avg_amount > 0 && variables.amount / variables.historical_avg_amount > 5) {
      anomalyCount++;
    }
    
    // Anomalía geográfica
    if (!variables.is_domestic || variables.distance_from_prev > 1000) {
      anomalyCount++;
    }
    
    // Anomalía temporal
    if (variables.is_night_transaction || variables.transactions_last_hour > 5) {
      anomalyCount++;
    }
    
    // Anomalía de frecuencia
    if (variables.transactions_last_24h > 15) {
      anomalyCount++;
    }
    
    // Anomalía de establecimiento
    if (variables.historical_merchant_types < 3) {
      anomalyCount++;
    }
    
    // Correlación: múltiples anomalías simultáneas = más sospechoso
    correlationScore = Math.min(anomalyCount / 5, 1);
    
    // Bonus por anomalías múltiples
    if (anomalyCount >= 3) {
      correlationScore += 0.2;
    }
    
    return Math.min(correlationScore, 1);
  }

  /**
   * Combino análisis de patrones de Capa 1
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de todas las redes de Capa 1
   * @returns {Object} - Datos preparados para la red
   */
  prepareInput(transactionData, layer1Results) {
    // Extraer todos los scores de Capa 1 para análisis de patrones
    const allScores = {
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
    
    // Analizar meta-patrones
    const meta = this.analyzeMetaPatterns(transactionData);
    const { variables } = transactionData;
    
    const input = {
      // Todos los scores de Capa 1
      ...allScores,
      
      // Meta-patrones detectados
      testing_escalation_pattern: meta.testing_escalation_pattern,
      structuring_pattern: meta.structuring_pattern,
      account_takeover_pattern: meta.account_takeover_pattern,
      synthetic_fraud_pattern: meta.synthetic_fraud_pattern,
      behavior_change_analysis: meta.behavior_change_analysis,
      multi_dimensional_consistency: meta.multi_dimensional_consistency,
      complex_temporal_patterns: meta.complex_temporal_patterns,
      correlated_anomalies: meta.correlated_anomalies,
      
      // Análisis estadístico de scores
      score_average: this.calculateScoreAverage(allScores),
      score_variance: this.calculateScoreVariance(allScores),
      high_score_count: this.countHighScores(allScores, 0.6),
      score_correlation_index: this.calculateScoreCorrelationIndex(allScores),
      
      // Patrones específicos multi-capa
      multi_anomaly_pattern: this.detectMultiAnomalyPattern(allScores),
      cascading_risk_pattern: this.detectCascadingRiskPattern(allScores),
      distributed_suspicion_pattern: this.detectDistributedSuspicionPattern(allScores),
      
      // Información contextual del cliente
      client_risk_context: this.calculateClientRiskContext(variables),
      transaction_risk_context: this.calculateTransactionRiskContext(variables),
      
      // Índices de meta-patrones
      overall_pattern_disruption: this.calculateOverallPatternDisruption(variables, allScores),
      fraud_pattern_likelihood: this.calculateFraudPatternLikelihood(meta, allScores),
      
      // Información temporal
      client_maturity: Math.min(variables.client_age_days / 365, 1),
      transaction_experience: Math.min(variables.historical_transaction_count / 100, 1)
    };
    
    return input;
  }

  /**
   * Calculo promedio de scores
   * @param {Object} scores - Scores de todas las redes
   * @returns {number} - Promedio de scores
   */
  calculateScoreAverage(scores) {
    const values = Object.values(scores);
    return values.reduce((sum, score) => sum + score, 0) / values.length;
  }

  /**
   * Calculo varianza de scores
   * @param {Object} scores - Scores de todas las redes
   * @returns {number} - Varianza de scores
   */
  calculateScoreVariance(scores) {
    const values = Object.values(scores);
    const average = this.calculateScoreAverage(scores);
    const variance = values.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / values.length;
    return Math.sqrt(variance); // Retornar desviación estándar normalizada
  }

  /**
   * Cuento scores altos
   * @param {Object} scores - Scores de todas las redes
   * @param {number} threshold - Umbral para considerar "alto"
   * @returns {number} - Proporción de scores altos
   */
  countHighScores(scores, threshold) {
    const values = Object.values(scores);
    const highScores = values.filter(score => score > threshold);
    return highScores.length / values.length;
  }

  /**
   * Calculo índice de correlación de scores
   * @param {Object} scores - Scores de todas las redes
   * @returns {number} - Índice de correlación
   */
  calculateScoreCorrelationIndex(scores) {
    const values = Object.values(scores);
    let correlationSum = 0;
    let pairCount = 0;
    
    // Calcular correlación promedio entre todos los pares
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const correlation = 1 - Math.abs(values[i] - values[j]);
        correlationSum += correlation;
        pairCount++;
      }
    }
    
    return pairCount > 0 ? correlationSum / pairCount : 0;
  }

  /**
   * Detecto patrón de múltiples anomalías
   * @param {Object} scores - Scores de todas las redes
   * @returns {number} - Score del patrón (0-1)
   */
  detectMultiAnomalyPattern(scores) {
    const highScores = Object.values(scores).filter(score => score > 0.7);
    return Math.min(highScores.length / 4, 1); // Normalizar por 4 anomalías máximas esperadas
  }

  /**
   * Detecto patrón de riesgo en cascada
   * @param {Object} scores - Scores de todas las redes
   * @returns {number} - Score del patrón (0-1)
   */
  detectCascadingRiskPattern(scores) {
    // Patrón donde el riesgo se propaga por múltiples dimensiones
    const relatedGroups = [
      [scores.amount, scores.merchant, scores.pattern],      // Grupo de gasto
      [scores.location, scores.distance, scores.country],   // Grupo geográfico
      [scores.time, scores.day, scores.velocity],           // Grupo temporal
      [scores.channel, scores.device, scores.frequency]     // Grupo tecnológico
    ];
    
    let cascadingScore = 0;
    for (const group of relatedGroups) {
      const groupAverage = group.reduce((sum, score) => sum + score, 0) / group.length;
      if (groupAverage > 0.5) {
        cascadingScore += 0.25;
      }
    }
    
    return cascadingScore;
  }

  /**
   * Detecto patrón de sospecha distribuida
   * @param {Object} scores - Scores de todas las redes
   * @returns {number} - Score del patrón (0-1)
   */
  detectDistributedSuspicionPattern(scores) {
    const values = Object.values(scores);
    const moderateScores = values.filter(score => score >= 0.4 && score <= 0.7);
    
    // Patrón donde muchas redes reportan sospecha moderada
    return Math.min(moderateScores.length / 6, 1);
  }

  /**
   * Calculo contexto de riesgo del cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de contexto de riesgo del cliente
   */
  calculateClientRiskContext(variables) {
    let riskContext = 0;
    
    if (variables.client_age_days < 30) riskContext += 0.3;
    if (variables.risk_profile === 'high') riskContext += 0.4;
    if (variables.unique_countries > 10) riskContext += 0.2;
    if (variables.historical_transaction_count < 10) riskContext += 0.1;
    
    return Math.min(riskContext, 1);
  }

  /**
   * Calculo contexto de riesgo de la transacción
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de contexto de riesgo de la transacción
   */
  calculateTransactionRiskContext(variables) {
    let riskContext = 0;
    
    if (variables.amount > 10000) riskContext += 0.3;
    if (!variables.is_domestic) riskContext += 0.2;
    if (variables.is_night_transaction) riskContext += 0.2;
    if (variables.is_weekend) riskContext += 0.1;
    if (variables.channel === 'online' || variables.channel === 'phone') riskContext += 0.2;
    
    return Math.min(riskContext, 1);
  }

  /**
   * Calculo disrupción general de patrones
   * @param {Object} variables - Variables de la transacción
   * @param {Object} scores - Scores de todas las redes
   * @returns {number} - Score de disrupción de patrones
   */
  calculateOverallPatternDisruption(variables, scores) {
    const avgScore = this.calculateScoreAverage(scores);
    const variance = this.calculateScoreVariance(scores);
    const highScoreRatio = this.countHighScores(scores, 0.6);
    
    // Combinación de factores que indican disrupción de patrones
    return Math.min((avgScore * 0.4) + (variance * 0.3) + (highScoreRatio * 0.3), 1);
  }

  /**
   * Calculo probabilidad de patrón de fraude
   * @param {Object} meta - Meta-patrones detectados
   * @param {Object} scores - Scores de todas las redes
   * @returns {number} - Probabilidad de patrón de fraude
   */
  calculateFraudPatternLikelihood(meta, scores) {
    let likelihood = 0;
    
    // Contribución de meta-patrones
    likelihood += meta.testing_escalation_pattern * 0.25;
    likelihood += meta.account_takeover_pattern * 0.25;
    likelihood += meta.synthetic_fraud_pattern * 0.2;
    likelihood += meta.structuring_pattern * 0.15;
    likelihood += meta.correlated_anomalies * 0.15;
    
    return Math.min(likelihood, 1);
  }

  /**
   * Analizo y combino todos los patrones
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado del análisis combinado
   */
  async analyze(transactionData, layer1Results) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red combinadora de patrones no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData, layer1Results);
      }
      
      const input = this.prepareInput(transactionData, layer1Results);
      const output = this.network.run(input);
      const combinedScore = Array.isArray(output) ? output[0] : output;
      
      const patterns = this.detectMetaPatterns(transactionData, layer1Results, input);
      
      const result = {
        network_id: this.networkId,
        combined_score: combinedScore,
        confidence: this.calculateConfidence(input),
        patterns_detected: patterns,
        pattern_analysis: {
          overall_disruption: input.overall_pattern_disruption,
          fraud_likelihood: input.fraud_pattern_likelihood,
          score_consistency: 1 - input.score_variance,
          anomaly_concentration: input.high_score_count,
          correlation_strength: input.score_correlation_index
        },
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de patrones completado: Score=${combinedScore.toFixed(3)}, Meta-patrones=${patterns.length}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de patrones:', error);
      return this.heuristicAnalysis(transactionData, layer1Results);
    }
  }

  /**
   * Análisis heurístico de patrones
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData, layer1Results) {
    const input = this.prepareInput(transactionData, layer1Results);
    let combinedScore = input.fraud_pattern_likelihood;
    const patterns = [];
    
    // Ajustar score basado en meta-patrones específicos
    if (input.testing_escalation_pattern > 0.6) {
      combinedScore += 0.2;
      patterns.push('Patrón de prueba y escalamiento detectado');
    }
    
    if (input.account_takeover_pattern > 0.6) {
      combinedScore += 0.25;
      patterns.push('Patrón de toma de cuenta detectado');
    }
    
    if (input.synthetic_fraud_pattern > 0.6) {
      combinedScore += 0.2;
      patterns.push('Patrón de fraude sintético detectado');
    }
    
    if (input.structuring_pattern > 0.5) {
      combinedScore += 0.2;
      patterns.push('Patrón de estructuración de dinero');
    }
    
    if (input.multi_anomaly_pattern > 0.7) {
      combinedScore += 0.15;
      patterns.push('Múltiples anomalías correlacionadas');
    }
    
    if (input.cascading_risk_pattern > 0.6) {
      combinedScore += 0.1;
      patterns.push('Patrón de riesgo en cascada');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      combined_score: Math.min(combinedScore, 1),
      confidence: 0.8,
      patterns_detected: patterns,
      pattern_analysis: {
        overall_disruption: input.overall_pattern_disruption,
        fraud_likelihood: input.fraud_pattern_likelihood,
        score_consistency: 1 - input.score_variance,
        anomaly_concentration: input.high_score_count,
        correlation_strength: input.score_correlation_index
      },
      processing_time_ms: 8
    };
  }

  /**
   * Detecto meta-patrones específicos
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} input - Datos de entrada procesados
   * @returns {Array} - Lista de meta-patrones detectados
   */
  detectMetaPatterns(transactionData, layer1Results, input) {
    const patterns = [];
    
    if (input.testing_escalation_pattern > 0.6) {
      patterns.push('Meta-patrón: Prueba y escalamiento de transacciones');
    }
    
    if (input.account_takeover_pattern > 0.6) {
      patterns.push('Meta-patrón: Toma de control de cuenta');
    }
    
    if (input.synthetic_fraud_pattern > 0.6) {
      patterns.push('Meta-patrón: Fraude con identidad sintética');
    }
    
    if (input.structuring_pattern > 0.5) {
      patterns.push('Meta-patrón: Estructuración para lavado de dinero');
    }
    
    if (input.behavior_change_analysis > 0.7) {
      patterns.push('Meta-patrón: Cambio dramático de comportamiento');
    }
    
    if (input.multi_dimensional_consistency < 0.3) {
      patterns.push('Meta-patrón: Inconsistencia multi-dimensional');
    }
    
    if (input.correlated_anomalies > 0.7) {
      patterns.push('Meta-patrón: Múltiples anomalías correlacionadas');
    }
    
    if (input.overall_pattern_disruption > 0.8) {
      patterns.push('Meta-patrón: Disrupción general de patrones establecidos');
    }
    
    return patterns;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.7; // Confianza base
    
    // Mayor confianza si tenemos experiencia del cliente
    if (input.transaction_experience > 0.2) {
      confidence += 0.1;
    }
    
    // Mayor confianza si los scores son consistentes
    if (input.score_correlation_index > 0.7) {
      confidence += 0.1;
    }
    
    // Mayor confianza si detectamos patrones claros
    if (input.fraud_pattern_likelihood > 0.6) {
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
      logger.info(`Iniciando entrenamiento de red combinadora de patrones con ${trainingData.length} muestras`);
      
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
      
      logger.info('Entrenamiento de red combinadora de patrones completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red combinadora de patrones:', error);
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
      purpose: 'pattern_combination',
      meta_patterns: this.metaPatterns
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
      
      if (modelData.meta_patterns) {
        this.metaPatterns = modelData.meta_patterns;
      }
      
      logger.info(`Modelo combinador de patrones cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo combinador de patrones:', error);
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
      purpose: 'pattern_combination',
      description: 'Combina todos los análisis de Capa 1 para detectar meta-patrones complejos de fraude',
      input_networks: ['amount', 'location', 'time', 'day', 'merchant', 'velocity', 'distance', 'pattern', 'frequency', 'channel', 'device', 'country']
    };
  }
}

module.exports = PatternCombiner;