const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 3.1 - Evaluación de Riesgo
 * Esta red evalúa el riesgo general basado en todos los análisis de Capas 1 y 2
 */
class RiskAssessment {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [18, 12, 6], // Recibe de todas las capas anteriores
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'risk_assessment_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Matriz de riesgo multi-dimensional
    this.riskMatrix = {
      // Factores de riesgo por categoría
      categories: {
        client: { weight: 0.25, factors: ['age', 'profile', 'history'] },
        transaction: { weight: 0.30, factors: ['amount', 'location', 'time'] },
        behavior: { weight: 0.25, factors: ['pattern', 'frequency', 'consistency'] },
        technology: { weight: 0.20, factors: ['channel', 'device', 'automation'] }
      },
      
      // Niveles de riesgo
      levels: {
        minimal: { threshold: 0.2, actions: ['monitor'] },
        low: { threshold: 0.4, actions: ['monitor', 'log'] },
        medium: { threshold: 0.6, actions: ['review', 'verify'] },
        high: { threshold: 0.8, actions: ['block', 'investigate'] },
        critical: { threshold: 1.0, actions: ['block', 'alert', 'investigate'] }
      }
    };
  }

  /**
   * Evalúo el riesgo general de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Evaluación de riesgo
   */
  assessOverallRisk(transactionData, layer1Results, layer2Results) {
    const { variables } = transactionData;
    
    return {
      // Evaluación por categorías
      client_risk: this.assessClientRisk(variables),
      transaction_risk: this.assessTransactionRisk(variables, layer1Results),
      behavior_risk: this.assessBehaviorRisk(layer1Results, layer2Results),
      technology_risk: this.assessTechnologyRisk(layer1Results, layer2Results),
      
      // Evaluación de escalamiento de riesgo
      risk_escalation: this.assessRiskEscalation(variables, layer1Results, layer2Results),
      
      // Evaluación de urgencia
      urgency_assessment: this.assessUrgency(variables, layer1Results, layer2Results),
      
      // Evaluación de impacto potencial
      impact_assessment: this.assessPotentialImpact(variables),
      
      // Evaluación de confianza en el análisis
      confidence_assessment: this.assessAnalysisConfidence(layer1Results, layer2Results),
      
      // Factores de mitigación
      mitigation_factors: this.assessMitigationFactors(variables),
      
      // Recomendaciones de acción
      action_recommendations: this.generateActionRecommendations(variables, layer1Results, layer2Results)
    };
  }

  /**
   * Evalúo el riesgo del cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de riesgo del cliente (0-1)
   */
  assessClientRisk(variables) {
    let clientRisk = 0;
    
    // Factor de edad del cliente
    if (variables.client_age_days < 7) {
      clientRisk += 0.4; // Cliente muy nuevo
    } else if (variables.client_age_days < 30) {
      clientRisk += 0.2; // Cliente nuevo
    }
    
    // Factor de perfil de riesgo
    if (variables.risk_profile === 'high') {
      clientRisk += 0.3;
    } else if (variables.risk_profile === 'medium') {
      clientRisk += 0.1;
    }
    
    // Factor de historial
    if (variables.historical_transaction_count < 5) {
      clientRisk += 0.2; // Poco historial
    }
    
    // Factor de diversidad geográfica
    if (variables.unique_countries > 10) {
      clientRisk += 0.1; // Muy diverso puede ser sospechoso
    }
    
    return Math.min(clientRisk, 1);
  }

  /**
   * Evalúo el riesgo de la transacción
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {number} - Score de riesgo de la transacción (0-1)
   */
  assessTransactionRisk(variables, layer1Results) {
    let transactionRisk = 0;
    
    // Riesgo basado en monto
    const amountScore = layer1Results.amount?.suspicion_score || 0;
    transactionRisk += amountScore * 0.3;
    
    // Riesgo basado en ubicación
    const locationScore = layer1Results.location?.suspicion_score || 0;
    const countryScore = layer1Results.country?.suspicion_score || 0;
    transactionRisk += Math.max(locationScore, countryScore) * 0.3;
    
    // Riesgo basado en tiempo
    const timeScore = layer1Results.time?.suspicion_score || 0;
    const dayScore = layer1Results.day?.suspicion_score || 0;
    transactionRisk += Math.max(timeScore, dayScore) * 0.2;
    
    // Riesgo basado en establecimiento
    const merchantScore = layer1Results.merchant?.suspicion_score || 0;
    transactionRisk += merchantScore * 0.2;
    
    return Math.min(transactionRisk, 1);
  }

  /**
   * Evalúo el riesgo de comportamiento
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Score de riesgo de comportamiento (0-1)
   */
  assessBehaviorRisk(layer1Results, layer2Results) {
    let behaviorRisk = 0;
    
    // Riesgo de Capa 1 - patrones individuales
    const patternScore = layer1Results.pattern?.suspicion_score || 0;
    const velocityScore = layer1Results.velocity?.suspicion_score || 0;
    const frequencyScore = layer1Results.frequency?.suspicion_score || 0;
    
    behaviorRisk += patternScore * 0.3;
    behaviorRisk += Math.max(velocityScore, frequencyScore) * 0.3;
    
    // Riesgo de Capa 2 - comportamiento combinado
    const behaviorCombined = layer2Results.behavior?.combined_score || 0;
    behaviorRisk += behaviorCombined * 0.4;
    
    return Math.min(behaviorRisk, 1);
  }

  /**
   * Evalúo el riesgo tecnológico
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Score de riesgo tecnológico (0-1)
   */
  assessTechnologyRisk(layer1Results, layer2Results) {
    let techRisk = 0;
    
    // Riesgo de Capa 1 - tecnología individual
    const channelScore = layer1Results.channel?.suspicion_score || 0;
    const deviceScore = layer1Results.device?.suspicion_score || 0;
    
    techRisk += channelScore * 0.3;
    techRisk += deviceScore * 0.3;
    
    // Riesgo de Capa 2 - dispositivos combinados
    const deviceCombined = layer2Results.device?.combined_score || 0;
    techRisk += deviceCombined * 0.4;
    
    return Math.min(techRisk, 1);
  }

  /**
   * Evalúo escalamiento de riesgo
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Score de escalamiento (0-1)
   */
  assessRiskEscalation(variables, layer1Results, layer2Results) {
    let escalation = 0;
    
    // Escalamiento basado en múltiples alertas
    const highAlerts = this.countHighAlerts(layer1Results, layer2Results, 0.7);
    escalation += Math.min(highAlerts / 5, 0.4); // Max 5 alertas altas
    
    // Escalamiento basado en severidad
    const maxScore = this.getMaxScore(layer1Results, layer2Results);
    escalation += maxScore * 0.3;
    
    // Escalamiento basado en correlaciones
    const correlatedAlerts = this.countCorrelatedAlerts(layer1Results, layer2Results);
    escalation += Math.min(correlatedAlerts / 3, 0.3); // Max 3 correlaciones
    
    return Math.min(escalation, 1);
  }

  /**
   * Evalúo la urgencia de la situación
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Score de urgencia (0-1)
   */
  assessUrgency(variables, layer1Results, layer2Results) {
    let urgency = 0;
    
    // Urgencia por monto alto
    if (variables.amount > 20000) {
      urgency += 0.3;
    } else if (variables.amount > 10000) {
      urgency += 0.2;
    }
    
    // Urgencia por actividad en tiempo real
    if (variables.transactions_last_hour > 5) {
      urgency += 0.2;
    }
    
    // Urgencia por múltiples anomalías simultáneas
    const simultaneousAnomalies = this.countHighAlerts(layer1Results, layer2Results, 0.6);
    if (simultaneousAnomalies >= 4) {
      urgency += 0.3;
    } else if (simultaneousAnomalies >= 2) {
      urgency += 0.2;
    }
    
    // Urgencia por patrones conocidos de fraude
    const behaviorScore = layer2Results.behavior?.combined_score || 0;
    if (behaviorScore > 0.8) {
      urgency += 0.2;
    }
    
    return Math.min(urgency, 1);
  }

  /**
   * Evalúo el impacto potencial
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de impacto potencial (0-1)
   */
  assessPotentialImpact(variables) {
    let impact = 0;
    
    // Impacto financiero directo
    const financialImpact = Math.min(variables.amount / 50000, 0.4); // Max $50k = 0.4
    impact += financialImpact;
    
    // Impacto reputacional (cliente establecido vs nuevo)
    if (variables.client_age_days > 365) {
      impact += 0.2; // Cliente establecido = mayor impacto reputacional
    }
    
    // Impacto por posible escalamiento
    if (variables.transactions_last_24h > 10) {
      impact += 0.2; // Puede ser parte de un ataque mayor
    }
    
    // Impacto regulatorio (transacciones internacionales)
    if (!variables.is_domestic) {
      impact += 0.2;
    }
    
    return Math.min(impact, 1);
  }

  /**
   * Evalúo confianza en el análisis
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Score de confianza (0-1)
   */
  assessAnalysisConfidence(layer1Results, layer2Results) {
    let confidence = 0.5; // Base
    
    // Confianza basada en número de redes que reportaron
    const reportingNetworks = this.countReportingNetworks(layer1Results, layer2Results);
    confidence += Math.min(reportingNetworks / 10, 0.3); // Max 10 redes
    
    // Confianza basada en consistencia de scores
    const scoreConsistency = this.calculateScoreConsistency(layer1Results, layer2Results);
    confidence += scoreConsistency * 0.2;
    
    return Math.min(confidence, 1);
  }

  /**
   * Evalúo factores de mitigación
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de mitigación (0-1, más alto = menos riesgo)
   */
  assessMitigationFactors(variables) {
    let mitigation = 0;
    
    // Cliente establecido con buen historial
    if (variables.client_age_days > 365 && variables.historical_transaction_count > 100) {
      mitigation += 0.3;
    }
    
    // Transacción doméstica
    if (variables.is_domestic) {
      mitigation += 0.2;
    }
    
    // Horario comercial normal
    if (!variables.is_night_transaction && !variables.is_weekend) {
      mitigation += 0.2;
    }
    
    // Canal físico (más seguro)
    if (variables.channel === 'physical' || variables.channel === 'atm') {
      mitigation += 0.2;
    }
    
    // Monto dentro del rango normal
    if (variables.historical_avg_amount > 0) {
      const amountRatio = variables.amount / variables.historical_avg_amount;
      if (amountRatio >= 0.5 && amountRatio <= 2.0) {
        mitigation += 0.1;
      }
    }
    
    return Math.min(mitigation, 1);
  }

  /**
   * Genero recomendaciones de acción
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Array} - Lista de recomendaciones
   */
  generateActionRecommendations(variables, layer1Results, layer2Results) {
    const recommendations = [];
    const overallRisk = this.calculateOverallRiskScore(variables, layer1Results, layer2Results);
    
    if (overallRisk >= 0.9) {
      recommendations.push('BLOQUEAR transacción inmediatamente');
      recommendations.push('ALERTAR al equipo de seguridad');
      recommendations.push('INVESTIGAR cuenta del cliente');
      recommendations.push('NOTIFICAR por WhatsApp');
    } else if (overallRisk >= 0.7) {
      recommendations.push('RETENER transacción para revisión');
      recommendations.push('SOLICITAR verificación adicional');
      recommendations.push('MONITOREAR actividad del cliente');
      recommendations.push('NOTIFICAR por WhatsApp');
    } else if (overallRisk >= 0.5) {
      recommendations.push('REVISAR transacción manualmente');
      recommendations.push('INCREMENTAR monitoreo del cliente');
      recommendations.push('VERIFICAR información del dispositivo');
    } else if (overallRisk >= 0.3) {
      recommendations.push('MONITOREAR actividad futura');
      recommendations.push('REGISTRAR en log de riesgo');
    } else {
      recommendations.push('PROCESAR normalmente');
      recommendations.push('MONITOREO rutinario');
    }
    
    return recommendations;
  }

  /**
   * Cuento alertas altas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {number} threshold - Umbral para considerar "alta"
   * @returns {number} - Número de alertas altas
   */
  countHighAlerts(layer1Results, layer2Results, threshold) {
    let count = 0;
    
    // Contar alertas de Capa 1
    Object.values(layer1Results).forEach(result => {
      if (result?.suspicion_score > threshold) count++;
    });
    
    // Contar alertas de Capa 2
    Object.values(layer2Results).forEach(result => {
      if (result?.combined_score > threshold) count++;
    });
    
    return count;
  }

  /**
   * Obtengo el score máximo de todas las capas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Score máximo
   */
  getMaxScore(layer1Results, layer2Results) {
    let maxScore = 0;
    
    // Revisar Capa 1
    Object.values(layer1Results).forEach(result => {
      if (result?.suspicion_score > maxScore) {
        maxScore = result.suspicion_score;
      }
    });
    
    // Revisar Capa 2
    Object.values(layer2Results).forEach(result => {
      if (result?.combined_score > maxScore) {
        maxScore = result.combined_score;
      }
    });
    
    return maxScore;
  }

  /**
   * Cuento alertas correlacionadas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Número de correlaciones
   */
  countCorrelatedAlerts(layer1Results, layer2Results) {
    let correlations = 0;
    
    // Correlaciones conocidas
    const correlationPairs = [
      ['amount', 'merchant'],
      ['location', 'country'],
      ['time', 'day'],
      ['velocity', 'frequency']
    ];
    
    correlationPairs.forEach(pair => {
      const score1 = layer1Results[pair[0]]?.suspicion_score || 0;
      const score2 = layer1Results[pair[1]]?.suspicion_score || 0;
      
      if (score1 > 0.6 && score2 > 0.6) {
        correlations++;
      }
    });
    
    return correlations;
  }

  /**
   * Cuento redes que reportaron
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Número de redes que reportaron
   */
  countReportingNetworks(layer1Results, layer2Results) {
    let count = 0;
    
    count += Object.keys(layer1Results).length;
    count += Object.keys(layer2Results).length;
    
    return count;
  }

  /**
   * Calculo consistencia de scores
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Score de consistencia (0-1)
   */
  calculateScoreConsistency(layer1Results, layer2Results) {
    const allScores = [];
    
    // Recopilar todos los scores
    Object.values(layer1Results).forEach(result => {
      if (result?.suspicion_score !== undefined) {
        allScores.push(result.suspicion_score);
      }
    });
    
    Object.values(layer2Results).forEach(result => {
      if (result?.combined_score !== undefined) {
        allScores.push(result.combined_score);
      }
    });
    
    if (allScores.length < 2) return 0.5;
    
    // Calcular varianza
    const mean = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
    const variance = allScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / allScores.length;
    
    // Consistencia alta = baja varianza
    return Math.max(0, 1 - Math.sqrt(variance));
  }

  /**
   * Calculo score general de riesgo
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {number} - Score general de riesgo (0-1)
   */
  calculateOverallRiskScore(variables, layer1Results, layer2Results) {
    const clientRisk = this.assessClientRisk(variables);
    const transactionRisk = this.assessTransactionRisk(variables, layer1Results);
    const behaviorRisk = this.assessBehaviorRisk(layer1Results, layer2Results);
    const technologyRisk = this.assessTechnologyRisk(layer1Results, layer2Results);
    const mitigation = this.assessMitigationFactors(variables);
    
    // Combinar riesgos con pesos
    let overallRisk = 0;
    overallRisk += clientRisk * this.riskMatrix.categories.client.weight;
    overallRisk += transactionRisk * this.riskMatrix.categories.transaction.weight;
    overallRisk += behaviorRisk * this.riskMatrix.categories.behavior.weight;
    overallRisk += technologyRisk * this.riskMatrix.categories.technology.weight;
    
    // Aplicar factores de mitigación
    overallRisk = overallRisk * (1 - mitigation * 0.3); // Mitigación puede reducir hasta 30%
    
    return Math.min(overallRisk, 1);
  }

  /**
   * Preparo datos para la red neuronal
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de todas las redes de Capa 1
   * @param {Object} layer2Results - Resultados de todas las redes de Capa 2
   * @returns {Object} - Datos preparados para la red
   */
  prepareInput(transactionData, layer1Results, layer2Results) {
    // Evaluar riesgo general
    const riskAssessment = this.assessOverallRisk(transactionData, layer1Results, layer2Results);
    const { variables } = transactionData;
    
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
      // Scores de Capa 1
      ...layer1Scores,
      
      // Scores de Capa 2 (con prefijo para evitar conflictos)
      l2_behavior: layer2Scores.behavior,
      l2_location: layer2Scores.location,
      l2_timing: layer2Scores.timing,
      l2_amount: layer2Scores.amount,
      l2_device: layer2Scores.device,
      l2_pattern: layer2Scores.pattern,
      
      // Evaluaciones de riesgo
      client_risk: riskAssessment.client_risk,
      transaction_risk: riskAssessment.transaction_risk,
      behavior_risk: riskAssessment.behavior_risk,
      technology_risk: riskAssessment.technology_risk,
      risk_escalation: riskAssessment.risk_escalation,
      urgency_assessment: riskAssessment.urgency_assessment,
      impact_assessment: riskAssessment.impact_assessment,
      confidence_assessment: riskAssessment.confidence_assessment,
      mitigation_factors: riskAssessment.mitigation_factors,
      
      // Score general calculado
      overall_risk_score: this.calculateOverallRiskScore(variables, layer1Results, layer2Results)
    };
    
    return input;
  }

  /**
   * Analizo y evalúo el riesgo general
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Resultado de la evaluación de riesgo
   */
  async analyze(transactionData, layer1Results, layer2Results) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de evaluación de riesgo no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData, layer1Results, layer2Results);
      }
      
      const input = this.prepareInput(transactionData, layer1Results, layer2Results);
      const output = this.network.run(input);
      const riskScore = Array.isArray(output) ? output[0] : output;
      
      const riskAssessment = this.assessOverallRisk(transactionData, layer1Results, layer2Results);
      const riskLevel = this.determineRiskLevel(riskScore);
      
      const result = {
        network_id: this.networkId,
        deep_analysis_score: riskScore,
        confidence: this.calculateConfidence(input),
        risk_level: riskLevel,
        risk_assessment: riskAssessment,
        warnings: this.generateWarnings(riskScore, riskAssessment),
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Evaluación de riesgo completada: Score=${riskScore.toFixed(3)}, Nivel=${riskLevel}`);
      return result;
      
    } catch (error) {
      logger.error('Error en evaluación de riesgo:', error);
      return this.heuristicAnalysis(transactionData, layer1Results, layer2Results);
    }
  }

  /**
   * Análisis heurístico de riesgo
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData, layer1Results, layer2Results) {
    const input = this.prepareInput(transactionData, layer1Results, layer2Results);
    const riskScore = input.overall_risk_score;
    const riskAssessment = this.assessOverallRisk(transactionData, layer1Results, layer2Results);
    const riskLevel = this.determineRiskLevel(riskScore);
    
    return {
      network_id: this.networkId + '_heuristic',
      deep_analysis_score: riskScore,
      confidence: 0.8,
      risk_level: riskLevel,
      risk_assessment: riskAssessment,
      warnings: this.generateWarnings(riskScore, riskAssessment),
      processing_time_ms: 10
    };
  }

  /**
   * Determino el nivel de riesgo
   * @param {number} riskScore - Score de riesgo (0-1)
   * @returns {string} - Nivel de riesgo
   */
  determineRiskLevel(riskScore) {
    if (riskScore >= 0.9) return 'critical';
    if (riskScore >= 0.7) return 'high';
    if (riskScore >= 0.5) return 'medium';
    if (riskScore >= 0.3) return 'low';
    return 'minimal';
  }

  /**
   * Genero advertencias basadas en la evaluación
   * @param {number} riskScore - Score de riesgo
   * @param {Object} riskAssessment - Evaluación detallada de riesgo
   * @returns {Array} - Lista de advertencias
   */
  generateWarnings(riskScore, riskAssessment) {
    const warnings = [];
    
    if (riskScore >= 0.9) {
      warnings.push('RIESGO CRÍTICO: Posible fraude en progreso');
    }
    
    if (riskAssessment.urgency_assessment > 0.7) {
      warnings.push('URGENTE: Requiere acción inmediata');
    }
    
    if (riskAssessment.impact_assessment > 0.6) {
      warnings.push('ALTO IMPACTO: Pérdidas potenciales significativas');
    }
    
    if (riskAssessment.risk_escalation > 0.7) {
      warnings.push('ESCALAMIENTO: Múltiples indicadores de riesgo activos');
    }
    
    if (riskAssessment.confidence_assessment < 0.4) {
      warnings.push('BAJA CONFIANZA: Datos insuficientes para análisis preciso');
    }
    
    return warnings;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    // La confianza viene del análisis integrado
    return input.confidence_assessment;
  }

  /**
   * Entreno la red con datos históricos
   * @param {Array} trainingData - Datos de entrenamiento
   * @returns {Object} - Resultado del entrenamiento
   */
  async train(trainingData) {
    try {
      logger.info(`Iniciando entrenamiento de red de evaluación de riesgo con ${trainingData.length} muestras`);
      
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
      
      logger.info('Entrenamiento de red de evaluación de riesgo completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de evaluación de riesgo:', error);
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
      purpose: 'risk_assessment',
      risk_matrix: this.riskMatrix
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
      
      if (modelData.risk_matrix) {
        this.riskMatrix = modelData.risk_matrix;
      }
      
      logger.info(`Modelo de evaluación de riesgo cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de evaluación de riesgo:', error);
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
      purpose: 'risk_assessment',
      description: 'Evalúa el riesgo general integrando todos los análisis de Capas 1 y 2 para proporcionar una evaluación comprehensiva',
      input_networks: 'all_layer1_and_layer2'
    };
  }
}

module.exports = RiskAssessment;