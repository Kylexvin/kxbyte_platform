// src/modules/platform/uploads/upload.controller.js

import uploadService from './upload.service.js';
import orgDb from '../organizations/db/org.db.js';
import authorizationService from '../authorization/services/authorization.service.js';

// ============================================================
// SIGNATURE
// ============================================================

const getSignature = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { kind, publicId } = req.body ?? {};

    if (!kind) {
      return res.status(400).json({ error: 'kind is required' });
    }

    // ---- Membership ----
    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // ---- Permission ----
    const hasPermission = await authorizationService.checkPermission(
      userId,
      organizationId,
      'settings.manage'
    );
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to upload' });
    }

    const signature = await uploadService.issueSignature(
      userId,
      organizationId,
      { kind, publicId }
    );

    res.status(200).json(signature);
  } catch (error) {
    if (error.message === 'Invalid upload kind') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Get signature error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================
// DELETE ASSET
// ============================================================

const deleteUpload = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { publicId } = req.body ?? {};

    if (!publicId) {
      return res.status(400).json({ error: 'publicId is required' });
    }

    // ---- Membership ----
    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // ---- Permission ----
    const hasPermission = await authorizationService.checkPermission(
      userId,
      organizationId,
      'settings.manage'
    );
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to delete uploads' });
    }

    // ---- Safety: only allow deleting assets under this org's folder ----
    const expectedPrefix = `kxbyte/orgs/${organizationId}/`;
    if (!publicId.startsWith(expectedPrefix)) {
      return res.status(403).json({ error: 'Cannot delete assets outside this organization' });
    }

    await uploadService.deleteAsset(publicId);
    res.status(200).json({ message: 'Upload deleted' });
  } catch (error) {
    console.error('Delete upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getSignature,
  deleteUpload,
};