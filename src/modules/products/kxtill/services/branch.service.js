// src/modules/products/kxtill/services/branch.service.js

import prisma from '../../../../database/postgres/prisma.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import branchDb from '../../../platform/branches/db/branch.db.js';

const getBranchStats = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Get all branches for this organization
  const branches = await branchDb.findBranchesByOrganization(organizationId);

  // Compute stats per branch
  const stats = await Promise.all(
    branches.items.map(async (branch) => {
      // Total stock for this branch
      const branchProducts = await prisma.kxTillBranchProduct.findMany({
        where: {
          branchId: branch.id,
          isAvailable: true,
        },
        select: {
          stock: true,
          minStock: true,
        },
      });

      const totalStock = branchProducts.reduce(
        (sum, p) => sum + Number(p.stock),
        0
      );

      const lowStockCount = branchProducts.filter(
        (p) => Number(p.stock) <= Number(p.minStock)
      ).length;

      // Today's sales
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const salesToday = await prisma.kxTillSale.aggregate({
        where: {
          organizationId,
          branchId: branch.id,
          status: 'COMPLETED',
          createdAt: { gte: todayStart },
        },
        _sum: { totalAmount: true },
        _count: true,
      });

      // This month's sales
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const salesThisMonth = await prisma.kxTillSale.aggregate({
        where: {
          organizationId,
          branchId: branch.id,
          status: 'COMPLETED',
          createdAt: { gte: monthStart },
        },
        _sum: { totalAmount: true },
        _count: true,
      });

      // Product count
      const productsCount = await prisma.kxTillBranchProduct.count({
        where: {
          branchId: branch.id,
          isAvailable: true,
        },
      });

      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        isDefault: branch.isDefault,
        isActive: branch.isActive,
        stats: {
          stock: totalStock,
          lowStockCount,
          products: productsCount,
          salesToday: Number(salesToday._sum?.totalAmount || 0),
          salesTodayCount: salesToday._count || 0,
          salesThisMonth: Number(salesThisMonth._sum?.totalAmount || 0),
          salesThisMonthCount: salesThisMonth._count || 0,
        },
      };
    })
  );

  // Organization-wide totals
  const totals = {
    branches: stats.length,
    activeBranches: stats.filter((b) => b.isActive).length,
    totalStock: stats.reduce((sum, b) => sum + b.stats.stock, 0),
    totalLowStock: stats.reduce((sum, b) => sum + b.stats.lowStockCount, 0),
    totalSalesToday: stats.reduce((sum, b) => sum + b.stats.salesToday, 0),
    totalSalesThisMonth: stats.reduce((sum, b) => sum + b.stats.salesThisMonth, 0),
    totalProducts: stats.reduce((sum, b) => sum + b.stats.products, 0),
  };

  return { branches: stats, totals };
};

const getBranchOverview = async (organizationId, userId, branchId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const branch = await branchDb.findBranchById(branchId, organizationId);
  if (!branch) {
    throw new Error('Branch not found');
  }

  // Stock at this branch
  const branchProducts = await prisma.kxTillBranchProduct.findMany({
    where: { branchId, isAvailable: true },
    include: {
      product: true,
    },
  });

  const totalStock = branchProducts.reduce(
    (sum, p) => sum + Number(p.stock),
    0
  );

  const lowStockItems = branchProducts
    .filter((p) => Number(p.stock) <= Number(p.minStock))
    .map((p) => ({
      productId: p.product.id,
      name: p.product.name,
      sku: p.product.sku,
      stock: Number(p.stock),
      minStock: Number(p.minStock),
    }));

  // Sales today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const salesToday = await prisma.kxTillSale.aggregate({
    where: {
      organizationId,
      branchId,
      status: 'COMPLETED',
      createdAt: { gte: todayStart },
    },
    _sum: { totalAmount: true },
    _count: true,
  });

  // Recent sales
  const recentSales = await prisma.kxTillSale.findMany({
    where: {
      organizationId,
      branchId,
      status: 'COMPLETED',
    },
    include: {
      user: {
        select: { firstName: true, lastName: true },
      },
      items: {
        include: {
          product: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Top products at branch
  const topProducts = await prisma.kxTillSaleItem.groupBy({
    by: ['productId'],
    where: {
      sale: {
        organizationId,
        branchId,
        status: 'COMPLETED',
      },
    },
    _sum: {
      total: true,
      quantity: true,
    },
    orderBy: {
      _sum: { total: 'desc' },
    },
    take: 5,
  });

  const productIds = topProducts.map((p) => p.productId);
  const products = await prisma.kxTillProduct.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true },
  });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const topProductsWithDetails = topProducts.map((p) => ({
    productId: p.productId,
    name: productMap[p.productId]?.name || 'Unknown',
    sku: productMap[p.productId]?.sku || '',
    total: Number(p._sum.total || 0),
    quantity: Number(p._sum.quantity || 0),
  }));

  return {
    branch: {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      email: branch.email,
      isDefault: branch.isDefault,
      isActive: branch.isActive,
    },
    summary: {
      totalProducts: branchProducts.length,
      totalStock,
      lowStockCount: lowStockItems.length,
      salesToday: Number(salesToday._sum?.totalAmount || 0),
      salesTodayCount: salesToday._count || 0,
    },
    lowStockItems,
    recentSales: recentSales.map((s) => ({
      id: s.id,
      reference: s.reference,
      customerName: s.customerName || 'Walk-in',
      total: Number(s.totalAmount),
      itemsCount: s.items.length,
      user: `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim(),
      createdAt: s.createdAt,
    })),
    topProducts: topProductsWithDetails,
  };
};

export default {
  getBranchStats,
  getBranchOverview,
};