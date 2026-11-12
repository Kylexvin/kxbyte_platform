// src/modules/products/admin/services/products.service.js
//
// Admin products catalogue — internal only.
// Reads Product + OrganizationProduct + ProductInstance.
// Never returns subscriptions, payments, or tenant billing.

import crypto from 'node:crypto';
import prisma from '../../../../database/postgres/prisma.js';
import audit from '../../../platform/audit/index.js';
import cloudinaryUtil from '../../../platform/uploads/cloudinary.util.js';
import {
  ValidationError,
  NotFoundError,
} from '../../kxcrm/domain/errors.js';

const ADMIN_PRODUCT_KEY = 'admin';

// ============================================================
// LIST
// ============================================================

const listProducts = async () => {
  const products = await prisma.product.findMany({
    where: { key: { not: ADMIN_PRODUCT_KEY } },
    orderBy: { name: 'asc' },
  });

  const enriched = await Promise.all(
    products.map(async (p) => {
      const orgProducts = await prisma.organizationProduct.findMany({
        where: { productId: p.id, isActive: true },
        select: { id: true, organizationId: true },
      });

      const orgProductIds = orgProducts.map((op) => op.id);

      const [instanceCount, verticals] = await Promise.all([
        orgProductIds.length === 0
          ? 0
          : prisma.productInstance.count({
              where: { organizationProductId: { in: orgProductIds }, isActive: true },
            }),
        orgProductIds.length === 0
          ? []
          : prisma.productInstance
              .findMany({
                where: { organizationProductId: { in: orgProductIds }, isActive: true },
                select: { vertical: true },
                distinct: ['vertical'],
              })
              .then((rows) => rows.map((r) => r.vertical).sort()),
      ]);

      return {
        ...p,
        stats: {
          orgCount: orgProducts.length,
          instanceCount,
          verticals,
        },
      };
    })
  );

  return enriched;
};

// ============================================================
// DETAIL
// ============================================================

const getProductDetail = async (key) => {
  if (key === ADMIN_PRODUCT_KEY) {
    throw new ValidationError('RESERVED_PRODUCT', 'The admin product is not managed here');
  }

  const product = await prisma.product.findUnique({
    where: { key },
  });
  if (!product) throw new NotFoundError('PRODUCT_NOT_FOUND', 'Product not found');

  const orgProducts = await prisma.organizationProduct.findMany({
    where: { productId: product.id, isActive: true },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      instances: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          vertical: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
    orderBy: { activatedAt: 'desc' },
  });

  const allInstances = orgProducts.flatMap((op) =>
    op.instances.map((inst) => ({
      ...inst,
      organizationId: op.organization.id,
      organizationName: op.organization.name,
      organizationSlug: op.organization.slug,
    }))
  );

  const verticalMap = new Map();
  for (const inst of allInstances) {
    if (!verticalMap.has(inst.vertical)) {
      verticalMap.set(inst.vertical, {
        vertical: inst.vertical,
        instances: 0,
        orgs: new Set(),
      });
    }
    const v = verticalMap.get(inst.vertical);
    v.instances++;
    v.orgs.add(inst.organizationId);
  }
  const verticals = [...verticalMap.values()].map((v) => ({
    vertical: v.vertical,
    instanceCount: v.instances,
    orgCount: v.orgs.size,
  }));

  return {
    ...product,
    stats: {
      orgCount: orgProducts.length,
      instanceCount: allInstances.length,
    },
    verticals,
    instances: allInstances,
  };
};

// ============================================================
// UPDATE
// ============================================================

const updateProduct = async (key, userId, payload) => {
  if (key === ADMIN_PRODUCT_KEY) {
    throw new ValidationError('RESERVED_PRODUCT', 'The admin product is not editable here');
  }

  const product = await prisma.product.findUnique({ where: { key } });
  if (!product) throw new NotFoundError('PRODUCT_NOT_FOUND', 'Product not found');

  const allowed = ['name', 'description', 'icon', 'isActive'];
  const update = {};
  for (const k of allowed) {
    if (payload[k] !== undefined) update[k] = payload[k];
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError('NOTHING_TO_UPDATE', 'No valid fields to update');
  }

  const updated = await prisma.product.update({
    where: { key },
    data: update,
  });

  await audit.log({
    organizationId: null,
    userId,
    action: 'PRODUCT_UPDATED',
    resource: 'product',
    resourceId: product.id,
    metadata: { productKey: key, updatedFields: Object.keys(update) },
  });

  return updated;
};

// ============================================================
// ICON UPLOAD — signature
// ============================================================

const issueProductIconSignature = async (key, userId) => {
  if (key === ADMIN_PRODUCT_KEY) {
    throw new ValidationError('RESERVED_PRODUCT', 'The admin product does not use catalogue icons');
  }

  const product = await prisma.product.findUnique({ where: { key } });
  if (!product) throw new NotFoundError('PRODUCT_NOT_FOUND', 'Product not found');

  const uuid = crypto.randomUUID();
  const publicId = `kxbyte/products/${key}/logos/${uuid}`;

  const signature = cloudinaryUtil.generateUploadSignature({
    publicId,
    resourceType: 'image',
  });

  await audit.log({
    organizationId: null,
    userId,
    action: 'PRODUCT_ICON_SIGNATURE_ISSUED',
    resource: 'product',
    resourceId: product.id,
    metadata: { productKey: key, publicId },
  });

  return signature;
};

// ============================================================
// ICON UPLOAD — delete (cleanup old assets)
// ============================================================

const deleteProductIcon = async (key, userId, publicId) => {
  if (key === ADMIN_PRODUCT_KEY) {
    throw new ValidationError('RESERVED_PRODUCT', 'The admin product does not use catalogue icons');
  }
  if (!publicId) {
    throw new ValidationError('PUBLIC_ID_REQUIRED', 'publicId is required');
  }

  // Guard: only assets under this product's folder
  const expectedPrefix = `kxbyte/products/${key}/logos/`;
  if (!publicId.startsWith(expectedPrefix)) {
    throw new ValidationError(
      'INVALID_PUBLIC_ID',
      'Cannot delete assets outside this product folder'
    );
  }

  const product = await prisma.product.findUnique({ where: { key } });
  if (!product) throw new NotFoundError('PRODUCT_NOT_FOUND', 'Product not found');

  await cloudinaryUtil.destroyAsset(publicId, 'image');

  await audit.log({
    organizationId: null,
    userId,
    action: 'PRODUCT_ICON_DELETED',
    resource: 'product',
    resourceId: product.id,
    metadata: { productKey: key, publicId },
  });

  return { message: 'Icon deleted' };
};

export default {
  listProducts,
  getProductDetail,
  updateProduct,
  issueProductIconSignature,
  deleteProductIcon,
};