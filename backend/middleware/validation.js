const { logger } = require('../config');

/**
 * Middleware de validación para solicitudes
 */

/**
 * Validar datos de cliente
 */
const validateClient = (req, res, next) => {
  const errors = [];

  // Validaciones requeridas
  if (!req.body.firstName || req.body.firstName.trim().length < 2) {
    errors.push('El nombre debe tener al menos 2 caracteres');
  }

  if (!req.body.lastName || req.body.lastName.trim().length < 2) {
    errors.push('El apellido debe tener al menos 2 caracteres');
  }

  if (!req.body.email || !isValidEmail(req.body.email)) {
    errors.push('Email inválido');
  }

  if (!req.body.phone || !isValidPhone(req.body.phone)) {
    errors.push('Teléfono inválido');
  }

  if (!req.body.dateOfBirth || !isValidDate(req.body.dateOfBirth)) {
    errors.push('Fecha de nacimiento inválida');
  }

  if (!req.body.identificationNumber || req.body.identificationNumber.trim().length < 5) {
    errors.push('Número de identificación inválido');
  }

  // Validaciones opcionales
  if (req.body.riskProfile && !['low', 'medium', 'high'].includes(req.body.riskProfile)) {
    errors.push('Perfil de riesgo debe ser: low, medium o high');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors
    });
  }

  next();
};

/**
 * Validar datos de tarjeta
 */
const validateCard = (req, res, next) => {
  const errors = [];

  // Validar número de tarjeta
  if (!req.body.cardNumber || !isValidCardNumber(req.body.cardNumber)) {
    errors.push('Número de tarjeta inválido');
  }

  // Validar tipo de tarjeta
  if (!req.body.cardType || !['credit', 'debit'].includes(req.body.cardType)) {
    errors.push('Tipo de tarjeta debe ser: credit o debit');
  }

  // Validar banco
  if (!req.body.bank || req.body.bank.trim().length < 3) {
    errors.push('Nombre del banco debe tener al menos 3 caracteres');
  }

  // Validar fecha de expiración
  if (!req.body.expiryDate || !isValidExpiryDate(req.body.expiryDate)) {
    errors.push('Fecha de expiración inválida (formato: YYYY-MM)');
  }

  // Validar límite de crédito (si es tarjeta de crédito)
  if (req.body.cardType === 'credit') {
    if (!req.body.creditLimit || req.body.creditLimit <= 0) {
      errors.push('Límite de crédito debe ser mayor a 0');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors
    });
  }

  next();
};

/**
 * Validar datos de transacción
 */
const validateTransaction = (req, res, next) => {
  const errors = [];

  // Validaciones requeridas
  if (!req.body.clientId || !isValidUUID(req.body.clientId)) {
    errors.push('ID de cliente inválido');
  }

  if (!req.body.cardId || !isValidUUID(req.body.cardId)) {
    errors.push('ID de tarjeta inválido');
  }

  if (!req.body.amount || req.body.amount <= 0 || req.body.amount > 1000000) {
    errors.push('Monto debe ser mayor a 0 y menor a 1,000,000');
  }

  if (!req.body.merchantName || req.body.merchantName.trim().length < 3) {
    errors.push('Nombre del comercio debe tener al menos 3 caracteres');
  }

  if (!req.body.merchantType || !isValidMerchantType(req.body.merchantType)) {
    errors.push('Tipo de comercio inválido');
  }

  if (!req.body.location || req.body.location.trim().length < 3) {
    errors.push('Ubicación debe tener al menos 3 caracteres');
  }

  if (!req.body.latitude || !isValidLatitude(req.body.latitude)) {
    errors.push('Latitud inválida');
  }

  if (!req.body.longitude || !isValidLongitude(req.body.longitude)) {
    errors.push('Longitud inválida');
  }

  if (!req.body.channel || !['online', 'physical', 'atm'].includes(req.body.channel)) {
    errors.push('Canal debe ser: online, physical o atm');
  }

  // Validaciones condicionales
  if (req.body.channel === 'online' && !req.body.ipAddress) {
    errors.push('IP address es requerida para transacciones online');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors
    });
  }

  next();
};

/**
 * Validar parámetros de búsqueda
 */
const validateSearchParams = (req, res, next) => {
  const errors = [];

  // Validar fechas si están presentes
  if (req.query.startDate && !isValidDate(req.query.startDate)) {
    errors.push('Fecha de inicio inválida');
  }

  if (req.query.endDate && !isValidDate(req.query.endDate)) {
    errors.push('Fecha de fin inválida');
  }

  // Validar que la fecha de inicio sea anterior a la fecha de fin
  if (req.query.startDate && req.query.endDate) {
    const start = new Date(req.query.startDate);
    const end = new Date(req.query.endDate);
    if (start > end) {
      errors.push('La fecha de inicio debe ser anterior a la fecha de fin');
    }
  }

  // Validar montos
  if (req.query.minAmount && (isNaN(req.query.minAmount) || req.query.minAmount < 0)) {
    errors.push('Monto mínimo inválido');
  }

  if (req.query.maxAmount && (isNaN(req.query.maxAmount) || req.query.maxAmount < 0)) {
    errors.push('Monto máximo inválido');
  }

  // Validar que el monto mínimo sea menor al máximo
  if (req.query.minAmount && req.query.maxAmount) {
    if (parseFloat(req.query.minAmount) > parseFloat(req.query.maxAmount)) {
      errors.push('El monto mínimo debe ser menor al monto máximo');
    }
  }

  // Validar límite
  if (req.query.limit) {
    const limit = parseInt(req.query.limit);
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      errors.push('Límite debe ser entre 1 y 1000');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación en parámetros de búsqueda',
      errors
    });
  }

  next();
};

// === Funciones de validación auxiliares ===

/**
 * Validar formato de email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validar formato de teléfono
 */
function isValidPhone(phone) {
  // Acepta formatos: +502 1234 5678, 12345678, etc.
  const phoneRegex = /^[\+]?[(]?[0-9]{3,4}[)]?[-\s\.]?[(]?[0-9]{3,4}[)]?[-\s\.]?[0-9]{3,4}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Validar formato de fecha
 */
function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * Validar número de tarjeta (algoritmo de Luhn)
 */
function isValidCardNumber(cardNumber) {
  // Remover espacios
  const cleanNumber = cardNumber.replace(/\s/g, '');
  
  // Verificar que sean solo dígitos y longitud correcta
  if (!/^\d{16}$/.test(cleanNumber)) {
    return false;
  }

  // Algoritmo de Luhn
  let sum = 0;
  let isEven = false;
  
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber.charAt(i), 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return (sum % 10) === 0;
}

/**
 * Validar fecha de expiración de tarjeta
 */
function isValidExpiryDate(expiryDate) {
  // Formato esperado: YYYY-MM
  const regex = /^\d{4}-\d{2}$/;
  if (!regex.test(expiryDate)) {
    return false;
  }

  const [year, month] = expiryDate.split('-').map(Number);
  const now = new Date();
  const expiry = new Date(year, month - 1);

  // La tarjeta no debe estar expirada
  return expiry > now;
}

/**
 * Validar UUID
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validar tipo de comercio
 */
function isValidMerchantType(type) {
  const validTypes = [
    'grocery', 'restaurant', 'gas_station', 'hotel', 'airline',
    'retail', 'online', 'entertainment', 'healthcare', 'education',
    'transportation', 'utilities', 'government', 'atm', 'other',
    'electronics', 'clothing', 'jewelry', 'pharmacy', 'hospital'
  ];
  
  return validTypes.includes(type);
}

/**
 * Validar latitud
 */
function isValidLatitude(lat) {
  const latitude = parseFloat(lat);
  return !isNaN(latitude) && latitude >= -90 && latitude <= 90;
}

/**
 * Validar longitud
 */
function isValidLongitude(lng) {
  const longitude = parseFloat(lng);
  return !isNaN(longitude) && longitude >= -180 && longitude <= 180;
}

/**
 * Sanitizar entrada para prevenir XSS
 */
const sanitizeInput = (req, res, next) => {
  // Función para sanitizar strings
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/[<>]/g, '') // Remover < y >
      .replace(/javascript:/gi, '') // Remover javascript:
      .replace(/on\w+\s*=/gi, '') // Remover event handlers
      .trim();
  };

  // Sanitizar body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }

  // Sanitizar query params
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    });
  }

  // Sanitizar params
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeString(req.params[key]);
      }
    });
  }

  next();
};

/**
 * Validar tamaño de payload
 */
const validatePayloadSize = (maxSize = 1048576) => { // 1MB por defecto
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        success: false,
        message: 'Payload demasiado grande'
      });
    }

    next();
  };
};

module.exports = {
  validateClient,
  validateCard,
  validateTransaction,
  validateSearchParams,
  sanitizeInput,
  validatePayloadSize
};