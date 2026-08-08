// src/modules/platform/payment/db/payment.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ========================
// Merchant Config
// ========================

const findConfigByOrgId = async (organizationId) => {
  return prisma.paymentMerchantConfig.findUnique({
    where: { organizationId },
  });
};

const createConfig = async (data) => {
  return prisma.paymentMerchantConfig.create({ data });
};

const updateConfig = async (organizationId, data) => {
  return prisma.paymentMerchantConfig.update({
    where: { organizationId },
    data,
  });
};

const deleteConfig = async (organizationId) => {
  return prisma.paymentMerchantConfig.delete({
    where: { organizationId },
  });
};

// ========================
// Transactions
// ========================

const createTransaction = async (data) => {
  return prisma.paymentTransaction.create({ data });
};

const findTransactionById = async (id) => {
  return prisma.paymentTransaction.findUnique({
    where: { id },
  });
};

const findTransactionByOrderTrackingId = async (orderTrackingId) => {
  return prisma.paymentTransaction.findFirst({
    where: { orderTrackingId },
  });
};

const findTransactionByMerchantReference = async (merchantReference) => {
  return prisma.paymentTransaction.findFirst({
    where: { merchantReference },
  });
};

const findTransactionsByOrg = async (organizationId, filters = {}) => {
  const { limit = 50, offset = 0, status, productId, startDate, endDate } = filters;
  const where = { organizationId };

  if (status) where.status = status;
  if (productId) where.productId = productId;
  if (startDate) where.createdAt = { gte: new Date(startDate) };
  if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

  const [items, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.paymentTransaction.count({ where }),
  ]);

  return { items, total, limit, offset };
};

const updateTransaction = async (id, data) => {
  return prisma.paymentTransaction.update({
    where: { id },
    data,
  });
};

const updateTransactionByOrderTrackingId = async (orderTrackingId, data) => {
  return prisma.paymentTransaction.update({
    where: { orderTrackingId },
    data,
  });
};

// ========================
// IPN Registrations
// ========================

const createIpnRegistration = async (data) => {
  return prisma.paymentIPNRegistration.create({ data });
};

const findIpnRegistrationByOrg = async (organizationId) => {
  return prisma.paymentIPNRegistration.findFirst({
    where: { organizationId, isActive: true },
  });
};

const findIpnRegistrationByIpnId = async (ipnId) => {
  return prisma.paymentIPNRegistration.findFirst({
    where: { ipnId, isActive: true },
  });
};

const updateIpnRegistration = async (id, data) => {
  return prisma.paymentIPNRegistration.update({
    where: { id },
    data,
  });
};

const findIpnRegistrationsByOrg = async (organizationId) => {
  return prisma.paymentIPNRegistration.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
};

export default {
  // Config
  findConfigByOrgId,
  createConfig,
  updateConfig,
  deleteConfig,
  // Transactions
  createTransaction,
  findTransactionById,
  findTransactionByOrderTrackingId,
  findTransactionByMerchantReference,
  findTransactionsByOrg,
  updateTransaction,
  updateTransactionByOrderTrackingId,
  // IPN
  createIpnRegistration,
  findIpnRegistrationByOrg,
  findIpnRegistrationByIpnId,
  updateIpnRegistration,
  findIpnRegistrationsByOrg,
};