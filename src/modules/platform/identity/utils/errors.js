// src/modules/platform/identity/utils/errors.js

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  INVALID_VERIFICATION_TOKEN: 'INVALID_VERIFICATION_TOKEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

export class AppError extends Error {
  constructor(code, message, details = undefined, httpStatus = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus ?? DEFAULT_STATUS[code] ?? 500;
  }
}

const DEFAULT_STATUS = {
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.EMAIL_EXISTS]: 409,
  [ERROR_CODES.INVALID_CREDENTIALS]: 401,
  [ERROR_CODES.EMAIL_NOT_VERIFIED]: 403,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.INVALID_RESET_TOKEN]: 400,
  [ERROR_CODES.INVALID_VERIFICATION_TOKEN]: 400,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
};

export const sendError = (res, err) => {
  const code = err.code || ERROR_CODES.INTERNAL_ERROR;
  const message = err.message || 'Internal server error';
  const status = err.httpStatus || DEFAULT_STATUS[code] || 500;

  const body = { error: { code, message } };
  if (err.details) body.error.details = err.details;

  return res.status(status).json(body);
};

export const sendValidationError = (res, fields) => {
  return res.status(400).json({
    error: {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Check the highlighted fields',
      details: { fields },
    },
  });
};