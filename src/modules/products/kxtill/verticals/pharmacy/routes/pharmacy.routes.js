// src/modules/products/kxtill/verticals/pharmacy/routes/pharmacy.routes.js
//
// Pharmacy-only endpoints. Mounted under the kxtill router at /pharmacy.
// Every route here assumes the org has an active pharmacy instance
// (enforced by requirePharmacyInstance middleware upstream).

import express from 'express';
import pharmacyController from '../controllers/pharmacy.controller.js';


const router = express.Router({ mergeParams: true });

// ============================================================
// BATCH RECEIVING
// ============================================================
router.post('/batches/receive', pharmacyController.receiveBatch);

// ============================================================
// BATCH READS
// ============================================================
// NOTE: static paths must be declared BEFORE dynamic paths.
// '/batches/expiring' before any '/batches/:id' (future).
router.get('/batches/expiring', pharmacyController.listExpiringBatches);
router.get('/batches', pharmacyController.listBatches);

// Per-product batches (FEFO-ordered)
router.get('/products/:productId/batches', pharmacyController.listProductBatches);

// ============================================================
// SALES
// ============================================================
router.post('/sales', pharmacyController.createPharmacySale);

// ============================================================
// REFUNDS
// ============================================================

router.post('/sales/:saleId/refund', pharmacyController.createPharmacyRefund);

// ============================================================
// TRANSFERS
// ============================================================
router.post('/transfers/:transferId/approve', pharmacyController.approveTransfer);

export default router;