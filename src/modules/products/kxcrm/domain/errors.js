// src/modules/products/kxcrm/domain/errors.js
//
// Typed errors thrown by engine rules and services.
// Surfaces (admin/crm, future kxcrm controllers) map by err.name
// to HTTP status. Engine never imports anything from surfaces.

export class ValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

export class ForbiddenError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ForbiddenError';
    this.code = code;
  }
}

export class NotFoundError extends Error {
  constructor(code = 'NOT_FOUND', message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.code = code;
  }
}

export class ConflictError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ConflictError';
    this.code = code;
  }
}