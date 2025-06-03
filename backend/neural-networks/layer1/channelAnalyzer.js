const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.10 - Análisis de Canal de Transacción
 * Esta red analiza si el canal de transacción (online, físico, ATM) es sospechoso
 */
class ChannelAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'channel_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Canales conocidos y sus niveles de riesgo
    this.channelRiskLevels = {
      'physical': 0.2,  // Bajo riesgo - presencia física
      'atm': 0.3,       // Medio-bajo - requiere tarjeta física
      'online': 0.5,    // Medio - más susceptible a fraude
      'mobile': 0.4,    // Medio-bajo - autenticación adicional
      'phone': 0.6,     // Medio-alto - fácil de spoofear
      'unknown': 0.8    // Alto riesgo - canal no identificado
    };
  }

  /**
   * Preparo los datos de canal para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    const channel = variables.channel || 'unknown';
    
    const input = {
      // Codificación one-hot del canal
      is_physical: channel === 'physical' ? 1 : 0,
      is_online: channel === 'online' ? 1 : 0,
      is_atm: channel === 'atm' ? 1 : 0,
      is_mobile: channel === 'mobile' ? 1 : 0,
      is_phone: channel === 'phone' ? 1 : 0,
      is_unknown: channel === 'unknown' ? 1 : 0,
      
      // Riesgo inherente del canal
      channel_risk_level: this.channelRiskLevels[channel] || 0.8,
      
      // Contexto temporal del canal
      is_night_online: (channel === 'online' && variables.is_night_transaction) ? 1 : 0,
      is_weekend_atm: (channel === 'atm' && variables.is_weekend) ? 1 : 0,
      
      // Patrones de uso del cliente
      client_experience: Math.min(variables.client_age_days / 365, 1),
      
      // Monto vs canal (algunos canales son inusuales para montos altos)
      high_amount_online: (channel === 'online' && variables.amount > 5000) ? 1 : 0,
      high_amount_phone: (channel === 'phone' && variables.amount > 1000) ? 1 : 0,
      
      // Actividad reciente en el canal
      recent_activity_factor: Math.min(variables.transactions_last_24h / 20, 1),
      
      // Ubicación vs canal
      foreign_online: (channel === 'online' && !variables.is_domestic) ? 1 : 0,
      
      // Información del dispositivo/IP si está disponible
      has_device_info: variables.device_info ? 1 : 0,
      has_ip_info: variables.ip_address ? 1 : 0
    };
    
    return input;
  }

  /**
   * Analizo el canal de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis de canal no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'channel',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de canal completado: Score=${suspicionScore.toFixed(3)}, Canal=${transactionData.variables.channel}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de canal:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico de canal
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    const channel = variables.channel || 'unknown';
    let suspicionScore = 0;
    const reasons = [];
    
    // Regla 1: Canal desconocido o de alto riesgo
    if (channel === 'unknown') {
      suspicionScore += 0.7;
      reasons.push('Canal de transacción desconocido');
    } else if (channel === 'phone') {
      suspicionScore += 0.4;
      reasons.push('Transacción telefónica (canal de riesgo)');
    }
    
    // Regla 2: Canal y monto incompatibles
    if (channel === 'online' && variables.amount > 10000) {
      suspicionScore += 0.5;
      reasons.push('Monto muy alto para transacción online');
    } else if (channel === 'phone' && variables.amount > 2000) {
      suspicionScore += 0.6;
      reasons.push('Monto alto para transacción telefónica');
    }
    
    // Regla 3: Canal y horario sospechoso
    if (channel === 'online' && variables.is_night_transaction) {
      suspicionScore += 0.3;
      reasons.push('Transacción online nocturna');
    }
    
    // Regla 4: Canal y ubicación sospechosa
    if (channel === 'online' && !variables.is_domestic) {
      suspicionScore += 0.4;
      reasons.push('Transacción online desde país extranjero');
    }
    
    // Regla 5: Cliente nuevo con canal de alto riesgo
    if (variables.client_age_days < 30 && (channel === 'online' || channel === 'phone')) {
      suspicionScore += 0.3;
      reasons.push('Cliente nuevo usando canal de riesgo');
    }
    
    // Regla 6: Falta de información del dispositivo para canal online
    if (channel === 'online' && !variables.device_info && !variables.ip_address) {
      suspicionScore += 0.4;
      reasons.push('Transacción online sin información del dispositivo');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'channel',
      suspicion_score: Math.min(suspicionScore, 1),
      confidence: 0.7,
      reasons: reasons,
      processing_time_ms: 4
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
    const channel = transactionData.variables.channel;
    
    if (score > 0.7) {
      if (input.is_unknown) reasons.push('Canal desconocido');
      if (input.high_amount_phone) reasons.push('Monto alto por teléfono');
      if (input.foreign_online) reasons.push('Transacción online internacional');
    } else if (score > 0.5) {
      if (input.high_amount_online) reasons.push('Monto alto online');
      if (input.is_night_online) reasons.push('Transacción online nocturna');
      if (!input.has_device_info && input.is_online) reasons.push('Online sin info de dispositivo');
    } else if (score > 0.3) {
      if (input.channel_risk_level > 0.5) reasons.push(`Canal de riesgo: ${channel}`);
      if (input.is_weekend_atm) reasons.push('ATM en fin de semana');
    }
    
    return reasons;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.8;
    
    // Mayor confianza si tenemos información del dispositivo
    if (input.has_device_info || input.has_ip_info) {
      confidence += 0.1;
    }
    
    // Mayor confianza si el cliente tiene experiencia
    if (input.client_experience > 0.2) {
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
      logger.info(`Iniciando entrenamiento de red de análisis de canal con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de canal completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de canal:', error);
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
      variable_analyzed: 'channel',
      channel_risk_levels: this.channelRiskLevels
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
      
      if (modelData.channel_risk_levels) {
        this.channelRiskLevels = modelData.channel_risk_levels;
      }
      
      logger.info(`Modelo de análisis de canal cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis de canal:', error);
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
      variable: 'channel',
      description: 'Analiza el canal de transacción para detectar patrones de fraude específicos del medio',
      supported_channels: Object.keys(this.channelRiskLevels)
    };
  }
}

module.exports = ChannelAnalyzer;