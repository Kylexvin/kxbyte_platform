// src/modules/platform/authorization/controllers/permission.controller.js

import permissionService from '../services/permission.service.js';

const listAllPermissions = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const permissions = await permissionService.listAllPermissions();
    res.status(200).json({ permissions });
  } catch (error) {
    console.error('List permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const listPermissionsByProduct = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { productKey } = req.params;
    const permissions = await permissionService.listPermissionsByProduct(productKey);
    res.status(200).json({ permissions });
  } catch (error) {
    console.error('List permissions by product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getPermissionByKey = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { key } = req.params;
    const permission = await permissionService.getPermissionByKey(key);
    res.status(200).json({ permission });
  } catch (error) {
    if (error.message === 'Permission not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get permission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  listAllPermissions,
  listPermissionsByProduct,
  getPermissionByKey,
};