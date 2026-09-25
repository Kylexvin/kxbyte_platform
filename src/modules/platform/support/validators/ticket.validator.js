// src/modules/platform/support/validators/ticket.validator.js

const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const VALID_CONTEXT_TYPES = ['branch', 'site', 'queue'];

// ============================================================
// CREATE
// ============================================================

const validateCreateTicket = (data) => {
  const errors = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Title is required');
  } else if (data.title.length < 3) {
    errors.push('Title must be at least 3 characters');
  } else if (data.title.length > 120) {
    errors.push('Title must be 120 characters or fewer');
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.push('Description is required');
  } else if (data.description.length < 10) {
    errors.push('Description must be at least 10 characters');
  }

  if (!data.categoryId) {
    errors.push('Category is required');
  }

  if (data.priority && !VALID_PRIORITIES.includes(data.priority)) {
    errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  // Optional context — if either field is present, both must be valid.
  if (data.contextId !== undefined && data.contextId !== null) {
    if (typeof data.contextId !== 'string' || data.contextId.length === 0) {
      errors.push('contextId must be a non-empty string');
    }
  }

  if (data.contextType !== undefined && data.contextType !== null) {
    if (!VALID_CONTEXT_TYPES.includes(data.contextType)) {
      errors.push(`contextType must be one of: ${VALID_CONTEXT_TYPES.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
};

// ============================================================
// UPDATE
// ============================================================

const validateUpdateTicket = (data) => {
  const errors = [];

  if (data.status !== undefined && !VALID_STATUSES.includes(data.status)) {
    errors.push(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (data.priority !== undefined && !VALID_PRIORITIES.includes(data.priority)) {
    errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  if (data.assigneeId !== undefined && data.assigneeId !== null) {
    if (typeof data.assigneeId !== 'string' || data.assigneeId.length === 0) {
      errors.push('assigneeId must be a non-empty string');
    }
  }

  if (
    data.resolutionNote !== undefined &&
    data.resolutionNote !== null &&
    typeof data.resolutionNote !== 'string'
  ) {
    errors.push('resolutionNote must be a string');
  }

  // Prevent updates to fields that are set by the server.
  const forbidden = ['userId', 'organizationId', 'categoryId', 'createdAt'];
  for (const field of forbidden) {
    if (data[field] !== undefined) {
      errors.push(`${field} cannot be updated`);
    }
  }

  return { valid: errors.length === 0, errors };
};

// ============================================================
// MESSAGE
// ============================================================

const validateCreateMessage = (data) => {
  const errors = [];

  if (!data.message || data.message.trim().length === 0) {
    errors.push('Message is required');
  } else if (data.message.length < 2) {
    errors.push('Message must be at least 2 characters');
  }

  if (data.isInternal !== undefined && typeof data.isInternal !== 'boolean') {
    errors.push('isInternal must be a boolean');
  }

  return { valid: errors.length === 0, errors };
};

export default {
  validateCreateTicket,
  validateUpdateTicket,
  validateCreateMessage,
};