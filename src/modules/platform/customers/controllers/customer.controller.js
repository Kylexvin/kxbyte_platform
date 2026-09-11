// src/modules/platform/customers/controllers/customer.controller.js

import customerService from '../services/customer.service.js';
import customerValidator from '../validators/customer.validator.js';

const createCustomer = async (req, res) => {
  const validation = customerValidator.validateCreateCustomer(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const customer = await customerService.createCustomer(userId, organizationId, req.body);
    res.status(201).json({ customer });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'A customer with this phone number already exists') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCustomers = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { limit, offset, search, customerType } = req.query;

    const result = await customerService.getCustomers(organizationId, userId, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      search,
      customerType,
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

const getCustomer = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, customerId } = req.params;
    const customer = await customerService.getCustomer(organizationId, userId, customerId);
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

const updateCustomer = async (req, res) => {
  const validation = customerValidator.validateUpdateCustomer(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, customerId } = req.params;
    const customer = await customerService.updateCustomer(
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
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, customerId } = req.params;
    const result = await customerService.deleteCustomer(organizationId, userId, customerId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Customer not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createCustomer,
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
};