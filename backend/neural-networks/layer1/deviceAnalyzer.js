const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.11 - Análisis de Dispositivo/IP
 * Esta red analiza si el dispositivo o IP de una transacción es sospechoso
 */
class DeviceAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'device_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Patrones de dispositivos sospechosos
    this.suspiciousPatterns = {
      // User agents sospechosos
      userAgents: [
        'bot', 'crawler', 'spider', 'scraper', 'automated',
        'python', 'curl', 'wget', 'postman', 'test'
      ],
      
      // Sistemas operativos poco comunes
      rareSystems: [
        'linux', 'unix', 'bsd', 'solaris', 'unknown'
      ],
      
      // Navegadores poco comunes
      rareBrowsers: [
        'lynx', 'opera mini', 'phantom', 'headless'
      ]
    };
    
    // Rangos de IP conocidos por ser problemáticos
    this.suspiciousIPRanges = {
      // VPN/Proxy conocidos (simplificado)
      vpnPatterns: ['10.', '192.168.', '172.'],
      
      // TOR exit nodes (simplificado)
      torPatterns: ['tor', 'onion'],
      
      // Rangos de hosting/servidores
      hostingPatterns: ['aws', 'azure', 'gcp', 'digital', 'vultr']
    };
  }

  /**
   * Analizo la información del dispositivo
   * @param {string} deviceInfo - Información del dispositivo/user agent
   * @returns {Object} - Análisis del dispositivo
   */
  analyzeDeviceInfo(deviceInfo) {
    if (!deviceInfo) {
      return {
        has_info: false,
        risk_score: 0.8, // Alto riesgo si no hay información
        suspicious_patterns: ['Sin información del dispositivo']
      };
    }
    
    const deviceLower = deviceInfo.toLowerCase();
    let riskScore = 0.1; // Bajo riesgo base
    const suspiciousPatterns = [];
    
    // Verificar patrones sospechosos en user agent
    this.suspiciousPatterns.userAgents.forEach(pattern => {
      if (deviceLower.includes(pattern)) {
        riskScore += 0.3;
        suspiciousPatterns.push(`User agent sospechoso: ${pattern}`);
      }
    });
    
    // Verificar sistemas operativos raros
    this.suspiciousPatterns.rareSystems.forEach(system => {
      if (deviceLower.includes(system)) {
        riskScore += 0.2;
        suspiciousPatterns.push(`Sistema operativo inusual: ${system}`);
      }
    });
    
    // Verificar navegadores raros
    this.suspiciousPatterns.rareBrowsers.forEach(browser => {
      if (deviceLower.includes(browser)) {
        riskScore += 0.3;
        suspiciousPatterns.push(`Navegador inusual: ${browser}`);
      }
    });
    
    // Detectar posibles automatizaciones
    if (deviceLower.length < 20 || deviceLower.length > 500) {
      riskScore += 0.2;
      suspiciousPatterns.push('Longitud de user agent anómala');
    }
    
    return {
      has_info: true,
      risk_score: Math.min(riskScore, 1),
      suspicious_patterns: suspiciousPatterns
    };
  }

  /**
   * Analizo la información de la IP
   * @param {string} ipAddress - Dirección IP
   * @returns {Object} - Análisis de la IP
   */
  analyzeIPAddress(ipAddress) {
    if (!ipAddress) {
      return {
        has_ip: false,
        risk_score: 0.7, // Riesgo medio-alto si no hay IP
        suspicious_patterns: ['Sin dirección IP']
      };
    }
    
    let riskScore = 0.1; // Bajo riesgo base
    const suspiciousPatterns = [];
    
    // Verificar rangos privados (pueden indicar proxy/VPN)
    this.suspiciousIPRanges.vpnPatterns.forEach(pattern => {
      if (ipAddress.startsWith(pattern)) {
        riskScore += 0.4;
        suspiciousPatterns.push(`IP de rango privado/VPN: ${pattern}`);
      }
    });
    
    // Verificar patrones de hosting
    this.suspiciousIPRanges.hostingPatterns.forEach(pattern => {
      if (ipAddress.toLowerCase().includes(pattern)) {
        riskScore += 0.3;
        suspiciousPatterns.push(`IP de proveedor hosting: ${pattern}`);
      }
    });
    
    // Verificar TOR (simplificado)
    this.suspiciousIPRanges.torPatterns.forEach(pattern => {
      if (ipAddress.toLowerCase().includes(pattern)) {
        riskScore += 0.6;
        suspiciousPatterns.push(`IP relacionada con TOR: ${pattern}`);
      }
    });
    
    // Verificar formato de IP válido (simplificado)
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(ipAddress)) {
      riskScore += 0.2;
      suspiciousPatterns.push('Formato de IP inválido');
    }
    
    return {
      has_ip: true,
      risk_score: Math.min(riskScore, 1),
      suspicious_patterns: suspiciousPatterns
    };
  }

  /**
   * Preparo los datos de dispositivo para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    
    // Analizar información del dispositivo
    const deviceAnalysis = this.analyzeDeviceInfo(variables.device_info);
    const ipAnalysis = this.analyzeIPAddress(variables.ip_address);
    
    const input = {
      // Información básica del dispositivo
      has_device_info: deviceAnalysis.has_info ? 1 : 0,
      has_ip_address: ipAnalysis.has_ip ? 1 : 0,
      
      // Scores de riesgo de dispositivo e IP
      device_risk_score: deviceAnalysis.risk_score,
      ip_risk_score: ipAnalysis.risk_score,
      
      // Combinación de riesgos
      combined_device_risk: (deviceAnalysis.risk_score + ipAnalysis.risk_score) / 2,
      
      // Flags específicos
      missing_both: (!deviceAnalysis.has_info && !ipAnalysis.has_ip) ? 1 : 0,
      has_suspicious_device: deviceAnalysis.suspicious_patterns.length > 0 ? 1 : 0,
      has_suspicious_ip: ipAnalysis.suspicious_patterns.length > 0 ? 1 : 0,
      
      // Contexto de la transacción
      is_online_transaction: variables.channel === 'online' ? 1 : 0,
      is_mobile_transaction: variables.channel === 'mobile' ? 1 : 0,
      
      // Monto y ubicación
      amount_normalized: Math.min(Math.log10(variables.amount + 1) / 6, 1),
      is_high_amount: variables.amount > 5000 ? 1 : 0,
      is_international: !variables.is_domestic ? 1 : 0,
      
      // Patrones temporales
      is_night_transaction: variables.is_night_transaction ? 1 : 0,
      is_weekend: variables.is_weekend ? 1 : 0,
      
      // Experiencia del cliente
      client_age_factor: Math.min(variables.client_age_days / 365, 1),
      
      // Actividad reciente
      recent_activity: Math.min(variables.transactions_last_24h / 20, 1),
      
      // Número total de patrones sospechosos detectados
      total_suspicious_patterns: Math.min(
        (deviceAnalysis.suspicious_patterns.length + ipAnalysis.suspicious_patterns.length) / 10, 
        1
      )
    };
    
    return input;
  }

  /**
   * Analizo el dispositivo de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis de dispositivo no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'device',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de dispositivo completado: Score=${suspicionScore.toFixed(3)}, Tiene info=${input.has_device_info || input.has_ip_address}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de dispositivo:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico de dispositivo
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    let suspicionScore = 0;
    const reasons = [];
    
    const deviceAnalysis = this.analyzeDeviceInfo(variables.device_info);
    const ipAnalysis = this.analyzeIPAddress(variables.ip_address);
    
    // Regla 1: Falta de información del dispositivo/IP
    if (!deviceAnalysis.has_info && !ipAnalysis.has_ip) {
      suspicionScore += 0.7;
      reasons.push('Sin información de dispositivo ni IP');
    } else if (!deviceAnalysis.has_info) {
      suspicionScore += 0.4;
      reasons.push('Sin información del dispositivo');
    } else if (!ipAnalysis.has_ip) {
      suspicionScore += 0.3;
      reasons.push('Sin dirección IP');
    }
    
    // Regla 2: Patrones sospechosos en dispositivo
    if (deviceAnalysis.suspicious_patterns.length > 0) {
      suspicionScore += Math.min(deviceAnalysis.suspicious_patterns.length * 0.2, 0.6);
      reasons.push(...deviceAnalysis.suspicious_patterns);
    }
    
    // Regla 3: Patrones sospechosos en IP
    if (ipAnalysis.suspicious_patterns.length > 0) {
      suspicionScore += Math.min(ipAnalysis.suspicious_patterns.length * 0.2, 0.6);
      reasons.push(...ipAnalysis.suspicious_patterns);
    }
    
    // Regla 4: Transacción online sin información adecuada
    if (variables.channel === 'online' && (!deviceAnalysis.has_info || !ipAnalysis.has_ip)) {
      suspicionScore += 0.4;
      reasons.push('Transacción online sin información completa del dispositivo');
    }
    
    // Regla 5: Monto alto con dispositivo sospechoso
    if (variables.amount > 5000 && (deviceAnalysis.risk_score > 0.5 || ipAnalysis.risk_score > 0.5)) {
      suspicionScore += 0.3;
      reasons.push('Monto alto con dispositivo/IP de riesgo');
    }
    
    // Regla 6: Cliente nuevo con información sospechosa
    if (variables.client_age_days < 30 && (deviceAnalysis.risk_score > 0.4 || ipAnalysis.risk_score > 0.4)) {
      suspicionScore += 0.3;
      reasons.push('Cliente nuevo con dispositivo/IP sospechoso');
    }
    
    // Regla 7: Transacción internacional nocturna sin información
    if (!variables.is_domestic && variables.is_night_transaction && !deviceAnalysis.has_info) {
      suspicionScore += 0.4;
      reasons.push('Transacción internacional nocturna sin info del dispositivo');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'device',
      suspicion_score: Math.min(suspicionScore, 1),
      confidence: 0.7,
      reasons: reasons,
      processing_time_ms: 6
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
    
    if (score > 0.7) {
      if (input.missing_both) reasons.push('Sin información de dispositivo ni IP');
      if (input.device_risk_score > 0.6) reasons.push('Dispositivo de alto riesgo');
      if (input.ip_risk_score > 0.6) reasons.push('IP de alto riesgo');
    } else if (score > 0.5) {
      if (!input.has_device_info && input.is_online_transaction) {
        reasons.push('Transacción online sin info del dispositivo');
      }
      if (input.has_suspicious_device) reasons.push('Patrones sospechosos en dispositivo');
      if (input.has_suspicious_ip) reasons.push('Patrones sospechosos en IP');
    } else if (score > 0.3) {
      if (input.combined_device_risk > 0.4) reasons.push('Riesgo combinado dispositivo/IP');
      if (input.total_suspicious_patterns > 0.3) reasons.push('Múltiples patrones sospechosos');
    }
    
    return reasons;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.6; // Confianza base media
    
    // Mayor confianza si tenemos información del dispositivo
    if (input.has_device_info) {
      confidence += 0.2;
    }
    
    // Mayor confianza si tenemos información de IP
    if (input.has_ip_address) {
      confidence += 0.1;
    }
    
    // Mayor confianza si el cliente tiene experiencia
    if (input.client_age_factor > 0.2) {
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
      logger.info(`Iniciando entrenamiento de red de análisis de dispositivo con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de dispositivo completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de dispositivo:', error);
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
      variable_analyzed: 'device',
      suspicious_patterns: this.suspiciousPatterns,
      suspicious_ip_ranges: this.suspiciousIPRanges
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
      
      if (modelData.suspicious_patterns) {
        this.suspiciousPatterns = modelData.suspicious_patterns;
      }
      if (modelData.suspicious_ip_ranges) {
        this.suspiciousIPRanges = modelData.suspicious_ip_ranges;
      }
      
      logger.info(`Modelo de análisis de dispositivo cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis de dispositivo:', error);
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
      variable: 'device',
      description: 'Analiza información del dispositivo e IP para detectar patrones tecnológicos fraudulentos',
      patterns_monitored: {
        device_patterns: Object.keys(this.suspiciousPatterns).length,
        ip_patterns: Object.keys(this.suspiciousIPRanges).length
      }
    };
  }
}

module.exports = DeviceAnalyzer;