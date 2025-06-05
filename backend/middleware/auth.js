const jwt = require('jsonwebtoken');
const { config, logger } = require('../config');

/**
 * Middleware de autenticación y autorización
 */

/**
 * Verificar token JWT
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token de acceso no proporcionado'
    });
  }

  jwt.verify(token, config.jwt.secret, (err, user) => {
    if (err) {
      logger.warn('Token inválido o expirado:', err.message);
      return res.status(403).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    req.user = user;
    next();
  });
};

/**
 * Verificar roles del usuario
 * @param {Array} allowedRoles - Roles permitidos para el endpoint
 */
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Acceso denegado. Usuario ${req.user.id} con rol ${req.user.role} intentó acceder a recurso restringido`);
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a este recurso'
      });
    }

    next();
  };
};

/**
 * Generar token JWT
 * @param {Object} payload - Datos del usuario
 * @returns {string} - Token JWT
 */
const generateToken = (payload) => {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn
    }
  );
};

/**
 * Verificar token de API (para integraciones externas)
 */
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key no proporcionada'
    });
  }

  // Aquí deberías verificar la API key contra tu base de datos
  // Por ahora, usamos una verificación simple
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({
      success: false,
      message: 'API key inválida'
    });
  }

  // Establecer usuario de API
  req.user = {
    id: 'api-user',
    role: 'api',
    source: 'external-api'
  };

  next();
};

/**
 * Middleware opcional de autenticación (para endpoints públicos con funcionalidad adicional para usuarios autenticados)
 */
const optionalAuthentication = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No hay token, pero permitir continuar
    req.user = null;
    return next();
  }

  jwt.verify(token, config.jwt.secret, (err, user) => {
    if (err) {
      // Token inválido, pero permitir continuar
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
};

/**
 * Rate limiting por usuario
 */
const userRateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const userRequests = requests.get(userId) || [];

    // Limpiar requests antiguos
    const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Demasiadas solicitudes. Por favor, intenta más tarde.'
      });
    }

    validRequests.push(now);
    requests.set(userId, validRequests);

    next();
  };
};

/**
 * Logging de acciones críticas
 */
const logCriticalAction = (action) => {
  return (req, res, next) => {
    const user = req.user;
    const metadata = {
      action,
      userId: user?.id,
      userEmail: user?.email,
      userRole: user?.role,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      endpoint: req.originalUrl,
      method: req.method,
      body: req.body
    };

    logger.info(`Acción crítica: ${action}`, metadata);

    // Agregar metadata a la request para uso posterior
    req.actionMetadata = metadata;

    next();
  };
};

/**
 * Verificar propiedad del recurso
 */
const verifyResourceOwnership = (resourceType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const resourceId = req.params.id || req.params.clientId || req.params.cardId;

      // Admins pueden acceder a cualquier recurso
      if (req.user.role === 'admin') {
        return next();
      }

      // Verificar propiedad según el tipo de recurso
      let hasAccess = false;

      switch (resourceType) {
        case 'client':
          // Verificar si el usuario es el cliente o un agente asignado
          hasAccess = resourceId === userId || req.user.role === 'agent';
          break;

        case 'transaction':
          // Verificar si la transacción pertenece al cliente
          const TransactionModel = require('../models/transactionModel');
          const transaction = await TransactionModel.getTransactionById(resourceId);
          hasAccess = transaction && (transaction.client_id === userId || req.user.role === 'agent');
          break;

        case 'card':
          // Verificar si la tarjeta pertenece al cliente
          const CardModel = require('../models/cardModel');
          const card = await CardModel.getCardById(resourceId);
          hasAccess = card && (card.client_id === userId || req.user.role === 'agent');
          break;

        default:
          hasAccess = false;
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este recurso'
        });
      }

      next();
    } catch (error) {
      logger.error('Error al verificar propiedad del recurso:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  generateToken,
  authenticateApiKey,
  optionalAuthentication,
  userRateLimiter,
  logCriticalAction,
  verifyResourceOwnership
};