// src/modules/products/kxtill/services/report.service.js

import prisma from '../../../../database/postgres/prisma.js';
import orgDb from '../../../platform/organizations/db/org.db.js';

// ============================================================
// DASHBOARD SUMMARY
// ============================================================

const getDashboardSummary = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  const monthStart = new Date(now);
  monthStart.setDate(monthStart.getDate() - 30);

  // Today's sales
  const todaySales = await prisma.kxTillSale.aggregate({
    where: {
      organizationId,
      status: 'COMPLETED',
      createdAt: { gte: todayStart },
    },
    _sum: { totalAmount: true },
    _count: true,
  });

  // This week's sales
  const weekSales = await prisma.kxTillSale.aggregate({
    where: {
      organizationId,
      status: 'COMPLETED',
      createdAt: { gte: weekStart },
    },
    _sum: { totalAmount: true },
  });

  // This month's sales
  const monthSales = await prisma.kxTillSale.aggregate({
    where: {
      organizationId,
      status: 'COMPLETED',
      createdAt: { gte: monthStart },
    },
    _sum: { totalAmount: true },
  });

  // Total revenue (all time)
  const totalRevenue = await prisma.kxTillSale.aggregate({
    where: {
      organizationId,
      status: 'COMPLETED',
    },
    _sum: { totalAmount: true },
  });

  // Today's sale count
  const todayCount = await prisma.kxTillSale.count({
    where: {
      organizationId,
      status: 'COMPLETED',
      createdAt: { gte: todayStart },
    },
  });

  // Yesterday's sales for growth comparison
  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);

  const yesterdaySales = await prisma.kxTillSale.aggregate({
    where: {
      organizationId,
      status: 'COMPLETED',
      createdAt: {
        gte: yesterdayStart,
        lt: todayStart,
      },
    },
    _sum: { totalAmount: true },
  });

  const todayTotal = todaySales._sum?.totalAmount || 0;
  const yesterdayTotal = yesterdaySales._sum?.totalAmount || 0;
  const growth = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : 0;

  return {
    today: {
      sales: todayTotal,
      count: todaySales._count || 0,
      growth: Math.round(growth * 100) / 100,
    },
    thisWeek: weekSales._sum?.totalAmount || 0,
    thisMonth: monthSales._sum?.totalAmount || 0,
    totalRevenue: totalRevenue._sum?.totalAmount || 0,
  };
};

// ============================================================
// SALES CHART
// ============================================================

const getSalesChart = async (organizationId, userId, period = '7d') => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const now = new Date();
  let days = 7;
  let labels = [];

  if (period === '7d') days = 7;
  else if (period === '30d') days = 30;
  else if (period === '90d') days = 90;

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    labels.push(`${day}/${month}`);
  }

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Get all sales in the period using Prisma
  const sales = await prisma.kxTillSale.findMany({
    where: {
      organizationId,
      status: 'COMPLETED',
      createdAt: {
        gte: startDate,
      },
    },
    select: {
      createdAt: true,
      totalAmount: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Group by day
  const salesByDay = {};
  for (const sale of sales) {
    const dateStr = sale.createdAt.toISOString().split('T')[0];
    if (!salesByDay[dateStr]) {
      salesByDay[dateStr] = 0;
    }
    salesByDay[dateStr] += Number(sale.totalAmount);
  }

  // Map to labels
  const data = labels.map((_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - 1 - index));
    const dateStr = date.toISOString().split('T')[0];
    return salesByDay[dateStr] || 0;
  });

  return {
    labels,
    datasets: [
      {
        name: 'Sales',
        data,
      },
    ],
  };
};

// ============================================================
// TOP PRODUCTS
// ============================================================

const getTopProducts = async (organizationId, userId, limit = 10) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const topProducts = await prisma.kxTillSaleItem.groupBy({
    by: ['productId'],
    where: {
      sale: {
        organizationId,
        status: 'COMPLETED',
      },
    },
    _sum: {
      total: true,
      quantity: true,
    },
    orderBy: {
      _sum: {
        total: 'desc',
      },
    },
    take: limit,
  });

  // Get product details
  const products = await Promise.all(
    topProducts.map(async (item) => {
      const product = await prisma.kxTillProduct.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          name: true,
          sku: true,
          stock: true,
        },
      });
      return {
        productId: product?.id || '',
        name: product?.name || 'Unknown',
        sku: product?.sku || '',
        total: item._sum.total || 0,
        quantity: item._sum.quantity || 0,
        stock: product?.stock || 0,
      };
    })
  );

  return products;
};

// ============================================================
// LOW STOCK
// ============================================================

const getLowStock = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Use Prisma findMany with where condition
  const products = await prisma.kxTillProduct.findMany({
    where: {
      organizationId,
      isActive: true,
      trackInventory: true,
      stock: {
        lte: prisma.kxTillProduct.fields.minStock,
      },
    },
    include: {
      baseUnit: true,
    },
    orderBy: {
      stock: 'asc',
    },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.stock,
    minStock: p.minStock,
    unit: p.baseUnit?.abbreviation || 'units',
  }));
};

// ============================================================
// RECENT SALES
// ============================================================

const getRecentSales = async (organizationId, userId, limit = 10) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const sales = await prisma.kxTillSale.findMany({
    where: {
      organizationId,
      status: 'COMPLETED',
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      },
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  return sales.map((s) => ({
    id: s.id,
    total: s.totalAmount,
    items: s.items.map((i) => ({
      name: i.product?.name || 'Unknown',
      quantity: i.quantity,
      total: i.total,
    })),
    user: s.user?.firstName || 'Unknown',
    createdAt: s.createdAt,
  }));
};

// ============================================================
// EXPORTS
// ============================================================

export default {
  getDashboardSummary,
  getSalesChart,
  getTopProducts,
  getLowStock,
  getRecentSales,
};