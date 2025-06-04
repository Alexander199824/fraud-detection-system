const brain = require('brain.js');
const { logger } = require('../../config');

/**
 * Red Neuronal 3.4 - Analizador de Contexto
 * Esta red analiza el contexto completo de la transacción considerando factores externos y situacionales
 */
class ContextAnalyzer {
  constructor() {
    this.network = new brain.NeuralNetwork({
      hiddenLayers: [18, 12, 6],
      activation: 'sigmoid',
      learningRate: 0.01,
      iterations: 20000,
      errorThresh: 0.005
    });
    
    this.networkId = 'context_analyzer_v1.0';
    this.isTrained = false;
    this.lastTrainingDate = null;
    this.version = '1.0.0';
    
    // Contextos conocidos
    this.knownContexts = {
      // Contextos temporales
      temporal: {
        holiday_shopping: { months: [11, 12], risk_modifier: 0.8 },
        tax_season: { months: [3, 4], risk_modifier: 0.9 },
        vacation_season: { months: [6, 7, 8], risk_modifier: 0.85 },
        black_friday: { date: 'last_friday_november', risk_modifier: 0.7 }
      },
      
      // Contextos geográficos
      geographical: {
        tourist_areas: { risk_modifier: 0.9 },
        business_districts: { risk_modifier: 0.8 },
        residential_areas: { risk_modifier: 0.7 },
        high_crime_areas: { risk_modifier: 1.2 }
      },
      
      // Contextos situacionales
      situational: {
        emergency: { indicators: ['hospital', 'pharmacy', 'urgent'], risk_modifier: 0.6 },
        travel: { indicators: ['airport', 'hotel', 'rental'], risk_modifier: 0.8 },
        business: { indicators: ['conference', 'meeting', 'corporate'], risk_modifier: 0.7 }
      }
    };
  }

  /**
   * Analizo el contexto completo de la transacción
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Análisis contextual
   */
  analyzeTransactionContext(transactionData, layer1Results, layer2Results) {
    const { variables } = transactionData;
    
    return {
      // Contexto temporal
      temporal_context: this.analyzeTemporalContext(variables),
      
      // Contexto geográfico
      geographical_context: this.analyzeGeographicalContext(variables, layer1Results),
      
      // Contexto del cliente
      client_context: this.analyzeClientContext(variables),
      
      // Contexto transaccional
      transactional_context: this.analyzeTransactionalContext(variables, layer1Results),
      
      // Contexto de red/relaciones
      network_context: this.analyzeNetworkContext(variables, layer1Results, layer2Results),
      
      // Contexto económico
      economic_context: this.analyzeEconomicContext(variables),
      
      // Contexto tecnológico
      technological_context: this.analyzeTechnologicalContext(variables, layer1Results),
      
      // Contexto situacional
      situational_context: this.analyzeSituationalContext(variables, layer1Results, layer2Results),
      
      // Factores contextuales de riesgo
      contextual_risk_factors: this.identifyContextualRiskFactors(variables, layer1Results, layer2Results)
    };
  }

  /**
   * Analizo contexto temporal
   * @param {Object} variables - Variables de la transacción
   * @returns {Object} - Contexto temporal
   */
  analyzeTemporalContext(variables) {
    const context = {
      time_of_day: this.getTimeOfDayContext(variables.hour_of_day),
      day_type: this.getDayTypeContext(variables.day_of_week, variables.is_weekend),
      seasonality: this.getSeasonalContext(new Date(variables.created_at)),
      temporal_anomalies: [],
      risk_modifier: 1.0
    };
    
    // Análisis de anomalías temporales
    if (variables.is_night_transaction && variables.merchant_type === 'jewelry') {
      context.temporal_anomalies.push('Compra de joyería en horario nocturno');
      context.risk_modifier *= 1.3;
    }
    
    if (variables.is_weekend && variables.channel === 'online' && variables.amount > 5000) {
      context.temporal_anomalies.push('Transacción online de alto valor en fin de semana');
      context.risk_modifier *= 1.2;
    }
    
    // Ajuste por temporada alta
    if (context.seasonality.is_holiday_season) {
      context.risk_modifier *= 0.8; // Menor riesgo en temporada navideña
    }
    
    return context;
  }

  /**
   * Analizo contexto geográfico
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Contexto geográfico
   */
  analyzeGeographicalContext(variables, layer1Results) {
    const context = {
      location_type: this.getLocationTypeFromMerchant(variables.merchant_type),
      cross_border: !variables.is_domestic,
      distance_context: this.getDistanceContext(variables.distance_from_prev),
      geographical_anomalies: [],
      risk_modifier: 1.0
    };
    
    // Análisis de anomalías geográficas
    if (!variables.is_domestic && variables.client_age_days < 30) {
      context.geographical_anomalies.push('Transacción internacional de cliente nuevo');
      context.risk_modifier *= 1.4;
    }
    
    if (variables.distance_from_prev > 500 && variables.time_since_prev_transaction < 120) {
      context.geographical_anomalies.push('Distancia imposible en el tiempo transcurrido');
      context.risk_modifier *= 1.5;
    }
    
    // Ajuste por zona turística
    if (this.isTouristLocation(variables.location)) {
      context.risk_modifier *= 0.9;
    }
    
    return context;
  }

  /**
   * Analizo contexto del cliente
   * @param {Object} variables - Variables de la transacción
   * @returns {Object} - Contexto del cliente
   */
  analyzeClientContext(variables) {
    const context = {
      client_maturity: this.getClientMaturity(variables.client_age_days),
      transaction_history: this.getTransactionHistoryContext(variables),
      behavioral_profile: this.getBehavioralProfile(variables),
      client_anomalies: [],
      risk_modifier: 1.0
    };
    
    // Cliente nuevo con alta actividad
    if (context.client_maturity === 'new' && variables.transactions_last_24h > 5) {
      context.client_anomalies.push('Cliente nuevo con actividad inusualmente alta');
      context.risk_modifier *= 1.3;
    }
    
    // Cliente establecido con cambio repentino
    if (context.client_maturity === 'established' && variables.amount > variables.historical_max_amount * 2) {
      context.client_anomalies.push('Cliente establecido con transacción atípicamente alta');
      context.risk_modifier *= 1.2;
    }
    
    return context;
  }

  /**
   * Analizo contexto transaccional
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Contexto transaccional
   */
  analyzeTransactionalContext(variables, layer1Results) {
    const context = {
      transaction_type: this.getTransactionType(variables),
      amount_context: this.getAmountContext(variables.amount, variables.merchant_type),
      velocity_context: this.getVelocityContext(variables),
      pattern_deviation: layer1Results.pattern?.suspicion_score || 0,
      transactional_anomalies: [],
      risk_modifier: 1.0
    };
    
    // Micro-transacciones seguidas
    if (variables.amount < 5 && variables.prev_amount < 5 && variables.transactions_last_hour > 3) {
      context.transactional_anomalies.push('Patrón de micro-transacciones (posible prueba de tarjeta)');
      context.risk_modifier *= 1.4;
    }
    
    // Transacción fraccionada
    if (this.detectSplitTransaction(variables)) {
      context.transactional_anomalies.push('Posible transacción fraccionada para evitar límites');
      context.risk_modifier *= 1.3;
    }
    
    return context;
  }

  /**
   * Analizo contexto de red/relaciones
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Contexto de red
   */
  analyzeNetworkContext(variables, layer1Results, layer2Results) {
    const context = {
      relationship_strength: this.calculateRelationshipStrength(variables),
      network_behavior: layer2Results.behavior?.combined_score || 0,
      correlation_patterns: this.detectCorrelationPatterns(layer1Results, layer2Results),
      network_anomalies: [],
      risk_modifier: 1.0
    };
    
    // Nuevo establecimiento en red sospechosa
    if (variables.merchant_risk_score > 0.7) {
      context.network_anomalies.push('Establecimiento con historial de fraudes');
      context.risk_modifier *= 1.3;
    }
    
    // Correlaciones sospechosas
    if (context.correlation_patterns.suspicious_count > 2) {
      context.network_anomalies.push('Múltiples correlaciones sospechosas detectadas');
      context.risk_modifier *= 1.2;
    }
    
    return context;
  }

  /**
   * Analizo contexto económico
   * @param {Object} variables - Variables de la transacción
   * @returns {Object} - Contexto económico
   */
  analyzeEconomicContext(variables) {
    const context = {
      amount_category: this.categorizeAmount(variables.amount),
      economic_indicators: this.getEconomicIndicators(variables),
      spending_pattern: this.analyzeSpendingPattern(variables),
      economic_anomalies: [],
      risk_modifier: 1.0
    };
    
    // Gasto excesivo vs ingreso estimado
    if (variables.amount_last_24h > variables.estimated_monthly_income * 0.5) {
      context.economic_anomalies.push('Gasto excesivo relativo al perfil económico');
      context.risk_modifier *= 1.3;
    }
    
    // Transacciones de lujo repentinas
    if (variables.merchant_type === 'luxury' && variables.historical_avg_amount < 500) {
      context.economic_anomalies.push('Compra de lujo inconsistente con historial');
      context.risk_modifier *= 1.2;
    }
    
    return context;
  }

  /**
   * Analizo contexto tecnológico
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Contexto tecnológico
   */
  analyzeTechnologicalContext(variables, layer1Results) {
    const context = {
      channel_consistency: this.analyzeChannelConsistency(variables),
      device_context: this.analyzeDeviceContext(variables),
      technological_indicators: this.getTechnologicalIndicators(variables, layer1Results),
      tech_anomalies: [],
      risk_modifier: 1.0
    };
    
    // Cambio repentino de canal
    if (layer1Results.channel?.suspicion_score > 0.7) {
      context.tech_anomalies.push('Cambio inusual de canal de transacción');
      context.risk_modifier *= 1.2;
    }
    
    // Falta de información de dispositivo en transacción online
    if (variables.channel === 'online' && !variables.device_info) {
      context.tech_anomalies.push('Transacción online sin información de dispositivo');
      context.risk_modifier *= 1.3;
    }
    
    // Uso de proxy o VPN detectado
    if (variables.proxy_detected || variables.vpn_detected) {
      context.tech_anomalies.push('Uso de tecnología de ocultación detectada');
      context.risk_modifier *= 1.4;
    }
    
    return context;
  }

  /**
   * Analizo contexto situacional
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Contexto situacional
   */
  analyzeSituationalContext(variables, layer1Results, layer2Results) {
    const context = {
      situation_type: this.identifySituation(variables),
      urgency_indicators: this.detectUrgencyIndicators(variables),
      behavioral_consistency: layer2Results.behavior?.combined_score || 0,
      situational_factors: [],
      risk_modifier: 1.0
    };
    
    // Situación de emergencia
    if (context.urgency_indicators.is_emergency) {
      context.situational_factors.push('Posible situación de emergencia');
      context.risk_modifier *= 0.7; // Menor riesgo en emergencias
    }
    
    // Situación de viaje
    if (this.detectTravelContext(variables)) {
      context.situational_factors.push('Contexto de viaje detectado');
      context.risk_modifier *= 0.85;
    }
    
    // Situación bajo presión
    if (this.detectPressureIndicators(variables, layer1Results)) {
      context.situational_factors.push('Indicadores de transacción bajo presión');
      context.risk_modifier *= 1.3;
    }
    
    return context;
  }

  /**
   * Identifico factores contextuales de riesgo
   * @param {Object} variables - Variables de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Array} - Factores de riesgo contextual
   */
  identifyContextualRiskFactors(variables, layer1Results, layer2Results) {
    const riskFactors = [];
    
    // Factor: Primera transacción internacional
    if (!variables.is_domestic && variables.historical_international_count === 0) {
      riskFactors.push({
        factor: 'first_international_transaction',
        description: 'Primera transacción internacional del cliente',
        risk_increase: 0.3
      });
    }
    
    // Factor: Horario y ubicación incompatibles
    if (variables.is_night_transaction && variables.merchant_type === 'office_supplies') {
      riskFactors.push({
        factor: 'incompatible_time_location',
        description: 'Compra en horario incompatible con tipo de establecimiento',
        risk_increase: 0.2
      });
    }
    
    // Factor: Contexto de alto riesgo múltiple
    const highRiskCount = Object.values(layer1Results).filter(r => r?.suspicion_score > 0.7).length;
    if (highRiskCount >= 4) {
      riskFactors.push({
        factor: 'multiple_high_risk_contexts',
        description: 'Múltiples contextos de alto riesgo simultáneos',
        risk_increase: 0.4
      });
    }
    
    // Factor: Ruptura de patrón contextual
    if (this.detectContextualPatternBreak(variables, layer2Results)) {
      riskFactors.push({
        factor: 'contextual_pattern_break',
        description: 'Ruptura significativa de patrones contextuales establecidos',
        risk_increase: 0.3
      });
    }
    
    return riskFactors;
  }

  // === Métodos auxiliares ===

  /**
   * Obtengo contexto de hora del día
   * @param {number} hour - Hora del día (0-23)
   * @returns {string} - Contexto temporal
   */
  getTimeOfDayContext(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Obtengo contexto del tipo de día
   * @param {number} dayOfWeek - Día de la semana (0-6)
   * @param {boolean} isWeekend - Es fin de semana
   * @returns {string} - Tipo de día
   */
  getDayTypeContext(dayOfWeek, isWeekend) {
    if (isWeekend) return 'weekend';
    if (dayOfWeek === 1) return 'monday';
    if (dayOfWeek === 5) return 'friday';
    return 'midweek';
  }

  /**
   * Obtengo contexto estacional
   * @param {Date} date - Fecha de la transacción
   * @returns {Object} - Contexto estacional
   */
  getSeasonalContext(date) {
    const month = date.getMonth();
    const day = date.getDate();
    
    return {
      season: this.getSeason(month),
      is_holiday_season: month === 11 || month === 0,
      is_vacation_season: month >= 5 && month <= 7,
      is_tax_season: month === 2 || month === 3,
      special_dates: this.checkSpecialDates(month, day)
    };
  }

  /**
   * Obtengo la estación del año
   * @param {number} month - Mes (0-11)
   * @returns {string} - Estación
   */
  getSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  /**
   * Verifico fechas especiales
   * @param {number} month - Mes
   * @param {number} day - Día
   * @returns {Array} - Fechas especiales
   */
  checkSpecialDates(month, day) {
    const specialDates = [];
    
    if (month === 11 && day >= 24 && day <= 26) {
      specialDates.push('black_friday_weekend');
    }
    
    if (month === 11 && day === 24) {
      specialDates.push('christmas_eve');
    }
    
    if (month === 0 && day === 1) {
      specialDates.push('new_year');
    }
    
    if (month === 1 && day === 14) {
      specialDates.push('valentines_day');
    }
    
    return specialDates;
  }

  /**
   * Obtengo tipo de ubicación desde el tipo de establecimiento
   * @param {string} merchantType - Tipo de establecimiento
   * @returns {string} - Tipo de ubicación
   */
  getLocationTypeFromMerchant(merchantType) {
    const mappings = {
      'grocery': 'residential',
      'restaurant': 'commercial',
      'hotel': 'tourist',
      'gas_station': 'transit',
      'hospital': 'emergency',
      'airport': 'travel'
    };
    
    return mappings[merchantType] || 'general';
  }

  /**
   * Obtengo contexto de distancia
   * @param {number} distance - Distancia en km
   * @returns {string} - Contexto de distancia
   */
  getDistanceContext(distance) {
    if (distance < 5) return 'local';
    if (distance < 50) return 'city';
    if (distance < 200) return 'regional';
    if (distance < 1000) return 'national';
    return 'international';
  }

  /**
   * Verifico si es ubicación turística
   * @param {string} location - Ubicación
   * @returns {boolean} - Es ubicación turística
   */
  isTouristLocation(location) {
    const touristKeywords = ['airport', 'hotel', 'resort', 'beach', 'tourist', 'vacation'];
    return touristKeywords.some(keyword => location.toLowerCase().includes(keyword));
  }

  /**
   * Obtengo madurez del cliente
   * @param {number} clientAgeDays - Días desde registro
   * @returns {string} - Nivel de madurez
   */
  getClientMaturity(clientAgeDays) {
    if (clientAgeDays < 30) return 'new';
    if (clientAgeDays < 90) return 'recent';
    if (clientAgeDays < 365) return 'regular';
    return 'established';
  }

  /**
   * Obtengo contexto del historial de transacciones
   * @param {Object} variables - Variables
   * @returns {string} - Contexto del historial
   */
  getTransactionHistoryContext(variables) {
    const avgDaily = variables.avg_transactions_per_day || 0;
    
    if (avgDaily < 0.1) return 'minimal';
    if (avgDaily < 0.5) return 'low';
    if (avgDaily < 2) return 'moderate';
    if (avgDaily < 5) return 'high';
    return 'very_high';
  }

  /**
   * Obtengo perfil comportamental
   * @param {Object} variables - Variables
   * @returns {Object} - Perfil comportamental
   */
  getBehavioralProfile(variables) {
    return {
      spending_level: this.categorizeAmount(variables.historical_avg_amount),
      diversity: variables.historical_merchant_types > 10 ? 'high' : 'low',
      geography: variables.unique_countries > 5 ? 'international' : 'domestic',
      consistency: variables.transaction_consistency_score || 0.5
    };
  }

  /**
   * Obtengo tipo de transacción
   * @param {Object} variables - Variables
   * @returns {string} - Tipo de transacción
   */
  getTransactionType(variables) {
    if (variables.channel === 'atm') return 'cash_withdrawal';
    if (variables.merchant_type === 'online') return 'ecommerce';
    if (variables.amount < 50) return 'micro_payment';
    if (variables.amount > 5000) return 'high_value';
    return 'standard';
  }

  /**
   * Obtengo contexto del monto
   * @param {number} amount - Monto
   * @param {string} merchantType - Tipo de establecimiento
   * @returns {Object} - Contexto del monto
   */
  getAmountContext(amount, merchantType) {
    const expectedRanges = {
      'grocery': { min: 20, max: 300 },
      'gas_station': { min: 30, max: 150 },
      'restaurant': { min: 15, max: 200 },
      'hotel': { min: 100, max: 1000 },
      'electronics': { min: 50, max: 5000 }
    };
    
    const range = expectedRanges[merchantType] || { min: 10, max: 1000 };
    
    return {
      is_within_expected: amount >= range.min && amount <= range.max,
      deviation: amount < range.min ? 'below' : (amount > range.max ? 'above' : 'normal')
    };
  }

  /**
   * Obtengo contexto de velocidad
   * @param {Object} variables - Variables
   * @returns {Object} - Contexto de velocidad
   */
  getVelocityContext(variables) {
    return {
      recent_activity: variables.transactions_last_hour > 3 ? 'high' : 'normal',
      daily_activity: variables.transactions_last_24h > 10 ? 'high' : 'normal',
      time_since_last: variables.time_since_prev_transaction < 5 ? 'rapid' : 'normal'
    };
  }

  /**
   * Detecto transacción fraccionada
   * @param {Object} variables - Variables
   * @returns {boolean} - Es transacción fraccionada
   */
  detectSplitTransaction(variables) {
    // Múltiples transacciones similares en poco tiempo
    return variables.transactions_last_hour > 3 && 
           variables.amount < 1000 &&
           Math.abs(variables.amount - variables.prev_amount) < 100;
  }

  /**
   * Calculo fuerza de la relación
   * @param {Object} variables - Variables
   * @returns {number} - Fuerza de relación (0-1)
   */
  calculateRelationshipStrength(variables) {
    let strength = 0;
    
    if (variables.historical_transaction_count > 100) strength += 0.3;
    if (variables.client_age_days > 365) strength += 0.3;
    if (variables.merchant_frequency > 10) strength += 0.2;
    if (variables.no_fraud_history) strength += 0.2;
    
    return Math.min(strength, 1);
  }

  /**
   * Detecto patrones de correlación
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Patrones de correlación
   */
  detectCorrelationPatterns(layer1Results, layer2Results) {
    let suspiciousCount = 0;
    
    // Contar correlaciones sospechosas
    const highL1Scores = Object.values(layer1Results).filter(r => r?.suspicion_score > 0.7).length;
    const highL2Scores = Object.values(layer2Results).filter(r => r?.combined_score > 0.7).length;
    
    if (highL1Scores > 3 && highL2Scores > 2) {
      suspiciousCount = highL1Scores + highL2Scores;
    }
    
    return {
      suspicious_count: suspiciousCount,
      correlation_strength: suspiciousCount > 5 ? 'high' : 'low'
    };
  }

  /**
   * Categorizo el monto
   * @param {number} amount - Monto
   * @returns {string} - Categoría
   */
  categorizeAmount(amount) {
    if (amount < 50) return 'micro';
    if (amount < 200) return 'small';
    if (amount < 1000) return 'medium';
    if (amount < 5000) return 'large';
    return 'very_large';
  }

  /**
   * Obtengo indicadores económicos
   * @param {Object} variables - Variables
   * @returns {Object} - Indicadores económicos
   */
  getEconomicIndicators(variables) {
    return {
      spending_velocity: variables.amount_last_24h / (variables.historical_avg_amount || 1),
      income_ratio: variables.amount / (variables.estimated_monthly_income || 5000),
      debt_indicator: variables.credit_utilization || 0
    };
  }

  /**
   * Analizo patrón de gasto
   * @param {Object} variables - Variables
   * @returns {string} - Patrón de gasto
   */
  analyzeSpendingPattern(variables) {
    if (variables.spending_trend === 'increasing' && variables.spending_increase_rate > 0.5) {
      return 'escalating';
    }
    if (variables.spending_variance > 0.7) {
      return 'erratic';
    }
    return 'stable';
  }

  /**
   * Analizo consistencia del canal
   * @param {Object} variables - Variables
   * @returns {number} - Score de consistencia (0-1)
   */
  analyzeChannelConsistency(variables) {
    if (variables.historical_channel_distribution) {
      const currentChannelUsage = variables.historical_channel_distribution[variables.channel] || 0;
      return currentChannelUsage / 100; // Convertir porcentaje a 0-1
    }
    return 0.5; // Neutral si no hay datos
  }

  /**
   * Analizo contexto del dispositivo
   * @param {Object} variables - Variables
   * @returns {Object} - Contexto del dispositivo
   */
  analyzeDeviceContext(variables) {
    return {
      has_device_info: !!variables.device_info,
      device_consistency: variables.device_change_frequency || 'unknown',
      suspicious_indicators: this.checkSuspiciousDeviceIndicators(variables)
    };
  }

  /**
   * Verifico indicadores sospechosos del dispositivo
   * @param {Object} variables - Variables
   * @returns {Array} - Indicadores sospechosos
   */
  checkSuspiciousDeviceIndicators(variables) {
    const indicators = [];
    
    if (variables.device_rooted) indicators.push('rooted_device');
    if (variables.emulator_detected) indicators.push('emulator');
    if (variables.multiple_accounts_same_device) indicators.push('shared_device');
    
    return indicators;
  }

  /**
   * Obtengo indicadores tecnológicos
   * @param {Object} variables - Variables
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {Object} - Indicadores tecnológicos
   */
  getTechnologicalIndicators(variables, layer1Results) {
    return {
      channel_risk: layer1Results.channel?.suspicion_score || 0,
      device_risk: layer1Results.device?.suspicion_score || 0,
      automation_probability: this.calculateAutomationProbability(variables)
    };
  }

  /**
   * Calculo probabilidad de automatización
   * @param {Object} variables - Variables
   * @returns {number} - Probabilidad (0-1)
   */
  calculateAutomationProbability(variables) {
    let probability = 0;
    
    if (variables.time_between_transactions_stddev < 10) probability += 0.3;
    if (variables.transaction_intervals_consistent) probability += 0.3;
    if (variables.no_human_patterns) probability += 0.4;
    
    return Math.min(probability, 1);
  }

  /**
   * Identifico situación
   * @param {Object} variables - Variables
   * @returns {string} - Tipo de situación
   */
  identifySituation(variables) {
    if (variables.merchant_type === 'hospital' || variables.merchant_type === 'pharmacy') {
      return 'emergency';
    }
    if (variables.merchant_type === 'hotel' || variables.merchant_type === 'airline') {
      return 'travel';
    }
    if (variables.is_recurring_payment) {
      return 'subscription';
    }
    return 'general';
  }

  /**
   * Detecto indicadores de urgencia
   * @param {Object} variables - Variables
   * @returns {Object} - Indicadores de urgencia
   */
  detectUrgencyIndicators(variables) {
    return {
      is_emergency: variables.merchant_type === 'hospital' || variables.merchant_type === 'emergency',
      is_after_hours: variables.is_night_transaction,
      rapid_succession: variables.time_since_prev_transaction < 5,
      high_amount: variables.amount > 5000
    };
  }

  /**
   * Detecto contexto de viaje
   * @param {Object} variables - Variables
   * @returns {boolean} - Está en contexto de viaje
   */
  detectTravelContext(variables) {
    return !variables.is_domestic || 
           variables.merchant_type === 'hotel' ||
           variables.merchant_type === 'airline' ||
           variables.location.includes('airport');
  }

  /**
   * Detecto indicadores de presión
   * @param {Object} variables - Variables
   * @param {Object} layer1Results - Resultados de Capa 1
   * @returns {boolean} - Hay indicadores de presión
   */
  detectPressureIndicators(variables, layer1Results) {
    return variables.transaction_duration < 30 || // Transacción muy rápida
           variables.multiple_attempts || // Múltiples intentos
           layer1Results.velocity?.suspicion_score > 0.8; // Alta velocidad
  }

  /**
   * Detecto ruptura de patrón contextual
   * @param {Object} variables - Variables
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {boolean} - Hay ruptura de patrón
   */
  detectContextualPatternBreak(variables, layer2Results) {
    const patternScore = layer2Results.pattern?.combined_score || 0;
    const behaviorScore = layer2Results.behavior?.combined_score || 0;
    
    return patternScore > 0.7 && behaviorScore > 0.7;
  }

  /**
   * Preparo datos para la red neuronal
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de todas las redes de Capa 1
   * @param {Object} layer2Results - Resultados de todas las redes de Capa 2
   * @returns {Object} - Datos preparados para la red
   */
  prepareInput(transactionData, layer1Results, layer2Results) {
    const contextAnalysis = this.analyzeTransactionContext(transactionData, layer1Results, layer2Results);
    
    const layer1Scores = {
      amount: layer1Results.amount?.suspicion_score || 0,
      location: layer1Results.location?.suspicion_score || 0,
      time: layer1Results.time?.suspicion_score || 0,
      day: layer1Results.day?.suspicion_score || 0,
      merchant: layer1Results.merchant?.suspicion_score || 0,
      velocity: layer1Results.velocity?.suspicion_score || 0,
      distance: layer1Results.distance?.suspicion_score || 0,
      pattern: layer1Results.pattern?.suspicion_score || 0,
      frequency: layer1Results.frequency?.suspicion_score || 0,
      channel: layer1Results.channel?.suspicion_score || 0,
      device: layer1Results.device?.suspicion_score || 0,
      country: layer1Results.country?.suspicion_score || 0
    };
    
    const layer2Scores = {
      behavior: layer2Results.behavior?.combined_score || 0,
      location: layer2Results.location?.combined_score || 0,
      timing: layer2Results.timing?.combined_score || 0,
      amount: layer2Results.amount?.combined_score || 0,
      device: layer2Results.device?.combined_score || 0,
      pattern: layer2Results.pattern?.combined_score || 0
    };
    
    const input = {
      // Scores de capas anteriores
      ...layer1Scores,
      l2_behavior: layer2Scores.behavior,
      l2_location: layer2Scores.location,
      l2_timing: layer2Scores.timing,
      l2_amount: layer2Scores.amount,
      l2_device: layer2Scores.device,
      l2_pattern: layer2Scores.pattern,
      
      // Modificadores de riesgo contextual
      temporal_risk_modifier: contextAnalysis.temporal_context.risk_modifier,
      geographical_risk_modifier: contextAnalysis.geographical_context.risk_modifier,
      client_risk_modifier: contextAnalysis.client_context.risk_modifier,
      transactional_risk_modifier: contextAnalysis.transactional_context.risk_modifier,
      network_risk_modifier: contextAnalysis.network_context.risk_modifier,
      economic_risk_modifier: contextAnalysis.economic_context.risk_modifier,
      technological_risk_modifier: contextAnalysis.technological_context.risk_modifier,
      situational_risk_modifier: contextAnalysis.situational_context.risk_modifier,
      
      // Conteo de anomalías contextuales
      total_anomaly_count: this.countTotalAnomalies(contextAnalysis),
      critical_factor_count: contextAnalysis.contextual_risk_factors.filter(f => f.risk_increase > 0.3).length,
      
      // Score contextual general
      overall_context_risk: this.calculateOverallContextRisk(contextAnalysis)
    };
    
    return input;
  }

  /**
   * Cuento anomalías totales
   * @param {Object} contextAnalysis - Análisis contextual
   * @returns {number} - Total de anomalías
   */
  countTotalAnomalies(contextAnalysis) {
    let count = 0;
    
    count += contextAnalysis.temporal_context.temporal_anomalies.length;
    count += contextAnalysis.geographical_context.geographical_anomalies.length;
    count += contextAnalysis.client_context.client_anomalies.length;
    count += contextAnalysis.transactional_context.transactional_anomalies.length;
    count += contextAnalysis.network_context.network_anomalies.length;
    count += contextAnalysis.economic_context.economic_anomalies.length;
    count += contextAnalysis.technological_context.tech_anomalies.length;
    count += contextAnalysis.situational_context.situational_factors.length;
    
    return count;
  }

  /**
   * Calculo riesgo contextual general
   * @param {Object} contextAnalysis - Análisis contextual
   * @returns {number} - Riesgo contextual (0-1)
   */
  calculateOverallContextRisk(contextAnalysis) {
    // Combinar todos los modificadores de riesgo
    const modifiers = [
      contextAnalysis.temporal_context.risk_modifier,
      contextAnalysis.geographical_context.risk_modifier,
      contextAnalysis.client_context.risk_modifier,
      contextAnalysis.transactional_context.risk_modifier,
      contextAnalysis.network_context.risk_modifier,
      contextAnalysis.economic_context.risk_modifier,
      contextAnalysis.technological_context.risk_modifier,
      contextAnalysis.situational_context.risk_modifier
    ];
    
    // Calcular modificador combinado
    const combinedModifier = modifiers.reduce((acc, mod) => acc * mod, 1);
    
    // Convertir a score de riesgo (0-1)
    return Math.min(Math.max((combinedModifier - 0.5) / 2, 0), 1);
  }

  /**
   * Analizo y evalúo el contexto de la transacción
   * @param {Object} transactionData - Datos originales de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Resultado del análisis contextual
   */
  async analyze(transactionData, layer1Results, layer2Results) {
    const startTime = Date.now();
    
    try {
      if (!this.isTrained) {
        logger.warn('Red analizadora de contexto no entrenada, usando heurísticas');
        return this.heuristicAnalysis(transactionData, layer1Results, layer2Results);
      }
      
      const input = this.prepareInput(transactionData, layer1Results, layer2Results);
      const output = this.network.run(input);
      const contextScore = Array.isArray(output) ? output[0] : output;
      
      const contextAnalysis = this.analyzeTransactionContext(transactionData, layer1Results, layer2Results);
      const warnings = this.generateWarnings(contextScore, contextAnalysis);
      
      const result = {
        network_id: this.networkId,
        deep_analysis_score: contextScore,
        confidence: this.calculateConfidence(input),
        context_analysis: contextAnalysis,
        warnings: warnings,
        context_summary: {
          overall_risk: input.overall_context_risk,
          anomaly_count: input.total_anomaly_count,
          critical_factors: input.critical_factor_count,
          primary_context: this.identifyPrimaryContext(contextAnalysis)
        },
        input_features: input,
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`Análisis contextual completado: Score=${contextScore.toFixed(3)}`);
      return result;
      
    } catch (error) {
      logger.error('Error en análisis contextual:', error);
      return this.heuristicAnalysis(transactionData, layer1Results, layer2Results);
    }
  }

  /**
   * Análisis heurístico contextual
   * @param {Object} transactionData - Datos de la transacción
   * @param {Object} layer1Results - Resultados de Capa 1
   * @param {Object} layer2Results - Resultados de Capa 2
   * @returns {Object} - Resultado heurístico
   */
  heuristicAnalysis(transactionData, layer1Results, layer2Results) {
    const input = this.prepareInput(transactionData, layer1Results, layer2Results);
    const contextScore = input.overall_context_risk;
    const contextAnalysis = this.analyzeTransactionContext(transactionData, layer1Results, layer2Results);
    const warnings = this.generateWarnings(contextScore, contextAnalysis);
    
    return {
      network_id: this.networkId + '_heuristic',
      deep_analysis_score: contextScore,
      confidence: 0.8,
      context_analysis: contextAnalysis,
      warnings: warnings,
      context_summary: {
        overall_risk: input.overall_context_risk,
        anomaly_count: input.total_anomaly_count,
        critical_factors: input.critical_factor_count,
        primary_context: this.identifyPrimaryContext(contextAnalysis)
      },
      processing_time_ms: 18
    };
  }

  /**
   * Identifico el contexto principal
   * @param {Object} contextAnalysis - Análisis contextual
   * @returns {string} - Contexto principal
   */
  identifyPrimaryContext(contextAnalysis) {
    const contexts = [
      { name: 'temporal', score: contextAnalysis.temporal_context.risk_modifier },
      { name: 'geographical', score: contextAnalysis.geographical_context.risk_modifier },
      { name: 'client', score: contextAnalysis.client_context.risk_modifier },
      { name: 'transactional', score: contextAnalysis.transactional_context.risk_modifier },
      { name: 'network', score: contextAnalysis.network_context.risk_modifier },
      { name: 'economic', score: contextAnalysis.economic_context.risk_modifier },
      { name: 'technological', score: contextAnalysis.technological_context.risk_modifier },
      { name: 'situational', score: contextAnalysis.situational_context.risk_modifier }
    ];
    
    // El contexto con mayor desviación de 1.0 es el más relevante
    contexts.sort((a, b) => Math.abs(b.score - 1) - Math.abs(a.score - 1));
    
    return contexts[0].name;
  }

  /**
   * Genero advertencias basadas en el análisis contextual
   * @param {number} contextScore - Score contextual
   * @param {Object} contextAnalysis - Análisis contextual
   * @returns {Array} - Lista de advertencias
   */
  generateWarnings(contextScore, contextAnalysis) {
    const warnings = [];
    
    if (contextScore >= 0.8) {
      warnings.push('CONTEXTO CRÍTICO: Múltiples factores contextuales de alto riesgo');
    }
    
    if (contextAnalysis.contextual_risk_factors.length > 3) {
      warnings.push('MÚLTIPLES RIESGOS: Varios factores contextuales problemáticos');
    }
    
    const criticalFactors = contextAnalysis.contextual_risk_factors.filter(f => f.risk_increase > 0.3);
    if (criticalFactors.length > 0) {
      warnings.push(`FACTORES CRÍTICOS: ${criticalFactors.map(f => f.factor).join(', ')}`);
    }
    
    if (contextAnalysis.technological_context.tech_anomalies.includes('Uso de tecnología de ocultación detectada')) {
      warnings.push('OCULTACIÓN DETECTADA: Posible uso de proxy/VPN');
    }
    
    return warnings;
  }

  /**
   * Calculo la confianza del análisis
   * @param {Object} input - Datos de entrada
   * @returns {number} - Nivel de confianza (0-1)
   */
  calculateConfidence(input) {
    let confidence = 0.7;
    
    // Mayor confianza con más anomalías detectadas
    if (input.total_anomaly_count > 5) {
      confidence += 0.15;
    } else if (input.total_anomaly_count > 3) {
      confidence += 0.1;
    }
    
    // Mayor confianza con factores críticos
    if (input.critical_factor_count > 2) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 0.95);
  }

  /**
   * Entreno la red con datos históricos
   * @param {Array} trainingData - Datos de entrenamiento
   * @returns {Object} - Resultado del entrenamiento
   */
  async train(trainingData) {
    try {
      logger.info(`Iniciando entrenamiento de red analizadora de contexto con ${trainingData.length} muestras`);
      
      const trainingSets = trainingData.map(data => {
        const mockLayer1Results = this.generateMockLayer1Results(data);
        const mockLayer2Results = this.generateMockLayer2Results(data);
        return {
          input: this.prepareInput(data, mockLayer1Results, mockLayer2Results),
          output: [data.fraud_score || 0]
        };
      });
      
      const result = this.network.train(trainingSets);
      
      this.isTrained = true;
      this.lastTrainingDate = new Date();
      
      logger.info('Entrenamiento de red analizadora de contexto completado:', result);
      return {
        success: true,
        iterations: result.iterations,
        error: result.error,
        network_id: this.networkId
      };
      
    } catch (error) {
      logger.error('Error en entrenamiento de red analizadora de contexto:', error);
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
      amount: { suspicion_score: fraudScore * (0.8 + Math.random() * 0.4) },
      location: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      time: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) },
      day: { suspicion_score: fraudScore * (0.5 + Math.random() * 1.0) },
      merchant: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      velocity: { suspicion_score: fraudScore * (0.8 + Math.random() * 0.4) },
      distance: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) },
      pattern: { suspicion_score: fraudScore * (0.9 + Math.random() * 0.2) },
      frequency: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) },
      channel: { suspicion_score: fraudScore * (0.5 + Math.random() * 1.0) },
      device: { suspicion_score: fraudScore * (0.6 + Math.random() * 0.8) },
      country: { suspicion_score: fraudScore * (0.7 + Math.random() * 0.6) }
    };
  }

  /**
   * Genero resultados simulados de Capa 2 para entrenamiento
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Object} - Resultados simulados de Capa 2
   */
  generateMockLayer2Results(transactionData) {
    const fraudScore = transactionData.fraud_score || 0;
    
    return {
      behavior: { combined_score: fraudScore * (0.8 + Math.random() * 0.4) },
      location: { combined_score: fraudScore * (0.7 + Math.random() * 0.6) },
      timing: { combined_score: fraudScore * (0.6 + Math.random() * 0.8) },
      amount: { combined_score: fraudScore * (0.8 + Math.random() * 0.4) },
      device: { combined_score: fraudScore * (0.7 + Math.random() * 0.6) },
      pattern: { combined_score: fraudScore * (0.9 + Math.random() * 0.2) }
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
      layer: 3,
      purpose: 'context_analysis',
      known_contexts: this.knownContexts
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
      
      if (modelData.known_contexts) {
        this.knownContexts = modelData.known_contexts;
      }
      
      logger.info(`Modelo analizador de contexto cargado: ${this.networkId} v${this.version}`);
    } catch (error) {
      logger.error('Error al cargar modelo analizador de contexto:', error);
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
      layer: 3,
      purpose: 'context_analysis',
      description: 'Analiza el contexto completo de la transacción considerando factores externos y situacionales'
    };
  }
}

module.exports = ContextAnalyzer;