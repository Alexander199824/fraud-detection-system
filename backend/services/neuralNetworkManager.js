const NetworkManager = require('../neural-networks/networkManager');
const { logger } = require('../config');
const fs = require('fs').promises;
const path = require('path');

/**
 * Servicio de administración de redes neuronales
 * Proporciona una interfaz de alto nivel para gestionar las redes neuronales modulares
 */
class NeuralNetworkManagerService {
  constructor() {
    this.networkManager = new NetworkManager();
    this.modelsPath = path.join(__dirname, '../../models');
    this.isInitialized = false;
    this.trainingQueue = [];
    this.isTraining = false;
    
    // Configuración del servicio
    this.config = {
      autoSaveModels: true,
      autoLoadModels: true,
      modelSaveInterval: 3600000, // 1 hora
      trainingBatchSize: 1000,
      minTrainingSamples: 100
    };
    
    // Inicializar servicio
    this.initialize();
  }

  /**
   * Inicializar el servicio
   */
  async initialize() {
    try {
      logger.info('Inicializando servicio de redes neuronales...');
      
      // Crear directorio de modelos si no existe
      await this.ensureModelsDirectory();
      
      // Cargar modelos guardados si está habilitado
      if (this.config.autoLoadModels) {
        await this.loadAllModels();
      }
      
      // Configurar guardado automático
      if (this.config.autoSaveModels) {
        this.startAutoSave();
      }
      
      this.isInitialized = true;
      logger.info('Servicio de redes neuronales inicializado correctamente');
      
    } catch (error) {
      logger.error('Error al inicializar servicio de redes neuronales:', error);
      throw error;
    }
  }

  /**
   * Asegurar que existe el directorio de modelos
   */
  async ensureModelsDirectory() {
    try {
      await fs.access(this.modelsPath);
    } catch (error) {
      await fs.mkdir(this.modelsPath, { recursive: true });
      logger.info(`Directorio de modelos creado: ${this.modelsPath}`);
    }
  }

  /**
   * Analizar transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Promise<Object>} - Resultado del análisis
   */
  async analyzeTransaction(transactionData) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return await this.networkManager.analyzeTransaction(transactionData);
  }

  /**
   * Entrenar todas las redes con datos históricos
   * @param {Array} trainingData - Datos de entrenamiento
   * @returns {Promise<Object>} - Resultado del entrenamiento
   */
  async trainAllNetworks(trainingData) {
    try {
      if (trainingData.length < this.config.minTrainingSamples) {
        throw new Error(`Se requieren al menos ${this.config.minTrainingSamples} muestras para entrenamiento`);
      }
      
      logger.info(`Iniciando entrenamiento con ${trainingData.length} muestras`);
      
      // Agregar a la cola de entrenamiento
      this.trainingQueue.push({
        data: trainingData,
        timestamp: new Date(),
        status: 'pending'
      });
      
      // Procesar cola de entrenamiento
      const result = await this.processTrainingQueue();
      
      // Guardar modelos después del entrenamiento
      if (this.config.autoSaveModels && result.success) {
        await this.saveAllModels();
      }
      
      return result;
      
    } catch (error) {
      logger.error('Error en entrenamiento de redes:', error);
      throw error;
    }
  }

  /**
   * Procesar cola de entrenamiento
   * @returns {Promise<Object>} - Resultado del procesamiento
   */
  async processTrainingQueue() {
    if (this.isTraining || this.trainingQueue.length === 0) {
      return { success: false, message: 'No hay entrenamientos pendientes o ya hay uno en proceso' };
    }
    
    this.isTraining = true;
    
    try {
      const trainingJob = this.trainingQueue.shift();
      trainingJob.status = 'processing';
      
      // Dividir datos en lotes si es necesario
      const batches = this.createTrainingBatches(trainingJob.data);
      
      logger.info(`Procesando entrenamiento en ${batches.length} lotes`);
      
      let allResults = {
        layer1: {},
        layer2: {},
        layer3: {},
        output: {},
        summary: {
          total_networks: 0,
          successful_trainings: 0,
          failed_trainings: 0,
          total_time_ms: 0
        }
      };
      
      const startTime = Date.now();
      
      // Entrenar por lotes
      for (let i = 0; i < batches.length; i++) {
        logger.info(`Procesando lote ${i + 1}/${batches.length}`);
        
        const batchResult = await this.networkManager.trainAllNetworks(batches[i]);
        
        // Combinar resultados
        this.mergeTrainingResults(allResults, batchResult);
        
        // Pequeña pausa entre lotes
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      allResults.summary.total_time_ms = Date.now() - startTime;
      
      trainingJob.status = 'completed';
      trainingJob.result = allResults;
      
      logger.info(`Entrenamiento completado: ${allResults.summary.successful_trainings}/${allResults.summary.total_networks} redes entrenadas exitosamente`);
      
      return {
        success: true,
        result: allResults
      };
      
    } catch (error) {
      logger.error('Error procesando cola de entrenamiento:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Crear lotes de entrenamiento
   * @param {Array} data - Datos completos
   * @returns {Array} - Array de lotes
   */
  createTrainingBatches(data) {
    const batches = [];
    const batchSize = this.config.trainingBatchSize;
    
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Combinar resultados de entrenamiento
   * @param {Object} allResults - Resultados acumulados
   * @param {Object} batchResult - Resultado del lote actual
   */
  mergeTrainingResults(allResults, batchResult) {
    // Combinar resultados por capa
    Object.keys(batchResult).forEach(key => {
      if (key === 'summary') {
        // Combinar sumario
        allResults.summary.total_networks = Math.max(
          allResults.summary.total_networks,
          batchResult.summary.total_networks
        );
        allResults.summary.successful_trainings += batchResult.summary.successful_trainings;
        allResults.summary.failed_trainings += batchResult.summary.failed_trainings;
      } else {
        // Combinar resultados de capas
        Object.assign(allResults[key], batchResult[key]);
      }
    });
  }

  /**
   * Guardar todos los modelos entrenados
   * @returns {Promise<Object>} - Resultado del guardado
   */
  async saveAllModels() {
    try {
      logger.info('Guardando modelos de redes neuronales...');
      
      const savedModels = {
        layer1: {},
        layer2: {},
        layer3: {},
        output: null,
        metadata: {
          saved_at: new Date().toISOString(),
          version: this.networkManager.version,
          network_count: 0
        }
      };
      
      // Guardar modelos de Capa 1
      for (const [name, network] of Object.entries(this.networkManager.layer1Networks)) {
        const modelData = network.exportModel();
        const filename = `layer1_${name}.json`;
        await this.saveModel(filename, modelData);
        savedModels.layer1[name] = filename;
      }
      
      // Guardar modelos de Capa 2
      for (const [name, network] of Object.entries(this.networkManager.layer2Networks)) {
        const modelData = network.exportModel();
        const filename = `layer2_${name}.json`;
        await this.saveModel(filename, modelData);
        savedModels.layer2[name] = filename;
      }
      
      // Guardar modelos de Capa 3
      for (const [name, network] of Object.entries(this.networkManager.layer3Networks)) {
        const modelData = network.exportModel();
        const filename = `layer3_${name}.json`;
        await this.saveModel(filename, modelData);
        savedModels.layer3[name] = filename;
      }
      
      // Guardar modelo de salida
      if (this.networkManager.outputNetwork) {
        const modelData = this.networkManager.outputNetwork.exportModel();
        const filename = 'output_fraud_decision.json';
        await this.saveModel(filename, modelData);
        savedModels.output = filename;
      }
      
      // Guardar metadatos
      savedModels.metadata.network_count = 
        Object.keys(savedModels.layer1).length +
        Object.keys(savedModels.layer2).length +
        Object.keys(savedModels.layer3).length +
        (savedModels.output ? 1 : 0);
      
      await this.saveModel('models_metadata.json', savedModels);
      
      logger.info(`${savedModels.metadata.network_count} modelos guardados exitosamente`);
      
      return {
        success: true,
        models_saved: savedModels.metadata.network_count,
        path: this.modelsPath
      };
      
    } catch (error) {
      logger.error('Error al guardar modelos:', error);
      throw error;
    }
  }

  /**
   * Guardar un modelo individual
   * @param {string} filename - Nombre del archivo
   * @param {Object} modelData - Datos del modelo
   */
  async saveModel(filename, modelData) {
    const filepath = path.join(this.modelsPath, filename);
    await fs.writeFile(filepath, JSON.stringify(modelData, null, 2));
    logger.debug(`Modelo guardado: ${filename}`);
  }

  /**
   * Cargar todos los modelos guardados
   * @returns {Promise<Object>} - Resultado de la carga
   */
  async loadAllModels() {
    try {
      logger.info('Cargando modelos de redes neuronales...');
      
      const metadataPath = path.join(this.modelsPath, 'models_metadata.json');
      
      // Verificar si existen modelos guardados
      try {
        await fs.access(metadataPath);
      } catch (error) {
        logger.info('No se encontraron modelos guardados');
        return { success: true, models_loaded: 0 };
      }
      
      // Cargar metadatos
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      let modelsLoaded = 0;
      
      // Cargar modelos de Capa 1
      for (const [name, filename] of Object.entries(metadata.layer1)) {
        try {
          const modelData = await this.loadModel(filename);
          this.networkManager.layer1Networks[name].importModel(modelData);
          modelsLoaded++;
        } catch (error) {
          logger.error(`Error cargando modelo ${filename}:`, error);
        }
      }
      
      // Cargar modelos de Capa 2
      for (const [name, filename] of Object.entries(metadata.layer2)) {
        try {
          const modelData = await this.loadModel(filename);
          this.networkManager.layer2Networks[name].importModel(modelData);
          modelsLoaded++;
        } catch (error) {
          logger.error(`Error cargando modelo ${filename}:`, error);
        }
      }
      
      // Cargar modelos de Capa 3
      for (const [name, filename] of Object.entries(metadata.layer3)) {
        try {
          const modelData = await this.loadModel(filename);
          this.networkManager.layer3Networks[name].importModel(modelData);
          modelsLoaded++;
        } catch (error) {
          logger.error(`Error cargando modelo ${filename}:`, error);
        }
      }
      
      // Cargar modelo de salida
      if (metadata.output) {
        try {
          const modelData = await this.loadModel(metadata.output);
          this.networkManager.outputNetwork.importModel(modelData);
          modelsLoaded++;
        } catch (error) {
          logger.error(`Error cargando modelo de salida:`, error);
        }
      }
      
      logger.info(`${modelsLoaded} modelos cargados exitosamente`);
      
      return {
        success: true,
        models_loaded: modelsLoaded,
        metadata: metadata.metadata
      };
      
    } catch (error) {
      logger.error('Error al cargar modelos:', error);
      return {
        success: false,
        models_loaded: 0,
        error: error.message
      };
    }
  }

  /**
   * Cargar un modelo individual
   * @param {string} filename - Nombre del archivo
   * @returns {Promise<Object>} - Datos del modelo
   */
  async loadModel(filename) {
    const filepath = path.join(this.modelsPath, filename);
    const content = await fs.readFile(filepath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Iniciar guardado automático de modelos
   */
  startAutoSave() {
    this.autoSaveInterval = setInterval(async () => {
      try {
        await this.saveAllModels();
        logger.info('Guardado automático de modelos completado');
      } catch (error) {
        logger.error('Error en guardado automático:', error);
      }
    }, this.config.modelSaveInterval);
    
    logger.info('Guardado automático de modelos activado');
  }

  /**
   * Detener guardado automático
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      logger.info('Guardado automático de modelos desactivado');
    }
  }

  /**
   * Obtener estadísticas del servicio
   * @returns {Object} - Estadísticas
   */
  getStats() {
    const networkStats = this.networkManager.getStats();
    
    return {
      service: {
        version: '1.0.0',
        is_initialized: this.isInitialized,
        is_training: this.isTraining,
        training_queue_size: this.trainingQueue.length,
        auto_save_enabled: this.config.autoSaveModels,
        auto_load_enabled: this.config.autoLoadModels
      },
      network_manager: networkStats,
      models: {
        path: this.modelsPath,
        last_save: this.lastSaveTime,
        last_load: this.lastLoadTime
      }
    };
  }

  /**
   * Obtener información de una red específica
   * @param {string} layer - Capa de la red
   * @param {string} networkName - Nombre de la red
   * @returns {Object} - Información de la red
   */
  getNetworkInfo(layer, networkName) {
    let network = null;
    
    switch (layer) {
      case 'layer1':
        network = this.networkManager.layer1Networks[networkName];
        break;
      case 'layer2':
        network = this.networkManager.layer2Networks[networkName];
        break;
      case 'layer3':
        network = this.networkManager.layer3Networks[networkName];
        break;
      case 'output':
        network = this.networkManager.outputNetwork;
        break;
    }
    
    if (!network) {
      return null;
    }
    
    return network.getStats();
  }

  /**
   * Resetear una red específica
   * @param {string} layer - Capa de la red
   * @param {string} networkName - Nombre de la red
   * @returns {boolean} - Éxito
   */
  resetNetwork(layer, networkName) {
    try {
      let network = null;
      
      switch (layer) {
        case 'layer1':
          network = this.networkManager.layer1Networks[networkName];
          break;
        case 'layer2':
          network = this.networkManager.layer2Networks[networkName];
          break;
        case 'layer3':
          network = this.networkManager.layer3Networks[networkName];
          break;
        case 'output':
          network = this.networkManager.outputNetwork;
          break;
      }
      
      if (!network) {
        return false;
      }
      
      // Resetear la red
      network.isTrained = false;
      network.lastTrainingDate = null;
      
      logger.info(`Red ${layer}/${networkName} reseteada`);
      return true;
      
    } catch (error) {
      logger.error(`Error al resetear red ${layer}/${networkName}:`, error);
      return false;
    }
  }

  /**
   * Validar datos de entrenamiento
   * @param {Array} trainingData - Datos a validar
   * @returns {Object} - Resultado de validación
   */
  validateTrainingData(trainingData) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      stats: {
        total_samples: trainingData.length,
        fraud_samples: 0,
        normal_samples: 0,
        invalid_samples: 0
      }
    };
    
    // Validar cada muestra
    trainingData.forEach((sample, index) => {
      if (!sample.variables || !sample.fraud_score) {
        validation.valid = false;
        validation.errors.push(`Muestra ${index}: Falta variables o fraud_score`);
        validation.stats.invalid_samples++;
        return;
      }
      
      if (sample.fraud_score >= 0.7) {
        validation.stats.fraud_samples++;
      } else {
        validation.stats.normal_samples++;
      }
    });
    
    // Validar balance de clases
    const fraudRatio = validation.stats.fraud_samples / validation.stats.total_samples;
    if (fraudRatio < 0.1 || fraudRatio > 0.9) {
      validation.warnings.push(`Desbalance de clases: ${(fraudRatio * 100).toFixed(1)}% fraude`);
    }
    
    // Validar cantidad mínima
    if (validation.stats.total_samples < this.config.minTrainingSamples) {
      validation.valid = false;
      validation.errors.push(`Se requieren al menos ${this.config.minTrainingSamples} muestras`);
    }
    
    return validation;
  }

  /**
   * Limpiar recursos
   */
  cleanup() {
    this.stopAutoSave();
    this.trainingQueue = [];
    this.isTraining = false;
    logger.info('Servicio de redes neuronales limpiado');
  }
}

// Exportar instancia única del servicio
module.exports = new NeuralNetworkManagerService();