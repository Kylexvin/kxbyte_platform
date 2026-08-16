// src/modules/platform/support/validators/ticket.validator.js

const validateCreateTicket = (data) => {
  const errors = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (data.title && data.title.length < 3) {
    errors.push('Title must be at least 3 characters');
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.push('Description is required');
  }

  if (data.description && data.description.length < 10) {
    errors.push('Description must be at least 10 characters');
  }

  if (!data.categoryId) {
    errors.push('Category is required');
  }

  if (data.priority && !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(data.priority)) {
    errors.push('Priority must be LOW, MEDIUM, HIGH, or URGENT');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateUpdateTicket = (data) => {
  const errors = [];

  if (data.status && !['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(data.status)) {
    errors.push('Status must be OPEN, IN_PROGRESS, RESOLVED, or CLOSED');
  }

  if (data.priority && !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(data.priority)) {
    errors.push('Priority must be LOW, MEDIUM, HIGH, or URGENT');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateCreateMessage = (data) => {
  const errors = [];

  if (!data.message || data.message.trim().length === 0) {
    errors.push('Message is required');
  }

  if (data.message && data.message.length < 2) {
    errors.push('Message must be at least 2 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateCreateTicket,
  validateUpdateTicket,
  validateCreateMessage,
};