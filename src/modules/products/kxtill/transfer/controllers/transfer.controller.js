// src/modules/products/kxtill/transfer/controllers/transfer.controller.js

import transferService from '../services/transfer.service.js';
import transferValidator from '../validators/transfer.validator.js';
import orgDb from '../../../../platform/organizations/db/org.db.js';
import prisma from '../../../../../database/postgres/prisma.js';


const createTransfer = async (req, res) => {
  console.log('📦 Create transfer request body:', req.body);

  const validation = transferValidator.validateCreateTransfer(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const transfer = await transferService.createTransfer(userId, organizationId, req.body);
    res.status(201).json({ transfer });
  } catch (error) {
    console.error('❌ Create transfer error:', error); // ← This will show the full error
    res.status(500).json({ error: error.message });
  }
};

const getTransfers = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { status, branchId, productId, limit, offset } = req.query;

    const result = await transferService.getTransfers(userId, organizationId, {
      status,
      branchId,
      productId,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get transfers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTransfer = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, transferId } = req.params;
    const transfer = await transferService.getTransfer(userId, organizationId, transferId);
    res.status(200).json({ transfer });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Transfer not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get transfer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const approveTransfer = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, transferId } = req.params;
    const transfer = await transferService.approveTransfer(userId, organizationId, transferId);
    res.status(200).json({ message: 'Transfer approved', transfer });
  } catch (error) {
    if (error.message === 'Transfer not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('already')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'You do not have permission to approve transfers') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Approve transfer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const completeTransfer = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, transferId } = req.params;
    const transfer = await transferService.completeTransfer(userId, organizationId, transferId);
    res.status(200).json({ message: 'Transfer completed', transfer });
  } catch (error) {
    if (error.message === 'Transfer not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Only approved transfers can be completed')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Complete transfer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const rejectTransfer = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, transferId } = req.params;
    const { reason } = req.body;

    const transfer = await transferService.rejectTransfer(userId, organizationId, transferId, reason);
    res.status(200).json({ message: 'Transfer rejected', transfer });
  } catch (error) {
    if (error.message === 'Transfer not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('already')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'You do not have permission to reject transfers') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Reject transfer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTransferStats = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const stats = await transferService.getTransferStats(organizationId);
    res.status(200).json(stats);
  } catch (error) {
    console.error('Get transfer stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTransferFormData = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;

    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    const branches = await prisma.branch.findMany({
      where: { organizationId, isActive: true },
      include: {
        branchProducts: {
          where: {
            isAvailable: true,
            // ✅ No stock filter — show all products
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
          orderBy: { product: { name: 'asc' } },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      products: branch.branchProducts.map((bp) => ({
        id: bp.id,
        productId: bp.productId,
        productName: bp.product.name,
        stock: bp.stock,
        price: bp.price || null,
        sku: bp.product.sku || null,
      })),
    }));

    res.status(200).json({ branches: result });
  } catch (error) {
    console.error('Get transfer form data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createTransfer,
  getTransfers,
  getTransfer,
  approveTransfer,
  completeTransfer,
  rejectTransfer,
  getTransferStats,
  getTransferFormData,
};