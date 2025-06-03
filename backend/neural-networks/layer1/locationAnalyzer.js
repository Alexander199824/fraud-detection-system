const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.2 - Análisis de Ubicación Geográfica
 * Esta red analiza si la ubicación de una transacción es sospechosa
 */
class LocationAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'location_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Países considerados de alto riesgo
    this.highRiskCountries = ['CN', 'RU', 'NG', 'PK', 'IR'];
    this.homeCountry = 'GT'; // Guatemala como país base
  }

  /**
   * Preparo los datos de ubicación para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    
    const input = {
      // Coordenadas normalizadas
      latitude_normalized: (variables.latitude + 90) / 180, // -90 a 90 -> 0 a 1
      longitude_normalized: (variables.longitude + 180) / 360, // -180 a 180 -> 0 a 1
      
      // Distancia desde la última transacción
      distance_from_prev: Math.min(variables.distance_from_prev / 10000, 1), // Max 10,000 km
      
      // Análisis de país
      is_domestic: variables.is_domestic ? 1 : 0,
      is_high_risk_country: this.highRiskCountries.includes(variables.country) ? 1 : 0,
      
      // Análisis de ubicaciones únicas
      location_diversity: Math.min(variables.historical_location_count / 50, 1), // Max 50 ubicaciones
      
      // Patrones geográficos del cliente
      has_travel_history: variables.historical_location_count > 5 ? 1 : 0,
      is_new_location: variables.historical_location_count === 0 ? 1 : 0,
      
      // Contexto temporal-geográfico
      unusual_distance_for_time: this.calculateUnusualDistance(variables)
    };
    
    return input;
  }

  /**
   * Calculo si la distancia es inusual para el tiempo transcurrido
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de distancia inusual (0-1)
   */
  calculateUnusualDistance(variables) {
    if (!variables.time_since_prev_transaction || !variables.distance_from_prev) {
      return 0;
    }
    
    const timeHours = variables.time_since_prev_transaction / 60; // Convertir a horas
    const distance = variables.distance_from_prev;
    
    // Velocidad máxima razonable (avión comercial): ~900 km/h
    const maxReasonableSpeed = 900;
    const requiredSpeed = distance / Math.max(timeHours, 0.1);
    
    if (requiredSpeed > maxReasonableSpeed) {
      return Math.min(requiredSpeed / (maxReasonableSpeed * 2), 1);
    }
    
    return 0;
  }

  /**
   * Analizo la ubicación de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis de ubicación no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'location',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de ubicación completado: Score=${suspicionScore.toFixed(3)}, País=${transactionData.variables.country}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de ubicación:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico de ubicación
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    let suspicionScore = 0;
    const reasons = [];
    
    // Regla 1: País de alto riesgo
    if (this.highRiskCountries.includes(variables.country)) {
      suspicionScore += 0.6;
      reasons.push(`Transacción desde país de alto riesgo: ${variables.country}`);
    }
    
    // Regla 2: Transacción internacional desde cliente doméstico
    if (!variables.is_domestic && variables.historical_location_count < 3) {
      suspicionScore += 0.4;
      reasons.push('Primera transacción internacional');
    }
    
    // Regla 3: Distancia imposible en el tiempo
    const timeHours = variables.time_since_prev_transaction / 60;
    if (timeHours > 0 && variables.distance_from_prev > 0) {
      const requiredSpeed = variables.distance_from_prev / timeHours;
      if (requiredSpeed > 900) { // Velocidad de avión comercial
        suspicionScore += 0.8;
        reasons.push(`Distancia físicamente imposible: ${variables.distance_from_prev.toFixed(0)}km en ${timeHours.toFixed(1)}h`);
      } else if (requiredSpeed > 500) {
        suspicionScore += 0.5;
        reasons.push(`Distancia muy grande para el tiempo: ${variables.distance_from_prev.toFixed(0)}km en ${timeHours.toFixed(1)}h`);
      }
    }
    
    // Regla 4: Muchas ubicaciones diferentes (patrón de skimming)
    if (variables.historical_location_count > 20) {
      suspicionScore += 0.3;
      reasons.push(`Muchas ubicaciones diferentes: ${variables.historical_location_count}`);
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'location',
      suspicion_score: Math.min(suspicionScore, 1),
      confidence: 0.7,
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
    const { variables } = transactionData;
    
    if (score > 0.7) {
      if (input.is_high_risk_country) reasons.push('País de alto riesgo');
      if (input.unusual_distance_for_time > 0.5) reasons.push('Viaje físicamente imposible');
      if (input.distance_from_prev > 0.8) reasons.push('Muy lejos de ubicación anterior');
    } else if (score > 0.5) {
      if (!input.is_domestic) reasons.push('Transacción internacional');
      if (input.unusual_distance_for_time > 0.3) reasons.push('Viaje muy rápido');
      if (input.location_diversity > 0.6) reasons.push('Muchas ubicaciones diferentes');
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
    
    // Mayor confianza si tenemos coordenadas exactas
    if (input.latitude_normalized > 0 && input.longitude_normalized > 0) {
      confidence += 0.1;
    }
    
    // Mayor confianza si tenemos historial de ubicaciones
    if (input.location_diversity > 0.1) {
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
      logger.info(`Iniciando entrenamiento de red de análisis de ubicación con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de ubicación completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de ubicación:', error);
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
      variable_analyzed: 'location',
      high_risk_countries: this.highRiskCountries
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
      
      if (modelData.high_risk_countries) {
        this.highRiskCountries = modelData.high_risk_countries;
      }
      
      logger.info(`Modelo de análisis de ubicación cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis de ubicación:', error);
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
      variable: 'location',
      description: 'Analiza la ubicación geográfica de transacciones para detectar patrones anómalos',
      high_risk_countries: this.highRiskCountries
    };
  }
}

module.exports = LocationAnalyzer;