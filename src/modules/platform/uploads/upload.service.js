// src/modules/platform/uploads/upload.service.js

import cloudinaryUtil from './cloudinary.util.js';

// ============================================================
// ALLOWED FOLDERS
// ============================================================
// Frontend can only request signatures for folders on this list.
// Prevents open-signature abuse (someone using our account as a
// free CDN for arbitrary assets).

const buildAllowedFolder = (orgId, kind) => {
  const kinds = {
    logo: `kxbyte/orgs/${orgId}/logos`,
  };
  return kinds[kind] ?? null;
};

// ============================================================
// ISSUE SIGNATURE
// ============================================================

const issueSignature = async (userId, organizationId, { kind, publicId }) => {
  const folder = buildAllowedFolder(organizationId, kind);

  if (!folder) {
    throw new Error('Invalid upload kind');
  }

  const signature = cloudinaryUtil.generateUploadSignature({
    folder,
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