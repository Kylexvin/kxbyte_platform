// src/modules/products/kxtill/db/sale.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// SALES
// ============================================================

const createSale = async (data) => {
  return prisma.kxTillSale.create({ data });
};

const findSaleByClientId = async (clientSaleId) => {
  return prisma.kxTillSale.findUnique({
    where: { clientSaleId },
    include: {
      items: {
        include: {
          product: true,
          unit: true,
        },
      },
      payments: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      refundedByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      branch: true,
    },
  });
};

const findSaleById = async (id, organizationId) => {
  return prisma.kxTillSale.findFirst({
    where: { id, organizationId },
    include: {
      items: {
        include: {
          product: true,
          unit: true,
        },
      },
      payments: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      refundedByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      branch: true,
      customer: true, // ✅ Add this
    },
  });
};

const findSalesByOrganization = async (organizationId, filters = {}) => {
  const { 
    limit = 50, 
    offset = 0, 
    startDate, 
    endDate, 
    status,
    branchId,
    search,
  } = filters;
  
  const where = { 
    organizationId,
  };

  if (branchId) {
    where.branchId = branchId;
  }

  if (startDate) {
    where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
  }
  if (endDate) {
    where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
  }
  if (status) {
    where.status = status;
  }
  
  if (search) {
    where.OR = [
      { reference: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.kxTillSale.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
            unit: true,
          },
        },
        payments: {
          select: {
            id: true,
            method: true,
            amount: true,
            reference: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        refundedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        customer: true, // ✅ Add this
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.kxTillSale.count({ where }),
  ]);

  const mappedItems = items.map(sale => ({
    id: sale.id,
    reference: sale.reference,
    customerId: sale.customerId,
    customerName: sale.customer?.name || sale.customerName || 'Walk-in Customer',
    customer: sale.customer,
    branch: sale.branch,
    user: sale.user,
    subtotal: sale.subtotal,
    taxAmount: sale.taxAmount,
    discount: sale.discount,
    totalAmount: sale.totalAmount,
    status: sale.status,
    paymentStatus: sale.paymentStatus,
    paymentMethod: sale.payments && sale.payments.length > 0 
      ? sale.payments[0].method 
      : null,
    itemsCount: sale.items?.length || 0,
    items: sale.items,
    payments: sale.payments,
    refundedByUser: sale.refundedByUser,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  }));

  return { 
    items: mappedItems, 
    total, 
    limit, 
    offset 
  };
};

const updateSaleStatus = async (id, status, userId = null) => {
  const data = { 
    status,
    updatedAt: new Date(),
  };
  
  if (userId) {
    // use refundedBy (exists in schema) instead of updatedBy (doesn't exist)
    if (status === 'REFUNDED') {
      data.refundedBy = userId;
      data.refundedAt = new Date();
    }
  }
  
  return prisma.kxTillSale.update({
    where: { id },
    data,
  });
};

// ============================================================
// SALE ITEMS
// ============================================================

const createSaleItem = async (data) => {
  return prisma.kxTillSaleItem.create({ data });
};

const createManySaleItems = async (items) => {
  return prisma.kxTillSaleItem.createMany({ data: items });
};

// ============================================================
// SALE PAYMENTS
// ============================================================

const createSalePayment = async (data) => {
  return prisma.kxTillSalePayment.create({ data });
};

export default {
  createSale,
  findSaleById,
  findSalesByOrganization,
  updateSaleStatus,
  createSaleItem,
  createManySaleItems,
  createSalePayment,
  findSaleByClientId,
};