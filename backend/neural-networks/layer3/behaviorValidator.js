const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 3.3 - Validador de Comportamiento
 * Esta red valida la coherencia del comportamiento transaccional comparando con patrones históricos
 */
class BehaviorValidator {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [18, 12, 6],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'behavior_validator_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Patrones de comportamiento conocidos
    this.behaviorPatterns = {
      normal: {
        spending: { min: 10, max: 5000, avg: 500 },
        frequency: { daily: 3, weekly: 15, monthly: 50 },
        locations: { max_per_day: 5, usual_radius_km: 50 }
      },
      suspicious: {
        velocity: { max_per_hour: 5, max_per_day: 20 },
        amounts: { sudden_increase: 5, micro_transactions: 10 },
        geography: { countries_per_day: 3, impossible_distance: 500 }
      }
    };
  }

  /**
   * Valido el comportamiento transaccional
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Validación de comportamiento
   */
  validateTransactionBehavior(transactionData, layer1Results, layer2Results) {
    const { variables } = transactionData;
    
    return {
      // Validación de coherencia temporal
      temporal_coherence: this.validateTemporalCoherence(variables, layer1Results),
      
      // Validación de coherencia espacial
      spatial_coherence: this.validateSpatialCoherence(variables, layer1Results),
      
      // Validación de coherencia de gasto
      spending_coherence: this.validateSpendingCoherence(variables, layer1Results),
      
      // Validación de coherencia de canal
      channel_coherence: this.validateChannelCoherence(variables, layer1Results),
      
      // Validación de coherencia de establecimiento
      merchant_coherence: this.validateMerchantCoherence(variables, layer1Results),
      
      // Validación de patrones evolutivos
      evolution_coherence: this.validateEvolutionCoherence(variables, layer1Results, layer2Results),
      
      // Validación de consistencia general
      overall_consistency: this.validateOverallConsistency(layer1Results, layer2Results),
      
      // Detección de comportamiento anómalo
      anomalous_behaviors: this.detectAnomalousBehaviors(variables, layer1Results, layer2Results)
    };
  }

  /**
   * Valido coherencia temporal
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Validación temporal
   */
  validateTemporalCoherence(variables, layer1Results) {
    const validation = {
      is_coherent: true,
      issues: [],
      score: 0
    };
    
    // Verificar velocidad de transacciones
    if (variables.transactions_last_hour > 5) {
      validation.issues.push('Demasiadas transacciones en una hora');
      validation.score += 0.3;
    }
    
    // Verificar horario inusual con alta actividad
    if (variables.is_night_transaction && variables.transactions_last_hour > 2) {
      validation.issues.push('Alta actividad en horario nocturno inusual');
      validation.score += 0.2;
    }
    
    // Verificar cambio repentino de patrón temporal
    const timeScore = layer1Results.time?.suspicion_score || 0;
    const dayScore = layer1Results.day?.suspicion_score || 0;
    if (timeScore > 0.7 && dayScore > 0.7) {
      validation.issues.push('Patrón temporal completamente atípico');
      validation.score += 0.3;
    }
    
    validation.is_coherent = validation.score < 0.5;
    return validation;
  }

  /**
   * Valido coherencia espacial
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Validación espacial
   */
  validateSpatialCoherence(variables, layer1Results) {
    const validation = {
      is_coherent: true,
      issues: [],
      score: 0
    };
    
    // Verificar distancia imposible
    const distanceScore = layer1Results.distance?.suspicion_score || 0;
    if (distanceScore > 0.9) {
      validation.issues.push('Distancia físicamente imposible entre transacciones');
      validation.score += 0.5;
    }
    
    // Verificar múltiples países en poco tiempo
    if (variables.unique_countries > 3 && variables.client_age_days < 30) {
      validation.issues.push('Demasiados países para cliente nuevo');
      validation.score += 0.3;
    }
    
    // Verificar coherencia de ubicación con tipo de establecimiento
    const locationScore = layer1Results.location?.suspicion_score || 0;
    const merchantScore = layer1Results.merchant?.suspicion_score || 0;
    if (locationScore > 0.7 && merchantScore > 0.7) {
      validation.issues.push('Ubicación incoherente con tipo de establecimiento');
      validation.score += 0.2;
    }
    
    validation.is_coherent = validation.score < 0.5;
    return validation;
  }

  /**
   * Valido coherencia de gasto
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Validación de gasto
   */
  validateSpendingCoherence(variables, layer1Results) {
    const validation = {
      is_coherent: true,
      issues: [],
      score: 0
    };
    
    // Verificar aumento repentino de gasto
    if (variables.historical_avg_amount > 0) {
      const spendingRatio = variables.amount / variables.historical_avg_amount;
      if (spendingRatio > 10) {
        validation.issues.push(`Gasto ${spendingRatio.toFixed(1)}x mayor al promedio`);
        validation.score += 0.4;
      }
    }
    
    // Verificar micro-transacciones seguidas de grandes montos
    if (variables.amount > 5000 && variables.prev_amount < 10) {
      validation.issues.push('Micro-transacción seguida de monto muy alto');
      validation.score += 0.3;
    }
    
    // Verificar gasto total en 24h
    if (variables.amount_last_24h > 20000) {
      validation.issues.push('Gasto excesivo en 24 horas');
      validation.score += 0.3;
    }
    
    validation.is_coherent = validation.score < 0.5;
    return validation;
  }

  /**
   * Valido coherencia de canal
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Validación de canal
   */
  validateChannelCoherence(variables, layer1Results) {
    const validation = {
      is_coherent: true,
      issues: [],
      score: 0
    };
    
    // Verificar cambio repentino de canal
    const channelScore = layer1Results.channel?.suspicion_score || 0;
    if (channelScore > 0.7 && variables.historical_transaction_count > 50) {
      validation.issues.push('Cambio inusual de canal de transacción');
      validation.score += 0.2;
    }
    
    // Verificar coherencia canal-monto
    if (variables.channel === 'atm' && variables.amount > 10000) {
      validation.issues.push('Monto inusualmente alto para retiro ATM');
      validation.score += 0.3;
    }
    
    // Verificar coherencia canal-dispositivo
    if (variables.channel === 'online' && !variables.device_info && !variables.ip_address) {
      validation.issues.push('Transacción online sin información de dispositivo');
      validation.score += 0.2;
    }
    
    validation.is_coherent = validation.score < 0.5;
    return validation;
  }

  /**
   * Valido coherencia de establecimiento
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Validación de establecimiento
   */
  validateMerchantCoherence(variables, layer1Results) {
    const validation = {
      is_coherent: true,
      issues: [],
      score: 0
    };
    
    // Verificar nuevo tipo de establecimiento para cliente establecido
    const merchantScore = layer1Results.merchant?.suspicion_score || 0;
    if (merchantScore > 0.7 && variables.client_age_days > 365) {
      validation.issues.push('Tipo de establecimiento nunca usado por cliente antiguo');
      validation.score += 0.2;
    }
    
    // Verificar coherencia monto-establecimiento
    if (variables.merchant_type === 'grocery' && variables.amount > 2000) {
      validation.issues.push('Monto inusualmente alto para tipo de establecimiento');
      validation.score += 0.2;
    }
    
    // Verificar diversidad repentina
    if (variables.historical_merchant_types < 5 && variables.merchant_type === 'jewelry') {
      validation.issues.push('Compra de alto riesgo para perfil conservador');
      validation.score += 0.3;
    }
    
    validation.is_coherent = validation.score < 0.5;
    return validation;
  }

  /**
   * Valido coherencia evolutiva del comportamiento
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Validación evolutiva
   */
  validateEvolutionCoherence(variables, layer1Results, layer2Results) {
    const validation = {
      is_coherent: true,
      issues: [],
      score: 0
    };
    
    // Verificar evolución natural vs cambio abrupto
    const behaviorScore = layer2Results.behavior?.combined_score || 0;
    if (behaviorScore > 0.8 && variables.client_age_days > 180) {
      validation.issues.push('Cambio abrupto en comportamiento establecido');
      validation.score += 0.4;
    }
    
    // Verificar escalamiento de actividad
    if (variables.transactions_last_24h > variables.avg_transactions_per_day * 5) {
      validation.issues.push('Escalamiento anormal de actividad');
      validation.score += 0.3;
    }
    
    // Verificar degradación de patrones
    const patternScore = layer1Results.pattern?.suspicion_score || 0;
    if (patternScore > 0.8) {
      validation.issues.push('Degradación severa de patrones históricos');
      validation.score += 0.3;
    }
    
    validation.is_coherent = validation.score < 0.5;
    return validation;
  }

  /**
   * Valido consistencia general
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Validación de consistencia
   */
  validateOverallConsistency(layer1Results, layer2Results) {
    const validation = {
      is_consistent: true,
      inconsistencies: [],
      score: 0
    };
    
    // Verificar consistencia entre capas
    const l1Scores = Object.values(layer1Results).map(r => r?.suspicion_score || 0);
    const l2Scores = Object.values(layer2Results).map(r => r?.combined_score || 0);
    
    const l1Avg = l1Scores.reduce((a, b) => a + b, 0) / l1Scores.length;
    const l2Avg = l2Scores.reduce((a, b) => a + b, 0) / l2Scores.length;
    
    if (Math.abs(l1Avg - l2Avg) > 0.4) {
      validation.inconsistencies.push('Inconsistencia significativa entre capas de análisis');
      validation.score += 0.3;
    }
    
    // Verificar alertas contradictorias
    if (l1Scores.filter(s => s > 0.8).length > 3 && l2Avg < 0.3) {
      validation.inconsistencies.push('Múltiples alertas individuales pero bajo riesgo combinado');
      validation.score += 0.2;
    }
    
    validation.is_consistent = validation.score < 0.3;
    return validation;
  }

  /**
   * Detecto comportamientos anómalos
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Array} - Lista de comportamientos anómalos
   */
  detectAnomalousBehaviors(variables, layer1Results, layer2Results) {
    const anomalies = [];
    
    // Comportamiento de prueba de tarjeta
    if (variables.amount < 5 && variables.transactions_last_hour > 3) {
      anomalies.push({
        type: 'card_testing',
        description: 'Posible prueba de tarjeta con micro-transacciones',
        severity: 'high'
      });
    }
    
    // Comportamiento de cuenta comprometida
    if (!variables.is_domestic && variables.is_night_transaction && variables.amount > 5000) {
      anomalies.push({
        type: 'compromised_account',
        description: 'Patrón típico de cuenta comprometida',
        severity: 'critical'
      });
    }
    
    // Comportamiento de lavado de dinero
    if (variables.transactions_last_24h > 20 && variables.unique_countries > 3) {
      anomalies.push({
        type: 'money_laundering',
        description: 'Posible patrón de lavado de dinero',
        severity: 'critical'
      });
    }
    
    // Comportamiento de identidad sintética
    if (variables.client_age_days < 30 && variables.historical_merchant_types > 15) {
      anomalies.push({
        type: 'synthetic_identity',
        description: 'Comportamiento consistente con identidad sintética',
        severity: 'high'
      });
    }
    
    return anomalies;
  }

  /**
   * Preparo datos para la red neuronal
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de todas las redes de Capa 1
   * @param {Object} layer2Results - Resultados de todas las redes de Capa 2
   * @returns {Object} - Datos preparados para la red
   */
  prepareInput(transactionData, layer1Results, layer2Results) {
    const behaviorValidation = this.validateTransactionBehavior(transactionData, layer1Results, layer2Results);
    
    const layer1Scores = {
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
    
    const layer2Scores = {
      behavior: layer2Results.behavior?.combined_score || 0,
      location: layer2Results.location?.combined_score || 0,
      timing: layer2Results.timing?.combined_score || 0,
      amount: layer2Results.amount?.combined_score || 0,
      device: layer2Results.device?.combined_score || 0,
      pattern: layer2Results.pattern?.combined_score || 0
    };
    
    const input = {
      // Scores de capas anteriores
      ...layer1Scores,
      l2_behavior: layer2Scores.behavior,
      l2_location: layer2Scores.location,
      l2_timing: layer2Scores.timing,
      l2_amount: layer2Scores.amount,
      l2_device: layer2Scores.device,
      l2_pattern: layer2Scores.pattern,
      
      // Validaciones de comportamiento
      temporal_coherence_score: behaviorValidation.temporal_coherence.score,
      spatial_coherence_score: behaviorValidation.spatial_coherence.score,
      spending_coherence_score: behaviorValidation.spending_coherence.score,
      channel_coherence_score: behaviorValidation.channel_coherence.score,
      merchant_coherence_score: behaviorValidation.merchant_coherence.score,
      evolution_coherence_score: behaviorValidation.evolution_coherence.score,
      overall_consistency_score: behaviorValidation.overall_consistency.score,
      
      // Conteo de anomalías
      anomalous_behavior_count: behaviorValidation.anomalous_behaviors.length,
      critical_anomaly_count: behaviorValidation.anomalous_behaviors.filter(a => a.severity === 'critical').length,
      
      // Score general de validación
      behavior_validation_score: this.calculateBehaviorValidationScore(behaviorValidation)
    };
    
    return input;
  }

  /**
   * Calculo score general de validación de comportamiento
   * @param {Object} validation - Validaciones realizadas
   * @returns {number} - Score de validación (0-1)
   */
  calculateBehaviorValidationScore(validation) {
    let score = 0;
    let weights = 0;
    
    // Ponderar cada tipo de validación
    const validations = [
      { score: validation.temporal_coherence.score, weight: 0.15 },
      { score: validation.spatial_coherence.score, weight: 0.20 },
      { score: validation.spending_coherence.score, weight: 0.20 },
      { score: validation.channel_coherence.score, weight: 0.10 },
      { score: validation.merchant_coherence.score, weight: 0.10 },
      { score: validation.evolution_coherence.score, weight: 0.15 },
      { score: validation.overall_consistency.score, weight: 0.10 }
    ];
    
    validations.forEach(v => {
      score += v.score * v.weight;
      weights += v.weight;
    });
    
    // Agregar penalización por anomalías
    const anomalyPenalty = Math.min(validation.anomalous_behaviors.length * 0.1, 0.3);
    score = Math.min(score + anomalyPenalty, 1);
    
    return score;
  }

  /**
   * Analizo y valido el comportamiento transaccional
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Resultado de la validación de comportamiento
   */
  async analyze(transactionData, layer1Results, layer2Results) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red validadora de comportamiento no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData, layer1Results, layer2Results);
      }
      
      const input = this.prepareInput(transactionData, layer1Results, layer2Results);
      const output = this.network.run(input);
      const validationScore = Array.isArray(output) ? output[0] : output;
      
      const behaviorValidation = this.validateTransactionBehavior(transactionData, layer1Results, layer2Results);
      const warnings = this.generateWarnings(validationScore, behaviorValidation);
      
      const result = {
        network_id: this.networkId,
        deep_analysis_score: validationScore,
        confidence: this.calculateConfidence(input),
        behavior_validation: behaviorValidation,
        warnings: warnings,
        coherence_summary: {
          temporal: behaviorValidation.temporal_coherence.is_coherent,
          spatial: behaviorValidation.spatial_coherence.is_coherent,
          spending: behaviorValidation.spending_coherence.is_coherent,
          channel: behaviorValidation.channel_coherence.is_coherent,
          merchant: behaviorValidation.merchant_coherence.is_coherent,
          evolution: behaviorValidation.evolution_coherence.is_coherent,
          overall: behaviorValidation.overall_consistency.is_consistent
        },
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Validación de comportamiento completada: Score=${validationScore.toFixed(3)}`);
      return result;
      
    } catch (error) {
      logger.error('Error en validación de comportamiento:', error);
      return this.heuristicAnalysis(transactionData, layer1Results, layer2Results);
    }
  }

  /**
   * Análisis heurístico de comportamiento
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData, layer1Results, layer2Results) {
    const input = this.prepareInput(transactionData, layer1Results, layer2Results);
    const validationScore = input.behavior_validation_score;
    const behaviorValidation = this.validateTransactionBehavior(transactionData, layer1Results, layer2Results);
    const warnings = this.generateWarnings(validationScore, behaviorValidation);
    
    return {
      network_id: this.networkId + '_heuristic',
      deep_analysis_score: validationScore,
      confidence: 0.8,
      behavior_validation: behaviorValidation,
      warnings: warnings,
      coherence_summary: {
        temporal: behaviorValidation.temporal_coherence.is_coherent,
        spatial: behaviorValidation.spatial_coherence.is_coherent,
        spending: behaviorValidation.spending_coherence.is_coherent,
        channel: behaviorValidation.channel_coherence.is_coherent,
        merchant: behaviorValidation.merchant_coherence.is_coherent,
        evolution: behaviorValidation.evolution_coherence.is_coherent,
        overall: behaviorValidation.overall_consistency.is_consistent
      },
      processing_time_ms: 15
    };
  }

  /**
   * Genero advertencias basadas en la validación
   * @param {number} validationScore - Score de validación
   * @param {Object} behaviorValidation - Validaciones de comportamiento
   * @returns {Array} - Lista de advertencias
   */
  generateWarnings(validationScore, behaviorValidation) {
    const warnings = [];
    
    if (validationScore >= 0.8) {
      warnings.push('COMPORTAMIENTO CRÍTICO: Múltiples incoherencias detectadas');
    }
    
    if (!behaviorValidation.temporal_coherence.is_coherent) {
      warnings.push('INCOHERENCIA TEMPORAL: Patrón temporal anómalo');
    }
    
    if (!behaviorValidation.spatial_coherence.is_coherent) {
      warnings.push('INCOHERENCIA ESPACIAL: Ubicación o distancia imposible');
    }
    
    if (!behaviorValidation.spending_coherence.is_coherent) {
      warnings.push('INCOHERENCIA DE GASTO: Patrón de gasto anormal');
    }
    
    if (behaviorValidation.anomalous_behaviors.some(a => a.severity === 'critical')) {
      warnings.push('COMPORTAMIENTO CRÍTICO: Patrones de alto riesgo detectados');
    }
    
    return warnings;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.7;
    
    // Mayor confianza si hay múltiples validaciones fallidas
    const failedValidations = [
      input.temporal_coherence_score > 0.5,
      input.spatial_coherence_score > 0.5,
      input.spending_coherence_score > 0.5,
      input.evolution_coherence_score > 0.5
    ].filter(Boolean).length;
    
    if (failedValidations >= 3) {
      confidence += 0.2;
    } else if (failedValidations >= 2) {
      confidence += 0.1;
    }
    
    // Menor confianza si hay inconsistencias
    if (input.overall_consistency_score > 0.3) {
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
      logger.info(`Iniciando entrenamiento de red validadora de comportamiento con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => {
        const mockLayer1Results = this.generateMockLayer1Results(data);
        const mockLayer2Results = this.generateMockLayer2Results(data);
        return {
          input: this.prepareInput(data, mockLayer1Results, mockLayer2Results),
          output: [data.fraud_score || 0]
        };
      });
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red validadora de comportamiento completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red validadora de comportamiento:', error);
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
   * Genero resultados simulados de Capa 2 para entrenamiento
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultados simulados de Capa 2
   */
  generateMockLayer2Results(transactionData) {
    const fraudScore = transactionData.fraud_score || 0;
    
    return {
      behavior: { combined_score: fraudScore * (0.8 + Math.random() * 0.4) },
      location: { combined_score: fraudScore * (0.7 + Math.random() * 0.6) },
      timing: { combined_score: fraudScore * (0.6 + Math.random() * 0.8) },
      amount: { combined_score: fraudScore * (0.8 + Math.random() * 0.4) },
      device: { combined_score: fraudScore * (0.7 + Math.random() * 0.6) },
      pattern: { combined_score: fraudScore * (0.9 + Math.random() * 0.2) }
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
      layer: 3,
      purpose: 'behavior_validation',
      behavior_patterns: this.behaviorPatterns
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
      
      if (modelData.behavior_patterns) {
        this.behaviorPatterns = modelData.behavior_patterns;
      }
      
      logger.info(`Modelo validador de comportamiento cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo validador de comportamiento:', error);
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
      layer: 3,
      purpose: 'behavior_validation',
      description: 'Valida la coherencia del comportamiento transaccional comparando con patrones históricos'
    };
  }
}

module.exports = BehaviorValidator;