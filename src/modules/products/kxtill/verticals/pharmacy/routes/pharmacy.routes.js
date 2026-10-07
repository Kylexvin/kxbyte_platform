// src/modules/products/kxtill/verticals/pharmacy/routes/pharmacy.routes.js
//
// Pharmacy-only endpoints. Mounted under the kxtill router at /pharmacy.
// Every route here assumes the org has an active pharmacy instance
// (enforced by requirePharmacyInstance middleware upstream).

import express from 'express';
import pharmacyController from '../controllers/pharmacy.controller.js';

const router = express.Router({ mergeParams: true });

// ─── Batch receiving ───
router.post('/batches/receive', pharmacyController.receiveBatch);

export default router;