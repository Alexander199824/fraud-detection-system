const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.12 - Análisis de País de Origen
 * Esta red analiza si el país de origen de una transacción es sospechoso
 */
class CountryAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'country_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Clasificación de países por nivel de riesgo
    this.riskClassification = {
      // Países de muy alto riesgo (conocidos por fraude)
      veryHigh: ['CN', 'RU', 'NG', 'PK', 'IR', 'KP', 'MM', 'AF'],
      
      // Países de alto riesgo
      high: ['VE', 'CO', 'PE', 'EC', 'BO', 'PY', 'UY', 'SR', 'GY', 'BD', 'LK', 'NP'],
      
      // Países de riesgo medio
      medium: ['BR', 'AR', 'CL', 'MX', 'PA', 'CR', 'NI', 'HN', 'SV', 'BZ', 'IN', 'TH', 'PH', 'ID'],
      
      // Países de bajo riesgo (vecinos/aliados comerciales)
      low: ['US', 'CA', 'ES', 'FR', 'DE', 'IT', 'GB', 'AU', 'JP', 'KR', 'SG'],
      
      // País base (Guatemala)
      home: ['GT']
    };
    
    // Scores de riesgo por clasificación
    this.riskScores = {
      veryHigh: 0.9,
      high: 0.7,
      medium: 0.5,
      low: 0.2,
      home: 0.1,
      unknown: 0.8
    };
  }

  /**
   * Obtengo la clasificación de riesgo de un país
   * @param {string} countryCode - Código del país (ISO 2)
   * @returns {string} - Clasificación de riesgo
   */
  getCountryRiskClassification(countryCode) {
    if (!countryCode) return 'unknown';
    
    const code = countryCode.toUpperCase();
    
    for (const [classification, countries] of Object.entries(this.riskClassification)) {
      if (countries.includes(code)) {
        return classification;
      }
    }
    
    return 'unknown';
  }

  /**
   * Preparo los datos de país para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    const country = variables.country || 'unknown';
    const classification = this.getCountryRiskClassification(country);
    
    const input = {
      // Codificación de la clasificación de riesgo
      is_very_high_risk: classification === 'veryHigh' ? 1 : 0,
      is_high_risk: classification === 'high' ? 1 : 0,
      is_medium_risk: classification === 'medium' ? 1 : 0,
      is_low_risk: classification === 'low' ? 1 : 0,
      is_home_country: classification === 'home' ? 1 : 0,
      is_unknown_country: classification === 'unknown' ? 1 : 0,
      
      // Score de riesgo del país
      country_risk_score: this.riskScores[classification] || 0.8,
      
      // Análisis de patrón de países del cliente
      is_domestic: variables.is_domestic ? 1 : 0,
      country_diversity: Math.min(variables.unique_countries / 20, 1), // Max 20 países
      
      // Primera vez en este país
      is_new_country: this.isNewCountryForClient(variables),
      
      // Contexto de la transacción
      amount_normalized: Math.min(Math.log10(variables.amount + 1) / 6, 1),
      is_high_amount: variables.amount > 5000 ? 1 : 0,
      
      // Tiempo y actividad
      is_night_transaction: variables.is_night_transaction ? 1 : 0,
      recent_activity: Math.min(variables.transactions_last_24h / 20, 1),
      
      // Experiencia del cliente
      client_age_factor: Math.min(variables.client_age_days / 365, 1),
      
      // Distancia desde país base
      geographical_distance: this.calculateGeographicalDistance(country),
      
      // Patrón de viaje del cliente
      travel_pattern_score: this.calculateTravelPatternScore(variables)
    };
    
    return input;
  }

  /**
   * Determino si es un país nuevo para el cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - 1 si es nuevo, 0 si no
   */
  isNewCountryForClient(variables) {
    // Si el cliente tiene pocos países únicos en su historial, 
    // es probable que este sea nuevo
    if (variables.unique_countries <= 1) return 1;
    if (variables.unique_countries <= 2 && !variables.is_domestic) return 1;
    return 0;
  }

  /**
   * Calculo distancia geográfica simplificada desde Guatemala
   * @param {string} countryCode - Código del país
   * @returns {number} - Score de distancia (0-1)
   */
  calculateGeographicalDistance(countryCode) {
    // Regiones geográficas simplificadas desde Guatemala
    const distanceMap = {
      // Muy cerca (Centroamérica)
      'GT': 0,
      'BZ': 0.1, 'SV': 0.1, 'HN': 0.1, 'NI': 0.1, 'CR': 0.1, 'PA': 0.2,
      
      // Cerca (América del Norte y Caribe)
      'MX': 0.2, 'US': 0.3, 'CA': 0.4,
      'CU': 0.3, 'JM': 0.3, 'HT': 0.3, 'DO': 0.3,
      
      // Medio (América del Sur)
      'CO': 0.4, 'VE': 0.4, 'BR': 0.5, 'AR': 0.6, 'CL': 0.6, 'PE': 0.5,
      'EC': 0.4, 'BO': 0.5, 'PY': 0.6, 'UY': 0.6,
      
      // Lejos (Europa, Asia, África)
      'ES': 0.8, 'FR': 0.8, 'DE': 0.8, 'IT': 0.8, 'GB': 0.8,
      'CN': 0.9, 'JP': 0.9, 'KR': 0.9, 'IN': 0.9, 'RU': 0.9,
      'AU': 0.9, 'NZ': 0.9,
      
      // Muy lejos o desconocido
      'unknown': 1.0
    };
    
    return distanceMap[countryCode?.toUpperCase()] || 0.9;
  }

  /**
   * Calculo score de patrón de viaje del cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de patrón de viaje (0-1)
   */
  calculateTravelPatternScore(variables) {
    if (variables.unique_countries <= 1) return 0.1; // Muy doméstico
    if (variables.unique_countries <= 3) return 0.3; // Poco viajero
    if (variables.unique_countries <= 7) return 0.5; // Viajero moderado
    if (variables.unique_countries <= 15) return 0.7; // Viajero frecuente
    return 0.9; // Súper viajero (sospechoso)
  }

  /**
   * Analizo el país de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis de país no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'country',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de país completado: Score=${suspicionScore.toFixed(3)}, País=${transactionData.variables.country}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de país:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico de país
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    const country = variables.country || 'unknown';
    const classification = this.getCountryRiskClassification(country);
    let suspicionScore = 0;
    const reasons = [];
    
    // Regla 1: País de muy alto riesgo
    if (classification === 'veryHigh') {
      suspicionScore += 0.8;
      reasons.push(`País de muy alto riesgo: ${country}`);
    } else if (classification === 'high') {
      suspicionScore += 0.6;
      reasons.push(`País de alto riesgo: ${country}`);
    } else if (classification === 'unknown') {
      suspicionScore += 0.7;
      reasons.push(`País desconocido: ${country}`);
    }
    
    // Regla 2: Primera transacción internacional
    if (!variables.is_domestic && variables.unique_countries <= 1) {
      suspicionScore += 0.4;
      reasons.push('Primera transacción internacional del cliente');
    }
    
    // Regla 3: País de riesgo con monto alto
    if ((classification === 'veryHigh' || classification === 'high') && variables.amount > 2000) {
      suspicionScore += 0.5;
      reasons.push(`Monto alto desde país de riesgo: $${variables.amount}`);
    }
    
    // Regla 4: Muchos países diferentes (perfil de lavado)
    if (variables.unique_countries > 10) {
      suspicionScore += 0.4;
      reasons.push(`Cliente usa muchos países: ${variables.unique_countries}`);
    }
    
    // Regla 5: Transacción nocturna desde país extranjero
    if (!variables.is_domestic && variables.is_night_transaction) {
      suspicionScore += 0.3;
      reasons.push('Transacción nocturna internacional');
    }
    
    // Regla 6: Cliente nuevo con transacción internacional de riesgo
    if (variables.client_age_days < 30 && classification !== 'home' && classification !== 'low') {
      suspicionScore += 0.4;
      reasons.push('Cliente nuevo con transacción desde país de riesgo');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'country',
      suspicion_score: Math.min(suspicionScore, 1),
      confidence: 0.8,
      reasons: reasons,
      processing_time_ms: 5
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
    const country = transactionData.variables.country;
    
    if (score > 0.7) {
      if (input.is_very_high_risk) reasons.push(`País de muy alto riesgo: ${country}`);
      if (input.is_unknown_country) reasons.push(`País desconocido: ${country}`);
      if (input.geographical_distance > 0.8) reasons.push('País muy distante geográficamente');
    } else if (score > 0.5) {
      if (input.is_high_risk) reasons.push(`País de alto riesgo: ${country}`);
      if (input.is_new_country && input.is_high_amount) reasons.push('Primer uso del país con monto alto');
      if (input.travel_pattern_score > 0.7) reasons.push('Patrón de viaje muy diverso');
    } else if (score > 0.3) {
      if (input.is_medium_risk) reasons.push(`País de riesgo medio: ${country}`);
      if (!input.is_domestic && input.is_night_transaction) reasons.push('Transacción internacional nocturna');
    }
    
    return reasons;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.9; // Alta confianza base para análisis geográfico
    
    // Menor confianza si el país es desconocido
    if (input.is_unknown_country) {
      confidence -= 0.2;
    }
    
    // Mayor confianza si tenemos historial del cliente
    if (input.client_age_factor > 0.1) {
      confidence += 0.1;
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
      logger.info(`Iniciando entrenamiento de red de análisis de país con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de país completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de país:', error);
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
      variable_analyzed: 'country',
      risk_classification: this.riskClassification,
      risk_scores: this.riskScores
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
      
      if (modelData.risk_classification) {
        this.riskClassification = modelData.risk_classification;
      }
      if (modelData.risk_scores) {
        this.riskScores = modelData.risk_scores;
      }
      
      logger.info(`Modelo de análisis de país cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis de país:', error);
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
      variable: 'country',
      description: 'Analiza el país de origen de transacciones para detectar patrones geográficos de fraude',
      risk_levels: Object.keys(this.riskScores),
      total_countries_classified: Object.values(this.riskClassification).flat().length
    };
  }
}

module.exports = CountryAnalyzer;