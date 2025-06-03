const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.7 - Análisis de Distancia desde Última Transacción
 * Esta red analiza si la distancia geográfica desde la última transacción es sospechosa
 */
class DistanceAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'distance_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Umbrales de distancia para clasificación
    this.distanceThresholds = {
      local: 10,        // Menos de 10 km - muy local
      city: 50,         // 10-50 km - misma ciudad/área metropolitana
      regional: 200,    // 50-200 km - región/estado
      national: 1000,   // 200-1000 km - nacional
      continental: 5000, // 1000-5000 km - continental
      global: 20000     // Más de 5000 km - global
    };
    
    // Velocidades máximas razonables (km/h)
    this.maxSpeeds = {
      walking: 6,
      bicycle: 25,
      car: 120,
      train: 300,
      plane: 900
    };
  }

  /**
   * Calculo la distancia entre dos puntos usando fórmula de Haversine
   * @param {number} lat1 - Latitud punto 1
   * @param {number} lon1 - Longitud punto 1
   * @param {number} lat2 - Latitud punto 2
   * @param {number} lon2 - Longitud punto 2
   * @returns {number} - Distancia en kilómetros
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * Convierte grados a radianes
   * @param {number} deg - Grados
   * @returns {number} - Radianes
   */
  deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  /**
   * Clasifico la distancia en categorías
   * @param {number} distance - Distancia en km
   * @returns {string} - Categoría de distancia
   */
  classifyDistance(distance) {
    if (distance <= this.distanceThresholds.local) return 'local';
    if (distance <= this.distanceThresholds.city) return 'city';
    if (distance <= this.distanceThresholds.regional) return 'regional';
    if (distance <= this.distanceThresholds.national) return 'national';
    if (distance <= this.distanceThresholds.continental) return 'continental';
    return 'global';
  }

  /**
   * Calculo la velocidad requerida para cubrir la distancia en el tiempo dado
   * @param {number} distance - Distancia en km
   * @param {number} timeMinutes - Tiempo en minutos
   * @returns {number} - Velocidad requerida en km/h
   */
  calculateRequiredSpeed(distance, timeMinutes) {
    if (!distance || !timeMinutes || timeMinutes <= 0) return 0;
    const timeHours = timeMinutes / 60;
    return distance / timeHours;
  }

  /**
   * Determino si la velocidad es físicamente posible
   * @param {number} speed - Velocidad en km/h
   * @returns {Object} - Análisis de posibilidad
   */
  analyzeSpeedFeasibility(speed) {
    if (speed <= this.maxSpeeds.walking) {
      return { feasible: true, method: 'walking', suspicion: 0.0 };
    } else if (speed <= this.maxSpeeds.bicycle) {
      return { feasible: true, method: 'bicycle', suspicion: 0.1 };
    } else if (speed <= this.maxSpeeds.car) {
      return { feasible: true, method: 'car', suspicion: 0.2 };
    } else if (speed <= this.maxSpeeds.train) {
      return { feasible: true, method: 'train', suspicion: 0.3 };
    } else if (speed <= this.maxSpeeds.plane) {
      return { feasible: true, method: 'plane', suspicion: 0.4 };
    } else {
      return { feasible: false, method: 'impossible', suspicion: 1.0 };
    }
  }

  /**
   * Preparo los datos de distancia para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    const distance = variables.distance_from_prev || 0;
    const timeMinutes = variables.time_since_prev_transaction || 0;
    
    // Clasificar distancia
    const distanceCategory = this.classifyDistance(distance);
    
    // Calcular velocidad requerida
    const requiredSpeed = this.calculateRequiredSpeed(distance, timeMinutes);
    const speedAnalysis = this.analyzeSpeedFeasibility(requiredSpeed);
    
    const input = {
      // Distancia normalizada (logarítmica para manejar rangos amplios)
      distance_normalized: distance > 0 ? Math.min(Math.log10(distance + 1) / 5, 1) : 0, // Max log10(100000) = 5
      
      // Clasificación de distancia (one-hot encoding)
      is_local: distanceCategory === 'local' ? 1 : 0,
      is_city: distanceCategory === 'city' ? 1 : 0,
      is_regional: distanceCategory === 'regional' ? 1 : 0,
      is_national: distanceCategory === 'national' ? 1 : 0,
      is_continental: distanceCategory === 'continental' ? 1 : 0,
      is_global: distanceCategory === 'global' ? 1 : 0,
      
      // Análisis de velocidad
      speed_required: Math.min(requiredSpeed / 1000, 1), // Normalizar a máx 1000 km/h
      speed_suspicion: speedAnalysis.suspicion,
      is_impossible_speed: speedAnalysis.feasible ? 0 : 1,
      
      // Tiempo entre transacciones
      time_factor: timeMinutes > 0 ? Math.min(timeMinutes / 1440, 1) : 1, // Normalizar a 24h máx
      very_quick_succession: timeMinutes < 5 ? 1 : 0, // Menos de 5 minutos
      
      // Contexto de la transacción
      amount_normalized: Math.min(Math.log10(variables.amount + 1) / 6, 1),
      is_high_amount: variables.amount > 5000 ? 1 : 0,
      
      // Información geográfica
      is_international: !variables.is_domestic ? 1 : 0,
      same_country: variables.country === variables.prev_country ? 1 : 0,
      
      // Historial del cliente
      client_experience: Math.min(variables.client_age_days / 365, 1),
      location_diversity: Math.min(variables.historical_location_count / 20, 1),
      travel_frequency: Math.min(variables.avg_transactions_per_day, 1),
      
      // Patrones temporales
      is_night_transaction: variables.is_night_transaction ? 1 : 0,
      is_weekend: variables.is_weekend ? 1 : 0,
      
      // Indicadores de riesgo calculados
      distance_time_ratio: distance > 0 && timeMinutes > 0 ? 
        Math.min(distance / (timeMinutes / 60), 1000) / 1000 : 0, // Ratio normalizado
      
      // Patrón de movilidad del cliente
      is_frequent_traveler: variables.historical_location_count > 10 ? 1 : 0,
      unusual_for_client: this.isUnusualDistanceForClient(variables, distance)
    };
    
    return input;
  }

  /**
   * Determino si la distancia es inusual para este cliente específico
   * @param {Object} variables - Variables de la transacción
   * @param {number} distance - Distancia actual
   * @returns {number} - 1 si es inusual, 0 si no
   */
  isUnusualDistanceForClient(variables, distance) {
    // Si el cliente normalmente es local pero ahora viaja lejos
    if (variables.historical_location_count <= 2 && distance > 100) {
      return 1;
    }
    
    // Si el cliente nunca ha viajado internacionalmente
    if (variables.unique_countries <= 1 && !variables.is_domestic) {
      return 1;
    }
    
    // Si es una distancia extrema comparada con la experiencia del cliente
    if (distance > 1000 && variables.historical_location_count < 5) {
      return 1;
    }
    
    return 0;
  }

  /**
   * Analizo la distancia de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis de distancia no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'distance',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de distancia completado: Score=${suspicionScore.toFixed(3)}, Distancia=${transactionData.variables.distance_from_prev?.toFixed(1)}km`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de distancia:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico de distancia
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    const distance = variables.distance_from_prev || 0;
    const timeMinutes = variables.time_since_prev_transaction || 0;
    let suspicionScore = 0;
    const reasons = [];
    
    if (distance === 0) {
      return {
        network_id: this.networkId + '_heuristic',
        variable: 'distance',
        suspicion_score: 0,
        confidence: 0.5,
        reasons: ['Sin transacción previa para comparar distancia'],
        processing_time_ms: 2
      };
    }
    
    // Calcular velocidad requerida
    const requiredSpeed = this.calculateRequiredSpeed(distance, timeMinutes);
    const speedAnalysis = this.analyzeSpeedFeasibility(requiredSpeed);
    
    // Regla 1: Velocidad físicamente imposible
    if (!speedAnalysis.feasible) {
      suspicionScore += 0.9;
      reasons.push(`Velocidad imposible: ${requiredSpeed.toFixed(0)} km/h para ${distance.toFixed(1)}km en ${timeMinutes.toFixed(1)} min`);
    } else if (requiredSpeed > this.maxSpeeds.car) {
      suspicionScore += 0.6;
      reasons.push(`Velocidad muy alta: ${requiredSpeed.toFixed(0)} km/h (requiere ${speedAnalysis.method})`);
    }
    
    // Regla 2: Distancia extrema en poco tiempo
    if (distance > 500 && timeMinutes < 120) { // 500km en menos de 2 horas
      suspicionScore += 0.7;
      reasons.push(`Distancia extrema en poco tiempo: ${distance.toFixed(1)}km en ${timeMinutes.toFixed(1)} min`);
    }
    
    // Regla 3: Cliente local que de repente viaja muy lejos
    if (variables.historical_location_count <= 2 && distance > 200) {
      suspicionScore += 0.5;
      reasons.push(`Cliente normalmente local ahora a ${distance.toFixed(1)}km`);
    }
    
    // Regla 4: Transacciones muy seguidas a gran distancia
    if (distance > 100 && timeMinutes < 30) {
      suspicionScore += 0.6;
      reasons.push(`Gran distancia en muy poco tiempo: ${distance.toFixed(1)}km en ${timeMinutes.toFixed(1)} min`);
    }
    
    // Regla 5: Primera transacción internacional con gran distancia
    if (variables.unique_countries <= 1 && !variables.is_domestic && distance > 1000) {
      suspicionScore += 0.4;
      reasons.push(`Primera transacción internacional a gran distancia: ${distance.toFixed(1)}km`);
    }
    
    // Regla 6: Monto alto con distancia sospechosa
    if (variables.amount > 5000 && distance > 500 && timeMinutes < 180) {
      suspicionScore += 0.3;
      reasons.push(`Monto alto con viaje sospechoso: $${variables.amount} a ${distance.toFixed(1)}km`);
    }
    
    // Regla 7: Cliente nuevo con patrones de viaje anómalos
    if (variables.client_age_days < 30 && distance > 300) {
      suspicionScore += 0.3;
      reasons.push(`Cliente nuevo con viaje de ${distance.toFixed(1)}km`);
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'distance',
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
    const distance = transactionData.variables.distance_from_prev || 0;
    
    if (score > 0.7) {
      if (input.is_impossible_speed) reasons.push('Velocidad físicamente imposible');
      if (input.is_global) reasons.push(`Distancia global: ${distance.toFixed(1)}km`);
      if (input.very_quick_succession && input.distance_normalized > 0.5) {
        reasons.push('Gran distancia en muy poco tiempo');
      }
    } else if (score > 0.5) {
      if (input.speed_suspicion > 0.6) reasons.push('Velocidad de viaje muy alta');
      if (input.is_continental) reasons.push(`Distancia continental: ${distance.toFixed(1)}km`);
      if (input.unusual_for_client) reasons.push('Distancia inusual para este cliente');
    } else if (score > 0.3) {
      if (input.is_national && input.time_factor < 0.2) {
        reasons.push('Distancia nacional en poco tiempo');
      }
      if (input.is_international && !input.is_frequent_traveler) {
        reasons.push('Viaje internacional para cliente no viajero');
      }
    }
    
    return reasons;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.7; // Confianza base media-alta
    
    // Mayor confianza si tenemos información de tiempo
    if (input.time_factor > 0) {
      confidence += 0.2;
    }
    
    // Mayor confianza si el cliente tiene historial
    if (input.client_experience > 0.1) {
      confidence += 0.1;
    }
    
    // Menor confianza si la distancia es 0 (sin punto de comparación)
    if (input.distance_normalized === 0) {
      confidence -= 0.3;
    }
    
    return Math.max(confidence, 0.4);
  }

  /**
   * Entreno la red con datos históricos
   * @param {Array} trainingData - Datos de entrenamiento
   * @returns {Object} - Resultado del entrenamiento
   */
  async train(trainingData) {
    try {
      logger.info(`Iniciando entrenamiento de red de análisis de distancia con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de distancia completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de distancia:', error);
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
      variable_analyzed: 'distance',
      distance_thresholds: this.distanceThresholds,
      max_speeds: this.maxSpeeds
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
      
      if (modelData.distance_thresholds) {
        this.distanceThresholds = modelData.distance_thresholds;
      }
      if (modelData.max_speeds) {
        this.maxSpeeds = modelData.max_speeds;
      }
      
      logger.info(`Modelo de análisis de distancia cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis de distancia:', error);
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
      variable: 'distance',
      description: 'Analiza la distancia geográfica y velocidad de viaje entre transacciones para detectar imposibilidades físicas',
      distance_categories: Object.keys(this.distanceThresholds),
      transport_methods: Object.keys(this.maxSpeeds)
    };
  }
}

module.exports = DistanceAnalyzer;