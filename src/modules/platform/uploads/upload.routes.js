// src/modules/platform/uploads/upload.routes.js

import express from 'express';
import uploadController from './upload.controller.js';
import authMiddleware from '../identity/middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware.authenticate);

// Get a Cloudinary signature for direct upload
router.post(
  '/organizations/:organizationId/uploads/signature',
  uploadController.getSignature
);

// Delete a previously uploaded asset
router.delete(
  '/organizations/:organizationId/uploads',
  uploadController.deleteUpload
);

export default router;