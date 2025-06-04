const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 2.5 - Combinador de Dispositivos y Tecnología
 * Esta red combina análisis tecnológicos de Capa 1 para detectar patrones de fraude digital
 */
class DeviceCombiner {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [12, 8, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'device_combiner_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Patrones tecnológicos sospechosos
    this.techPatterns = {
      // Combinaciones de canal sospechosas
      suspiciousChannelCombos: [
        { channels: ['online', 'phone'], timeWindow: 60 }, // Online y teléfono en 1 hora
        { channels: ['atm', 'online'], timeWindow: 30 },   // ATM y online en 30 min
      ],
      
      // Patrones de dispositivo sospechosos
      devicePatterns: {
        multipleDevices: 3,    // Más de 3 dispositivos en 24h
        rapidSwitching: 30,    // Cambio de dispositivo en menos de 30 min
        unknownDevice: 0.8     // Score alto para dispositivo desconocido
      },
      
      // Patrones geográficos vs tecnológicos
      geoTechConflicts: [
        { domestic: false, channel: 'atm' },      // ATM internacional
        { country: 'high_risk', channel: 'online' }, // Online desde país de riesgo
      ]
    };
  }

  /**
   * Analizo patrones tecnológicos del cliente
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Análisis tecnológico
   */
  analyzeTechPatterns(transactionData) {
    const { variables } = transactionData;
    
    return {
      // Consistencia de canal
      channel_consistency: this.calculateChannelConsistency(variables),
      
      // Análisis de dispositivo
      device_trust_level: this.calculateDeviceTrustLevel(variables),
      
      // Patrones de IP
      ip_risk_level: this.calculateIPRiskLevel(variables),
      
      // Conflictos geo-tecnológicos
      geo_tech_conflicts: this.detectGeoTechConflicts(variables),
      
      // Análisis de sesión
      session_analysis: this.analyzeSessionBehavior(variables),
      
      // Patrones de automatización
      automation_indicators: this.detectAutomationIndicators(variables),
      
      // Análisis de consistencia tecnológica
      tech_consistency: this.calculateTechConsistency(variables)
    };
  }

  /**
   * Calculo consistencia de canal del cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de consistencia (0-1)
   */
  calculateChannelConsistency(variables) {
    if (variables.historical_transaction_count < 5) {
      return 0.5; // Neutral para clientes nuevos
    }
    
    const currentChannel = variables.channel;
    let consistencyScore = 0.5; // Base
    
    // Canales físicos = más consistentes
    if (currentChannel === 'physical' || currentChannel === 'atm') {
      consistencyScore += 0.3;
    }
    
    // Canal online = moderadamente consistente
    if (currentChannel === 'online') {
      consistencyScore += 0.1;
    }
    
    // Canal telefónico = menos consistente
    if (currentChannel === 'phone') {
      consistencyScore -= 0.2;
    }
    
    return Math.max(consistencyScore, 0.1);
  }

  /**
   * Calculo nivel de confianza del dispositivo
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de confianza (0-1)
   */
  calculateDeviceTrustLevel(variables) {
    let trustLevel = 0.5; // Base neutral
    
    // Si tiene información del dispositivo
    if (variables.device_info) {
      trustLevel += 0.2;
      
      // Dispositivos comunes son más confiables
      const deviceInfo = variables.device_info.toLowerCase();
      if (deviceInfo.includes('chrome') || deviceInfo.includes('firefox') || deviceInfo.includes('safari')) {
        trustLevel += 0.2;
      }
      
      // Detectar posibles bots
      if (deviceInfo.includes('bot') || deviceInfo.includes('crawler') || deviceInfo.includes('automated')) {
        trustLevel -= 0.6;
      }
    }
    
    // Si tiene IP address
    if (variables.ip_address) {
      trustLevel += 0.1;
    }
    
    return Math.max(trustLevel, 0.1);
  }

  /**
   * Calculo nivel de riesgo de IP
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de riesgo (0-1)
   */
  calculateIPRiskLevel(variables) {
    if (!variables.ip_address) {
      return 0.7; // Alto riesgo si no hay IP
    }
    
    let riskLevel = 0.1; // Bajo riesgo base
    const ip = variables.ip_address.toLowerCase();
    
    // IPs privadas pueden indicar proxy/VPN
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
      riskLevel += 0.4;
    }
    
    // Patrones sospechosos en la IP
    if (ip.includes('tor') || ip.includes('proxy') || ip.includes('vpn')) {
      riskLevel += 0.5;
    }
    
    return Math.min(riskLevel, 1);
  }

  /**
   * Detecto conflictos geo-tecnológicos
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de conflicto (0-1)
   */
  detectGeoTechConflicts(variables) {
    let conflictScore = 0;
    
    // ATM internacional (físicamente imposible para algunos casos)
    if (variables.channel === 'atm' && !variables.is_domestic && variables.distance_from_prev > 1000) {
      conflictScore += 0.6;
    }
    
    // Online desde país de muy alto riesgo
    if (variables.channel === 'online' && !variables.is_domestic) {
      // Asumiendo que tenemos información del país de riesgo
      conflictScore += 0.3;
    }
    
    // Transacción física con device_info (inconsistencia)
    if (variables.channel === 'physical' && variables.device_info) {
      conflictScore += 0.2;
    }
    
    // ATM con información de navegador web
    if (variables.channel === 'atm' && variables.device_info && 
        variables.device_info.toLowerCase().includes('mozilla')) {
      conflictScore += 0.5;
    }
    
    return Math.min(conflictScore, 1);
  }

  /**
   * Analizo comportamiento de sesión
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de comportamiento de sesión sospechoso (0-1)
   */
  analyzeSessionBehavior(variables) {
    let sessionScore = 0;
    
    // Múltiples transacciones muy seguidas (posible bot)
    if (variables.transactions_last_hour > 5 && variables.channel === 'online') {
      sessionScore += 0.5;
    }
    
    // Transacciones muy seguidas sin tiempo humano normal
    if (variables.time_since_prev_transaction < 1 && variables.channel === 'online') {
      sessionScore += 0.4;
    }
    
    // Actividad nocturna online
    if (variables.is_night_transaction && variables.channel === 'online') {
      sessionScore += 0.2;
    }
    
    return Math.min(sessionScore, 1);
  }

  /**
   * Detecto indicadores de automatización
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de automatización (0-1)
   */
  detectAutomationIndicators(variables) {
    let automationScore = 0;
    
    // User agent sospechoso
    if (variables.device_info) {
      const deviceInfo = variables.device_info.toLowerCase();
      if (deviceInfo.includes('python') || deviceInfo.includes('curl') || 
          deviceInfo.includes('postman') || deviceInfo.includes('automated')) {
        automationScore += 0.7;
      }
    }
    
    // Patrón de tiempo muy regular (bots)
    if (variables.transactions_last_hour > 3) {
      const avgTime = 60 / variables.transactions_last_hour; // minutos promedio entre transacciones
      if (avgTime < 2) { // Menos de 2 minutos entre transacciones
        automationScore += 0.5;
      }
    }
    
    // Montos exactamente redondos repetitivos
    if (variables.amount % 100 === 0 && variables.transactions_last_24h > 5) {
      automationScore += 0.3;
    }
    
    return Math.min(automationScore, 1);
  }

  /**
   * Calculo consistencia tecnológica general
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de consistencia (0-1)
   */
  calculateTechConsistency(variables) {
    let consistencyScore = 0.5; // Base
    
    // Tener información completa = más consistente
    if (variables.device_info && variables.ip_address) {
      consistencyScore += 0.3;
    }
    
    // Canal y información del dispositivo consistentes
    if (variables.channel === 'online' && variables.device_info) {
      consistencyScore += 0.2;
    }
    
    // ATM sin device_info = consistente
    if (variables.channel === 'atm' && !variables.device_info) {
      consistencyScore += 0.2;
    }
    
    return Math.min(consistencyScore, 1);
  }

  /**
   * Combino análisis tecnológicos de Capa 1
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de todas las redes de Capa 1
   * @returns {Object} - Datos preparados para la red
   */
  prepareInput(transactionData, layer1Results) {
    // Extraer scores relacionados con tecnología
    const techScores = {
      channel: layer1Results.channel?.suspicion_score || 0,
      device: layer1Results.device?.suspicion_score || 0,
      country: layer1Results.country?.suspicion_score || 0,
      location: layer1Results.location?.suspicion_score || 0,
      velocity: layer1Results.velocity?.suspicion_score || 0
    };
    
    // Analizar patrones tecnológicos
    const tech = this.analyzeTechPatterns(transactionData);
    const { variables } = transactionData;
    
    const input = {
      // Scores de Capa 1 relacionados con tecnología
      channel_score: techScores.channel,
      device_score: techScores.device,
      country_score: techScores.country,
      location_score: techScores.location,
      velocity_score: techScores.velocity,
      
      // Análisis tecnológico específico
      channel_consistency: tech.channel_consistency,
      device_trust_level: tech.device_trust_level,
      ip_risk_level: tech.ip_risk_level,
      geo_tech_conflicts: tech.geo_tech_conflicts,
      session_analysis: tech.session_analysis,
      automation_indicators: tech.automation_indicators,
      tech_consistency: tech.tech_consistency,
      
      // Información tecnológica base
      has_device_info: variables.device_info ? 1 : 0,
      has_ip_address: variables.ip_address ? 1 : 0,
      is_online_transaction: variables.channel === 'online' ? 1 : 0,
      is_mobile_transaction: variables.channel === 'mobile' ? 1 : 0,
      is_physical_transaction: variables.channel === 'physical' ? 1 : 0,
      is_atm_transaction: variables.channel === 'atm' ? 1 : 0,
      
      // Patrones tecnológicos específicos detectados
      missing_tech_info: (!variables.device_info && !variables.ip_address) ? 1 : 0,
      suspicious_user_agent: this.hasSuspiciousUserAgent(variables.device_info),
      rapid_online_activity: (variables.channel === 'online' && variables.transactions_last_hour > 5) ? 1 : 0,
      night_online_activity: (variables.channel === 'online' && variables.is_night_transaction) ? 1 : 0,
      
      // Combinaciones sospechosas
      online_no_device_info: (variables.channel === 'online' && !variables.device_info) ? 1 : 0,
      physical_with_device_info: (variables.channel === 'physical' && variables.device_info) ? 1 : 0,
      international_online: (variables.channel === 'online' && !variables.is_domestic) ? 1 : 0,
      
      // Información del cliente
      client_tech_experience: Math.min(variables.client_age_days / 365, 1),
      transaction_diversity: Math.min(variables.historical_transaction_count / 50, 1),
      
      // Score tecnológico combinado
      tech_combined_score: (techScores.channel + techScores.device + techScores.country) / 3,
      
      // Correlaciones tecnológicas
      channel_device_correlation: this.calculateCorrelation(techScores.channel, techScores.device),
      device_location_correlation: this.calculateCorrelation(techScores.device, techScores.location),
      
      // Índice de riesgo tecnológico
      tech_risk_index: this.calculateTechRiskIndex(variables, techScores, tech)
    };
    
    return input;
  }

  /**
   * Verifico si el user agent es sospechoso
   * @param {string} deviceInfo - Información del dispositivo
   * @returns {number} - 1 si es sospechoso, 0 si no
   */
  hasSuspiciousUserAgent(deviceInfo) {
    if (!deviceInfo) return 0;
    
    const suspiciousPatterns = ['bot', 'crawler', 'spider', 'python', 'curl', 'postman', 'automated', 'test'];
    const deviceLower = deviceInfo.toLowerCase();
    
    return suspiciousPatterns.some(pattern => deviceLower.includes(pattern)) ? 1 : 0;
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
   * Calculo índice de riesgo tecnológico
   * @param {Object} variables - Variables de la transacción
   * @param {Object} techScores - Scores tecnológicos
   * @param {Object} tech - Análisis tecnológico
   * @returns {number} - Índice de riesgo (0-1)
   */
  calculateTechRiskIndex(variables, techScores, tech) {
    let riskIndex = 0;
    
    // Factor de canal
    riskIndex += techScores.channel * 0.25;
    
    // Factor de dispositivo
    riskIndex += techScores.device * 0.25;
    
    // Factor de conflictos geo-tecnológicos
    riskIndex += tech.geo_tech_conflicts * 0.2;
    
    // Factor de automatización
    riskIndex += tech.automation_indicators * 0.15;
    
    // Factor de riesgo de IP
    riskIndex += tech.ip_risk_level * 0.15;
    
    return Math.min(riskIndex, 1);
  }

  /**
   * Analizo y combino patrones tecnológicos
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado del análisis combinado
   */
  async analyze(transactionData, layer1Results) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red combinadora de dispositivos no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData, layer1Results);
      }
      
      const input = this.prepareInput(transactionData, layer1Results);
      const output = this.network.run(input);
      const combinedScore = Array.isArray(output) ? output[0] : output;
      
      const patterns = this.detectTechPatterns(transactionData, layer1Results, input);
      
      const result = {
        network_id: this.networkId,
        combined_score: combinedScore,
        confidence: this.calculateConfidence(input),
        patterns_detected: patterns,
        tech_analysis: {
          channel_risk: input.channel_score,
          device_risk: input.device_score,
          automation_risk: input.automation_indicators,
          session_risk: input.session_analysis,
          consistency_score: input.tech_consistency
        },
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis tecnológico completado: Score=${combinedScore.toFixed(3)}, Canal=${transactionData.variables.channel}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis tecnológico:', error);
      return this.heuristicAnalysis(transactionData, layer1Results);
    }
  }

  /**
   * Análisis heurístico tecnológico
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData, layer1Results) {
    const input = this.prepareInput(transactionData, layer1Results);
    let combinedScore = input.tech_risk_index;
    const patterns = [];
    
    // Ajustar score basado en patrones específicos
    if (input.automation_indicators > 0.6) {
      combinedScore += 0.3;
      patterns.push('Indicadores de automatización detectados');
    }
    
    if (input.geo_tech_conflicts > 0.5) {
      combinedScore += 0.2;
      patterns.push('Conflictos geo-tecnológicos detectados');
    }
    
    if (input.suspicious_user_agent) {
      combinedScore += 0.25;
      patterns.push('User agent sospechoso detectado');
    }
    
    if (input.missing_tech_info) {
      combinedScore += 0.2;
      patterns.push('Información tecnológica faltante');
    }
    
    if (input.rapid_online_activity) {
      combinedScore += 0.15;
      patterns.push('Actividad online acelerada');
    }
    
    if (input.night_online_activity) {
      combinedScore += 0.1;
      patterns.push('Actividad online nocturna');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      combined_score: Math.min(combinedScore, 1),
      confidence: 0.8,
      patterns_detected: patterns,
      tech_analysis: {
        channel_risk: input.channel_score,
        device_risk: input.device_score,
        automation_risk: input.automation_indicators,
        session_risk: input.session_analysis,
        consistency_score: input.tech_consistency
      },
      processing_time_ms: 7
    };
  }

  /**
   * Detecto patrones tecnológicos específicos
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} input - Datos de entrada procesados
   * @returns {Array} - Lista de patrones detectados
   */
  detectTechPatterns(transactionData, layer1Results, input) {
    const patterns = [];
    
    if (input.automation_indicators > 0.6) {
      patterns.push('Patrones de automatización/bot detectados');
    }
    
    if (input.geo_tech_conflicts > 0.5) {
      patterns.push('Inconsistencias entre geografía y tecnología');
    }
    
    if (input.suspicious_user_agent) {
      patterns.push('User agent sospechoso o automatizado');
    }
    
    if (input.tech_consistency < 0.3) {
      patterns.push('Comportamiento tecnológico altamente inconsistente');
    }
    
    if (input.ip_risk_level > 0.7) {
      patterns.push('IP de alto riesgo (proxy/VPN/TOR)');
    }
    
    if (input.session_analysis > 0.6) {
      patterns.push('Comportamiento de sesión anómalo');
    }
    
    if (input.device_trust_level < 0.3) {
      patterns.push('Dispositivo de baja confianza');
    }
    
    if (input.channel_device_correlation > 0.8) {
      patterns.push('Fuerte correlación canal-dispositivo sospechosa');
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
    
    // Mayor confianza si tenemos información tecnológica completa
    if (input.has_device_info && input.has_ip_address) {
      confidence += 0.2;
    }
    
    // Mayor confianza si el cliente tiene experiencia
    if (input.client_tech_experience > 0.2) {
      confidence += 0.1;
    }
    
    // Menor confianza si falta información crítica
    if (input.missing_tech_info) {
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
      logger.info(`Iniciando entrenamiento de red combinadora de dispositivos con ${trainingData.length} muestras`);
      
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
      
      logger.info('Entrenamiento de red combinadora de dispositivos completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red combinadora de dispositivos:', error);
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
      channel: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) },
      device: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      country: { suspicion_score: fraudScore * (0.5 + Math.random() * 1.0) },
      location: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) },
      velocity: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) }
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
      purpose: 'device_combination',
      tech_patterns: this.techPatterns
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
      
      if (modelData.tech_patterns) {
        this.techPatterns = modelData.tech_patterns;
      }
      
      logger.info(`Modelo combinador de dispositivos cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo combinador de dispositivos:', error);
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
      purpose: 'device_combination',
      description: 'Combina análisis tecnológicos de Capa 1 para detectar patrones de fraude digital y automatización',
      input_networks: ['channel', 'device', 'country', 'location', 'velocity']
    };
  }
}

module.exports = DeviceCombiner;