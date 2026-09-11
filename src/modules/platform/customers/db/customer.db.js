// src/modules/platform/customers/db/customer.db.js

import prisma from '../../../../database/postgres/prisma.js';

const createCustomer = async (data) => {
  return prisma.customer.create({ data });
};

const findCustomerById = async (id, organizationId) => {
  return prisma.customer.findFirst({
    where: { id, organizationId, isActive: true },
  });
};

const findCustomerByPhone = async (phone, organizationId) => {
  return prisma.customer.findFirst({
    where: { phone, organizationId, isActive: true },
  });
};

const findCustomersByOrganization = async (organizationId, filters = {}) => {
  const { limit = 50, offset = 0, search, customerType } = filters;
  const where = { organizationId, isActive: true };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (customerType) where.customerType = customerType;

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: offset,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const updateCustomer = async (id, data) => {
  return prisma.customer.update({
    where: { id },
    data,
  });
};

const deleteCustomer = async (id) => {
  return prisma.customer.update({
    where: { id },
    data: { isActive: false },
  });
};

export default {
  createCustomer,
  findCustomerById,
  findCustomerByPhone,
  findCustomersByOrganization,
  updateCustomer,
  deleteCustomer,
};