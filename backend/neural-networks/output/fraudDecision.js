const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal Final - Decisión de Fraude
 * Esta red toma las salidas de TODAS las capas anteriores y genera la decisión final
 */
class FraudDecision {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [24, 16, 8, 4], // 4 capas ocultas para decisión compleja
      activation: 'sigmoid',
      learningRate: 0.005, // Más conservador para decisión final
      iterations: 30000, // Más iteraciones para mejor precisión
      errorThresh: 0.003
    });
    
    this.networkId = 'fraud_decision_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Umbrales de decisión
    this.decisionThresholds = {
      fraud: 0.7, // Score >= 0.7 = fraude detectado
      review: 0.5, // Score entre 0.5 y 0.7 = revisión manual
      safe: 0.3, // Score < 0.3 = transacción segura
      critical: 0.9 // Score >= 0.9 = fraude crítico
    };
    
    // Pesos para diferentes capas
    this.layerWeights = {
      layer1: 0.25, // Variables individuales
      layer2: 0.30, // Patrones combinados
      layer3: 0.35, // Análisis profundo
      consensus: 0.10 // Consenso entre capas
    };
  }

  /**
   * Proceso todas las entradas de las capas para la decisión final
   * @param {Object} transactionData - Datos originales
   * @param {Object} layer1Results - Todos los resultados de Capa 1
   * @param {Object} layer2Results - Todos los resultados de Capa 2
   * @param {Object} layer3Results - Todos los resultados de Capa 3
   * @returns {Object} - Análisis completo para decisión
   */
  processAllLayerInputs(transactionData, layer1Results, layer2Results, layer3Results) {
    return {
      // Resumen de Capa 1
      layer1_summary: this.summarizeLayer1(layer1Results),
      
      // Resumen de Capa 2
      layer2_summary: this.summarizeLayer2(layer2Results),
      
      // Resumen de Capa 3
      layer3_summary: this.summarizeLayer3(layer3Results),
      
      // Análisis de consenso entre capas
      consensus_analysis: this.analyzeConsensus(layer1Results, layer2Results, layer3Results),
      
      // Patrones críticos detectados
      critical_patterns: this.detectCriticalPatterns(layer1Results, layer2Results, layer3Results),
      
      // Factores de mitigación
      mitigation_factors: this.analyzeMitigationFactors(transactionData, layer1Results, layer2Results, layer3Results),
      
      // Análisis de confianza
      confidence_analysis: this.analyzeConfidence(layer1Results, layer2Results, layer3Results),
      
      // Score ponderado preliminar
      weighted_score: this.calculateWeightedScore(layer1Results, layer2Results, layer3Results)
    };
  }

  /**
   * Resumo resultados de Capa 1
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resumen de Capa 1
   */
  summarizeLayer1(layer1Results) {
    const scores = {};
    const alerts = [];
    let totalScore = 0;
    let count = 0;
    
    // Extraer scores individuales
    Object.entries(layer1Results).forEach(([network, result]) => {
      const score = result?.suspicion_score || 0;
      scores[network] = score;
      totalScore += score;
      count++;
      
      if (score > 0.7) {
        alerts.push({
          network,
          score,
          reasons: result.reasons || []
        });
      }
    });
    
    return {
      individual_scores: scores,
      average_score: count > 0 ? totalScore / count : 0,
      max_score: Math.max(...Object.values(scores)),
      min_score: Math.min(...Object.values(scores)),
      high_risk_count: alerts.length,
      alerts: alerts,
      variance: this.calculateVariance(Object.values(scores))
    };
  }

  /**
   * Resumo resultados de Capa 2
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Resumen de Capa 2
   */
  summarizeLayer2(layer2Results) {
    const scores = {};
    const patterns = [];
    let totalScore = 0;
    let count = 0;
    
    Object.entries(layer2Results).forEach(([network, result]) => {
      const score = result?.combined_score || 0;
      scores[network] = score;
      totalScore += score;
      count++;
      
      if (result?.patterns_detected && result.patterns_detected.length > 0) {
        patterns.push(...result.patterns_detected.map(p => ({
          network,
          pattern: p,
          score
        })));
      }
    });
    
    return {
      combined_scores: scores,
      average_score: count > 0 ? totalScore / count : 0,
      max_score: Math.max(...Object.values(scores)),
      detected_patterns: patterns,
      pattern_count: patterns.length,
      risk_concentration: this.calculateRiskConcentration(scores)
    };
  }

  /**
   * Resumo resultados de Capa 3
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {Object} - Resumen de Capa 3
   */
  summarizeLayer3(layer3Results) {
    const scores = {};
    const warnings = [];
    const assessments = {};
    let totalScore = 0;
    let count = 0;
    
    Object.entries(layer3Results).forEach(([network, result]) => {
      const score = result?.deep_analysis_score || 0;
      scores[network] = score;
      totalScore += score;
      count++;
      
      // Recopilar warnings
      if (result?.warnings && result.warnings.length > 0) {
        warnings.push(...result.warnings.map(w => ({
          network,
          warning: w,
          severity: this.getWarningSeverity(w)
        })));
      }
      
      // Recopilar assessments específicos
      if (network === 'risk' && result?.risk_assessment) {
        assessments.risk = result.risk_level;
      }
      if (network === 'anomaly' && result?.anomaly_summary) {
        assessments.anomaly = result.anomaly_summary;
      }
      if (network === 'behavior' && result?.coherence_summary) {
        assessments.behavior = result.coherence_summary;
      }
      if (network === 'context' && result?.context_summary) {
        assessments.context = result.context_summary;
      }
    });
    
    return {
      deep_scores: scores,
      average_score: count > 0 ? totalScore / count : 0,
      max_score: Math.max(...Object.values(scores)),
      critical_warnings: warnings.filter(w => w.severity === 'critical'),
      all_warnings: warnings,
      assessments: assessments,
      consensus_level: this.calculateConsensusLevel(scores)
    };
  }

  /**
   * Analizo consenso entre capas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {Object} - Análisis de consenso
   */
  analyzeConsensus(layer1Results, layer2Results, layer3Results) {
    const l1Avg = this.calculateLayerAverage(layer1Results, 'suspicion_score');
    const l2Avg = this.calculateLayerAverage(layer2Results, 'combined_score');
    const l3Avg = this.calculateLayerAverage(layer3Results, 'deep_analysis_score');
    
    const consensus = {
      layer_averages: { layer1: l1Avg, layer2: l2Avg, layer3: l3Avg },
      agreement_score: 1 - this.calculateVariance([l1Avg, l2Avg, l3Avg]),
      unanimous_high_risk: l1Avg > 0.7 && l2Avg > 0.7 && l3Avg > 0.7,
      unanimous_low_risk: l1Avg < 0.3 && l2Avg < 0.3 && l3Avg < 0.3,
      conflicting_signals: Math.abs(l1Avg - l3Avg) > 0.4,
      escalation_pattern: l1Avg < l2Avg && l2Avg < l3Avg, // Riesgo escalando por capas
      confidence_in_consensus: 0
    };
    
    // Calcular confianza en el consenso
    if (consensus.unanimous_high_risk || consensus.unanimous_low_risk) {
      consensus.confidence_in_consensus = 0.95;
    } else if (consensus.agreement_score > 0.8) {
      consensus.confidence_in_consensus = 0.85;
    } else if (consensus.conflicting_signals) {
      consensus.confidence_in_consensus = 0.6;
    } else {
      consensus.confidence_in_consensus = 0.75;
    }
    
    return consensus;
  }

  /**
   * Detecto patrones críticos
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {Array} - Patrones críticos detectados
   */
  detectCriticalPatterns(layer1Results, layer2Results, layer3Results) {
    const criticalPatterns = [];
    
    // Patrón: Múltiples alertas de Capa 1
    const l1HighAlerts = Object.values(layer1Results).filter(r => r?.suspicion_score > 0.8).length;
    if (l1HighAlerts >= 4) {
      criticalPatterns.push({
        pattern: 'multiple_l1_alerts',
        description: `${l1HighAlerts} variables individuales con riesgo muy alto`,
        severity: 'high',
        confidence: 0.9
      });
    }
    
    // Patrón: Comportamiento anómalo detectado
    if (layer2Results.behavior?.combined_score > 0.8) {
      criticalPatterns.push({
        pattern: 'anomalous_behavior',
        description: 'Comportamiento altamente anómalo detectado',
        severity: 'critical',
        confidence: layer2Results.behavior.confidence || 0.85
      });
    }
    
    // Patrón: Múltiples anomalías en Capa 3
    if (layer3Results.anomaly?.anomaly_summary?.types_detected > 5) {
      criticalPatterns.push({
        pattern: 'multiple_anomaly_types',
        description: `${layer3Results.anomaly.anomaly_summary.types_detected} tipos de anomalías detectadas`,
        severity: 'critical',
        confidence: 0.95
      });
    }
    
    // Patrón: Riesgo contextual crítico
    if (layer3Results.context?.context_summary?.critical_factors > 3) {
      criticalPatterns.push({
        pattern: 'critical_context',
        description: 'Múltiples factores contextuales críticos',
        severity: 'high',
        confidence: 0.88
      });
    }
    
    // Patrón: Escalamiento de riesgo
    const riskEscalation = this.detectRiskEscalation(layer1Results, layer2Results, layer3Results);
    if (riskEscalation.detected) {
      criticalPatterns.push({
        pattern: 'risk_escalation',
        description: riskEscalation.description,
        severity: 'critical',
        confidence: 0.92
      });
    }
    
    return criticalPatterns;
  }

  /**
   * Analizo factores de mitigación
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {Object} - Factores de mitigación
   */
  analyzeMitigationFactors(transactionData, layer1Results, layer2Results, layer3Results) {
    const mitigations = {
      factors: [],
      total_mitigation: 0
    };
    
    const { variables } = transactionData;
    
    // Cliente establecido y confiable
    if (variables.client_age_days > 730 && variables.fraud_incidents === 0) {
      mitigations.factors.push({
        factor: 'trusted_customer',
        description: 'Cliente establecido sin historial de fraude',
        mitigation_value: 0.2
      });
      mitigations.total_mitigation += 0.2;
    }
    
    // Transacción doméstica en horario normal
    if (variables.is_domestic && !variables.is_night_transaction && !variables.is_weekend) {
      mitigations.factors.push({
        factor: 'normal_context',
        description: 'Transacción doméstica en horario comercial normal',
        mitigation_value: 0.15
      });
      mitigations.total_mitigation += 0.15;
    }
    
    // Establecimiento frecuente
    if (variables.merchant_frequency > 10) {
      mitigations.factors.push({
        factor: 'frequent_merchant',
        description: 'Establecimiento usado frecuentemente',
        mitigation_value: 0.1
      });
      mitigations.total_mitigation += 0.1;
    }
    
    // Monto dentro del rango normal
    if (variables.amount <= variables.historical_avg_amount * 1.5) {
      mitigations.factors.push({
        factor: 'normal_amount',
        description: 'Monto dentro del rango histórico normal',
        mitigation_value: 0.1
      });
      mitigations.total_mitigation += 0.1;
    }
    
    // Sin alertas críticas en ninguna capa
    const noCriticalAlerts = !this.hasCriticalAlerts(layer1Results, layer2Results, layer3Results);
    if (noCriticalAlerts) {
      mitigations.factors.push({
        factor: 'no_critical_alerts',
        description: 'Sin alertas críticas en el análisis',
        mitigation_value: 0.05
      });
      mitigations.total_mitigation += 0.05;
    }
    
    mitigations.total_mitigation = Math.min(mitigations.total_mitigation, 0.4); // Máximo 40% de mitigación
    
    return mitigations;
  }

  /**
   * Analizo confianza en la decisión
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {Object} - Análisis de confianza
   */
  analyzeConfidence(layer1Results, layer2Results, layer3Results) {
    const confidence = {
      factors: [],
      overall_confidence: 0.7 // Base
    };
    
    // Factor: Número de redes que reportaron
    const totalNetworks = Object.keys(layer1Results).length + 
                         Object.keys(layer2Results).length + 
                         Object.keys(layer3Results).length;
    
    if (totalNetworks > 18) {
      confidence.factors.push({
        factor: 'comprehensive_analysis',
        description: `${totalNetworks} redes neuronales analizaron la transacción`,
        confidence_boost: 0.15
      });
      confidence.overall_confidence += 0.15;
    }
    
    // Factor: Consenso entre capas
    const consensusScore = this.calculateInterLayerConsensus(layer1Results, layer2Results, layer3Results);
    if (consensusScore > 0.8) {
      confidence.factors.push({
        factor: 'high_consensus',
        description: 'Alto consenso entre todas las capas',
        confidence_boost: 0.1
      });
      confidence.overall_confidence += 0.1;
    }
    
    // Factor: Claridad de señales
    const signalClarity = this.assessSignalClarity(layer1Results, layer2Results, layer3Results);
    if (signalClarity > 0.7) {
      confidence.factors.push({
        factor: 'clear_signals',
        description: 'Señales claras y consistentes',
        confidence_boost: 0.05
      });
      confidence.overall_confidence += 0.05;
    }
    
    // Reducir confianza si hay señales contradictorias
    if (this.hasContradictorySignals(layer1Results, layer2Results, layer3Results)) {
      confidence.factors.push({
        factor: 'contradictory_signals',
        description: 'Señales contradictorias entre capas',
        confidence_penalty: -0.1
      });
      confidence.overall_confidence -= 0.1;
    }
    
    confidence.overall_confidence = Math.max(0.5, Math.min(0.95, confidence.overall_confidence));
    
    return confidence;
  }

  /**
   * Calculo score ponderado de todas las capas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {number} - Score ponderado (0-1)
   */
  calculateWeightedScore(layer1Results, layer2Results, layer3Results) {
    // Promedios por capa
    const l1Avg = this.calculateLayerAverage(layer1Results, 'suspicion_score');
    const l2Avg = this.calculateLayerAverage(layer2Results, 'combined_score');
    const l3Avg = this.calculateLayerAverage(layer3Results, 'deep_analysis_score');
    
    // Score ponderado básico
    let weightedScore = (l1Avg * this.layerWeights.layer1) +
                       (l2Avg * this.layerWeights.layer2) +
                       (l3Avg * this.layerWeights.layer3);
    
    // Ajuste por consenso
    const consensusBonus = this.calculateConsensusBonus(l1Avg, l2Avg, l3Avg);
    weightedScore += consensusBonus * this.layerWeights.consensus;
    
    // Ajuste por señales críticas
    const criticalAdjustment = this.calculateCriticalAdjustment(layer1Results, layer2Results, layer3Results);
    weightedScore = Math.min(1, weightedScore + criticalAdjustment);
    
    return weightedScore;
  }

  // === Métodos auxiliares ===

  /**
   * Calculo varianza de un conjunto de valores
   * @param {Array} values - Valores
   * @returns {number} - Varianza
   */
  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  /**
   * Calculo concentración de riesgo
   * @param {Object} scores - Scores por red
   * @returns {number} - Concentración (0-1)
   */
  calculateRiskConcentration(scores) {
    const values = Object.values(scores);
    const highRiskCount = values.filter(s => s > 0.7).length;
    return highRiskCount / values.length;
  }

  /**
   * Obtengo severidad de una advertencia
   * @param {string} warning - Texto de advertencia
   * @returns {string} - Nivel de severidad
   */
  getWarningSeverity(warning) {
    if (warning.includes('CRÍTICO') || warning.includes('CRITICAL')) return 'critical';
    if (warning.includes('ALTO') || warning.includes('HIGH')) return 'high';
    if (warning.includes('MEDIO') || warning.includes('MEDIUM')) return 'medium';
    return 'low';
  }

  /**
   * Calculo nivel de consenso
   * @param {Object} scores - Scores
   * @returns {number} - Nivel de consenso (0-1)
   */
  calculateConsensusLevel(scores) {
    const values = Object.values(scores);
    if (values.length < 2) return 1;
    
    const variance = this.calculateVariance(values);
    return Math.max(0, 1 - (variance * 2)); // Menos varianza = más consenso
  }

  /**
   * Calculo promedio de una capa
   * @param {Object} layerResults - Resultados de la capa
   * @param {string} scoreField - Campo del score
   * @returns {number} - Promedio
   */
  calculateLayerAverage(layerResults, scoreField) {
    const scores = Object.values(layerResults)
      .map(r => r?.[scoreField] || 0)
      .filter(s => !isNaN(s));
    
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Detecto escalamiento de riesgo
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {Object} - Detección de escalamiento
   */
  detectRiskEscalation(layer1Results, layer2Results, layer3Results) {
    const l1Max = Math.max(...Object.values(layer1Results).map(r => r?.suspicion_score || 0));
    const l2Max = Math.max(...Object.values(layer2Results).map(r => r?.combined_score || 0));
    const l3Max = Math.max(...Object.values(layer3Results).map(r => r?.deep_analysis_score || 0));
    
    const escalating = l1Max < l2Max && l2Max < l3Max;
    const rapidEscalation = l3Max - l1Max > 0.4;
    
    return {
      detected: escalating || rapidEscalation,
      description: rapidEscalation 
        ? `Escalamiento rápido de riesgo: ${(l1Max*100).toFixed(0)}% → ${(l3Max*100).toFixed(0)}%`
        : escalating 
          ? 'Escalamiento progresivo de riesgo detectado'
          : 'Sin escalamiento significativo'
    };
  }

  /**
   * Verifico si hay alertas críticas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {boolean} - Hay alertas críticas
   */
  hasCriticalAlerts(layer1Results, layer2Results, layer3Results) {
    // Verificar scores muy altos en cualquier capa
    const l1Critical = Object.values(layer1Results).some(r => r?.suspicion_score > 0.9);
    const l2Critical = Object.values(layer2Results).some(r => r?.combined_score > 0.9);
    const l3Critical = Object.values(layer3Results).some(r => r?.deep_analysis_score > 0.9);
    
    return l1Critical || l2Critical || l3Critical;
  }

  /**
   * Calculo consenso entre capas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {number} - Score de consenso (0-1)
   */
  calculateInterLayerConsensus(layer1Results, layer2Results, layer3Results) {
    const l1Avg = this.calculateLayerAverage(layer1Results, 'suspicion_score');
    const l2Avg = this.calculateLayerAverage(layer2Results, 'combined_score');
    const l3Avg = this.calculateLayerAverage(layer3Results, 'deep_analysis_score');
    
    const variance = this.calculateVariance([l1Avg, l2Avg, l3Avg]);
    return Math.max(0, 1 - (variance * 3));
  }

  /**
   * Evalúo claridad de señales
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {number} - Claridad (0-1)
   */
  assessSignalClarity(layer1Results, layer2Results, layer3Results) {
    // Las señales son claras cuando los scores están cerca de 0 o 1
    const allScores = [
      ...Object.values(layer1Results).map(r => r?.suspicion_score || 0),
      ...Object.values(layer2Results).map(r => r?.combined_score || 0),
      ...Object.values(layer3Results).map(r => r?.deep_analysis_score || 0)
    ];
    
    const clearSignals = allScores.filter(s => s < 0.2 || s > 0.8).length;
    return clearSignals / allScores.length;
  }

  /**
   * Verifico señales contradictorias
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {boolean} - Hay contradicciones
   */
  hasContradictorySignals(layer1Results, layer2Results, layer3Results) {
    const l1Avg = this.calculateLayerAverage(layer1Results, 'suspicion_score');
    const l2Avg = this.calculateLayerAverage(layer2Results, 'combined_score');
    const l3Avg = this.calculateLayerAverage(layer3Results, 'deep_analysis_score');
    
    // Contradicción: una capa dice alto riesgo y otra dice bajo riesgo
    const hasHighLow = (l1Avg > 0.7 && l3Avg < 0.3) || 
                      (l1Avg < 0.3 && l3Avg > 0.7) ||
                      (l2Avg > 0.7 && (l1Avg < 0.3 || l3Avg < 0.3));
    
    return hasHighLow;
  }

  /**
   * Calculo bonus de consenso
   * @param {number} l1Avg - Promedio Capa 1
   * @param {number} l2Avg - Promedio Capa 2
   * @param {number} l3Avg - Promedio Capa 3
   * @returns {number} - Bonus (0-1)
   */
  calculateConsensusBonus(l1Avg, l2Avg, l3Avg) {
    const variance = this.calculateVariance([l1Avg, l2Avg, l3Avg]);
    
    // Menos varianza = más consenso = más bonus
    if (variance < 0.05) return 0.2; // Alto consenso
    if (variance < 0.1) return 0.1; // Consenso moderado
    if (variance < 0.2) return 0.05; // Consenso bajo
    return 0; // Sin consenso
  }

  /**
   * Calculo ajuste por señales críticas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {number} - Ajuste (-0.2 a 0.2)
   */
  calculateCriticalAdjustment(layer1Results, layer2Results, layer3Results) {
    let adjustment = 0;
    
    // Ajuste positivo por múltiples señales críticas
    const criticalCount = this.countCriticalSignals(layer1Results, layer2Results, layer3Results);
    if (criticalCount >= 5) {
      adjustment += 0.2;
    } else if (criticalCount >= 3) {
      adjustment += 0.1;
    }
    
    // Ajuste negativo si todas las señales son bajas
    const allLowSignals = this.checkAllLowSignals(layer1Results, layer2Results, layer3Results);
    if (allLowSignals) {
      adjustment -= 0.1;
    }
    
    return adjustment;
  }

  /**
   * Cuento señales críticas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {number} - Número de señales críticas
   */
  countCriticalSignals(layer1Results, layer2Results, layer3Results) {
    let count = 0;
    
    count += Object.values(layer1Results).filter(r => r?.suspicion_score > 0.8).length;
    count += Object.values(layer2Results).filter(r => r?.combined_score > 0.8).length;
    count += Object.values(layer3Results).filter(r => r?.deep_analysis_score > 0.8).length;
    
    return count;
  }

  /**
   * Verifico si todas las señales son bajas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {boolean} - Todas las señales son bajas
   */
  checkAllLowSignals(layer1Results, layer2Results, layer3Results) {
    const allScores = [
      ...Object.values(layer1Results).map(r => r?.suspicion_score || 0),
      ...Object.values(layer2Results).map(r => r?.combined_score || 0),
      ...Object.values(layer3Results).map(r => r?.deep_analysis_score || 0)
    ];
    
    return allScores.every(score => score < 0.3);
  }

  /**
   * Preparo datos para la red neuronal final
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de todas las redes de Capa 1
   * @param {Object} layer2Results - Resultados de todas las redes de Capa 2
   * @param {Object} layer3Results - Resultados de todas las redes de Capa 3
   * @returns {Object} - Datos preparados para la red
   */
  prepareInput(transactionData, layer1Results, layer2Results, layer3Results) {
    const analysis = this.processAllLayerInputs(transactionData, layer1Results, layer2Results, layer3Results);
    
    const input = {
      // Scores individuales de Capa 1
      l1_amount: layer1Results.amount?.suspicion_score || 0,
      l1_location: layer1Results.location?.suspicion_score || 0,
      l1_time: layer1Results.time?.suspicion_score || 0,
      l1_velocity: layer1Results.velocity?.suspicion_score || 0,
      l1_pattern: layer1Results.pattern?.suspicion_score || 0,
      l1_day: layer1Results.day?.suspicion_score || 0,
      l1_merchant: layer1Results.merchant?.suspicion_score || 0,
      l1_distance: layer1Results.distance?.suspicion_score || 0,
      l1_frequency: layer1Results.frequency?.suspicion_score || 0,
      l1_channel: layer1Results.channel?.suspicion_score || 0,
      l1_device: layer1Results.device?.suspicion_score || 0,
      l1_country: layer1Results.country?.suspicion_score || 0,
      
      // Scores combinados de Capa 2
      l2_behavior: layer2Results.behavior?.combined_score || 0,
      l2_location: layer2Results.location?.combined_score || 0,
      l2_timing: layer2Results.timing?.combined_score || 0,
      l2_amount: layer2Results.amount?.combined_score || 0,
      l2_device: layer2Results.device?.combined_score || 0,
      l2_pattern: layer2Results.pattern?.combined_score || 0,
      
      // Scores profundos de Capa 3
      l3_risk: layer3Results.risk?.deep_analysis_score || 0,
      l3_anomaly: layer3Results.anomaly?.deep_analysis_score || 0,
      l3_behavior: layer3Results.behavior?.deep_analysis_score || 0,
      l3_context: layer3Results.context?.deep_analysis_score || 0,
      
      // Métricas agregadas
      l1_avg: analysis.layer1_summary.average_score,
      l1_max: analysis.layer1_summary.max_score,
      l1_variance: analysis.layer1_summary.variance,
      l2_avg: analysis.layer2_summary.average_score,
      l2_max: analysis.layer2_summary.max_score,
      l3_avg: analysis.layer3_summary.average_score,
      l3_max: analysis.layer3_summary.max_score,
      
      // Análisis de consenso
      consensus_agreement: analysis.consensus_analysis.agreement_score,
      consensus_confidence: analysis.consensus_analysis.confidence_in_consensus,
      
      // Patrones críticos
      critical_pattern_count: analysis.critical_patterns.length,
      has_critical_patterns: analysis.critical_patterns.length > 0 ? 1 : 0,
      
      // Factores de mitigación
      mitigation_score: analysis.mitigation_factors.total_mitigation,
      
      // Score ponderado preliminar
      weighted_score: analysis.weighted_score
    };
    
    return input;
  }

  /**
   * Genero razones principales de la decisión
   * @param {number} fraudScore - Score de fraude
   * @param {Object} analysis - Análisis completo
   * @returns {Array} - Razones principales
   */
  generatePrimaryReasons(fraudScore, analysis) {
    const reasons = [];
    
    // Agregar razones basadas en score
    if (fraudScore >= 0.9) {
      reasons.push('Score de fraude crítico detectado');
    } else if (fraudScore >= 0.7) {
      reasons.push('Alto riesgo de fraude identificado');
    }
    
    // Agregar razones de patrones críticos
    analysis.critical_patterns.forEach(pattern => {
      if (pattern.severity === 'critical') {
        reasons.push(pattern.description);
      }
    });
    
    // Agregar razones de consenso
    if (analysis.consensus_analysis.unanimous_high_risk) {
      reasons.push('Consenso unánime de alto riesgo en todas las capas');
    }
    
    // Agregar alertas de Capa 3
    if (analysis.layer3_summary.critical_warnings.length > 0) {
      reasons.push(...analysis.layer3_summary.critical_warnings.slice(0, 2).map(w => w.warning));
    }
    
    // Agregar alertas de Capa 1 si son relevantes
    if (analysis.layer1_summary.high_risk_count >= 3) {
      reasons.push(`${analysis.layer1_summary.high_risk_count} variables individuales con alto riesgo`);
    }
    
    return reasons.slice(0, 5); // Máximo 5 razones principales
  }

  /**
   * Determino acciones recomendadas
   * @param {number} fraudScore - Score de fraude
   * @param {boolean} fraudDetected - Fraude detectado
   * @returns {Array} - Acciones recomendadas
   */
  determineRecommendedActions(fraudScore, fraudDetected) {
    const actions = [];
    
    if (fraudScore >= 0.9) {
      actions.push('BLOQUEAR transacción inmediatamente');
      actions.push('NOTIFICAR equipo de seguridad');
      actions.push('CONGELAR cuenta temporalmente');
      actions.push('CONTACTAR cliente para verificación');
    } else if (fraudScore >= 0.7) {
      actions.push('RETENER transacción para revisión');
      actions.push('SOLICITAR autenticación adicional');
      actions.push('REVISAR historial reciente del cliente');
    } else if (fraudScore >= 0.5) {
      actions.push('MARCAR para monitoreo');
      actions.push('VERIFICAR con establecimiento si es posible');
    } else if (fraudScore >= 0.3) {
      actions.push('PERMITIR con monitoreo');
      actions.push('REGISTRAR en log de actividad');
    } else {
      actions.push('APROBAR transacción');
      actions.push('Sin acciones adicionales requeridas');
    }
    
    return actions;
  }

  /**
   * Tomo la decisión final de fraude
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {Object} - Decisión final
   */
  async analyze(transactionData, layer1Results, layer2Results, layer3Results) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de decisión final no entrenada, usando heurísticas');
        return this.heuristicDecision(transactionData, layer1Results, layer2Results, layer3Results);
      }
      
      const input = this.prepareInput(transactionData, layer1Results, layer2Results, layer3Results);
      const output = this.network.run(input);
      const fraudScore = Array.isArray(output) ? output[0] : output;
      
      // Aplicar mitigaciones
      const analysis = this.processAllLayerInputs(transactionData, layer1Results, layer2Results, layer3Results);
      const adjustedScore = Math.max(0, fraudScore - analysis.mitigation_factors.total_mitigation);
      
      const fraudDetected = adjustedScore >= this.decisionThresholds.fraud;
      const requiresReview = adjustedScore >= this.decisionThresholds.review && !fraudDetected;
      
      const result = {
        network_id: this.networkId,
        fraud_detected: fraudDetected,
        fraud_score: adjustedScore,
        original_score: fraudScore,
        confidence: analysis.confidence_analysis.overall_confidence,
        decision_category: this.categorizeDecision(adjustedScore),
        requires_manual_review: requiresReview,
        
        // Detalles de la decisión
        primary_reasons: this.generatePrimaryReasons(adjustedScore, analysis),
        recommended_actions: this.determineRecommendedActions(adjustedScore, fraudDetected),
        
        // Análisis detallado
        layer_consensus: analysis.consensus_analysis,
        critical_patterns: analysis.critical_patterns,
        mitigation_applied: analysis.mitigation_factors,
        
        // Métricas de decisión
        decision_metrics: {
          weighted_score: analysis.weighted_score,
          adjusted_score: adjustedScore,
          confidence_factors: analysis.confidence_analysis.factors,
          processing_time_ms: Date.now() - startTime
        },
        
        // Información para auditoría
        audit_trail: {
          model_version: this.version,
          threshold_used: this.decisionThresholds.fraud,
          layers_analyzed: {
            layer1: Object.keys(layer1Results).length,
            layer2: Object.keys(layer2Results).length,
            layer3: Object.keys(layer3Results).length
          },
          decision_timestamp: new Date().toISOString()
        }
      };
      
      logger.info(`Decisión final completada: Fraude=${fraudDetected}, Score=${adjustedScore.toFixed(3)}, Confianza=${result.confidence.toFixed(2)}`);
      return result;
      
    } catch (error) {
      logger.error('Error en decisión final de fraude:', error);
      return this.fallbackDecision(transactionData, layer1Results, layer2Results, layer3Results, error);
    }
  }

  /**
   * Decisión heurística cuando la red no está entrenada
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {Object} - Decisión heurística
   */
  heuristicDecision(transactionData, layer1Results, layer2Results, layer3Results) {
    const analysis = this.processAllLayerInputs(transactionData, layer1Results, layer2Results, layer3Results);
    const fraudScore = analysis.weighted_score;
    const adjustedScore = Math.max(0, fraudScore - analysis.mitigation_factors.total_mitigation);
    const fraudDetected = adjustedScore >= this.decisionThresholds.fraud;
    
    return {
      network_id: this.networkId + '_heuristic',
      fraud_detected: fraudDetected,
      fraud_score: adjustedScore,
      original_score: fraudScore,
      confidence: analysis.confidence_analysis.overall_confidence * 0.8, // Reducir confianza por ser heurística
      decision_category: this.categorizeDecision(adjustedScore),
      requires_manual_review: adjustedScore >= this.decisionThresholds.review,
      primary_reasons: this.generatePrimaryReasons(adjustedScore, analysis),
      recommended_actions: this.determineRecommendedActions(adjustedScore, fraudDetected),
      layer_consensus: analysis.consensus_analysis,
      critical_patterns: analysis.critical_patterns,
      mitigation_applied: analysis.mitigation_factors,
      decision_metrics: {
        weighted_score: analysis.weighted_score,
        adjusted_score: adjustedScore,
        confidence_factors: analysis.confidence_analysis.factors,
        processing_time_ms: 25
      },
      audit_trail: {
        model_version: this.version + '_heuristic',
        threshold_used: this.decisionThresholds.fraud,
        decision_method: 'heuristic_weighted_average',
        decision_timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Decisión de respaldo en caso de error
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @param {Error} error - Error ocurrido
   * @returns {Object} - Decisión de respaldo
   */
  fallbackDecision(transactionData, layer1Results, layer2Results, layer3Results, error) {
    // Usar el máximo score de cualquier capa como medida conservadora
    const maxScores = [
      Math.max(...Object.values(layer1Results).map(r => r?.suspicion_score || 0)),
      Math.max(...Object.values(layer2Results).map(r => r?.combined_score || 0)),
      Math.max(...Object.values(layer3Results).map(r => r?.deep_analysis_score || 0))
    ];
    
    const fraudScore = Math.max(...maxScores);
    const fraudDetected = fraudScore >= this.decisionThresholds.fraud;
    
    return {
      network_id: 'fallback_decision',
      fraud_detected: fraudDetected,
      fraud_score: fraudScore,
      confidence: 0.5, // Baja confianza debido al error
      decision_category: this.categorizeDecision(fraudScore),
      requires_manual_review: true, // Siempre revisar en caso de error
      primary_reasons: ['Error en procesamiento - usando decisión conservadora'],
      recommended_actions: ['REVISAR manualmente', 'VERIFICAR sistema'],
      error_details: {
        message: error.message,
        fallback_method: 'maximum_layer_score'
      },
      audit_trail: {
        decision_method: 'error_fallback',
        error_occurred: true,
        decision_timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Categorizo la decisión basada en el score
   * @param {number} score - Score de fraude
   * @returns {string} - Categoría de decisión
   */
  categorizeDecision(score) {
    if (score >= this.decisionThresholds.critical) return 'critical_fraud';
    if (score >= this.decisionThresholds.fraud) return 'fraud_detected';
    if (score >= this.decisionThresholds.review) return 'requires_review';
    if (score >= this.decisionThresholds.safe) return 'low_risk';
    return 'safe_transaction';
  }

  /**
   * Entreno la red con datos históricos
   * @param {Array} trainingData - Datos de entrenamiento
   * @returns {Object} - Resultado del entrenamiento
   */
  async train(trainingData) {
    try {
      logger.info(`Iniciando entrenamiento de red de decisión final con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => {
        // Generar datos simulados de todas las capas para entrenamiento
        const mockLayer1Results = this.generateMockLayer1Results(data);
        const mockLayer2Results = this.generateMockLayer2Results(data);
        const mockLayer3Results = this.generateMockLayer3Results(data);
        
        return {
          input: this.prepareInput(data, mockLayer1Results, mockLayer2Results, mockLayer3Results),
          output: [data.fraud_score || 0]
        };
      });
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de decisión final completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de decisión final:', error);
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
    const baseVariance = 0.2;
    
    return {
      amount: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      location: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      time: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      day: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      merchant: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      velocity: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      distance: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      pattern: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      frequency: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      channel: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      device: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      country: { suspicion_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) }
    };
  }

  /**
   * Genero resultados simulados de Capa 2 para entrenamiento
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultados simulados de Capa 2
   */
  generateMockLayer2Results(transactionData) {
    const fraudScore = transactionData.fraud_score || 0;
    const baseVariance = 0.15;
    
    return {
      behavior: { combined_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      location: { combined_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      timing: { combined_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      amount: { combined_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      device: { combined_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) },
      pattern: { combined_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance) }
    };
  }

  /**
   * Genero resultados simulados de Capa 3 para entrenamiento
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultados simulados de Capa 3
   */
  generateMockLayer3Results(transactionData) {
    const fraudScore = transactionData.fraud_score || 0;
    const baseVariance = 0.1;
    
    return {
      risk: { 
        deep_analysis_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance),
        risk_level: fraudScore > 0.7 ? 'high' : 'low'
      },
      anomaly: { 
        deep_analysis_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance),
        anomaly_summary: { types_detected: Math.floor(fraudScore * 8) }
      },
      behavior: { 
        deep_analysis_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance)
      },
      context: { 
        deep_analysis_score: Math.min(1, fraudScore + (Math.random() - 0.5) * baseVariance),
        context_summary: { critical_factors: Math.floor(fraudScore * 5) }
      }
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
      layer: 'output',
      purpose: 'final_fraud_decision',
      decision_thresholds: this.decisionThresholds,
      layer_weights: this.layerWeights
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
      
      if (modelData.decision_thresholds) {
        this.decisionThresholds = modelData.decision_thresholds;
      }
      
      if (modelData.layer_weights) {
        this.layerWeights = modelData.layer_weights;
      }
      
      logger.info(`Modelo de decisión final cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de decisión final:', error);
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
      layer: 'output',
      purpose: 'final_fraud_decision',
      description: 'Toma la decisión final de fraude integrando todas las capas de análisis',
      thresholds: this.decisionThresholds,
      weights: this.layerWeights
    };
  }
}

module.exports = FraudDecision;