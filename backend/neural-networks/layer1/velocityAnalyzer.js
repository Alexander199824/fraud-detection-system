const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.6 - Análisis de Velocidad de Transacciones
 * Esta red analiza la velocidad/frecuencia de transacciones para detectar patrones anómalos
 */
class VelocityAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'velocity_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Umbrales normales para comparación
    this.normalThresholds = {
      maxTransactionsPerHour: 5,
      maxTransactionsPerDay: 20,
      minTimeBetweenTransactions: 60, // segundos
      maxDailyAmount: 10000
    };
  }

  /**
   * Preparo los datos de velocidad para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    
    const input = {
      // Transacciones por período
      transactions_last_hour: Math.min(variables.transactions_last_hour / 10, 1), // Max 10 normalizado
      transactions_last_24h: Math.min(variables.transactions_last_24h / 50, 1), // Max 50 normalizado
      
      // Tiempo entre transacciones
      time_since_prev_minutes: variables.time_since_prev_transaction > 0 
        ? Math.min(variables.time_since_prev_transaction / 1440, 1) // Max 24 horas (1440 min)
        : 1, // Si no hay transacción previa, asumir tiempo máximo
      
      // Velocidad de gasto
      amount_last_24h: Math.min((variables.amount_last_24h || 0) / 20000, 1), // Max $20,000
      amount_velocity: variables.amount_last_24h > 0 
        ? Math.min(variables.amount / variables.amount_last_24h, 1)
        : 0,
      
      // Frecuencia promedio del cliente
      avg_transactions_per_day: Math.min(variables.avg_transactions_per_day / 10, 1), // Max 10 por día
      
      // Ratio actual vs promedio histórico
      current_vs_avg_frequency: variables.avg_transactions_per_day > 0
        ? Math.min(variables.transactions_last_24h / variables.avg_transactions_per_day, 2) / 2 // Max 2x promedio
        : 1,
      
      // Indicadores de actividad anómala
      burst_activity: this.calculateBurstActivity(variables),
      rapid_succession: variables.time_since_prev_transaction < 5 ? 1 : 0, // Menos de 5 minutos
      
      // Contexto del cliente
      client_age_factor: Math.min(variables.client_age_days / 365, 1),
      has_transaction_history: variables.historical_transaction_count > 0 ? 1 : 0
    };
    
    return input;
  }

  /**
   * Calculo actividad en ráfaga (burst activity)
   * @param {Object} variables - Variables de la transacción
   * @returns {number} - Score de actividad en ráfaga (0-1)
   */
  calculateBurstActivity(variables) {
    const hourlyRate = variables.transactions_last_hour;
    const dailyRate = variables.transactions_last_24h / 24; // Promedio por hora en el día
    
    if (dailyRate === 0) return 0;
    
    // Si la actividad en la última hora es mucho mayor que el promedio diario
    const burstRatio = hourlyRate / Math.max(dailyRate, 0.1);
    return Math.min(burstRatio / 10, 1); // Normalizar
  }

  /**
   * Analizo la velocidad de transacciones
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis de velocidad no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'velocity',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de velocidad completado: Score=${suspicionScore.toFixed(3)}, Trans/hora=${transactionData.variables.transactions_last_hour}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de velocidad:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico de velocidad
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    let suspicionScore = 0;
    const reasons = [];
    
    // Regla 1: Demasiadas transacciones por hora
    if (variables.transactions_last_hour >= 8) {
      suspicionScore += 0.8;
      reasons.push(`Actividad muy alta: ${variables.transactions_last_hour} transacciones en la última hora`);
    } else if (variables.transactions_last_hour >= 5) {
      suspicionScore += 0.5;
      reasons.push(`Actividad alta: ${variables.transactions_last_hour} transacciones en la última hora`);
    }
    
    // Regla 2: Demasiadas transacciones por día
    if (variables.transactions_last_24h >= 30) {
      suspicionScore += 0.7;
      reasons.push(`Actividad diaria muy alta: ${variables.transactions_last_24h} transacciones en 24h`);
    } else if (variables.transactions_last_24h >= 15) {
      suspicionScore += 0.4;
      reasons.push(`Actividad diaria alta: ${variables.transactions_last_24h} transacciones en 24h`);
    }
    
    // Regla 3: Transacciones muy seguidas
    if (variables.time_since_prev_transaction < 2) {
      suspicionScore += 0.6;
      reasons.push(`Transacciones muy seguidas: ${variables.time_since_prev_transaction.toFixed(1)} minutos`);
    } else if (variables.time_since_prev_transaction < 5) {
      suspicionScore += 0.3;
      reasons.push(`Transacciones seguidas: ${variables.time_since_prev_transaction.toFixed(1)} minutos`);
    }
    
    // Regla 4: Mucho gasto en poco tiempo
    const amount24h = variables.amount_last_24h || 0;
    if (amount24h > 15000) {
      suspicionScore += 0.6;
      reasons.push(`Gasto alto en 24h: $${amount24h.toFixed(2)}`);
    } else if (amount24h > 8000) {
      suspicionScore += 0.3;
      reasons.push(`Gasto moderado en 24h: $${amount24h.toFixed(2)}`);
    }
    
    // Regla 5: Actividad anómala para cliente nuevo
    if (variables.client_age_days < 7 && variables.transactions_last_24h > 5) {
      suspicionScore += 0.4;
      reasons.push('Cliente nuevo con alta actividad');
    }
    
    // Regla 6: Actividad muy superior al patrón histórico
    if (variables.avg_transactions_per_day > 0) {
      const activityRatio = variables.transactions_last_24h / variables.avg_transactions_per_day;
      if (activityRatio > 5) {
        suspicionScore += 0.5;
        reasons.push(`Actividad ${activityRatio.toFixed(1)}x mayor que promedio histórico`);
      } else if (activityRatio > 3) {
        suspicionScore += 0.3;
        reasons.push(`Actividad ${activityRatio.toFixed(1)}x mayor que promedio histórico`);
      }
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'velocity',
      suspicion_score: Math.min(suspicionScore, 1),
      confidence: 0.8,
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
    const { variables } = transactionData;
    
    if (score > 0.7) {
      if (input.transactions_last_hour > 0.5) {
        reasons.push(`Actividad muy alta: ${variables.transactions_last_hour} transacciones/hora`);
      }
      if (input.rapid_succession) {
        reasons.push(`Transacciones en rápida sucesión`);
      }
      if (input.burst_activity > 0.6) {
        reasons.push('Patrón de actividad en ráfagas');
      }
    } else if (score > 0.5) {
      if (input.transactions_last_24h > 0.4) {
        reasons.push(`Alta actividad diaria: ${variables.transactions_last_24h} transacciones`);
      }
      if (input.current_vs_avg_frequency > 0.6) {
        reasons.push('Frecuencia muy superior al histórico');
      }
      if (input.amount_last_24h > 0.4) {
        reasons.push(`Alto gasto diario: $${variables.amount_last_24h || 0}`);
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
    let confidence = 0.8;
    
    // Mayor confianza si tenemos historial de transacciones
    if (input.has_transaction_history) {
      confidence += 0.1;
    }
    
    // Mayor confianza si el cliente no es muy nuevo
    if (input.client_age_factor > 0.1) {
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
      logger.info(`Iniciando entrenamiento de red de análisis de velocidad con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de velocidad completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de velocidad:', error);
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
      variable_analyzed: 'velocity',
      normal_thresholds: this.normalThresholds
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
      
      if (modelData.normal_thresholds) {
        this.normalThresholds = { ...this.normalThresholds, ...modelData.normal_thresholds };
      }
      
      logger.info(`Modelo de análisis de velocidad cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis de velocidad:', error);
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
      variable: 'velocity',
      description: 'Analiza la velocidad y frecuencia de transacciones para detectar patrones anómalos',
      normal_thresholds: this.normalThresholds
    };
  }
}

module.exports = VelocityAnalyzer;