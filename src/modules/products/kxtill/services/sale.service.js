// src/modules/products/kxtill/services/sale.service.js

import saleDb from '../db/sale.db.js';
import productDb from '../db/product.db.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import audit from '../../../platform/audit/index.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

const createSale = async (userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.sales.create');
  if (!hasPermission) {
    throw new Error('You do not have permission to create sales');
  }

  let subtotal = 0;
  const saleItems = [];

  for (const item of data.items) {
    const product = await productDb.findProductById(item.productId, organizationId);
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    const unit = await productDb.findUnitById(item.unitId, item.productId);
    if (!unit) {
      throw new Error(`Unit ${item.unitId} not found for product ${item.productId}`);
    }

    const quantity = Number(item.quantity);
    const conversionQty = Number(unit.conversionQty);
    const baseQuantity = quantity * conversionQty;
    const unitPrice = Number(unit.price || product.price);

    if (product.trackInventory && product.stock < baseQuantity) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock} ${product.baseUnit?.abbreviation || 'units'}`);
    }

    const total = quantity * unitPrice;
    subtotal += total;

    saleItems.push({
      productId: product.id,
      unitId: unit.id,
      unitName: unit.name,
      unitAbbrev: unit.abbreviation,
      unitType: unit.unitType,
      quantity: quantity,
      conversionQty: conversionQty,
      unitPrice: unitPrice,
      baseQuantity: baseQuantity,
      taxRate: 0,
      taxAmount: 0,
      discount: 0,
      total: total,
    });

    if (product.trackInventory) {
      await productDb.updateStock(product.id, -baseQuantity);
    }
  }

  const totalAmount = subtotal;

  const sale = await saleDb.createSale({
    organizationId,
    userId,
    subtotal,
    taxAmount: 0,
    discount: 0,
    totalAmount,
    status: 'COMPLETED',
    paymentStatus: 'PAID',
  });

  for (const item of saleItems) {
    await saleDb.createSaleItem({
      ...item,
      saleId: sale.id,
    });
  }

  if (data.paymentMethod) {
    await saleDb.createSalePayment({
      saleId: sale.id,
      method: data.paymentMethod,
      amount: totalAmount,
      reference: data.paymentReference || null,
    });
  }

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SALE_CREATED',
    resource: 'sale',
    resourceId: sale.id,
    metadata: {
      total: totalAmount,
      items: saleItems.length,
    },
  });

  return saleDb.findSaleById(sale.id, organizationId);
};

const getSales = async (organizationId, userId, filters) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return saleDb.findSalesByOrganization(organizationId, filters);
};

const getSale = async (organizationId, userId, saleId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const sale = await saleDb.findSaleById(saleId, organizationId);
  if (!sale) {
    throw new Error('Sale not found');
  }

  return sale;
};

const refundSale = async (organizationId, userId, saleId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.sales.refund');
  if (!hasPermission) {
    throw new Error('You do not have permission to refund sales');
  }

  const sale = await saleDb.findSaleById(saleId, organizationId);
  if (!sale) {
    throw new Error('Sale not found');
  }

  if (sale.status === 'REFUNDED') {
    throw new Error('Sale already refunded');
  }

  for (const item of sale.items) {
    await productDb.updateStock(item.productId, item.baseQuantity);
  }

  const updated = await saleDb.updateSaleStatus(saleId, 'REFUNDED');

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SALE_REFUNDED',
    resource: 'sale',
    resourceId: saleId,
    metadata: {
      originalTotal: sale.totalAmount,
    },
  });

  return updated;
};

export default {
  createSale,
  getSales,
  getSale,
  refundSale,
};