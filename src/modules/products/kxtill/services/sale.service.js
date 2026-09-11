// src/modules/products/kxtill/services/sale.service.js

import saleDb from '../db/sale.db.js';
import productDb from '../db/product.db.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import branchDb from '../../../platform/branches/db/branch.db.js';
import audit from '../../../platform/audit/index.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';
import prisma from '../../../../database/postgres/prisma.js';

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

// ============================================================
// HELPERS
// ============================================================

const generateReference = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `INV-${timestamp}-${random}`;
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

  // ✅ Validate customer if provided
  let customer = null;
  if (data.customerId) {
    const customerService = await import('../../../platform/customers/index.js');
    customer = await customerService.default.validateCustomer(data.customerId, organizationId);
  }

  let subtotal = 0;
  let taxAmount = 0;
  const saleItems = [];
  let currentBranchProduct = null;

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

    const branchProduct = await prisma.kxTillBranchProduct.findFirst({
      where: {
        productId: product.id,
        branchId: data.branchId,
      },
    });

    if (!branchProduct) {
      throw new Error(`Product ${product.name} is not available at this branch`);
    }

    if (branchProduct.stock < baseQuantity) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${branchProduct.stock} ${product.baseUnit?.abbreviation || 'units'}`);
    }

    const total = quantity * unitPrice;
    const tax = total * (Number(product.taxRate) / 100);

    subtotal += total;
    taxAmount += tax;

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
      taxRate: Number(product.taxRate),
      taxAmount: tax,
      discount: 0,
      total: total + tax,
    });

    await prisma.kxTillBranchProduct.update({
      where: { id: branchProduct.id },
      data: { stock: { decrement: baseQuantity } },
    });

    currentBranchProduct = branchProduct;
  }

  const totalAmount = subtotal + taxAmount;

  const reference = generateReference();

  const sale = await saleDb.createSale({
    organizationId,
    userId,
    reference,
    customerId: customer?.id || null,
    customerName: customer?.name || data.customerName || 'Walk-in',
    branchId: data.branchId,
    subtotal,
    taxAmount,
    discount: 0,
    totalAmount,
    status: 'COMPLETED',
    paymentStatus: 'PAID',
  });

  for (const item of saleItems) {
    await saleDb.createSaleItem({
      ...item,
      saleId: sale.id,
      branchProductId: currentBranchProduct?.id,
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
      reference,
      customerId: customer?.id || null,
      customerName: customer?.name || 'Walk-in',
    },
  });

  return saleDb.findSaleById(sale.id, organizationId);
};

const createOfflineSale = async (userId, organizationId, data) => {
  const {
    clientSaleId,
    branchId,
    customerId,
    customerName,
    items,
    paymentMethod,
    paymentReference,
  } = data;

  // Check if sale already exists (idempotency)
  if (clientSaleId) {
    const existing = await saleDb.findSaleByClientId(clientSaleId);
    if (existing) {
      return existing;
    }
  }

  // Validate organization and branch
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const branch = await branchDb.findBranchById(branchId, organizationId);
  if (!branch) {
    throw new Error('Branch not found');
  }

  // Check permission
  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.sales.create');
  if (!hasPermission) {
    throw new Error('You do not have permission to create sales');
  }

  // ✅ Validate customer if provided
  let customer = null;
  if (customerId) {
    const customerService = await import('../../../platform/customers/index.js');
    customer = await customerService.default.validateCustomer(customerId, organizationId);
  }

  const reference = generateReference();

  let subtotal = 0;
  let taxAmount = 0;
  const saleItems = [];

  for (const item of data.items) {
    const product = await productDb.findProductById(item.productId, organizationId);
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    const branchProduct = await productDb.findBranchProductById(item.branchProductId, organizationId);
    if (!branchProduct) {
      throw new Error(`Branch product ${item.branchProductId} not found`);
    }

    const unit = await productDb.findUnitById(item.unitId, item.productId);
    if (!unit) {
      throw new Error(`Unit ${item.unitId} not found`);
    }

    const quantity = Number(item.quantity);
    const conversionQty = Number(unit.conversionQty);
    const baseQuantity = quantity * conversionQty;
    const unitPrice = Number(item.unitPrice || unit.price || product.price);

    if (product.trackInventory) {
      const stock = Number(branchProduct.stock);
      if (stock < baseQuantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${stock}`);
      }
    }

    const total = quantity * unitPrice;
    const tax = total * (Number(product.taxRate) / 100);

    subtotal += total;
    taxAmount += tax;

    saleItems.push({
      productId: product.id,
      unitId: unit.id,
      branchProductId: branchProduct.id,
      unitName: unit.name,
      unitAbbrev: unit.abbreviation,
      unitType: unit.unitType,
      quantity: quantity,
      conversionQty: conversionQty,
      unitPrice: unitPrice,
      baseQuantity: baseQuantity,
      taxRate: Number(product.taxRate),
      taxAmount: tax,
      discount: 0,
      total: total + tax,
    });

    if (product.trackInventory) {
      await productDb.updateStock(branchProduct.id, -baseQuantity);
    }
  }

  const totalAmount = subtotal + taxAmount;

  const sale = await saleDb.createSale({
    organizationId,
    userId,
    branchId,
    clientSaleId: clientSaleId || null,
    customerId: customer?.id || null,
    customerName: customer?.name || customerName || null,
    reference: reference,
    subtotal,
    taxAmount,
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

  if (paymentMethod) {
    await saleDb.createSalePayment({
      saleId: sale.id,
      method: paymentMethod,
      amount: totalAmount,
      reference: paymentReference || null,
    });
  }

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SALE_CREATED_OFFLINE',
    resource: 'sale',
    resourceId: sale.id,
    metadata: {
      clientSaleId,
      reference,
      total: totalAmount,
      items: saleItems.length,
      customerId: customer?.id || null,
      customerName: customer?.name || customerName || null,
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

const refundSale = async (organizationId, userId, saleId, branchId = null) => {
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

  // ✅ Check branch isolation
  if (branchId && sale.branchId !== branchId) {
    throw new Error('You can only refund sales from your assigned branch');
  }

  // If no branchId provided, check if user has all branches access
  if (!branchId) {
    const hasAllBranches = membership.hasAllBranches || false;
    if (!hasAllBranches) {
      throw new Error('Branch is required to refund this sale');
    }
  }

  if (sale.status === 'REFUNDED') {
    throw new Error('Sale already refunded');
  }

  if (sale.status === 'VOIDED') {
    throw new Error('Sale is voided and cannot be refunded');
  }

  // Restore stock for each item
  for (const item of sale.items) {
    await prisma.kxTillBranchProduct.update({
      where: { id: item.branchProductId },
      data: {
        stock: {
          increment: item.baseQuantity,
        },
      },
    });
  }

  const updated = await saleDb.updateSaleStatus(saleId, 'REFUNDED', userId);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_SALE_REFUNDED',
    resource: 'sale',
    resourceId: saleId,
    metadata: {
      originalTotal: sale.totalAmount,
      refundedBy: userId,
      branchId: sale.branchId,
    },
  });

  return updated;
};

export default {
  createSale,
  getSales,
  getSale,
  refundSale,
  createOfflineSale
};