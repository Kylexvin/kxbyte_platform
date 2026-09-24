// src/modules/platform/uploads/upload.service.js

import crypto from 'crypto';
import cloudinaryUtil from './cloudinary.util.js';

// ============================================================
// PUBLIC ID BUILDER
// ============================================================
// The public_id fully determines the asset path in Cloudinary.
// Frontend can only request signatures for kinds on this list.
// Prevents open-signature abuse (someone using our account as a
// free CDN for arbitrary assets).

const buildPublicId = (orgId, kind) => {
  const uuid = crypto.randomUUID();
  const kinds = {
    logo: `kxbyte/orgs/${orgId}/logos/${uuid}`,
  };
  return kinds[kind] ?? null;
};

// ============================================================
// ISSUE SIGNATURE
// ============================================================

const issueSignature = async (userId, organizationId, { kind }) => {
  const publicId = buildPublicId(organizationId, kind);

  if (!publicId) {
    throw new Error('Invalid upload kind');
  }

  const signature = cloudinaryUtil.generateUploadSignature({
    publicId,
    resourceType: 'image',
  });

  return signature;
};

// ============================================================
// DELETE ASSET
// ============================================================

const deleteAsset = async (publicId) => {
  return cloudinaryUtil.destroyAsset(publicId, 'image');
};

export default {
  issueSignature,
  deleteAsset,
};