const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 3.2 - Detector de Anomalías
 * Esta red se especializa en detectar anomalías complejas que emergen de la interacción de múltiples factores
 */
class AnomalyDetector {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [18, 12, 6],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'anomaly_detector_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Tipos de anomalías conocidas
    this.anomalyTypes = {
      // Anomalías estadísticas
      statistical: {
        outliers: { threshold: 3, description: 'Valores estadísticamente atípicos' },
        deviations: { threshold: 2.5, description: 'Desviaciones significativas del patrón' }
      },
      
      // Anomalías temporales
      temporal: {
        velocity: { threshold: 0.8, description: 'Velocidad anómala de transacciones' },
        timing: { threshold: 0.7, description: 'Patrones temporales anómalos' },
        frequency: { threshold: 0.75, description: 'Frecuencia anómala de actividad' }
      },
      
      // Anomalías espaciales
      spatial: {
        location: { threshold: 0.8, description: 'Ubicaciones geográficas anómalas' },
        distance: { threshold: 0.9, description: 'Distancias físicamente improbables' }
      },
      
      // Anomalías comportamentales
      behavioral: {
        pattern: { threshold: 0.7, description: 'Ruptura de patrones establecidos' },
        escalation: { threshold: 0.8, description: 'Escalamiento anómalo de actividad' }
      },
      
      // Anomalías tecnológicas
      technological: {
        device: { threshold: 0.7, description: 'Dispositivos o canales anómalos' },
        automation: { threshold: 0.8, description: 'Indicadores de automatización' }
      }
    };
  }

  /**
   * Detecto anomalías complejas
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Detección de anomalías
   */
  detectComplexAnomalies(transactionData, layer1Results, layer2Results) {
    const { variables } = transactionData;
    
    return {
      // Anomalías estadísticas
      statistical_anomalies: this.detectStatisticalAnomalies(variables, layer1Results),
      
      // Anomalías emergentes
      emergent_anomalies: this.detectEmergentAnomalies(layer1Results, layer2Results),
      
      // Anomalías de correlación
      correlation_anomalies: this.detectCorrelationAnomalies(layer1Results, layer2Results),
      
      // Anomalías de cascada
      cascade_anomalies: this.detectCascadeAnomalies(layer1Results, layer2Results),
      
      // Anomalías de contexto
      context_anomalies: this.detectContextAnomalies(variables, layer1Results, layer2Results),
      
      // Anomalías de sistema
      system_anomalies: this.detectSystemAnomalies(variables, layer1Results, layer2Results),
      
      // Anomalías de interacción
      interaction_anomalies: this.detectInteractionAnomalies(layer1Results, layer2Results),
      
      // Anomalías sintéticas
      synthetic_anomalies: this.detectSyntheticAnomalies(variables, layer1Results, layer2Results)
    };
  }

  /**
   * Detecto anomalías estadísticas
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Anomalías estadísticas detectadas
   */
  detectStatisticalAnomalies(variables, layer1Results) {
    const anomalies = {
      outliers: [],
      deviations: [],
      score: 0
    };
    
    // Anomalía de monto estadístico
    if (variables.historical_avg_amount > 0) {
      const zScore = this.calculateZScore(variables.amount, variables.historical_avg_amount, variables.historical_avg_amount * 0.5);
      if (Math.abs(zScore) > 3) {
        anomalies.outliers.push(`Monto outlier estadístico (Z=${zScore.toFixed(2)})`);
        anomalies.score += 0.3;
      }
    }
    
    // Anomalía de frecuencia estadística
    if (variables.avg_transactions_per_day > 0) {
      const frequencyRatio = variables.transactions_last_24h / variables.avg_transactions_per_day;
      if (frequencyRatio > 5 || frequencyRatio < 0.1) {
        anomalies.deviations.push(`Frecuencia anómala (ratio=${frequencyRatio.toFixed(2)})`);
        anomalies.score += 0.2;
      }
    }
    
    // Anomalía de distribución de scores
    const scores = Object.values(layer1Results).map(r => r?.suspicion_score || 0);
    const scoreVariance = this.calculateVariance(scores);
    if (scoreVariance > 0.3) {
      anomalies.deviations.push(`Alta varianza en scores de detección (${scoreVariance.toFixed(3)})`);
      anomalies.score += 0.15;
    }
    
    return {
      ...anomalies,
      score: Math.min(anomalies.score, 1)
    };
  }

  /**
   * Detecto anomalías emergentes
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Anomalías emergentes detectadas
   */
  detectEmergentAnomalies(layer1Results, layer2Results) {
    const anomalies = {
      patterns: [],
      score: 0
    };
    
    // Emergencia de múltiples alertas simultáneas
    const highAlerts = this.countHighScores(layer1Results, 0.7);
    if (highAlerts >= 4) {
      anomalies.patterns.push(`Emergencia de múltiples alertas simultáneas (${highAlerts})`);
      anomalies.score += 0.4;
    }
    
    // Emergencia de correlaciones inesperadas
    const unexpectedCorrelations = this.detectUnexpectedCorrelations(layer1Results);
    if (unexpectedCorrelations > 2) {
      anomalies.patterns.push(`Correlaciones inesperadas entre variables (${unexpectedCorrelations})`);
      anomalies.score += 0.3;
    }
    
    // Emergencia de patrones complejos en Capa 2
    const complexPatterns = this.countComplexPatterns(layer2Results);
    if (complexPatterns >= 2) {
      anomalies.patterns.push(`Emergencia de patrones complejos múltiples (${complexPatterns})`);
      anomalies.score += 0.3;
    }
    
    return {
      ...anomalies,
      score: Math.min(anomalies.score, 1)
    };
  }

  /**
   * Detecto anomalías de correlación
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Anomalías de correlación detectadas
   */
  detectCorrelationAnomalies(layer1Results, layer2Results) {
    const anomalies = {
      correlations: [],
      score: 0
    };
    
    // Correlaciones anómalas entre variables independientes
    const independentPairs = [
      ['amount', 'time'],
      ['location', 'merchant'],
      ['device', 'distance']
    ];
    
    independentPairs.forEach(pair => {
      const score1 = layer1Results[pair[0]]?.suspicion_score || 0;
      const score2 = layer1Results[pair[1]]?.suspicion_score || 0;
      
      if (score1 > 0.7 && score2 > 0.7) {
        anomalies.correlations.push(`Correlación anómala: ${pair[0]} y ${pair[1]}`);
        anomalies.score += 0.2;
      }
    });
    
    // Anti-correlaciones anómalas (una alta, otra muy baja)
    const antiCorrelationPairs = [
      ['pattern', 'velocity'],
      ['location', 'device']
    ];
    
    antiCorrelationPairs.forEach(pair => {
      const score1 = layer1Results[pair[0]]?.suspicion_score || 0;
      const score2 = layer1Results[pair[1]]?.suspicion_score || 0;
      
      if ((score1 > 0.8 && score2 < 0.2) || (score1 < 0.2 && score2 > 0.8)) {
        anomalies.correlations.push(`Anti-correlación anómala: ${pair[0]} vs ${pair[1]}`);
        anomalies.score += 0.15;
      }
    });
    
    return {
      ...anomalies,
      score: Math.min(anomalies.score, 1)
    };
  }

  /**
   * Detecto anomalías de cascada
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Anomalías de cascada detectadas
   */
  detectCascadeAnomalies(layer1Results, layer2Results) {
    const anomalies = {
      cascades: [],
      score: 0
    };
    
    // Cascada temporal: tiempo -> día -> frecuencia
    const temporalCascade = [
      layer1Results.time?.suspicion_score || 0,
      layer1Results.day?.suspicion_score || 0,
      layer1Results.frequency?.suspicion_score || 0
    ];
    
    if (temporalCascade.every(score => score > 0.6)) {
      anomalies.cascades.push('Cascada temporal completa detectada');
      anomalies.score += 0.3;
    }
    
    // Cascada espacial: ubicación -> distancia -> país
    const spatialCascade = [
      layer1Results.location?.suspicion_score || 0,
      layer1Results.distance?.suspicion_score || 0,
      layer1Results.country?.suspicion_score || 0
    ];
    
    if (spatialCascade.every(score => score > 0.6)) {
      anomalies.cascades.push('Cascada espacial completa detectada');
      anomalies.score += 0.3;
    }
    
    // Cascada comportamental: patrón -> velocidad -> frecuencia
    const behavioralCascade = [
      layer1Results.pattern?.suspicion_score || 0,
      layer1Results.velocity?.suspicion_score || 0,
      layer1Results.frequency?.suspicion_score || 0
    ];
    
    if (behavioralCascade.every(score => score > 0.6)) {
      anomalies.cascades.push('Cascada comportamental completa detectada');
      anomalies.score += 0.4;
    }
    
    return {
      ...anomalies,
      score: Math.min(anomalies.score, 1)
    };
  }

  /**
   * Detecto anomalías de contexto
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Anomalías de contexto detectadas
   */
  detectContextAnomalies(variables, layer1Results, layer2Results) {
    const anomalies = {
      contexts: [],
      score: 0
    };
    
    // Contexto temporal anómalo
    if (variables.is_night_transaction && variables.is_weekend && variables.amount > 10000) {
      anomalies.contexts.push('Contexto temporal de alto riesgo: noche + fin de semana + monto alto');
      anomalies.score += 0.3;
    }
    
    // Contexto geográfico anómalo
    if (!variables.is_domestic && variables.is_night_transaction && (layer1Results.device?.suspicion_score || 0) > 0.7) {
      anomalies.contexts.push('Contexto geográfico anómalo: internacional + nocturno + dispositivo sospechoso');
      anomalies.score += 0.3;
    }
    
    // Contexto de cliente anómalo
    if (variables.client_age_days < 30 && variables.amount > 5000 && variables.unique_countries > 3) {
      anomalies.contexts.push('Contexto de cliente anómalo: nuevo + alto monto + múltiples países');
      anomalies.score += 0.4;
    }
    
    // Contexto tecnológico anómalo
    if (variables.channel === 'online' && !variables.device_info && !variables.is_domestic) {
      anomalies.contexts.push('Contexto tecnológico anómalo: online internacional sin device info');
      anomalies.score += 0.2;
    }
    
    return {
      ...anomalies,
      score: Math.min(anomalies.score, 1)
    };
  }

  /**
   * Detecto anomalías de sistema
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Anomalías de sistema detectadas
   */
  detectSystemAnomalies(variables, layer1Results, layer2Results) {
    const anomalies = {
      system_issues: [],
      score: 0
    };
    
    // Anomalía de cobertura: muy pocas redes reportando
    const reportingNetworks = Object.values(layer1Results).filter(r => r && r.suspicion_score > 0.1).length;
    if (reportingNetworks < 5) {
      anomalies.system_issues.push(`Baja cobertura de análisis: solo ${reportingNetworks} redes reportando`);
      anomalies.score += 0.2;
    }
    
    // Anomalía de consenso: resultados muy dispersos
    const scores = Object.values(layer1Results).map(r => r?.suspicion_score || 0);
    const variance = this.calculateVariance(scores);
    if (variance > 0.4) {
      anomalies.system_issues.push(`Falta de consenso: alta varianza en resultados (${variance.toFixed(3)})`);
      anomalies.score += 0.1;
    }
    
    // Anomalía de inconsistencia entre capas
    const layer1Max = Math.max(...scores);
    const layer2Scores = Object.values(layer2Results).map(r => r?.combined_score || 0);
    const layer2Max = Math.max(...layer2Scores);
    
    if (Math.abs(layer1Max - layer2Max) > 0.5) {
      anomalies.system_issues.push(`Inconsistencia entre capas: L1=${layer1Max.toFixed(2)}, L2=${layer2Max.toFixed(2)}`);
      anomalies.score += 0.15;
    }
    
    return {
      ...anomalies,
      score: Math.min(anomalies.score, 1)
    };
  }

  /**
   * Detecto anomalías de interacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Anomalías de interacción detectadas
   */
  detectInteractionAnomalies(layer1Results, layer2Results) {
    const anomalies = {
      interactions: [],
      score: 0
    };
    
    // Interacciones no lineales
    const nonLinearInteractions = this.detectNonLinearInteractions(layer1Results);
    if (nonLinearInteractions > 0) {
      anomalies.interactions.push(`Interacciones no lineales detectadas: ${nonLinearInteractions}`);
      anomalies.score += nonLinearInteractions * 0.1;
    }
    
    // Interacciones emergentes en Capa 2
    const emergentInteractions = this.detectEmergentInteractions(layer1Results, layer2Results);
    if (emergentInteractions > 0) {
      anomalies.interactions.push(`Interacciones emergentes en Capa 2: ${emergentInteractions}`);
      anomalies.score += emergentInteractions * 0.15;
    }
    
    // Interacciones inhibitorias anómalas
    const inhibitoryInteractions = this.detectInhibitoryInteractions(layer1Results, layer2Results);
    if (inhibitoryInteractions > 0) {
      anomalies.interactions.push(`Interacciones inhibitorias anómalas: ${inhibitoryInteractions}`);
      anomalies.score += inhibitoryInteractions * 0.1;
    }
    
    return {
      ...anomalies,
      score: Math.min(anomalies.score, 1)
    };
  }

  /**
   * Detecto anomalías sintéticas
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Anomalías sintéticas detectadas
   */
  detectSyntheticAnomalies(variables, layer1Results, layer2Results) {
    const anomalies = {
      synthetic_patterns: [],
      score: 0
    };
    
    // Patrón sintético de identidad
    if (variables.client_age_days < 60 && 
        variables.unique_countries > 5 && 
        variables.historical_merchant_types > 10) {
      anomalies.synthetic_patterns.push('Patrón de identidad sintética: nuevo cliente con actividad muy diversa');
      anomalies.score += 0.4;
    }
    
    // Patrón sintético de comportamiento
    const behaviorScore = layer2Results.behavior?.combined_score || 0;
    const patternScore = layer1Results.pattern?.suspicion_score || 0;
    if (behaviorScore > 0.8 && patternScore > 0.8 && variables.client_age_days < 90) {
      anomalies.synthetic_patterns.push('Patrón sintético de comportamiento: anomalías comportamentales extremas en cliente relativamente nuevo');
      anomalies.score += 0.3;
    }
    
    // Patrón sintético tecnológico
    const deviceScore = layer1Results.device?.suspicion_score || 0;
    const channelScore = layer1Results.channel?.suspicion_score || 0;
    if (deviceScore > 0.7 && channelScore > 0.7 && !variables.device_info) {
      anomalies.synthetic_patterns.push('Patrón sintético tecnológico: múltiples alertas tech sin device info');
      anomalies.score += 0.2;
    }
    
    return {
      ...anomalies,
      score: Math.min(anomalies.score, 1)
    };
  }

  /**
   * Calculo Z-score
   * @param {number} value - Valor actual
   * @param {number} mean - Media
   * @param {number} stdDev - Desviación estándar
   * @returns {number} - Z-score
   */
  calculateZScore(value, mean, stdDev) {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  /**
   * Calculo varianza
   * @param {Array} values - Valores
   * @returns {number} - Varianza
   */
  calculateVariance(values) {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance); // Retornar desviación estándar
  }

  /**
   * Cuento scores altos
   * @param {Object} results - Resultados a evaluar
   * @param {number} threshold - Umbral
   * @returns {number} - Número de scores altos
   */
  countHighScores(results, threshold) {
    return Object.values(results).filter(r => r?.suspicion_score > threshold).length;
  }

  /**
   * Detecto correlaciones inesperadas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {number} - Número de correlaciones inesperadas
   */
  detectUnexpectedCorrelations(layer1Results) {
    let count = 0;
    const unexpectedPairs = [
      ['amount', 'day'],
      ['time', 'merchant'],
      ['device', 'location']
    ];
    
    unexpectedPairs.forEach(pair => {
      const score1 = layer1Results[pair[0]]?.suspicion_score || 0;
      const score2 = layer1Results[pair[1]]?.suspicion_score || 0;
      
      if (score1 > 0.7 && score2 > 0.7) {
        count++;
      }
    });
    
    return count;
  }

  /**
   * Cuento patrones complejos en Capa 2
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Número de patrones complejos
   */
  countComplexPatterns(layer2Results) {
    return Object.values(layer2Results).filter(r => r?.combined_score > 0.7).length;
  }

  /**
   * Detecto interacciones no lineales
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {number} - Número de interacciones no lineales
   */
  detectNonLinearInteractions(layer1Results) {
    // Simplificado: buscar patrones donde la suma no es igual a las partes
    let count = 0;
    const scores = Object.values(layer1Results).map(r => r?.suspicion_score || 0);
    
    // Detectar si hay scores muy altos con otros muy bajos (no lineal)
    const highScores = scores.filter(s => s > 0.8).length;
    const lowScores = scores.filter(s => s < 0.2).length;
    
    if (highScores >= 2 && lowScores >= 2) {
      count++;
    }
    
    return count;
  }

  /**
   * Detecto interacciones emergentes
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Número de interacciones emergentes
   */
  detectEmergentInteractions(layer1Results, layer2Results) {
    let count = 0;
    
    // Buscar casos donde Capa 2 tiene scores altos pero Capa 1 no
    Object.values(layer2Results).forEach(l2Result => {
      if (l2Result?.combined_score > 0.7) {
        const maxL1Score = Math.max(...Object.values(layer1Results).map(r => r?.suspicion_score || 0));
        if (maxL1Score < 0.5) {
          count++; // Emergencia: alto en L2 pero bajo en L1
        }
      }
    });
    
    return count;
  }

  /**
   * Detecto interacciones inhibitorias
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Número de interacciones inhibitorias
   */
  detectInhibitoryInteractions(layer1Results, layer2Results) {
    let count = 0;
    
    // Buscar casos donde Capa 1 tiene scores altos pero Capa 2 los inhibe
    const maxL1Score = Math.max(...Object.values(layer1Results).map(r => r?.suspicion_score || 0));
    const maxL2Score = Math.max(...Object.values(layer2Results).map(r => r?.combined_score || 0));
    
    if (maxL1Score > 0.8 && maxL2Score < 0.4) {
      count++; // Inhibición: alto en L1 pero bajo en L2
    }
    
    return count;
  }

  /**
   * Preparo datos para la red neuronal
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de todas las redes de Capa 1
   * @param {Object} layer2Results - Resultados de todas las redes de Capa 2
   * @returns {Object} - Datos preparados para la red
   */
  prepareInput(transactionData, layer1Results, layer2Results) {
    // Detectar anomalías complejas
    const anomalies = this.detectComplexAnomalies(transactionData, layer1Results, layer2Results);
    
    // Extraer todos los scores de capas anteriores
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
      
      // Scores de anomalías detectadas
      statistical_anomalies: anomalies.statistical_anomalies.score,
      emergent_anomalies: anomalies.emergent_anomalies.score,
      correlation_anomalies: anomalies.correlation_anomalies.score,
      cascade_anomalies: anomalies.cascade_anomalies.score,
      context_anomalies: anomalies.context_anomalies.score,
      system_anomalies: anomalies.system_anomalies.score,
      interaction_anomalies: anomalies.interaction_anomalies.score,
      synthetic_anomalies: anomalies.synthetic_anomalies.score,
      
      // Métricas agregadas de anomalías
      total_anomaly_score: this.calculateTotalAnomalyScore(anomalies),
      anomaly_diversity: this.calculateAnomalyDiversity(anomalies),
      anomaly_severity: this.calculateAnomalySeverity(anomalies)
    };
    
    return input;
  }

  /**
   * Calculo score total de anomalías
   * @param {Object} anomalies - Todas las anomalías detectadas
   * @returns {number} - Score total de anomalías
   */
  calculateTotalAnomalyScore(anomalies) {
    const scores = [
      anomalies.statistical_anomalies.score,
      anomalies.emergent_anomalies.score,
      anomalies.correlation_anomalies.score,
      anomalies.cascade_anomalies.score,
      anomalies.context_anomalies.score,
      anomalies.system_anomalies.score,
      anomalies.interaction_anomalies.score,
      anomalies.synthetic_anomalies.score
    ];
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Calculo diversidad de anomalías
   * @param {Object} anomalies - Todas las anomalías detectadas
   * @returns {number} - Diversidad de anomalías (0-1)
   */
  calculateAnomalyDiversity(anomalies) {
    const typesWithAnomalies = [
      anomalies.statistical_anomalies.score > 0.1,
      anomalies.emergent_anomalies.score > 0.1,
      anomalies.correlation_anomalies.score > 0.1,
      anomalies.cascade_anomalies.score > 0.1,
      anomalies.context_anomalies.score > 0.1,
      anomalies.system_anomalies.score > 0.1,
      anomalies.interaction_anomalies.score > 0.1,
      anomalies.synthetic_anomalies.score > 0.1
    ].filter(Boolean).length;
    
    return typesWithAnomalies / 8; // 8 tipos de anomalías
  }

  /**
   * Calculo severidad de anomalías
   * @param {Object} anomalies - Todas las anomalías detectadas
   * @returns {number} - Severidad máxima de anomalías
   */
  calculateAnomalySeverity(anomalies) {
    return Math.max(
      anomalies.statistical_anomalies.score,
      anomalies.emergent_anomalies.score,
      anomalies.correlation_anomalies.score,
      anomalies.cascade_anomalies.score,
      anomalies.context_anomalies.score,
      anomalies.system_anomalies.score,
      anomalies.interaction_anomalies.score,
      anomalies.synthetic_anomalies.score
    );
  }

  /**
   * Analizo y detecto anomalías complejas
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Resultado de la detección de anomalías
   */
  async analyze(transactionData, layer1Results, layer2Results) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red detectora de anomalías no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData, layer1Results, layer2Results);
      }
      
      const input = this.prepareInput(transactionData, layer1Results, layer2Results);
      const output = this.network.run(input);
      const anomalyScore = Array.isArray(output) ? output[0] : output;
      
      const complexAnomalies = this.detectComplexAnomalies(transactionData, layer1Results, layer2Results);
      const warnings = this.generateAnomalyWarnings(anomalyScore, complexAnomalies);
      
      const result = {
        network_id: this.networkId,
        deep_analysis_score: anomalyScore,
        confidence: this.calculateConfidence(input),
        complex_anomalies: complexAnomalies,
        warnings: warnings,
        anomaly_summary: {
          total_score: input.total_anomaly_score,
          diversity: input.anomaly_diversity,
          severity: input.anomaly_severity,
          types_detected: this.countDetectedAnomalyTypes(complexAnomalies)
        },
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Detección de anomalías completada: Score=${anomalyScore.toFixed(3)}, Tipos=${result.anomaly_summary.types_detected}`);
      return result;
      
    } catch (error) {
      logger.error('Error en detección de anomalías:', error);
      return this.heuristicAnalysis(transactionData, layer1Results, layer2Results);
    }
  }

  /**
   * Análisis heurístico de anomalías
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData, layer1Results, layer2Results) {
    const input = this.prepareInput(transactionData, layer1Results, layer2Results);
    const anomalyScore = input.total_anomaly_score;
    const complexAnomalies = this.detectComplexAnomalies(transactionData, layer1Results, layer2Results);
    const warnings = this.generateAnomalyWarnings(anomalyScore, complexAnomalies);
    
    return {
      network_id: this.networkId + '_heuristic',
      deep_analysis_score: anomalyScore,
      confidence: 0.8,
      complex_anomalies: complexAnomalies,
      warnings: warnings,
      anomaly_summary: {
        total_score: input.total_anomaly_score,
        diversity: input.anomaly_diversity,
        severity: input.anomaly_severity,
        types_detected: this.countDetectedAnomalyTypes(complexAnomalies)
      },
      processing_time_ms: 12
    };
  }

  /**
   * Genero advertencias de anomalías
   * @param {number} anomalyScore - Score de anomalías
   * @param {Object} complexAnomalies - Anomalías complejas detectadas
   * @returns {Array} - Lista de advertencias
   */
  generateAnomalyWarnings(anomalyScore, complexAnomalies) {
    const warnings = [];
    
    if (anomalyScore >= 0.8) {
      warnings.push('ANOMALÍAS CRÍTICAS: Múltiples patrones anómalos detectados');
    }
    
    if (complexAnomalies.cascade_anomalies.score > 0.7) {
      warnings.push('CASCADA ANÓMALA: Efectos en cadena detectados');
    }
    
    if (complexAnomalies.emergent_anomalies.score > 0.6) {
      warnings.push('ANOMALÍAS EMERGENTES: Patrones inesperados en interacciones');
    }
    
    if (complexAnomalies.synthetic_anomalies.score > 0.6) {
      warnings.push('POSIBLE FRAUDE SINTÉTICO: Indicadores de identidad/comportamiento artificial');
    }
    
    if (complexAnomalies.system_anomalies.score > 0.5) {
      warnings.push('ANOMALÍAS DE SISTEMA: Inconsistencias en el análisis');
    }
    
    return warnings;
  }

  /**
   * Cuento tipos de anomalías detectadas
   * @param {Object} complexAnomalies - Anomalías complejas
   * @returns {number} - Número de tipos detectados
   */
  countDetectedAnomalyTypes(complexAnomalies) {
    let count = 0;
    
    if (complexAnomalies.statistical_anomalies.score > 0.1) count++;
    if (complexAnomalies.emergent_anomalies.score > 0.1) count++;
    if (complexAnomalies.correlation_anomalies.score > 0.1) count++;
    if (complexAnomalies.cascade_anomalies.score > 0.1) count++;
    if (complexAnomalies.context_anomalies.score > 0.1) count++;
    if (complexAnomalies.system_anomalies.score > 0.1) count++;
    if (complexAnomalies.interaction_anomalies.score > 0.1) count++;
    if (complexAnomalies.synthetic_anomalies.score > 0.1) count++;
    
    return count;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.7; // Base
    
    // Mayor confianza si detectamos múltiples tipos de anomalías
    if (input.anomaly_diversity > 0.5) {
      confidence += 0.1;
    }
    
    // Mayor confianza si las anomalías son consistentes
    if (input.anomaly_severity > 0.7 && input.total_anomaly_score > 0.6) {
      confidence += 0.1;
    }
    
    // Menor confianza si hay anomalías de sistema
    if (input.system_anomalies > 0.3) {
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
      logger.info(`Iniciando entrenamiento de red detectora de anomalías con ${trainingData.length} muestras`);
      
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
      
      logger.info('Entrenamiento de red detectora de anomalías completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red detectora de anomalías:', error);
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
      purpose: 'anomaly_detection',
      anomaly_types: this.anomalyTypes
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
      
      if (modelData.anomaly_types) {
        this.anomalyTypes = modelData.anomaly_types;
      }
      
      logger.info(`Modelo detector de anomalías cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo detector de anomalías:', error);
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
      purpose: 'anomaly_detection',
      description: 'Detecta anomalías complejas que emergen de la interacción de múltiples factores en las capas anteriores',
      anomaly_categories: Object.keys(this.anomalyTypes)
    };
  }
}

module.exports = AnomalyDetector;