// src/modules/products/kxtill/verticals/pharmacy/controllers/pharmacy.controller.js
//
// HTTP layer for pharmacy endpoints. No business logic here — validates the
// request shape, calls the service, maps errors to HTTP status codes.

import receivingService from '../services/receiving.service.js';
import batchesService from '../services/batches.service.js';
import pharmacyValidator from '../validators/pharmacy.validator.js';
import pharmacySaleService from '../services/sales/createSale.js';
import saleService from '../../../services/sale.service.js';


/**
 * POST /pharmacy/batches/receive
 *
 * Receives stock into a branch as a specific batch.
 */
const receiveBatch = async (req, res) => {
  // Shape validation
  const validation = pharmacyValidator.validateReceiveBatch(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  // Auth context
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { organizationId } = req.params;

  try {
    const result = await receivingService.receiveBatch({
      organizationId,
      userId,
      productId: req.body.productId,
      branchId: req.body.branchId,
      batchNumber: req.body.batchNumber,
      expiryDate: req.body.expiryDate,
      quantityBase: req.body.quantityBase,
      unitCost: req.body.unitCost,
      sellingPrice: req.body.sellingPrice,
      manufacturedAt: req.body.manufacturedAt,
      manufacturer: req.body.manufacturer,
      reason: req.body.reason,
    });

    return res.status(201).json({
      message: 'Batch received',
      batch: {
        id: result.batch.id,
        productId: result.batch.productId,
        batchNumber: result.batch.batchNumber,
        expiryDate: result.batch.expiryDate,
        manufacturedAt: result.batch.manufacturedAt,
        manufacturer: result.batch.manufacturer,
      },
      batchStock: {
        id: result.batchStock.id,
        branchProductId: result.batchStock.branchProductId,
        quantityOnHand: result.batchStock.quantityOnHand,
        unitCost: result.batchStock.unitCost,
        sellingPrice: result.batchStock.sellingPrice,
        status: result.batchStock.status,
      },
      branchProduct: {
        id: result.branchProduct.id,
        stock: result.branchProduct.stock,
      },
      movement: {
        id: result.movement.id,
        movementType: result.movement.movementType,
        quantity: result.movement.quantity,
        createdAt: result.movement.createdAt,
      },
    });
  } catch (error) {
    if (error.message === 'Branch product not found. Create the product at this branch before receiving stock.') {
      return res.status(404).json({ error: error.message });
    }

    if (
      error.message === 'organizationId is required' ||
      error.message === 'branchId is required' ||
      error.message === 'productId is required' ||
      error.message === 'batchNumber is required' ||
      error.message === 'expiryDate is required' ||
      error.message === 'quantityBase must be greater than 0' ||
      error.message === 'unitCost must be zero or greater' ||
      error.message === 'userId is required'
    ) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Receive batch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// BATCH READS
// ============================================================

/**
 * GET /pharmacy/batches
 * List batches for an org (optionally filtered by branch).
 */
const listBatches = async (req, res) => {
  const validation = pharmacyValidator.validateListQuery(req.query);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  const { organizationId } = req.params;
  const { branchId, take, skip } = req.query;

  try {
    const result = await batchesService.listBatches({
      organizationId,
      branchId: branchId || null,
      take: take ? Number(take) : 100,
      skip: skip ? Number(skip) : 0,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('List batches error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /pharmacy/batches/expiring?days=90&branchId=<uuid>
 * Batches expiring within N days.
 */
const listExpiringBatches = async (req, res) => {
  const validation = pharmacyValidator.validateExpiringQuery(req.query);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  const { organizationId } = req.params;
  const { days, branchId } = req.query;

  try {
    const result = await batchesService.listExpiring({
      organizationId,
      branchId: branchId || null,
      days: days ? Number(days) : 90,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error.message === 'days must be a positive number') {
      return res.status(400).json({ error: error.message });
    }
    console.error('List expiring batches error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /pharmacy/products/:productId/batches?branchId=<uuid>
 * Batches for a single product, FEFO-ordered.
 */
const listProductBatches = async (req, res) => {
  const validation = pharmacyValidator.validateListQuery(req.query);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  const { organizationId, productId } = req.params;
  const { branchId } = req.query;

  try {
    const result = await batchesService.listForProduct({
      organizationId,
      productId,
      branchId: branchId || null,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Product not found in this organization') {
      return res.status(404).json({ error: error.message });
    }
    console.error('List product batches error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// PHARMACY SALES
// ============================================================

/**
 * POST /pharmacy/sales
 *
 * Creates a pharmacy sale. Same body shape as Core's POST /kxtill/sales.
 * The difference: pharmacy runs FEFO behind the scenes — the sale consumes
 * stock from the earliest-expiring batches first, all in one transaction.
 */
const createPharmacySale = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { organizationId } = req.params;

  try {
    const saleId = await pharmacySaleService.createSale({
      userId,
      organizationId,
      data: req.body,
    });

    // Read-back the sale for the response (same shape as Core)
    const sale = await saleService.getSale(organizationId, userId, saleId);

    return res.status(201).json({ sale });
  } catch (error) {
    // Map common errors to HTTP status
    const msg = error.message || '';

    if (msg.includes('Insufficient stock')) {
      return res.status(400).json({
        error: msg,
        code: 'INSUFFICIENT_STOCK',
      });
    }
    if (
      msg === 'Organization not found' ||
      msg === 'Product not found' ||
      msg.includes('not found')
    ) {
      return res.status(404).json({ error: msg });
    }
    if (
      msg.includes('permission') ||
      msg.includes('do not have access')
    ) {
      return res.status(403).json({ error: msg });
    }
    if (
      msg === 'Shift is required' ||
      msg.includes('Credit') ||
      msg.includes('Payments') ||
      msg.includes('payment') ||
      msg.includes('not available at this branch') ||
      msg.includes('required')
    ) {
      return res.status(400).json({ error: msg });
    }

    console.error('Create pharmacy sale error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  receiveBatch,
  listBatches,
  listExpiringBatches,
  createPharmacySale,
  listProductBatches,
};