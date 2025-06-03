const { logger } = require('../config');
const path = require('path');

// Importar todas las redes de Capa 1
const AmountAnalyzer = require('./layer1/amountAnalyzer');
const LocationAnalyzer = require('./layer1/locationAnalyzer');
const TimeAnalyzer = require('./layer1/timeAnalyzer');
const VelocityAnalyzer = require('./layer1/velocityAnalyzer');
const PatternAnalyzer = require('./layer1/patternAnalyzer');
// const DayAnalyzer = require('./layer1/dayAnalyzer');
// const MerchantAnalyzer = require('./layer1/merchantAnalyzer');
// const DistanceAnalyzer = require('./layer1/distanceAnalyzer');
// const FrequencyAnalyzer = require('./layer1/frequencyAnalyzer');
// const ChannelAnalyzer = require('./layer1/channelAnalyzer');
// const DeviceAnalyzer = require('./layer1/deviceAnalyzer');
// const CountryAnalyzer = require('./layer1/countryAnalyzer');

// Importar redes de Capa 2
const BehaviorCombiner = require('./layer2/behaviorCombiner');
const LocationCombiner = require('./layer2/locationCombiner');
// const TimingCombiner = require('./layer2/timingCombiner');
// const AmountCombiner = require('./layer2/amountCombiner');
// const DeviceCombiner = require('./layer2/deviceCombiner');
// const PatternCombiner = require('./layer2/patternCombiner');

// Importar redes de Capa 3
const RiskAssessment = require('./layer3/riskAssessment');
// const AnomalyDetector = require('./layer3/anomalyDetector');
// const BehaviorValidator = require('./layer3/behaviorValidator');
// const ContextAnalyzer = require('./layer3/contextAnalyzer');

// Importar red de decisión final
const FraudDecision = require('./output/fraudDecision');

/**
 * Administrador de Redes Neuronales Modulares
 * Coordina el análisis de fraude a través de múltiples capas de redes neuronales
 */
class NetworkManager {
  constructor() {
    this.version = '1.0.0';
    this.initializationTime = new Date();
    
    // Inicializar todas las redes por capas
    this.layer1Networks = {};
    this.layer2Networks = {};
    this.layer3Networks = {};
    this.outputNetwork = null;
    
    // Configuración del flujo de análisis
    this.analysisConfig = {
      enable_parallel_processing: true,
      timeout_per_layer_ms: 5000,
      min_confidence_threshold: 0.6,
      fraud_threshold: 0.7
    };
    
    // Estadísticas de rendimiento
    this.stats = {
      total_analyses: 0,
      avg_processing_time: 0,
      layer_performance: {},
      fraud_detection_rate: 0,
      last_reset: new Date()
    };
    
    this.initializeNetworks();
  }

  /**
   * Inicializo todas las redes neuronales
   */
  initializeNetworks() {
    try {
      logger.info('Inicializando redes neuronales modulares...');
      
      // === CAPA 1: Análisis Individual de Variables ===
      this.layer1Networks = {
        amount: new AmountAnalyzer(),
        location: new LocationAnalyzer(),
        time: new TimeAnalyzer(),
        velocity: new VelocityAnalyzer(),
        pattern: new PatternAnalyzer()
        // day: new DayAnalyzer(),
        // merchant: new MerchantAnalyzer(),
        // distance: new DistanceAnalyzer(),
        // frequency: new FrequencyAnalyzer(),
        // channel: new ChannelAnalyzer(),
        // device: new DeviceAnalyzer(),
        // country: new CountryAnalyzer()
      };
      
      // === CAPA 2: Combinación de Patrones ===
      this.layer2Networks = {
        behavior: new BehaviorCombiner(),
        location: new LocationCombiner()
        // timing: new TimingCombiner(),
        // amount: new AmountCombiner(),
        // device: new DeviceCombiner(),
        // pattern: new PatternCombiner()
      };
      
      // === CAPA 3: Análisis Profundo ===
      this.layer3Networks = {
        risk: new RiskAssessment()
        // anomaly: new AnomalyDetector(),
        // behavior: new BehaviorValidator(),
        // context: new ContextAnalyzer()
      };
      
      // === RED FINAL: Decisión de Fraude ===
      this.outputNetwork = new FraudDecision();
      
      logger.info(`Redes neuronales inicializadas:
        - Capa 1: ${Object.keys(this.layer1Networks).length} redes
        - Capa 2: ${Object.keys(this.layer2Networks).length} redes  
        - Capa 3: ${Object.keys(this.layer3Networks).length} redes
        - Salida: 1 red de decisión final`);
        
    } catch (error) {
      logger.error('Error al inicializar redes neuronales:', error);
      throw error;
    }
  }

  /**
   * Ejecuto el análisis completo de fraude a través de todas las capas
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Promise<Object>} - Resultado completo del análisis
   */
  async analyzeTransaction(transactionData) {
    const analysisStartTime = Date.now();
    
    try {
      logger.info(`Iniciando análisis completo de transacción: ${transactionData.id}`);
      
      // === CAPA 1: Análisis Individual ===
      const layer1Start = Date.now();
      const layer1Results = await this.executeLayer1Analysis(transactionData);
      const layer1Time = Date.now() - layer1Start;
      
      // === CAPA 2: Combinación de Patrones ===
      const layer2Start = Date.now();
      const layer2Results = await this.executeLayer2Analysis(transactionData, layer1Results);
      const layer2Time = Date.now() - layer2Start;
      
      // === CAPA 3: Análisis Profundo ===
      const layer3Start = Date.now();
      const layer3Results = await this.executeLayer3Analysis(transactionData, layer1Results, layer2Results);
      const layer3Time = Date.now() - layer3Start;
      
      // === DECISIÓN FINAL ===
      const outputStart = Date.now();
      const finalDecision = await this.executeFinalDecision(transactionData, layer1Results, layer2Results, layer3Results);
      const outputTime = Date.now() - outputStart;
      
      const totalProcessingTime = Date.now() - analysisStartTime;
      
      // Compilar resultado final
      const analysisResult = {
        transaction_id: transactionData.id,
        analysis_timestamp: new Date().toISOString(),
        
        // Resultado principal
        fraud_detected: finalDecision.fraud_detected,
        fraud_score: finalDecision.fraud_score,
        risk_level: this.calculateRiskLevel(finalDecision.fraud_score),
        confidence: finalDecision.confidence,
        
        // Resultados por capa
        layer1_results: {
          networks_analyzed: Object.keys(layer1Results).length,
          results: layer1Results,
          processing_time_ms: layer1Time,
          anomalies: this.countAnomalies(layer1Results)
        },
        
        layer2_results: {
          networks_analyzed: Object.keys(layer2Results).length,
          results: layer2Results,
          processing_time_ms: layer2Time,
          risk_factors: this.extractRiskFactors(layer2Results)
        },
        
        layer3_results: {
          networks_analyzed: Object.keys(layer3Results).length,
          results: layer3Results,
          processing_time_ms: layer3Time,
          warnings: this.extractWarnings(layer3Results)
        },
        
        final_decision: finalDecision,
        
        // Metadatos del análisis
        processing_time_ms: totalProcessingTime,
        network_versions: this.getNetworkVersions(),
        primary_reasons: this.extractPrimaryReasons(layer1Results, layer2Results, layer3Results, finalDecision),
        
        // Información para debugging
        analysis_details: {
          layer_timings: {
            layer1: layer1Time,
            layer2: layer2Time,
            layer3: layer3Time,
            output: outputTime
          },
          interconnections: this.getInterconnectionMap(),
          data_flow: this.getDataFlow(layer1Results, layer2Results, layer3Results)
        }
      };
      
      // Actualizar estadísticas
      this.updateStats(analysisResult);
      
      logger.info(`Análisis completo de fraude completado en ${totalProcessingTime}ms - Score: ${finalDecision.fraud_score.toFixed(3)} - Fraude: ${finalDecision.fraud_detected}`);
      
      return analysisResult;
      
    } catch (error) {
      logger.error('Error en análisis completo de fraude:', error);
      throw error;
    }
  }

  /**
   * Ejecuto el análisis de Capa 1 (análisis individual de variables)
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Promise<Object>} - Resultados de Capa 1
   */
  async executeLayer1Analysis(transactionData) {
    const results = {};
    const promises = [];
    
    logger.info('Ejecutando análisis de Capa 1 - Variables individuales');
    
    // Ejecutar todas las redes de Capa 1 en paralelo
    for (const [networkName, network] of Object.entries(this.layer1Networks)) {
      promises.push(
        network.analyze(transactionData)
          .then(result => {
            results[networkName] = result;
            logger.debug(`Red ${networkName} completada: Score=${result.suspicion_score.toFixed(3)}`);
          })
          .catch(error => {
            logger.error(`Error en red ${networkName}:`, error);
            results[networkName] = {
              network_id: network.networkId,
              variable: networkName,
              suspicion_score: 0.5, // Score neutral en caso de error
              confidence: 0.1,
              reasons: ['Error en el análisis'],
              error: error.message
            };
          })
      );
    }
    
    // Esperar a que todas las redes terminen
    await Promise.all(promises);
    
    logger.info(`Capa 1 completada: ${Object.keys(results).length} redes analizadas`);
    return results;
  }

  /**
   * Ejecuto el análisis de Capa 2 (combinación de patrones)
   * @param {Object} transactionData - Datos originales
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Promise<Object>} - Resultados de Capa 2
   */
  async executeLayer2Analysis(transactionData, layer1Results) {
    const results = {};
    const promises = [];
    
    logger.info('Ejecutando análisis de Capa 2 - Combinación de patrones');
    
    // Cada red de Capa 2 recibe TODAS las salidas de Capa 1 (totalmente interconectada)
    for (const [networkName, network] of Object.entries(this.layer2Networks)) {
      promises.push(
        network.analyze(transactionData, layer1Results)
          .then(result => {
            results[networkName] = result;
            logger.debug(`Red de combinación ${networkName} completada: Score=${result.combined_score.toFixed(3)}`);
          })
          .catch(error => {
            logger.error(`Error en red de combinación ${networkName}:`, error);
            results[networkName] = {
              network_id: network.networkId,
              combined_score: 0.5,
              confidence: 0.1,
              patterns_detected: [],
              error: error.message
            };
          })
      );
    }
    
    await Promise.all(promises);
    
    logger.info(`Capa 2 completada: ${Object.keys(results).length} redes de combinación analizadas`);
    return results;
  }

  /**
   * Ejecuto el análisis de Capa 3 (análisis profundo)
   * @param {Object} transactionData - Datos originales
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Promise<Object>} - Resultados de Capa 3
   */
  async executeLayer3Analysis(transactionData, layer1Results, layer2Results) {
    const results = {};
    const promises = [];
    
    logger.info('Ejecutando análisis de Capa 3 - Análisis profundo');
    
    // Cada red de Capa 3 recibe salidas de Capa 1 Y Capa 2 (totalmente interconectada)
    for (const [networkName, network] of Object.entries(this.layer3Networks)) {
      promises.push(
        network.analyze(transactionData, layer1Results, layer2Results)
          .then(result => {
            results[networkName] = result;
            logger.debug(`Red de análisis profundo ${networkName} completada: Score=${result.deep_analysis_score.toFixed(3)}`);
          })
          .catch(error => {
            logger.error(`Error en red de análisis profundo ${networkName}:`, error);
            results[networkName] = {
              network_id: network.networkId,
              deep_analysis_score: 0.5,
              confidence: 0.1,
              risk_assessment: {},
              error: error.message
            };
          })
      );
    }
    
    await Promise.all(promises);
    
    logger.info(`Capa 3 completada: ${Object.keys(results).length} redes de análisis profundo completadas`);
    return results;
  }

  /**
   * Ejecuto la decisión final de fraude
   * @param {Object} transactionData - Datos originales
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2  
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {Promise<Object>} - Decisión final
   */
  async executeFinalDecision(transactionData, layer1Results, layer2Results, layer3Results) {
    logger.info('Ejecutando decisión final de fraude');
    
    try {
      // La red final recibe salidas de TODAS las capas anteriores
      const finalResult = await this.outputNetwork.analyze(
        transactionData, 
        layer1Results, 
        layer2Results, 
        layer3Results
      );
      
      logger.info(`Decisión final: Score=${finalResult.fraud_score.toFixed(3)}, Fraude=${finalResult.fraud_detected}`);
      return finalResult;
      
    } catch (error) {
      logger.error('Error en decisión final:', error);
      
      // Decisión de fallback basada en promedios
      const avgLayer1Score = this.calculateAverageScore(layer1Results, 'suspicion_score');
      const avgLayer2Score = this.calculateAverageScore(layer2Results, 'combined_score');
      const avgLayer3Score = this.calculateAverageScore(layer3Results, 'deep_analysis_score');
      
      const fallbackScore = (avgLayer1Score * 0.3 + avgLayer2Score * 0.3 + avgLayer3Score * 0.4);
      
      return {
        network_id: 'fallback_decision',
        fraud_detected: fallbackScore >= this.analysisConfig.fraud_threshold,
        fraud_score: fallbackScore,
        confidence: 0.5,
        decision_method: 'fallback_average',
        error: error.message
      };
    }
  }

  /**
   * Calculo el promedio de scores de una capa
   * @param {Object} results - Resultados de la capa
   * @param {string} scoreField - Campo del score
   * @returns {number} - Promedio del score
   */
  calculateAverageScore(results, scoreField) {
    const scores = Object.values(results)
      .map(result => result[scoreField] || 0)
      .filter(score => !isNaN(score));
    
    if (scores.length === 0) return 0.5;
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Calculo el nivel de riesgo basado en el score de fraude
   * @param {number} fraudScore - Score de fraude (0-1)
   * @returns {string} - Nivel de riesgo
   */
  calculateRiskLevel(fraudScore) {
    if (fraudScore >= 0.9) return 'critical';
    if (fraudScore >= 0.7) return 'high';
    if (fraudScore >= 0.5) return 'medium';
    if (fraudScore >= 0.3) return 'low';
    return 'minimal';
  }

  /**
   * Cuento anomalías detectadas en Capa 1
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {number} - Número de anomalías
   */
  countAnomalies(layer1Results) {
    return Object.values(layer1Results)
      .filter(result => result.suspicion_score > 0.6)
      .length;
  }

  /**
   * Extraigo factores de riesgo de Capa 2
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Array} - Lista de factores de riesgo
   */
  extractRiskFactors(layer2Results) {
    const factors = [];
    
    Object.values(layer2Results).forEach(result => {
      if (result.patterns_detected) {
        factors.push(...result.patterns_detected);
      }
    });
    
    return factors;
  }

  /**
   * Extraigo alertas de Capa 3
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {Array} - Lista de alertas
   */
  extractWarnings(layer3Results) {
    const warnings = [];
    
    Object.values(layer3Results).forEach(result => {
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
    });
    
    return warnings;
  }

  /**
   * Extraigo las razones principales del análisis
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @param {Object} finalDecision - Decisión final
   * @returns {Array} - Razones principales
   */
  extractPrimaryReasons(layer1Results, layer2Results, layer3Results, finalDecision) {
    const reasons = [];
    
    // Razones de Capa 1 con score alto
    Object.values(layer1Results).forEach(result => {
      if (result.suspicion_score > 0.6 && result.reasons) {
        reasons.push(...result.reasons.map(reason => `L1: ${reason}`));
      }
    });
    
    // Razones de Capa 2
    Object.values(layer2Results).forEach(result => {
      if (result.combined_score > 0.6 && result.patterns_detected) {
        reasons.push(...result.patterns_detected.map(pattern => `L2: ${pattern}`));
      }
    });
    
    // Razones de Capa 3
    Object.values(layer3Results).forEach(result => {
      if (result.deep_analysis_score > 0.6 && result.warnings) {
        reasons.push(...result.warnings.map(warning => `L3: ${warning}`));
      }
    });
    
    // Razones de la decisión final
    if (finalDecision.primary_reasons) {
      reasons.push(...finalDecision.primary_reasons.map(reason => `Final: ${reason}`));
    }
    
    return reasons.slice(0, 10); // Limitar a 10 razones principales
  }

  /**
   * Obtengo versiones de todas las redes
   * @returns {Object} - Versiones de las redes
   */
  getNetworkVersions() {
    const versions = {
      network_manager: this.version,
      layer1: {},
      layer2: {},
      layer3: {},
      output: {}
    };
    
    // Versiones de Capa 1
    Object.entries(this.layer1Networks).forEach(([name, network]) => {
      versions.layer1[name] = network.version;
    });
    
    // Versiones de Capa 2
    Object.entries(this.layer2Networks).forEach(([name, network]) => {
      versions.layer2[name] = network.version;
    });
    
    // Versiones de Capa 3
    Object.entries(this.layer3Networks).forEach(([name, network]) => {
      versions.layer3[name] = network.version;
    });
    
    // Versión de red final
    if (this.outputNetwork) {
      versions.output = this.outputNetwork.version;
    }
    
    return versions;
  }

  /**
   * Obtengo el mapa de interconexiones
   * @returns {Object} - Mapa de interconexiones
   */
  getInterconnectionMap() {
    return {
      description: 'Todas las redes están totalmente interconectadas entre capas',
      layer1_to_layer2: 'Cada red de L2 recibe salidas de TODAS las redes de L1',
      layer2_to_layer3: 'Cada red de L3 recibe salidas de TODAS las redes de L1 y L2',
      layer3_to_output: 'La red final recibe salidas de TODAS las capas anteriores',
      total_connections: this.calculateTotalConnections()
    };
  }

  /**
   * Calculo el número total de conexiones
   * @returns {number} - Número total de conexiones
   */
  calculateTotalConnections() {
    const l1Count = Object.keys(this.layer1Networks).length;
    const l2Count = Object.keys(this.layer2Networks).length;
    const l3Count = Object.keys(this.layer3Networks).length;
    
    // L1 -> L2: cada red L2 recibe de todas las L1
    const l1ToL2 = l1Count * l2Count;
    
    // L1,L2 -> L3: cada red L3 recibe de todas las L1 y L2
    const l1l2ToL3 = (l1Count + l2Count) * l3Count;
    
    // L1,L2,L3 -> Output: la red final recibe de todas
    const allToOutput = l1Count + l2Count + l3Count;
    
    return l1ToL2 + l1l2ToL3 + allToOutput;
  }

  /**
   * Obtengo el flujo de datos a través de las capas
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @param {Object} layer3Results - Resultados de Capa 3
   * @returns {Object} - Flujo de datos
   */
  getDataFlow(layer1Results, layer2Results, layer3Results) {
    return {
      layer1_outputs: Object.keys(layer1Results).length,
      layer2_inputs: Object.keys(layer1Results).length * Object.keys(layer2Results).length,
      layer2_outputs: Object.keys(layer2Results).length,
      layer3_inputs: (Object.keys(layer1Results).length + Object.keys(layer2Results).length) * Object.keys(layer3Results).length,
      layer3_outputs: Object.keys(layer3Results).length,
      final_inputs: Object.keys(layer1Results).length + Object.keys(layer2Results).length + Object.keys(layer3Results).length
    };
  }

  /**
   * Actualizo estadísticas de rendimiento
   * @param {Object} analysisResult - Resultado del análisis
   */
  updateStats(analysisResult) {
    this.stats.total_analyses++;
    
    // Actualizar tiempo promedio de procesamiento
    const currentAvg = this.stats.avg_processing_time;
    const newTime = analysisResult.processing_time_ms;
    this.stats.avg_processing_time = ((currentAvg * (this.stats.total_analyses - 1)) + newTime) / this.stats.total_analyses;
    
    // Actualizar tasa de detección de fraude
    if (analysisResult.fraud_detected) {
      this.stats.fraud_detection_rate = ((this.stats.fraud_detection_rate * (this.stats.total_analyses - 1)) + 1) / this.stats.total_analyses;
    } else {
      this.stats.fraud_detection_rate = (this.stats.fraud_detection_rate * (this.stats.total_analyses - 1)) / this.stats.total_analyses;
    }
  }

  /**
   * Obtengo estadísticas del administrador
   * @returns {Object} - Estadísticas completas
   */
  getStats() {
    return {
      version: this.version,
      initialization_time: this.initializationTime,
      networks_loaded: {
        layer1: Object.keys(this.layer1Networks).length,
        layer2: Object.keys(this.layer2Networks).length,
        layer3: Object.keys(this.layer3Networks).length,
        output: this.outputNetwork ? 1 : 0
      },
      performance: this.stats,
      configuration: this.analysisConfig,
      total_connections: this.calculateTotalConnections()
    };
  }

  /**
   * Entreno todas las redes con datos históricos
   * @param {Array} trainingData - Datos de entrenamiento
   * @returns {Promise<Object>} - Resultado del entrenamiento
   */
  async trainAllNetworks(trainingData) {
    logger.info(`Iniciando entrenamiento de todas las redes con ${trainingData.length} muestras`);
    
    const trainingResults = {
      layer1: {},
      layer2: {},
      layer3: {},
      output: {},
      summary: {
        total_networks: 0,
        successful_trainings: 0,
        failed_trainings: 0,
        total_time_ms: 0
      }
    };
    
    const startTime = Date.now();
    
    try {
      // Entrenar Capa 1
      for (const [name, network] of Object.entries(this.layer1Networks)) {
        try {
          trainingResults.summary.total_networks++;
          const result = await network.train(trainingData);
          trainingResults.layer1[name] = result;
          trainingResults.summary.successful_trainings++;
        } catch (error) {
          logger.error(`Error entrenando red ${name}:`, error);
          trainingResults.layer1[name] = { success: false, error: error.message };
          trainingResults.summary.failed_trainings++;
        }
      }
      
      // Entrenar Capa 2 (necesita resultados de Capa 1)
      for (const [name, network] of Object.entries(this.layer2Networks)) {
        try {
          trainingResults.summary.total_networks++;
          const result = await network.train(trainingData);
          trainingResults.layer2[name] = result;
          trainingResults.summary.successful_trainings++;
        } catch (error) {
          logger.error(`Error entrenando red de combinación ${name}:`, error);
          trainingResults.layer2[name] = { success: false, error: error.message };
          trainingResults.summary.failed_trainings++;
        }
      }
      
      // Entrenar Capa 3
      for (const [name, network] of Object.entries(this.layer3Networks)) {
        try {
          trainingResults.summary.total_networks++;
          const result = await network.train(trainingData);
          trainingResults.layer3[name] = result;
          trainingResults.summary.successful_trainings++;
        } catch (error) {
          logger.error(`Error entrenando red de análisis profundo ${name}:`, error);
          trainingResults.layer3[name] = { success: false, error: error.message };
          trainingResults.summary.failed_trainings++;
        }
      }
      
      // Entrenar red final
      if (this.outputNetwork) {
        try {
          trainingResults.summary.total_networks++;
          const result = await this.outputNetwork.train(trainingData);
          trainingResults.output = result;
          trainingResults.summary.successful_trainings++;
        } catch (error) {
          logger.error('Error entrenando red de decisión final:', error);
          trainingResults.output = { success: false, error: error.message };
          trainingResults.summary.failed_trainings++;
        }
      }
      
      trainingResults.summary.total_time_ms = Date.now() - startTime;
      
      logger.info(`Entrenamiento completado: ${trainingResults.summary.successful_trainings}/${trainingResults.summary.total_networks} redes entrenadas exitosamente`);
      
      return trainingResults;
      
    } catch (error) {
      logger.error('Error en entrenamiento masivo de redes:', error);
      throw error;
    }
  }
}

module.exports = NetworkManager;