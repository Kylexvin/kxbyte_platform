// src/modules/platform/authorization/controllers/role.controller.js

import roleService from '../services/role.service.js';
import roleValidator from '../validators/role.validator.js';

const createRole = async (req, res) => {
  const validation = roleValidator.validateCreateRole(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const role = await roleService.createRole(organizationId, userId, req.body);
    res.status(201).json({ role });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can manage roles') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'A role with this name already exists') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getRoles = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const roles = await roleService.getRoles(organizationId, userId);
    res.status(200).json({ roles });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getRole = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, roleId } = req.params;
    const role = await roleService.getRole(organizationId, userId, roleId);
    res.status(200).json({ role });
  } catch (error) {
    if (error.message === 'Organization not found' ||
        error.message === 'Role not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this organization' ||
        error.message === 'Role does not belong to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateRole = async (req, res) => {
  const validation = roleValidator.validateUpdateRole(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, roleId } = req.params;
    const role = await roleService.updateRole(organizationId, userId, roleId, req.body);
    res.status(200).json({ role });
  } catch (error) {
    if (error.message === 'Organization not found' ||
        error.message === 'Role not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can manage roles' ||
        error.message === 'Role does not belong to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'A role with this name already exists') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteRole = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, roleId } = req.params;
    await roleService.deleteRole(organizationId, userId, roleId);
    res.status(200).json({ message: 'Role deleted successfully' });
  } catch (error) {
    if (error.message === 'Organization not found' ||
        error.message === 'Role not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can manage roles' ||
        error.message === 'Role does not belong to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const addPermissionToRole = async (req, res) => {
  const validation = roleValidator.validateAddPermission(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, roleId } = req.params;
    const { permissionKey } = req.body;

    const result = await roleService.addPermissionToRole(
      organizationId,
      userId,
      roleId,
      permissionKey
    );
    res.status(201).json({ message: 'Permission added to role', result });
  } catch (error) {
    if (error.message === 'Organization not found' ||
        error.message === 'Role not found' ||
        error.message === 'Permission not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can manage roles' ||
        error.message === 'Role does not belong to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Permission already assigned to this role') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Add permission to role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removePermissionFromRole = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, roleId, permissionId } = req.params;

    await roleService.removePermissionFromRole(
      organizationId,
      userId,
      roleId,
      permissionId
    );
    res.status(200).json({ message: 'Permission removed from role' });
  } catch (error) {
    if (error.message === 'Organization not found' ||
        error.message === 'Role not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can manage roles' ||
        error.message === 'Role does not belong to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Permission not assigned to this role') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Remove permission from role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const assignRoleToMember = async (req, res) => {
  const validation = roleValidator.validateAssignRole(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, memberId } = req.params;
    const { roleId } = req.body;

    const result = await roleService.assignRoleToMember(
      organizationId,
      userId,
      memberId,
      roleId
    );
    res.status(200).json({ message: 'Role assigned to member', membership: result });
  } catch (error) {
    if (error.message === 'Organization not found' ||
        error.message === 'Role not found' ||
        error.message === 'Member not found in this organization') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can assign roles' ||
        error.message === 'Role does not belong to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Assign role to member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createRole,
  getRoles,
  getRole,
  updateRole,
  deleteRole,
  addPermissionToRole,
  removePermissionFromRole,
  assignRoleToMember,
};