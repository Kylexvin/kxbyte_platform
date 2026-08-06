// src/modules/platform/identity/middleware/auth.middleware.js

import jwt from '../utils/jwt.js';

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verifyAccessToken(token);
    req.user = { userId: payload.userId, email: payload.email };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired' });
    }
    return res.status(401).json({ error: 'Invalid access token' });
  }
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verifyAccessToken(token);
      req.user = { userId: payload.userId, email: payload.email };
    } catch (error) {
      // Silently fail, user stays unauthenticated
    }
  }
  next();
};

export default {
  authenticate,
  optionalAuth,
};