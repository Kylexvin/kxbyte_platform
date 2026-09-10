// src/modules/products/kxtill/transfer/services/transfer.service.js

import prisma from '../../../../../database/postgres/prisma.js';
import transferDb from '../db/transfer.db.js';
import branchProductDb from '../../db/product.db.js';
import orgDb from '../../../../platform/organizations/db/org.db.js';
import audit from '../../../../platform/audit/index.js';
import authorizationService from '../../../../platform/authorization/services/authorization.service.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// HELPER: Check permission (same pattern as product.service.js)
// ============================================================

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

// Platform-level fallback: users with branches.manage can also act on transfers.
// Mirrors the frontend gate so no buttons are shown that would 403.
const canManageTransfersViaPlatform = async (userId, organizationId) => {
  return checkPermission(userId, organizationId, 'branches.manage');
};

const generateReference = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `XF-${timestamp}-${random}`;
};

// ============================================================
// CREATE
// ============================================================

const createTransfer = async (userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasKxtillPerm = await checkPermission(
    userId,
    organizationId,
    'kxtill.inventory.transfers.create'
  );
  const hasPlatformPerm = hasKxtillPerm
    ? true
    : await canManageTransfersViaPlatform(userId, organizationId);

  if (!hasKxtillPerm && !hasPlatformPerm) {
    throw new Error('You do not have permission to create transfers');
  }

  const source = await prisma.kxTillBranchProduct.findFirst({
    where: {
      id: data.sourceBranchProductId,
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true },
      },
      branch: {
        select: { id: true, name: true },
      },
    },
  });

  if (!source) {
    throw new Error('Source branch product not found');
  }

  const destBranchId = data.destBranchId;

  let dest = await prisma.kxTillBranchProduct.findFirst({
    where: {
      productId: source.productId,
      branchId: destBranchId,
    },
  });

  if (!dest) {
    dest = await prisma.kxTillBranchProduct.create({
      data: {
        productId: source.productId,
        branchId: destBranchId,
        displayName: source.product.name,
        stock: 0,
        minStock: 0,
        isAvailable: true,
      },
    });
  }

  const quantity = Number(data.quantitySent);
  const stock = Number(source.stock);
  if (stock < quantity) {
    throw new Error(`Insufficient stock. Available: ${stock}, Requested: ${quantity}`);
  }

  const reference = generateReference();

  const transfer = await transferDb.createTransfer({
    organizationId,
    reference,
    sourceBranchProductId: source.id,
    destBranchProductId: dest.id,
    quantitySent: quantity,
    quantityReceived: null,
    sourceStockBefore: stock,
    sourceStockAfter: stock - quantity,
    destStockBefore: Number(dest.stock),
    destStockAfter: Number(dest.stock) + quantity,
    status: 'PENDING',
    initiatedById: userId,
    notes: data.notes || null,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_TRANSFER_CREATED',
    resource: 'transfer',
    resourceId: transfer.id,
    metadata: {
      reference,
      quantity,
      sourceBranch: source.branchId,
      destBranch: destBranchId,
      product: source.productId,
    },
  });

  return transfer;
};

// ============================================================
// READ
// ============================================================

const getTransfers = async (userId, organizationId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return transferDb.findTransfersByOrganization(organizationId, filters);
};

const getTransfer = async (userId, organizationId, transferId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const transfer = await transferDb.findTransferById(transferId, organizationId);
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  return transfer;
};

// ============================================================
// APPROVE
// ============================================================

const approveTransfer = async (userId, organizationId, transferId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasKxtillPerm = await checkPermission(
    userId,
    organizationId,
    'kxtill.inventory.transfers.approve'
  );
  const hasPlatformPerm = hasKxtillPerm
    ? true
    : await canManageTransfersViaPlatform(userId, organizationId);

  if (!hasKxtillPerm && !hasPlatformPerm) {
    throw new Error('You do not have permission to approve transfers');
  }

  const transfer = await transferDb.findTransferById(transferId, organizationId);
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  if (transfer.status !== 'PENDING') {
    throw new Error(`Transfer is already ${transfer.status.toLowerCase()}`);
  }

  // Deduct stock from source
  await branchProductDb.updateStock(transfer.sourceBranchProductId, -Number(transfer.quantitySent));

  // Add stock to destination
  await branchProductDb.updateStock(transfer.destBranchProductId, Number(transfer.quantitySent));

  const updated = await transferDb.updateTransfer(transferId, {
    status: 'APPROVED',
    approvedById: userId,
    approvedAt: new Date(),
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_TRANSFER_APPROVED',
    resource: 'transfer',
    resourceId: transferId,
    metadata: {
      reference: transfer.reference,
      quantity: transfer.quantitySent,
    },
  });

  return updated;
};

// ============================================================
// COMPLETE
// ============================================================

const completeTransfer = async (userId, organizationId, transferId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasKxtillPerm = await checkPermission(
    userId,
    organizationId,
    'kxtill.inventory.transfers.complete'
  );
  const hasApprovePerm = hasKxtillPerm
    ? true
    : await checkPermission(userId, organizationId, 'kxtill.inventory.transfers.approve');
  const hasPlatformPerm =
    hasKxtillPerm || hasApprovePerm
      ? true
      : await canManageTransfersViaPlatform(userId, organizationId);

  if (!hasKxtillPerm && !hasApprovePerm && !hasPlatformPerm) {
    throw new Error('You do not have permission to complete transfers');
  }

  const transfer = await transferDb.findTransferById(transferId, organizationId);
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  if (transfer.status !== 'APPROVED') {
    throw new Error('Only approved transfers can be completed');
  }

  const updated = await transferDb.updateTransfer(transferId, {
    status: 'COMPLETED',
    quantityReceived: transfer.quantitySent,
    completedById: userId,
    completedAt: new Date(),
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_TRANSFER_COMPLETED',
    resource: 'transfer',
    resourceId: transferId,
    metadata: {
      reference: transfer.reference,
      quantity: transfer.quantitySent,
    },
  });

  return updated;
};

// ============================================================
// REJECT
// ============================================================

const rejectTransfer = async (userId, organizationId, transferId, reason) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasKxtillPerm = await checkPermission(
    userId,
    organizationId,
    'kxtill.inventory.transfers.approve'
  );
  const hasPlatformPerm = hasKxtillPerm
    ? true
    : await canManageTransfersViaPlatform(userId, organizationId);

  if (!hasKxtillPerm && !hasPlatformPerm) {
    throw new Error('You do not have permission to reject transfers');
  }

  const transfer = await transferDb.findTransferById(transferId, organizationId);
  if (!transfer) {
    throw new Error('Transfer not found');
  }

  if (transfer.status !== 'PENDING') {
    throw new Error(`Transfer is already ${transfer.status.toLowerCase()}`);
  }

  const updated = await transferDb.updateTransfer(transferId, {
    status: 'REJECTED',
    rejectedById: userId,
    rejectedAt: new Date(),
    rejectionReason: reason || null,
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_TRANSFER_REJECTED',
    resource: 'transfer',
    resourceId: transferId,
    metadata: {
      reference: transfer.reference,
      reason: reason || 'No reason provided',
    },
  });

  return updated;
};

// ============================================================
// STATS
// ============================================================

const getTransferStats = async (organizationId) => {
  const counts = await transferDb.countTransfersByStatus(organizationId);
  return {
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    pending: counts.PENDING || 0,
    approved: counts.APPROVED || 0,
    completed: counts.COMPLETED || 0,
    rejected: counts.REJECTED || 0,
    failed: counts.FAILED || 0,
  };
};

// ============================================================
// STOCK HELPER
// ============================================================

const updateStock = async (branchProductId, quantity) => {
  return prisma.kxTillBranchProduct.update({
    where: { id: branchProductId },
    data: {
      stock: {
        increment: quantity,
      },
    },
  });
};

export default {
  createTransfer,
  getTransfers,
  getTransfer,
  approveTransfer,
  completeTransfer,
  rejectTransfer,
  getTransferStats,
  updateStock,
};