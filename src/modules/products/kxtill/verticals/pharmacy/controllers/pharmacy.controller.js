// src/modules/products/kxtill/verticals/pharmacy/controllers/pharmacy.controller.js
//
// HTTP layer for pharmacy endpoints. No business logic here — validates the
// request shape, calls the service, maps errors to HTTP status codes.

import receivingService from '../services/receiving.service.js';
import pharmacyValidator from '../validators/pharmacy.validator.js';

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

export default {
  receiveBatch,
};