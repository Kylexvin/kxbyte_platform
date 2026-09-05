// src/config/rate-limit.config.js

import rateLimit from 'express-rate-limit';

/**
 * Rate limiting configuration for authentication endpoints.
 * 
 * All limits are applied per IP address.
 * Standard headers (RateLimit-*) are enabled for client transparency.
 */
const standardConfig = {
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Login rate limiter.
 * Limits failed login attempts to prevent brute force attacks.
 * 10 attempts per 15 minutes per IP.
 */
export const loginLimiter = rateLimit({
  ...standardConfig,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many login attempts. Please try again after 15 minutes.',
  },
  skipSuccessfulRequests: true,
});

/**
 * Registration rate limiter.
 * Prevents mass account creation attacks.
 * 5 registrations per hour per IP.
 */
export const registerLimiter = rateLimit({
  ...standardConfig,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many registration attempts. Please try again after an hour.',
  },
});

/**
 * Password reset rate limiter.
 * Prevents email flooding and abuse of reset functionality.
 * 3 reset requests per hour per IP.
 */
export const passwordResetLimiter = rateLimit({
  ...standardConfig,
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many reset attempts. Please try again after an hour.',
  },
});

/**
 * General API rate limiter.
 * Applies to all authenticated endpoints as a baseline.
 * 100 requests per minute per IP.
 */
export const apiLimiter = rateLimit({
  ...standardConfig,
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests. Please slow down.',
  },
});

/**
 * Strict rate limiter for sensitive operations.
 * Applies to endpoints like email verification resend.
 * 3 requests per hour per IP.
 */
export const strictLimiter = rateLimit({
  ...standardConfig,
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many requests. Please try again after an hour.',
  },
});

/**
 * Social auth rate limiter.
 * Prevents abuse of OAuth initiation endpoints.
 * 5 requests per 15 minutes per IP.
 */
export const socialAuthLimiter = rateLimit({
  ...standardConfig,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many social authentication attempts. Please try again later.',
  },
});

/**
 * Session management rate limiter.
 * Prevents abuse of session listing and revocation.
 * 10 requests per minute per IP.
 */
export const sessionLimiter = rateLimit({
  ...standardConfig,
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'Too many session requests. Please slow down.',
  },
});

// Default export for convenience
export default {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  apiLimiter,
  strictLimiter,
  socialAuthLimiter,
  sessionLimiter,
};