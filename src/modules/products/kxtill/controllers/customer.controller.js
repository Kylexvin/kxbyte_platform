// src/modules/products/kxtill/controllers/customer.controller.js

import customerService from '../services/customer.service.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';

// ============================================================
// PERMISSION HELPER
// ============================================================

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

// ============================================================
// SYNC: GET CUSTOMERS FOR LOCAL DB
// ============================================================

const getCustomersForSync = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'customers.view');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view customers' });
    }

    const { since, limit } = req.query;

    const result = await customerService.getCustomersForSync(organizationId, userId, {
      since,
      limit: limit ? parseInt(limit) : 500,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get customers for sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// SYNC: PUSH OFFLINE-CREATED CUSTOMERS
// ============================================================

const syncOfflineCustomers = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'customers.create');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to create customers' });
    }

    const { customers } = req.body;

    if (!customers || !Array.isArray(customers)) {
      return res.status(400).json({ error: 'Customers array is required' });
    }

    const result = await customerService.syncOfflineCustomers(organizationId, userId, {
      customers,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Sync offline customers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// LIST CUSTOMERS WITH STATS
// ============================================================

const getCustomers = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'customers.view');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view customers' });
    }

    const { limit, offset, search, customerType, source } = req.query;

    const result = await customerService.getCustomersWithStats(organizationId, userId, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      search,
      customerType,
      source,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// GET CUSTOMER DETAIL WITH STATS
// ============================================================

const getCustomer = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, customerId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'customers.view');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view customers' });
    }

    const customer = await customerService.getCustomerWithStats(organizationId, userId, customerId);
    res.status(200).json({ customer });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Customer not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// GET CUSTOMER SALES HISTORY
// ============================================================

const getCustomerSales = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, customerId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'customers.view');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view customers' });
    }

    const { limit, offset } = req.query;

    const result = await customerService.getCustomerSales(organizationId, userId, customerId, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Customer not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get customer sales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// CREATE CUSTOMER FROM KXTILL
// ============================================================

const createCustomer = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'customers.create');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to create customers' });
    }

    const customer = await customerService.createCustomerFromKxTill(organizationId, userId, req.body);
    res.status(201).json({ customer });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Customer name is required' ||
        error.message === 'Either phone or email is required' ||
        error.message === 'A customer with this phone number already exists') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// UPDATE CUSTOMER (KxTill-created only)
// ============================================================

const updateCustomer = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, customerId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'customers.update');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to update customers' });
    }

    const customer = await customerService.updateCustomerFromKxTill(
      organizationId,
      userId,
      customerId,
      req.body
    );

    res.status(200).json({ customer });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Customer not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'A customer with this phone number already exists') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'This customer can only be edited from the product that created it') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// DELETE CUSTOMER (KxTill-created only)
// ============================================================

const deleteCustomer = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, customerId } = req.params;

    const hasPermission = await checkPermission(userId, organizationId, 'customers.delete');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to delete customers' });
    }

    const result = await customerService.deleteCustomerFromKxTill(
      organizationId,
      userId,
      customerId
    );

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Customer not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'This customer can only be deleted from the product that created it') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.startsWith('Cannot delete customer with')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update exports
export default {
  getCustomersForSync,
  syncOfflineCustomers,
  getCustomers,
  getCustomer,
  getCustomerSales,
  createCustomer,
  updateCustomer,     
  deleteCustomer,     
};