// src/modules/platform/authorization/validators/role.validator.js

const validateCreateRole = (data) => {
  const { name } = data;
  const errors = [];

  if (!name || name.trim().length === 0) {
    errors.push('Role name is required');
  }

  if (name && name.trim().length < 2) {
    errors.push('Role name must be at least 2 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateUpdateRole = (data) => {
  const errors = [];

  if (data.name !== undefined && data.name.length < 2) {
    errors.push('Role name must be at least 2 characters');
  }

  if (data.permissionKeys !== undefined && !Array.isArray(data.permissionKeys)) {
    errors.push('Permissions must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateAddPermission = (data) => {
  const { permissionKey } = data;
  const errors = [];

  if (!permissionKey || permissionKey.trim().length === 0) {
    errors.push('Permission key is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validateAssignRole = (data) => {
  const { roleId } = data;
  const errors = [];

  if (!roleId || roleId.trim().length === 0) {
    errors.push('Role ID is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateCreateRole,
  validateUpdateRole,
  validateAddPermission,
  validateAssignRole,
};