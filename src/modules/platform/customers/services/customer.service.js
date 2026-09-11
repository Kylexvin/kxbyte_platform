// src/modules/platform/customers/services/customer.service.js

import customerDb from '../db/customer.db.js';
import orgDb from '../../organizations/db/org.db.js';
import audit from '../../audit/index.js';

const createCustomer = async (userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Check if phone already exists
  if (data.phone) {
    const existing = await customerDb.findCustomerByPhone(data.phone, organizationId);
    if (existing) {
      throw new Error('A customer with this phone number already exists');
    }
  }

  const customer = await customerDb.createCustomer({
    organizationId,
    name: data.name,
    customerType: data.customerType || 'INDIVIDUAL',
    phone: data.phone || null,
    email: data.email || null,
    taxNumber: data.taxNumber || null,
    companyName: data.companyName || null,
    address: data.address || null,
    city: data.city || null,
    country: data.country || null,
    source: data.source || null,
    createdByProduct: data.createdByProduct || null, 
    notes: data.notes || null,
    isActive: true,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'CUSTOMER_CREATED',
    resource: 'customer',
    resourceId: customer.id,
    metadata: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    },
  });

  return customer;
};

const getCustomers = async (organizationId, userId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return customerDb.findCustomersByOrganization(organizationId, filters);
};

const getCustomer = async (organizationId, userId, customerId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const customer = await customerDb.findCustomerById(customerId, organizationId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  return customer;
};

const updateCustomer = async (organizationId, userId, customerId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const customer = await customerDb.findCustomerById(customerId, organizationId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  // Check if phone is being changed to an existing one
  if (data.phone && data.phone !== customer.phone) {
    const existing = await customerDb.findCustomerByPhone(data.phone, organizationId);
    if (existing) {
      throw new Error('A customer with this phone number already exists');
    }
  }

  const updated = await customerDb.updateCustomer(customerId, data);

  await audit.log({
    organizationId,
    userId,
    action: 'CUSTOMER_UPDATED',
    resource: 'customer',
    resourceId: customerId,
    metadata: {
      updatedFields: Object.keys(data),
    },
  });

  return updated;
};

const deleteCustomer = async (organizationId, userId, customerId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const customer = await customerDb.findCustomerById(customerId, organizationId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  await customerDb.deleteCustomer(customerId);

  await audit.log({
    organizationId,
    userId,
    action: 'CUSTOMER_DELETED',
    resource: 'customer',
    resourceId: customerId,
    metadata: {
      name: customer.name,
    },
  });

  return { message: 'Customer deleted successfully' };
};

// ============================================================
// PUBLIC INTERFACE FOR OTHER MODULES
// ============================================================

const validateCustomer = async (customerId, organizationId) => {
  const customer = await customerDb.findCustomerById(customerId, organizationId);
  if (!customer) {
    throw new Error('Customer not found');
  }
  return customer;
};

export default {
  createCustomer,
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  validateCustomer,
};