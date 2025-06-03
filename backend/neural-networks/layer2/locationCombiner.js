const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 2.2 - Combinador de Ubicación/Geografía
 * Esta red combina análisis geográficos y de movilidad de Capa 1 para detectar patrones espaciales complejos
 */
class LocationCombiner {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [12, 8, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'location_combiner_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Patrones geográficos sospechosos conocidos
    this.suspiciousPatterns = {
      // Velocidades imposibles
      impossibleTravel: 900, // km/h - velocidad de avión comercial
      
      // Distancias sospechosas por tiempo
      rapidMovement: {
        local: { distance: 50, time: 30 },      // 50km en 30 min = sospechoso
        regional: { distance: 300, time: 120 }, // 300km en 2h = límite
        international: { distance: 1000, time: 180 } // 1000km en 3h = muy sospechoso
      },
      
      // Países de riesgo por proximidad
      riskByProximity: {
        neighbors: ['MX', 'BZ', 'SV', 'HN'], // Vecinos - riesgo medio
        regional: ['US', 'CA', 'CR', 'NI', 'PA'], // Regional - riesgo bajo
        distant: ['CN', 'RU', 'NG', 'PK', 'IR'] // Distantes de riesgo - muy alto
      }
    };
  }

  /**
   * Analizo patrones de movilidad del cliente
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Análisis de movilidad
   */
  analyzeMobilityPatterns(transactionData) {
    const { variables } = transactionData;
    
    return {
      // Patrón de viaje del cliente
      travel_frequency: this.calculateTravelFrequency(variables),
      location_diversity: Math.min(variables.historical_location_count / 25, 1),
      country_diversity: Math.min(variables.unique_countries / 15, 1),
      
      // Velocidad de movimiento actual
      current_travel_speed: this.calculateTravelSpeed(variables),
      
      // Patrón de ubicaciones de riesgo
      risk_location_pattern: this.analyzeRiskLocationPattern(variables),
      
      // Consistencia geográfica
      geographic_consistency: this.calculateGeographicConsistency(variables),
      
      // Indicadores de actividad anómala
      location_hopping: this.detectLocationHopping(variables),
      international_jumping: this.detectInternationalJumping(variables)
    };
  }

  /**
   * Calculo frecuencia de viaje del cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de frecuencia de viaje (0-1)
   */
  calculateTravelFrequency(variables) {
    if (variables.historical_transaction_count < 10) {
      return 0.5; // Neutral para clientes nuevos
    }
    
    const locationsPerTransaction = variables.historical_location_count / variables.historical_transaction_count;
    return Math.min(locationsPerTransaction * 2, 1); // Normalizar
  }

  /**
   * Calculo velocidad de viaje actual
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Velocidad en km/h
   */
  calculateTravelSpeed(variables) {
    if (!variables.distance_from_prev || !variables.time_since_prev_transaction) {
      return 0;
    }
    
    const timeHours = variables.time_since_prev_transaction / 60;
    return variables.distance_from_prev / Math.max(timeHours, 0.1);
  }

  /**
   * Analizo patrón de ubicaciones de riesgo
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de patrón de riesgo (0-1)
   */
  analyzeRiskLocationPattern(variables) {
    let riskScore = 0;
    
    // Si está en país de alto riesgo
    if (this.suspiciousPatterns.riskByProximity.distant.includes(variables.country)) {
      riskScore += 0.6;
    }
    
    // Si viaja mucho internacionalmente
    if (variables.unique_countries > 10) {
      riskScore += 0.3;
    }
    
    // Si es transacción internacional nocturna
    if (!variables.is_domestic && variables.is_night_transaction) {
      riskScore += 0.2;
    }
    
    return Math.min(riskScore, 1);
  }

  /**
   * Calculo consistencia geográfica del cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de consistencia (0-1)
   */
  calculateGeographicConsistency(variables) {
    // Cliente muy local = muy consistente
    if (variables.historical_location_count <= 3) {
      return 0.9;
    }
    
    // Cliente moderadamente local = consistente
    if (variables.historical_location_count <= 8) {
      return 0.7;
    }
    
    // Cliente muy viajero = inconsistente
    if (variables.historical_location_count > 20) {
      return 0.2;
    }
    
    return 0.5; // Moderado
  }

  /**
   * Detecto salto entre ubicaciones (location hopping)
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - 1 si se detecta, 0 si no
   */
  detectLocationHopping(variables) {
    // Muchas ubicaciones diferentes en poco tiempo
    if (variables.historical_location_count > 15 && 
        variables.client_age_days < 90) {
      return 1;
    }
    
    // Distancia grande en tiempo corto
    if (variables.distance_from_prev > 500 && 
        variables.time_since_prev_transaction < 360) { // 6 horas
      return 1;
    }
    
    return 0;
  }

  /**
   * Detecto salto internacional sospechoso
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - 1 si se detecta, 0 si no
   */
  detectInternationalJumping(variables) {
    // Primera transacción internacional con distancia grande
    if (variables.unique_countries <= 1 && 
        !variables.is_domestic && 
        variables.distance_from_prev > 1000) {
      return 1;
    }
    
    // Múltiples países en poco tiempo
    if (variables.unique_countries > 5 && 
        variables.client_age_days < 60) {
      return 1;
    }
    
    return 0;
  }

  /**
   * Combino análisis geográficos de Capa 1
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de todas las redes de Capa 1
   * @returns {Object} - Datos preparados para la red
   */
  prepareInput(transactionData, layer1Results) {
    // Extraer scores relacionados con ubicación
    const locationScores = {
      location: layer1Results.location?.suspicion_score || 0,
      distance: layer1Results.distance?.suspicion_score || 0,
      country: layer1Results.country?.suspicion_score || 0,
      time: layer1Results.time?.suspicion_score || 0, // Tiempo puede afectar viaje
      velocity: layer1Results.velocity?.suspicion_score || 0 // Velocidad relacionada con distancia
    };
    
    // Analizar patrones de movilidad
    const mobility = this.analyzeMobilityPatterns(transactionData);
    const { variables } = transactionData;
    
    const input = {
      // Scores de Capa 1 relacionados con ubicación
      location_score: locationScores.location,
      distance_score: locationScores.distance,
      country_score: locationScores.country,
      time_score: locationScores.time,
      velocity_score: locationScores.velocity,
      
      // Análisis de movilidad
      travel_frequency: mobility.travel_frequency,
      location_diversity: mobility.location_diversity,
      country_diversity: mobility.country_diversity,
      current_travel_speed: Math.min(mobility.current_travel_speed / 1000, 1), // Normalizar
      risk_location_pattern: mobility.risk_location_pattern,
      geographic_consistency: mobility.geographic_consistency,
      
      // Detección de patrones específicos
      location_hopping: mobility.location_hopping,
      international_jumping: mobility.international_jumping,
      impossible_travel: mobility.current_travel_speed > this.suspiciousPatterns.impossibleTravel ? 1 : 0,
      
      // Combinaciones geográficas sospechosas
      night_foreign_transaction: (!variables.is_domestic && variables.is_night_transaction) ? 1 : 0,
      high_risk_country_large_amount: (locationScores.country > 0.7 && variables.amount > 5000) ? 1 : 0,
      rapid_international_movement: this.detectRapidInternationalMovement(variables),
      
      // Información geográfica base
      is_domestic: variables.is_domestic ? 1 : 0,
      distance_from_prev: Math.min(variables.distance_from_prev / 10000, 1), // Max 10,000 km
      time_since_prev: variables.time_since_prev_transaction > 0 ? 
        Math.min(variables.time_since_prev_transaction / 1440, 1) : 1, // Max 24h
      
      // Contexto del cliente
      client_experience: Math.min(variables.client_age_days / 365, 1),
      is_new_client: variables.client_age_days < 30 ? 1 : 0,
      
      // Score combinado de ubicación
      location_combined_score: (locationScores.location + locationScores.distance + locationScores.country) / 3,
      
      // Correlaciones geográficas
      location_distance_correlation: this.calculateCorrelation(locationScores.location, locationScores.distance),
      country_velocity_correlation: this.calculateCorrelation(locationScores.country, locationScores.velocity),
      
      // Índice de sospecha geográfica
      geographic_suspicion_index: this.calculateGeographicSuspicionIndex(variables, locationScores, mobility)
    };
    
    return input;
  }

  /**
   * Detecto movimiento internacional rápido
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - 1 si se detecta, 0 si no
   */
  detectRapidInternationalMovement(variables) {
    if (!variables.distance_from_prev || !variables.time_since_prev_transaction) {
      return 0;
    }
    
    // Movimiento internacional en menos de 6 horas
    if (variables.distance_from_prev > 2000 && 
        variables.time_since_prev_transaction < 360) {
      return 1;
    }
    
    return 0;
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
   * Calculo índice de sospecha geográfica
   * @param {Object} variables - Variables de la transacción
   * @param {Object} locationScores - Scores de ubicación
   * @param {Object} mobility - Análisis de movilidad
   * @returns {number} - Índice de sospecha (0-1)
   */
  calculateGeographicSuspicionIndex(variables, locationScores, mobility) {
    let suspicionIndex = 0;
    
    // Factor de riesgo del país
    suspicionIndex += locationScores.country * 0.3;
    
    // Factor de distancia/velocidad
    suspicionIndex += locationScores.distance * 0.25;
    
    // Factor de ubicación específica
    suspicionIndex += locationScores.location * 0.2;
    
    // Factor de movilidad anómala
    if (mobility.location_hopping) suspicionIndex += 0.15;
    if (mobility.international_jumping) suspicionIndex += 0.1;
    
    return Math.min(suspicionIndex, 1);
  }

  /**
   * Analizo y combino patrones geográficos
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado del análisis combinado
   */
  async analyze(transactionData, layer1Results) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red combinadora de ubicación no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData, layer1Results);
      }
      
      const input = this.prepareInput(transactionData, layer1Results);
      const output = this.network.run(input);
      const combinedScore = Array.isArray(output) ? output[0] : output;
      
      const patterns = this.detectLocationPatterns(transactionData, layer1Results, input);
      
      const result = {
        network_id: this.networkId,
        combined_score: combinedScore,
        confidence: this.calculateConfidence(input),
        patterns_detected: patterns,
        location_analysis: {
          geographic_risk: input.location_combined_score,
          mobility_risk: input.travel_frequency,
          distance_risk: input.distance_score,
          country_risk: input.country_score,
          travel_speed_risk: input.current_travel_speed
        },
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de ubicación completado: Score=${combinedScore.toFixed(3)}, Patrones=${patterns.length}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de ubicación:', error);
      return this.heuristicAnalysis(transactionData, layer1Results);
    }
  }

  /**
   * Análisis heurístico de ubicación
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData, layer1Results) {
    const input = this.prepareInput(transactionData, layer1Results);
    let combinedScore = input.geographic_suspicion_index;
    const patterns = [];
    
    // Ajustar score basado en patrones específicos
    if (input.impossible_travel) {
      combinedScore += 0.3;
      patterns.push('Velocidad de viaje físicamente imposible');
    }
    
    if (input.location_hopping) {
      combinedScore += 0.2;
      patterns.push('Patrón de salto entre ubicaciones');
    }
    
    if (input.international_jumping) {
      combinedScore += 0.2;
      patterns.push('Salto internacional sospechoso');
    }
    
    if (input.night_foreign_transaction) {
      combinedScore += 0.15;
      patterns.push('Transacción extranjera nocturna');
    }
    
    if (input.high_risk_country_large_amount) {
      combinedScore += 0.15;
      patterns.push('Monto alto en país de riesgo');
    }
    
    if (input.rapid_international_movement) {
      combinedScore += 0.1;
      patterns.push('Movimiento internacional muy rápido');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      combined_score: Math.min(combinedScore, 1),
      confidence: 0.8,
      patterns_detected: patterns,
      location_analysis: {
        geographic_risk: input.location_combined_score,
        mobility_risk: input.travel_frequency,
        distance_risk: input.distance_score,
        country_risk: input.country_score,
        travel_speed_risk: input.current_travel_speed
      },
      processing_time_ms: 7
    };
  }

  /**
   * Detecto patrones geográficos específicos
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} input - Datos de entrada procesados
   * @returns {Array} - Lista de patrones detectados
   */
  detectLocationPatterns(transactionData, layer1Results, input) {
    const patterns = [];
    
    if (input.impossible_travel) {
      patterns.push('Velocidad de viaje imposible detectada');
    }
    
    if (input.location_hopping) {
      patterns.push('Patrón de location hopping (salto entre ubicaciones)');
    }
    
    if (input.international_jumping) {
      patterns.push('Salto internacional anómalo');
    }
    
    if (input.geographic_consistency < 0.3) {
      patterns.push('Comportamiento geográfico altamente inconsistente');
    }
    
    if (input.risk_location_pattern > 0.7) {
      patterns.push('Patrón de ubicaciones de alto riesgo');
    }
    
    if (input.location_distance_correlation > 0.8) {
      patterns.push('Fuerte correlación ubicación-distancia sospechosa');
    }
    
    if (input.country_diversity > 0.8) {
      patterns.push('Diversidad de países extremadamente alta');
    }
    
    return patterns;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.8; // Confianza base alta para análisis geográfico
    
    // Mayor confianza si tenemos datos de distancia y tiempo
    if (input.distance_from_prev > 0 && input.time_since_prev > 0) {
      confidence += 0.1;
    }
    
    // Mayor confianza si el cliente tiene experiencia
    if (input.client_experience > 0.2) {
      confidence += 0.1;
    }
    
    // Menor confianza si el cliente es muy nuevo
    if (input.is_new_client) {
      confidence -= 0.1;
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
      logger.info(`Iniciando entrenamiento de red combinadora de ubicación con ${trainingData.length} muestras`);
      
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
      
      logger.info('Entrenamiento de red combinadora de ubicación completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red combinadora de ubicación:', error);
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
      location: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      distance: { suspicion_score: fraudScore * (0.8 + Math.random() * 0.4) },
      country: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) },
      time: { suspicion_score: fraudScore * (0.5 + Math.random() * 1.0) },
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
      purpose: 'location_combination',
      suspicious_patterns: this.suspiciousPatterns
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
      
      logger.info(`Modelo combinador de ubicación cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo combinador de ubicación:', error);
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
      purpose: 'location_combination',
      description: 'Combina análisis geográficos de Capa 1 para detectar patrones espaciales y de movilidad complejos',
      input_networks: ['location', 'distance', 'country', 'time', 'velocity']
    };
  }
}

module.exports = LocationCombiner;