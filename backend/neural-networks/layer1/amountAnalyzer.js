const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 1.1 - Análisis de Monto de Transacción
 * Esta red analiza específicamente si el monto de una transacción es sospechoso
 */
class AmountAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [8, 6, 4], // Capa de entrada, oculta, salida
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'amount_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
  }

  /**
   * Preparo los datos de monto para análisis
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Datos normalizados para la red
   */
  prepareInput(transactionData) {
    const { variables } = transactionData;
    
    // Normalizo las variables de monto (valores entre 0 y 1)
    const input = {
      // Monto absoluto normalizado (log scale para manejar rangos amplios)
      amount_normalized: Math.min(Math.log10(variables.amount + 1) / 6, 1), // Max log10(1M) = 6
      
      // Ratio con respecto al promedio histórico
      amount_vs_avg: Math.min(variables.amount_ratio_to_avg / 10, 1), // Max 10x el promedio
      
      // Ratio con respecto al máximo histórico
      amount_vs_max: Math.min(variables.amount_ratio_to_max, 1),
      
      // Indicadores de montos extremos
      is_very_small: variables.amount < 1 ? 1 : 0, // Transacciones de menos de $1
      is_small: variables.amount < 50 ? 1 : 0, // Transacciones pequeñas
      is_large: variables.amount > 5000 ? 1 : 0, // Transacciones grandes
      is_very_large: variables.amount > 20000 ? 1 : 0, // Transacciones muy grandes
      
      // Contexto del cliente
      client_age_factor: Math.min(variables.client_age_days / 365, 1), // Max 1 año normalizado
    };
    
    return input;
  }

  /**
   * Analizo el monto de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado del análisis
   */
  async analyze(transactionData) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red de análisis de monto no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData);
      }
      
      const input = this.prepareInput(transactionData);
      const output = this.network.run(input);
      const suspicionScore = Array.isArray(output) ? output[0] : output;
      
      // Genero razones específicas basadas en el análisis
      const reasons = this.generateReasons(transactionData, input, suspicionScore);
      
      const result = {
        network_id: this.networkId,
        variable: 'amount',
        suspicion_score: suspicionScore,
        confidence: this.calculateConfidence(input),
        reasons: reasons,
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis de monto completado: Score=${suspicionScore.toFixed(3)}, Monto=$${transactionData.variables.amount}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis de monto:', error);
      return this.heuristicAnalysis(transactionData);
    }
  }

  /**
   * Análisis heurístico cuando la red no está entrenada
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData) {
    const { variables } = transactionData;
    let suspicionScore = 0;
    const reasons = [];
    
    // Regla 1: Montos muy pequeños (posible prueba de tarjeta)
    if (variables.amount < 1) {
      suspicionScore += 0.7;
      reasons.push('Monto extremadamente pequeño (< $1)');
    } else if (variables.amount < 5) {
      suspicionScore += 0.4;
      reasons.push('Monto muy pequeño (< $5)');
    }
    
    // Regla 2: Montos muy grandes
    if (variables.amount > 20000) {
      suspicionScore += 0.8;
      reasons.push('Monto extremadamente alto (> $20,000)');
    } else if (variables.amount > 10000) {
      suspicionScore += 0.5;
      reasons.push('Monto alto (> $10,000)');
    }
    
    // Regla 3: Comparación con historial
    if (variables.amount_ratio_to_avg > 10) {
      suspicionScore += 0.6;
      reasons.push(`Monto ${variables.amount_ratio_to_avg.toFixed(1)}x mayor que promedio histórico`);
    } else if (variables.amount_ratio_to_avg > 5) {
      suspicionScore += 0.3;
      reasons.push(`Monto ${variables.amount_ratio_to_avg.toFixed(1)}x mayor que promedio histórico`);
    }
    
    // Regla 4: Cliente nuevo con transacción grande
    if (variables.client_age_days < 30 && variables.amount > 1000) {
      suspicionScore += 0.4;
      reasons.push('Cliente nuevo con transacción grande');
    }
    
    return {
      network_id: this.networkId + '_heuristic',
      variable: 'amount',
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
      if (input.is_very_small) reasons.push('Monto extremadamente pequeño');
      if (input.is_very_large) reasons.push('Monto extremadamente alto');
      if (input.amount_vs_avg > 0.5) reasons.push('Monto muy superior al histórico');
    } else if (score > 0.5) {
      if (input.is_small) reasons.push('Monto pequeño inusual');
      if (input.is_large) reasons.push('Monto alto');
      if (input.amount_vs_avg > 0.3) reasons.push('Monto superior al histórico');
    }
    
    return reasons;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.8; // Base
    
    // Mayor confianza si tenemos datos históricos
    if (input.amount_vs_avg > 0 && input.amount_vs_max > 0) {
      confidence += 0.1;
    }
    
    // Mayor confianza si el cliente no es nuevo
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
      logger.info(`Iniciando entrenamiento de red de análisis de monto con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => ({
        input: this.prepareInput(data),
        output: [data.fraud_score || 0]
      }));
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red de monto completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red de monto:', error);
      throw error;
    }
  }

  /**
   * Guardo el modelo entrenado
   * @returns {Object} - Datos del modelo para persistencia
   */
  exportModel() {
    return {
      network_id: this.networkId,
      version: this.version,
      trained_model: this.network.toJSON(),
      is_trained: this.isTrained,
      last_training_date: this.lastTrainingDate,
      variable_analyzed: 'amount'
    };
  }

  /**
   * Cargo un modelo previamente entrenado
   * @param {Object} modelData - Datos del modelo
   */
  importModel(modelData) {
    try {
      this.network.fromJSON(modelData.trained_model);
      this.isTrained = true;
      this.lastTrainingDate = new Date(modelData.last_training_date);
      this.version = modelData.version;
      
      logger.info(`Modelo de análisis de monto cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo de análisis de monto:', error);
      throw error;
    }
  }

  /**
   * Obtengo estadísticas del modelo
   * @returns {Object} - Estadísticas del modelo
   */
  getStats() {
    return {
      network_id: this.networkId,
      version: this.version,
      is_trained: this.isTrained,
      last_training_date: this.lastTrainingDate,
      variable: 'amount',
      description: 'Analiza el monto de transacciones para detectar patrones fraudulentos'
    };
  }
}

module.exports = AmountAnalyzer;