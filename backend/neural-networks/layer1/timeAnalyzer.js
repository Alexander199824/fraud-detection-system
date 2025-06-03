const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.3 - Análisis de Hora del Día
 * Esta red analiza si la hora de una transacción es sospechosa
 */
class TimeAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'time_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
  }

  /**
   * Preparo los datos temporales para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    const hour = variables.hour_of_day;
    
    const input = {
      // Hora normalizada (0-23 -> 0-1)
      hour_normalized: hour / 23,
      
      // Patrones circulares para capturar la naturaleza cíclica del tiempo
      hour_sin: Math.sin(2 * Math.PI * hour / 24),
      hour_cos: Math.cos(2 * Math.PI * hour / 24),
      
      // Categorías de tiempo
      is_business_hours: (hour >= 9 && hour <= 17) ? 1 : 0, // 9 AM - 5 PM
      is_evening: (hour >= 18 && hour <= 22) ? 1 : 0, // 6 PM - 10 PM
      is_night: (hour >= 23 || hour <= 5) ? 1 : 0, // 11 PM - 5 AM
      is_early_morning: (hour >= 6 && hour <= 8) ? 1 : 0, // 6 AM - 8 AM
      
      // Contexto de fin de semana/día laboral
      is_weekend: variables.is_weekend ? 1 : 0,
      is_night_transaction: variables.is_night_transaction ? 1 : 0,
      
      // Patrón histórico del cliente (si disponible)
      client_age_days: Math.min(variables.client_age_days / 365, 1), // Normalizar a años
    };
    
    return input;
  }

  /**
   * Analizo la hora de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis temporal no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'time',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis temporal completado: Score=${suspicionScore.toFixed(3)}, Hora=${transactionData.variables.hour_of_day}:00`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis temporal:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico temporal
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    const hour = variables.hour_of_day;
    let suspicionScore = 0;
    const reasons = [];
    
    // Regla 1: Transacciones en horarios muy inusuales (2 AM - 5 AM)
    if (hour >= 2 && hour <= 5) {
      suspicionScore += 0.6;
      reasons.push(`Transacción en horario muy inusual: ${hour}:00`);
    }
    
    // Regla 2: Transacciones nocturnas (11 PM - 1 AM)
    else if (hour >= 23 || hour <= 1) {
      suspicionScore += 0.3;
      reasons.push(`Transacción nocturna: ${hour}:00`);
    }
    
    // Regla 3: Transacciones muy tempranas (5 AM - 6 AM)
    else if (hour >= 5 && hour <= 6) {
      suspicionScore += 0.2;
      reasons.push(`Transacción muy temprano: ${hour}:00`);
    }
    
    // Regla 4: Transacciones en fin de semana fuera de horario normal
    if (variables.is_weekend && (hour < 8 || hour > 22)) {
      suspicionScore += 0.2;
      reasons.push(`Transacción en fin de semana fuera de horario normal: ${hour}:00`);
    }
    
    // Regla 5: Cliente nuevo con transacciones nocturnas
    if (variables.client_age_days < 7 && variables.is_night_transaction) {
      suspicionScore += 0.4;
      reasons.push('Cliente nuevo con transacción nocturna');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'time',
      suspicion_score: Math.min(suspicionScore, 1),
      confidence: 0.8,
      reasons: reasons,
      processing_time_ms: 3
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
    const hour = transactionData.variables.hour_of_day;
    
    if (score > 0.7) {
      if (input.is_night) reasons.push(`Horario nocturno inusual: ${hour}:00`);
      if (input.is_weekend && !input.is_business_hours) {
        reasons.push('Fin de semana fuera de horario normal');
      }
    } else if (score > 0.5) {
      if (input.is_early_morning) reasons.push(`Muy temprano en la mañana: ${hour}:00`);
      if (input.is_night_transaction) reasons.push('Transacción nocturna');
    } else if (score > 0.3) {
      if (!input.is_business_hours && !input.is_evening) {
        reasons.push('Fuera del horario comercial normal');
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
    let confidence = 0.9; // Alta confianza base para análisis temporal
    
    // Menor confianza si es cliente muy nuevo (datos insuficientes)
    if (input.client_age_days < 0.1) { // Menos de ~36 días
      confidence -= 0.2;
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
      logger.info(`Iniciando entrenamiento de red de análisis temporal con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red temporal completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red temporal:', error);
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
      variable_analyzed: 'time'
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
      
      logger.info(`Modelo de análisis temporal cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis temporal:', error);
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
      variable: 'time',
      description: 'Analiza la hora del día de transacciones para detectar patrones temporales anómalos'
    };
  }
}

module.exports = TimeAnalyzer;