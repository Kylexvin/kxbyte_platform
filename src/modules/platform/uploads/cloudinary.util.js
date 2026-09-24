// src/modules/platform/uploads/cloudinary.util.js

import { v2 as cloudinary } from 'cloudinary';

// ============================================================
// CONFIG
// ============================================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ============================================================
// SIGNATURE
// ============================================================
// Signs a payload the client will POST directly to Cloudinary.
// The client sends the file; we only sign the metadata.

const generateUploadSignature = ({ folder, publicId, resourceType = 'image' }) => {
  const timestamp = Math.round(Date.now() / 1000);

  const paramsToSign = {
    folder,
    timestamp,
  };

  if (publicId) {
    paramsToSign.public_id = publicId;
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
    publicId: publicId ?? null,
    uploadUrl,
  };
};

// ============================================================
// DESTROY
// ============================================================

const destroyAsset = async (publicId, resourceType = 'image') => {
  if (!publicId) return null;
  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
  } catch (err) {
    console.error(`Cloudinary destroy failed for ${publicId}:`, err);
    return null;
  }
};

// ============================================================
// EXPORTS
// ============================================================

export default {
  cloudinary,
  generateUploadSignature,
  destroyAsset,
};