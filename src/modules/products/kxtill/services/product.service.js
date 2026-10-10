// src/modules/products/kxtill/services/product.service.js

import productDb from '../db/product.db.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import audit from '../../../platform/audit/index.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';
import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// HELPER: Check permission
// ============================================================

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

// ============================================================
// PRODUCT SERVICE
// ============================================================

const createProduct = async (userId, organizationId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.create');
  if (!hasPermission) {
    throw new Error('You do not have permission to create products');
  }

  // ─── If pharmacy metadata is supplied, the org must have a pharmacy instance ───
  if (data.pharmacy) {
    const hasPharmacy = await prisma.productInstance.findFirst({
      where: {
        vertical: 'pharmacy',
        isActive: true,
        organizationProduct: {
          organizationId,
          isActive: true,
          product: { key: 'kxtill' },
        },
      },
      select: { id: true },
    });
    if (!hasPharmacy) {
      throw new Error('Pharmacy metadata requires an active pharmacy instance');
    }
  }

  // Create product WITH cost
  const product = await productDb.createProduct({
    organizationId,
    name: data.name,
    sku: data.sku,
    description: data.description,
    category: data.category,
    taxRate: 0,
    cost: data.cost || 0,
    trackInventory: data.trackInventory !== undefined ? data.trackInventory : true,
  });

  let baseUnitId = null;

  if (data.baseUnit) {
    const baseUnit = await productDb.createProductUnit({
      productId: product.id,
      name: data.baseUnit.name,
      abbreviation: data.baseUnit.abbreviation,
      unitType: data.baseUnit.unitType || 'WHOLE',
      conversionQty: 1,
      price: data.baseUnit.price,
      cost: data.baseUnit.cost || null,
      allowFractional: data.baseUnit.allowFractional || false,
    });
    baseUnitId = baseUnit.id;
  }

  if (data.units && data.units.length > 0) {
    for (const unit of data.units) {
      await productDb.createProductUnit({
        productId: product.id,
        name: unit.name,
        abbreviation: unit.abbreviation,
        unitType: unit.unitType || 'PACKAGED',
        conversionQty: unit.conversionQty || 1,
        price: unit.price,
        cost: unit.cost || null,
        allowFractional: unit.allowFractional || false,
      });
    }
  }

  if (baseUnitId) {
    await productDb.updateProduct(product.id, organizationId, { baseUnitId });
  }

  const branches = await prisma.branch.findMany({
    where: { organizationId, isActive: true },
  });

  for (const branch of branches) {
    await prisma.kxTillBranchProduct.create({
      data: {
        productId: product.id,
        branchId: branch.id,
        displayName: data.name,
        // Pharmacy products start at 0 — stock enters via batch receiving only.
        stock: data.pharmacy ? 0 : (data.stock || 0),
        minStock: data.minStock || 0,
        isAvailable: true,
      },
    });
  }

  // ─── Attach pharmacy metadata (only when supplied) ───
  if (data.pharmacy) {
    await prisma.kxTillPharmacyProduct.create({
      data: {
        productId: product.id,
        genericName: data.pharmacy.genericName ?? null,
        brandName: data.pharmacy.brandName ?? null,
        strength: data.pharmacy.strength ?? null,
        dosageForm: data.pharmacy.dosageForm ?? null,
        route: data.pharmacy.route ?? null,
        prescriptionCategory: data.pharmacy.prescriptionCategory ?? null,
        packSize: data.pharmacy.packSize ?? null,
        storageConditions: data.pharmacy.storageConditions ?? null,
      },
    });
  }

  const completeProduct = await productDb.findProductById(product.id, organizationId);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_PRODUCT_CREATED',
    resource: 'product',
    resourceId: product.id,
    metadata: {
      name: product.name,
      sku: product.sku,
      hasPharmacyMetadata: !!data.pharmacy,
    },
  });

  return completeProduct;
};

const getProducts = async (organizationId, userId, filters) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return productDb.findProductsByOrganization(organizationId, filters);
};

const getProduct = async (organizationId, userId, productId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const product = await productDb.findProductById(productId, organizationId);
  if (!product) {
    throw new Error('Product not found');
  }

  return product;
};

const updateProduct = async (organizationId, userId, productId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.update');
  if (!hasPermission) {
    throw new Error('You do not have permission to update products');
  }

  // ─── Pharmacy metadata: verify instance before touching it ───
  if (data.pharmacy) {
    const hasPharmacy = await prisma.productInstance.findFirst({
      where: {
        vertical: 'pharmacy',
        isActive: true,
        organizationProduct: {
          organizationId,
          isActive: true,
          product: { key: 'kxtill' },
        },
      },
      select: { id: true },
    });
    if (!hasPharmacy) {
      throw new Error('Pharmacy metadata requires an active pharmacy instance');
    }
  }

  const allowedFields = ['name', 'sku', 'description', 'category', 'taxRate', 'cost', 'trackInventory', 'isActive'];
  const updateData = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  const hasCoreChanges = Object.keys(updateData).length > 0;
  const hasPharmacyChanges = !!data.pharmacy;

  if (!hasCoreChanges && !hasPharmacyChanges) {
    throw new Error('No valid fields to update');
  }

  // ─── Update core product if any core fields changed ───
  let product;
  if (hasCoreChanges) {
    product = await productDb.updateProduct(productId, organizationId, updateData);
  } else {
    // No core fields — just verify product exists
    product = await productDb.findProductById(productId, organizationId);
    if (!product) {
      throw new Error('Product not found');
    }
  }

  // ─── Upsert pharmacy metadata if supplied ───
  if (hasPharmacyChanges) {
    const pharmacyData = {
      genericName: data.pharmacy.genericName,
      brandName: data.pharmacy.brandName,
      strength: data.pharmacy.strength,
      dosageForm: data.pharmacy.dosageForm,
      route: data.pharmacy.route,
      prescriptionCategory: data.pharmacy.prescriptionCategory,
      packSize: data.pharmacy.packSize,
      storageConditions: data.pharmacy.storageConditions,
    };
    // Remove undefined keys so we don't overwrite existing values with undefined
    Object.keys(pharmacyData).forEach((k) => pharmacyData[k] === undefined && delete pharmacyData[k]);

    await prisma.kxTillPharmacyProduct.upsert({
      where: { productId },
      update: pharmacyData,
      create: { productId, ...pharmacyData },
    });
  }

  const completeProduct = await productDb.findProductById(productId, organizationId);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_PRODUCT_UPDATED',
    resource: 'product',
    resourceId: completeProduct.id,
    metadata: {
      name: completeProduct.name,
      updatedFields: [...Object.keys(updateData), ...(hasPharmacyChanges ? ['pharmacy'] : [])],
    },
  });

  return completeProduct;
};

const deleteProduct = async (organizationId, userId, productId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.delete');
  if (!hasPermission) {
    throw new Error('You do not have permission to delete products');
  }

  const product = await productDb.deleteProduct(productId, organizationId);

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_PRODUCT_DELETED',
    resource: 'product',
    resourceId: productId,
    metadata: {
      name: product.name,
    },
  });

  return product;
};

const getLowStockProducts = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.view');
  if (!hasPermission) {
    throw new Error('You do not have permission to view inventory');
  }

  return productDb.getLowStockProducts(organizationId);
};

const getProductByBarcode = async (organizationId, userId, barcode, branchId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const product = await productDb.findProductByBarcode(barcode, organizationId, branchId);
  if (!product) {
    throw new Error('Product not found');
  }

  let branchStock = null;
  if (branchId && product.branchProducts && product.branchProducts.length > 0) {
    const bp = product.branchProducts[0];
    branchStock = {
      stock: bp.stock,
      minStock: bp.minStock,
      isAvailable: bp.isAvailable,
    };
  }

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    category: product.category,
    price: product.price,
    taxRate: product.taxRate,
    baseUnit: product.baseUnit,
    units: product.units,
    stock: branchStock?.stock || 0,
    isAvailable: branchStock?.isAvailable !== false,
  };
};

const searchProducts = async (organizationId, userId, searchTerm, branchId, limit = 20) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const products = await prisma.kxTillProduct.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { sku: { contains: searchTerm, mode: 'insensitive' } },
       
      ],
    },
    include: {
      units: true,
      baseUnit: true,
      branchProducts: {
        where: { branchId },
        include: {
          branch: true,
        },
      },
    },
    take: limit,
  });

  return products.map((product) => {
    const branchProduct = product.branchProducts?.[0];
    return {
      id: product.id,
      productId: product.id,
      name: product.name,
      displayName: branchProduct?.displayName || product.name,
      sku: product.sku,
      category: product.category,
      stock: branchProduct?.stock || 0,
      minStock: branchProduct?.minStock || 0,
      isAvailable: branchProduct?.isAvailable !== false,
      price: branchProduct?.price || product.price,
      baseUnit: product.baseUnit,
      units: product.units,
      branchId: branchId,
      branchName: branchProduct?.branch?.name,
    };
  });
};




// ============================================================
// BRANCH PRODUCTS
// ============================================================

const updateBranchProduct = async (organizationId, userId, branchId, productId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.update');
  if (!hasPermission) {
    throw new Error('You do not have permission to update products');
  }

  if (!membership.hasAllBranches) {
    const hasBranchAccess = await prisma.branchAssignment.findUnique({
      where: {
        membershipId_branchId: {
          membershipId: membership.id,
          branchId,
        },
      },
    });
    if (!hasBranchAccess) {
      throw new Error('You do not have access to this branch');
    }
  }

  const branchProduct = await prisma.kxTillBranchProduct.findFirst({
    where: {
      productId,
      branchId,
      product: { organizationId },
    },
  });

  if (!branchProduct) {
    throw new Error('Branch product not found');
  }

  // ✅ Remove price from update
  const updated = await prisma.kxTillBranchProduct.update({
    where: { id: branchProduct.id },
    data: {
      displayName: data.displayName !== undefined ? data.displayName : branchProduct.displayName,
      description: data.description !== undefined ? data.description : branchProduct.description,
      isAvailable: data.isAvailable !== undefined ? data.isAvailable : branchProduct.isAvailable,
    },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_BRANCH_PRODUCT_UPDATED',
    resource: 'branch_product',
    resourceId: updated.id,
    metadata: {
      productId,
      branchId,
      updatedFields: Object.keys(data),
    },
  });

  return updated;
};

const getBranchProducts = async (organizationId, userId, branchId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Verify the branch actually belongs to this organization. This is the
  // tenant boundary — without it, an owner with `hasAllBranches = true`
  // could pass a foreign branchId and see another org's products.
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!branch) {
    throw new Error('Branch not found');
  }

  // Check branch-level access for non-owner memberships.
  if (!membership.hasAllBranches) {
    const hasBranchAccess = await prisma.branchAssignment.findUnique({
      where: {
        membershipId_branchId: {
          membershipId: membership.id,
          branchId,
        },
      },
    });
    if (!hasBranchAccess) {
      throw new Error('You do not have access to this branch');
    }
  }

  return productDb.getBranchProducts(branchId, organizationId, filters);
};

const updateBranchProductStock = async (organizationId, userId, branchId, productId, stockData) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.update');
  if (!hasPermission) {
    throw new Error('You do not have permission to update inventory');
  }

  // Verify the product actually belongs to this org before touching stock.
  const product = await prisma.kxTillProduct.findFirst({
    where: { id: productId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!product) {
    throw new Error('Product not found');
  }

  const updated = await prisma.kxTillBranchProduct.upsert({
    where: {
      productId_branchId: { productId, branchId },
    },
    update: {
      stock: stockData.stock,
      ...(stockData.minStock !== undefined ? { minStock: stockData.minStock } : {}),
    },
    create: {
      productId,
      branchId,
      stock: stockData.stock ?? 0,
      minStock: stockData.minStock ?? 0,
      isAvailable: true,
    },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_BRANCH_STOCK_UPDATED',
    resource: 'branch_product',
    resourceId: updated.id,
    metadata: {
      productId,
      branchId,
      newStock: updated.stock,
    },
  });

  return updated;
};

const removeBranchProduct = async (organizationId, userId, branchId, productId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.update');
  if (!hasPermission) {
    throw new Error('You do not have permission to update inventory');
  }

  // Branch access check (only if user doesn't have all branches)
  if (!membership.hasAllBranches) {
    const hasBranchAccess = await prisma.branchAssignment.findUnique({
      where: {
        membershipId_branchId: {
          membershipId: membership.id,
          branchId,
        },
      },
    });
    if (!hasBranchAccess) {
      throw new Error('You do not have access to this branch');
    }
  }

  const branchProduct = await prisma.kxTillBranchProduct.findFirst({
    where: {
      productId,
      branchId,
      product: { organizationId },
    },
  });

  if (!branchProduct) {
    throw new Error('Branch product not found');
  }

  // Soft remove: mark unavailable, don't delete. The global product
  // stays intact and the branch row can be reactivated later.
  const updated = await prisma.kxTillBranchProduct.update({
    where: { id: branchProduct.id },
    data: { isAvailable: false },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_BRANCH_PRODUCT_REMOVED',
    resource: 'branch_product',
    resourceId: branchProduct.id,
    metadata: { productId, branchId },
  });

  return updated;
};

const updateProductUnit = async (organizationId, userId, productId, unitId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.update');
  if (!hasPermission) {
    throw new Error('You do not have permission to update products');
  }

  const product = await productDb.findProductById(productId, organizationId);
  if (!product) {
    throw new Error('Product not found');
  }

  const unit = await productDb.findUnitById(unitId, productId);
  if (!unit) {
    throw new Error('Unit not found');
  }

  const updated = await productDb.updateProductUnit(unitId, {
    barcode: data.barcode,
    price: data.price,
    allowFractional: data.allowFractional,
    conversionQty: data.conversionQty,
  });

  return updated;
};

const generateUnitBarcode = async (organizationId, userId, productId, unitId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.update');
  if (!hasPermission) {
    throw new Error('You do not have permission to update products');
  }

  const product = await productDb.findProductById(productId, organizationId);
  if (!product) {
    throw new Error('Product not found');
  }

  const unit = await productDb.findUnitById(unitId, productId);
  if (!unit) {
    throw new Error('Unit not found');
  }

  if (unit.barcode) {
    return unit; // already has one, return as-is
  }

  // Reserved-range EAN-13: prefix 200 (in-store use only)
  // Format: 200 + 9-digit sequence + check digit
  const code = await prisma.$transaction(async (tx) => {
    // Lock to prevent concurrent generation collisions
    const existing = await tx.kxTillProductUnit.findMany({
      where: {
        barcode: { startsWith: '200' },
        product: { organizationId },
      },
      select: { barcode: true },
      orderBy: { barcode: 'desc' },
      take: 1,
    });

    let nextSeq = 1;
    if (existing.length > 0) {
      const last = existing[0].barcode; // "200XXXXXXXXC"
      const seqStr = last.slice(3, 12);  // 9 digits
      nextSeq = parseInt(seqStr, 10) + 1;
    }

    const seqStr = String(nextSeq).padStart(9, '0');
    const twelveDigits = `200${seqStr}`;
    const checkDigit = computeEan13CheckDigit(twelveDigits);
    return `${twelveDigits}${checkDigit}`;
  });

  const updated = await productDb.updateProductUnit(unitId, { barcode: code });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_PRODUCT_UNIT_BARCODE_GENERATED',
    resource: 'product_unit',
    resourceId: unitId,
    metadata: {
      productId,
      barcode: code,
    },
  });

  return updated;
};

// EAN-13 check digit — standard algorithm
const computeEan13CheckDigit = (twelveDigits) => {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(twelveDigits[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return String(remainder === 0 ? 0 : 10 - remainder);
};

const getProductsForSync = async (organizationId, since, limit = 50, offset = 0, branchId) => {
  const result = await productDb.findProductsForSync(organizationId, since, limit, offset, branchId);
  
  // result is already flattened with { items, total, limit, offset }
  return result;
};

const getBranchProductsForSync = async (organizationId, branchId, since, limit = 50, offset = 0) => {
  const where = {
    branchId,
    isAvailable: true,
    product: {
      organizationId,
      isActive: true,          
    },
  };

  if (since) {
    where.updatedAt = { gte: new Date(since) };
  }

  const [items, total] = await Promise.all([
    prisma.kxTillBranchProduct.findMany({
      where,
include: {
  product: {
    include: {
      units: true,
      baseUnit: true,
      pharmacyProduct: true,
    },
  },
  branch: true,
},
      orderBy: { updatedAt: 'asc' },
      skip: offset,
      take: limit,
    }),
    prisma.kxTillBranchProduct.count({ where }),
  ]);

  // Format items consistently
  const formattedItems = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    name: item.product?.name || 'Unknown',
    displayName: item.displayName || item.product?.name || 'Unknown',
    sku: item.product?.sku || null,
    category: item.product?.category || null,
    stock: item.stock,
    minStock: item.minStock,
    isAvailable: item.isAvailable,
    units: item.product?.units || [],
    baseUnit: item.product?.baseUnit || null,
    branchId: item.branchId,
    branchName: item.branch?.name || 'Unknown',
    updatedAt: item.updatedAt,
    pharmacyProduct: item.product?.pharmacyProduct || null,
  }));

  // ─────────────────────────────────────────────────────────
  // PHARMACY ENRICHMENT (optional — only when instance exists)
  //
  // If the org has an active pharmacy instance, attach a `batches`
  // array to each branch product so offline terminals can run FEFO
  // locally. Sorted by expiry ASC (FEFO order). Only batches with
  // quantity > 0 and status = AVAILABLE.
  //
  // Retail orgs: no `batches` key added — response is byte-for-byte
  // identical to before.
  // ─────────────────────────────────────────────────────────
  const hasPharmacy = await prisma.productInstance.findFirst({
    where: {
      vertical: 'pharmacy',
      isActive: true,
      organizationProduct: {
        organizationId,
        isActive: true,
        product: { key: 'kxtill' },
      },
    },
    select: { id: true },
  });

  if (hasPharmacy && formattedItems.length > 0) {
    const branchProductIds = formattedItems.map((i) => i.id);

    const batchStocks = await prisma.kxTillPharmacyBatchStock.findMany({
      where: {
        branchProductId: { in: branchProductIds },
        quantityOnHand: { gt: 0 },
        status: 'AVAILABLE',
      },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
          },
        },
      },
      orderBy: { batch: { expiryDate: 'asc' } },
    });

    // Group by branchProductId
    const byBranchProduct = {};
    for (const bs of batchStocks) {
      if (!byBranchProduct[bs.branchProductId]) {
        byBranchProduct[bs.branchProductId] = [];
      }
      byBranchProduct[bs.branchProductId].push({
        batchId: bs.batch.id,
        batchNumber: bs.batch.batchNumber,
        expiryDate: bs.batch.expiryDate,
        quantityOnHand: Number(bs.quantityOnHand),
        status: bs.status,
      });
    }

    // Attach to each formatted item
    for (const item of formattedItems) {
      item.batches = byBranchProduct[item.id] || [];
    }
  }

  return { items: formattedItems, total, limit, offset };
};

export default {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  getBranchProducts,
  updateBranchProductStock,
  getProductByBarcode,
  searchProducts,
  updateProductUnit,
  getProductsForSync,
  getBranchProductsForSync,
  updateBranchProduct,
  removeBranchProduct,
  generateUnitBarcode,
};