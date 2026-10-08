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
/**
 * Social auth rate limiter.
 * Prevents abuse of OAuth initiation endpoints.
 * 5 requests per 15 minutes per IP.
 *
 * Renders a styled HTML page (matching the OAuth login page) instead of JSON,
 * because this limiter is hit inside a popup that users see directly.
 */
export const socialAuthLimiter = rateLimit({
  ...standardConfig,
  windowMs: 15 * 60 * 1000,
  max: 5,
  handler: (req, res) => {
    res.status(429).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Please wait</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }

            body {
              font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
              background: #0e0f13;
              color: #eceef2;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 32px 20px;
              position: relative;
              overflow: hidden;
            }

            body::before,
            body::after {
              content: "";
              position: absolute;
              border-radius: 50%;
              filter: blur(90px);
              pointer-events: none;
              z-index: 0;
            }

            body::before {
              width: 460px;
              height: 460px;
              top: -140px;
              right: 10%;
              background: radial-gradient(circle, rgba(217, 168, 78, 0.18) 0%, rgba(255, 106, 43, 0.06) 55%, transparent 75%);
            }

            body::after {
              width: 420px;
              height: 420px;
              bottom: -160px;
              left: 10%;
              background: radial-gradient(circle, rgba(76, 122, 94, 0.14) 0%, rgba(76, 122, 94, 0.04) 55%, transparent 75%);
            }

            .card {
              position: relative;
              z-index: 1;
              width: 100%;
              max-width: 440px;
              border-radius: 28px;
              background: linear-gradient(180deg, rgba(27, 28, 35, 0.72), rgba(22, 23, 29, 0.6));
              border: 1px solid rgba(255, 255, 255, 0.14);
              backdrop-filter: blur(28px) saturate(140%);
              -webkit-backdrop-filter: blur(28px) saturate(140%);
              box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 2px 0 rgba(255, 255, 255, 0.03) inset, 0 -1px 0 rgba(0, 0, 0, 0.4) inset;
              padding: 40px 36px;
              text-align: center;
            }

            .icon {
              width: 56px;
              height: 56px;
              margin: 0 auto 20px;
              border-radius: 16px;
              background: linear-gradient(150deg, #d9a84e, #ff6a2b);
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .icon svg {
              width: 28px;
              height: 28px;
              stroke: #17181e;
              stroke-width: 2.5;
              fill: none;
              stroke-linecap: round;
              stroke-linejoin: round;
            }

            h2 {
              font-size: 20px;
              font-weight: 600;
              color: #eceef2;
              margin: 0 0 8px;
            }

            p {
              font-size: 14px;
              color: #a3a5b0;
              line-height: 1.5;
              margin: 0 0 24px;
            }

            .btn {
              display: inline-block;
              padding: 12px 32px;
              border-radius: 12px;
              border: none;
              color: #17181e;
              font-size: 14px;
              font-weight: 700;
              background: linear-gradient(150deg, #d9a84e, #ff6a2b);
              cursor: pointer;
              box-shadow: 0 8px 20px rgba(255, 106, 43, 0.32);
              transition: transform 0.15s ease, box-shadow 0.15s ease;
              font-family: inherit;
            }

            .btn:hover {
              transform: translateY(-1px);
              box-shadow: 0 10px 24px rgba(255, 106, 43, 0.4);
            }

            .btn:active {
              transform: translateY(0);
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h2>Too many attempts</h2>
            <p>You've tried to sign in several times in a row. For security, please wait a few minutes and try again.</p>
            <button class="btn" onclick="window.close()">Close</button>
          </div>
        </body>
      </html>
    `);
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