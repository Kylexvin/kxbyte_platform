// src/modules/products/kxtill/verticals/pharmacy/services/sales/getSaleAllocations.js
//
// Read a sale's pharmacy batch allocations.
// Returns, per sale item, the batch(es) that supplied it, with remaining
// refundable quantity — so the refund UI can present a batch picker.

import prisma from '../../../../../../../database/postgres/prisma.js';

const getSaleAllocations = async ({ organizationId, saleId }) => {
  // Verify sale belongs to the org
  const sale = await prisma.kxTillSale.findFirst({
    where: { id: saleId, organizationId },
    select: {
      id: true,
      reference: true,
      status: true,
      refundedAmount: true,
      totalAmount: true,
      items: {
        select: {
          id: true,
          productId: true,
          unitId: true,
          unitName: true,
          unitAbbrev: true,
          quantity: true,
          conversionQty: true,
          unitPrice: true,
          baseQuantity: true,
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  });

  if (!sale) throw new Error('Sale not found');

  // Fetch all allocations for the sale's items
  const itemIds = sale.items.map((i) => i.id);
  const allocations = await prisma.kxTillPharmacySaleBatchAllocation.findMany({
    where: { saleItemId: { in: itemIds } },
    include: {
      batch: {
        select: {
          id: true,
          batchNumber: true,
          expiryDate: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by sale item
  const byItem = {};
  for (const a of allocations) {
    if (!byItem[a.saleItemId]) byItem[a.saleItemId] = [];
    byItem[a.saleItemId].push({
      allocationId: a.id,
      batchId: a.batchId,
      batchStockId: a.batchStockId,
      batchNumber: a.batch.batchNumber,
      expiryDate: a.batch.expiryDate,
      quantity: Number(a.quantity),
      refundedQuantity: Number(a.refundedQuantity || 0),
      remainingRefundable: Number(a.quantity) - Number(a.refundedQuantity || 0),
      unitCost: Number(a.unitCost),
    });
  }

  // Shape items
  const items = sale.items.map((item) => {
    const itemAllocs = byItem[item.id] || [];
    return {
      saleItemId: item.id,
      productId: item.productId,
      productName: item.product?.name || 'Unknown',
      sku: item.product?.sku || null,
      unitName: item.unitName,
      unitAbbrev: item.unitAbbrev,
      quantity: Number(item.quantity),
      conversionQty: Number(item.conversionQty),
      unitPrice: Number(item.unitPrice),
      baseQuantity: Number(item.baseQuantity),
      isPharmacy: itemAllocs.length > 0,
      allocations: itemAllocs,
    };
  });

  return {
    sale: {
      id: sale.id,
      reference: sale.reference,
      status: sale.status,
      totalAmount: Number(sale.totalAmount),
      refundedAmount: Number(sale.refundedAmount),
    },
    items,
  };
};

export default {
  getSaleAllocations,
};