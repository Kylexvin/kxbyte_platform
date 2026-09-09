// src/modules/products/kxtill/services/report.service.js

import prisma from '../../../../database/postgres/prisma.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import branchDb from '../../../platform/branches/db/branch.db.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';

const checkPermission = async (userId, organizationId, permissionKey) => {
  return authorizationService.checkPermission(userId, organizationId, permissionKey);
};

// ============================================================
// DASHBOARD SUMMARY
// ============================================================

const getEmptySummary = () => ({
  totalSales: 0,
  totalRevenue: 0,
  activeUsers: 0,
  conversionRate: 0,
  averageOrderValue: 0,
  growth: 0,
  inventoryItems: 0,
  lowStock: 0,
});

const getDashboardSummary = async (organizationId, userId, period = '30d', branchId = null) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const org = await orgDb.findOrganizationById(organizationId);
  const isOwner = org?.ownerId === userId;
  const hasAllBranches = membership.hasAllBranches || false;

  // ✅ Determine branch filter
  let branchFilter = {};

  if (branchId) {
    // Explicit branch filter
    branchFilter = { branchId };
  } else if (!isOwner && !hasAllBranches) {
    // Get user's assigned branches
    const assignments = await prisma.branchAssignment.findMany({
      where: { membershipId: membership.id },
      include: { branch: true },
    });

    const assignedBranchIds = assignments.map(a => a.branchId);

    if (assignedBranchIds.length === 0) {
      return getEmptySummary();
    }

    if (assignedBranchIds.length === 1) {
      branchFilter = { branchId: assignedBranchIds[0] };
    } else {
      branchFilter = { branchId: { in: assignedBranchIds } };
    }
  }
  // If owner or hasAllBranches, no branch filter (all branches)

  const now = new Date();
  let startDate = new Date(now);

  if (period === 'today') {
    startDate.setHours(0, 0, 0, 0);
  } else if (period === '7d') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '30d') {
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === '90d') {
    startDate.setDate(startDate.getDate() - 90);
  } else {
    startDate.setDate(startDate.getDate() - 30);
  }

  // ✅ Build WHERE with branch filter
  const where = {
    organizationId,
    status: 'COMPLETED',
    createdAt: { gte: startDate },
    ...branchFilter,
  };

  // Total sales
  const totalSales = await prisma.kxTillSale.aggregate({
    where,
    _count: true,
    _sum: { totalAmount: true },
  });

  // Previous period for growth
  const diffDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - diffDays);
  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);

  const prevWhere = {
    organizationId,
    status: 'COMPLETED',
    createdAt: {
      gte: prevStartDate,
      lte: prevEndDate,
    },
    ...branchFilter,
  };

  const prevSales = await prisma.kxTillSale.aggregate({
    where: prevWhere,
    _sum: { totalAmount: true },
  });

  // Active users
  let activeUsers = 0;
  let totalBranchMembers = 0;

  const salesByUser = await prisma.kxTillSale.groupBy({
    by: ['userId'],
    where,
  });
  activeUsers = salesByUser.length;

  totalBranchMembers = await prisma.membership.count({
    where: {
      organizationId,
      isActive: true,
      ...(branchFilter.branchId ? {
        OR: [
          { hasAllBranches: true },
          {
            branchAssignments: {
              some: branchFilter.branchId.in
                ? { branchId: { in: branchFilter.branchId.in } }
                : { branchId: branchFilter.branchId },
            },
          },
        ],
      } : {}),
    },
  });

  // Inventory items
  const inventoryWhere = {
    product: { organizationId, isActive: true, trackInventory: true },
    isAvailable: true,
    ...(branchFilter.branchId ? {
      branchId: branchFilter.branchId.in
        ? { in: branchFilter.branchId.in }
        : branchFilter.branchId,
    } : {}),
  };

  const inventoryItems = await prisma.kxTillBranchProduct.aggregate({
    where: inventoryWhere,
    _sum: { stock: true },
  });

  const lowStock = await prisma.kxTillBranchProduct.count({
    where: {
      ...inventoryWhere,
      stock: {
        lte: prisma.kxTillBranchProduct.fields.minStock,
      },
    },
  });

  const currentTotal = Number(totalSales._sum?.totalAmount || 0);
  const prevTotal = Number(prevSales._sum?.totalAmount || 0);
  const growth = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;
  const totalSalesCount = totalSales._count || 0;

  return {
    totalSales: totalSalesCount,
    totalRevenue: currentTotal,
    activeUsers: activeUsers || 0,
    conversionRate: totalBranchMembers > 0 ? Math.round((activeUsers / totalBranchMembers) * 100) : 0,
    averageOrderValue: totalSalesCount > 0 ? Math.round(currentTotal / totalSalesCount) : 0,
    growth: Math.round(growth * 10) / 10,
    inventoryItems: Number(inventoryItems._sum?.stock || 0),
    lowStock: lowStock || 0,
  };
};

const getTodayStats = async (organizationId, userId, branchId = null) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const org = await orgDb.findOrganizationById(organizationId);
  const isOwner = org?.ownerId === userId;
  const hasAllBranches = membership.hasAllBranches || false;

  // Determine branch filter
  let branchFilter = {};
  if (branchId) {
    branchFilter = { branchId };
  } else if (!isOwner && !hasAllBranches) {
    const assignments = await prisma.branchAssignment.findMany({
      where: { membershipId: membership.id },
    });
    const assignedBranchIds = assignments.map(a => a.branchId);
    if (assignedBranchIds.length === 0) {
      return { todaySales: 0, transactions: 0, profit: 0, itemsSold: 0 };
    }
    if (assignedBranchIds.length === 1) {
      branchFilter = { branchId: assignedBranchIds[0] };
    } else {
      branchFilter = { branchId: { in: assignedBranchIds } };
    }
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const where = {
    organizationId,
    status: 'COMPLETED',
    createdAt: { gte: todayStart },
    ...branchFilter,
  };

  // Get today's sales
  const sales = await prisma.kxTillSale.aggregate({
    where,
    _count: true,
    _sum: { totalAmount: true },
  });

  // Get items sold
  const itemsSold = await prisma.kxTillSaleItem.aggregate({
    where: {
      sale: where,
    },
    _sum: { quantity: true },
  });

  // Calculate profit (simplified)
  let profit = 0;
  const saleItems = await prisma.kxTillSaleItem.findMany({
    where: {
      sale: where,
    },
    include: {
      product: true,
      unit: true,
    },
  });

  for (const item of saleItems) {
    const unitCost = item.unit?.cost !== null && item.unit?.cost !== undefined
      ? Number(item.unit.cost)
      : (Number(item.product?.cost || 0) * Number(item.conversionQty));
    const totalCost = unitCost * Number(item.quantity);
    const totalRevenue = Number(item.total);
    profit += totalRevenue - totalCost;
  }

  const todaySales = Number(sales._sum?.totalAmount || 0);
  const transactions = sales._count || 0;

  return {
    todaySales,
    transactions,
    profit: Math.round(profit),
    itemsSold: Number(itemsSold._sum?.quantity || 0),
  };
};

// ============================================================
// SALES CHART
// ============================================================

const getSalesChart = async (organizationId, userId, period = '30d', branchId = null, interval = 'day') => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Enforce branch access
  if (!membership.hasAllBranches) {
    const assignments = await prisma.branchAssignment.findMany({
      where: { membershipId: membership.id },
      select: { branchId: true },
    });
    const assignedBranchIds = assignments.map(a => a.branchId);

    if (branchId) {
      if (!assignedBranchIds.includes(branchId)) {
        throw new Error('You do not have access to this branch');
      }
    } else {
      if (assignedBranchIds.length === 0) {
        throw new Error('You do not have access to any branch');
      }
      branchId = assignedBranchIds[0];
    }
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.sales.view');
  if (!hasPermission) {
    throw new Error('You do not have permission to view sales');
  }

  const now = new Date();
  let days = 30;
  if (period === '7d') days = 7;
  else if (period === '30d') days = 30;
  else if (period === '90d') days = 90;

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const where = {
    organizationId,
    status: 'COMPLETED',
    createdAt: { gte: startDate },
  };
  if (branchId) where.branchId = branchId;

  // Get sales
  const sales = await prisma.kxTillSale.findMany({
    where,
    select: {
      createdAt: true,
      totalAmount: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by day
  const salesByDay = {};
  let total = 0;
  for (const sale of sales) {
    const dateStr = sale.createdAt.toISOString().split('T')[0];
    if (!salesByDay[dateStr]) {
      salesByDay[dateStr] = 0;
    }
    salesByDay[dateStr] += Number(sale.totalAmount);
    total += Number(sale.totalAmount);
  }

  // Build data array
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const label = date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
    data.push({
      date: dateStr,
      label: label,
      value: salesByDay[dateStr] || 0,
    });
  }

  // Calculate trend (compare last 7 days to previous 7 days)
  const last7Days = data.slice(-7);
  const prev7Days = data.slice(-14, -7);
  const lastTotal = last7Days.reduce((sum, d) => sum + d.value, 0);
  const prevTotal = prev7Days.reduce((sum, d) => sum + d.value, 0);
  const trend = prevTotal > 0 ? ((lastTotal - prevTotal) / prevTotal) * 100 : 0;

  return {
    data,
    total,
    trend: Math.round(trend * 10) / 10,
  };
};

// ============================================================
// TOP PRODUCTS
// ============================================================

const getTopProducts = async (organizationId, userId, limit = 10, branchId = null) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.sales.view');
  if (!hasPermission) {
    throw new Error('You do not have permission to view sales');
  }

  // Build where clause for sale items
  const saleWhere = {
    sale: {
      organizationId,
      status: 'COMPLETED',
    },
  };

  if (branchId) {
    saleWhere.sale.branchId = branchId;
  }

  // Group by productId
  const topProducts = await prisma.kxTillSaleItem.groupBy({
    by: ['productId'],
    where: saleWhere,
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

  // Get product details (no stock field)
  const products = await Promise.all(
    topProducts.map(async (item) => {
      const product = await prisma.kxTillProduct.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          name: true,
          sku: true,
          // ✅ stock removed — it's now in KxTillBranchProduct
        },
      });

      // Get stock for this branch (or all branches)
      let stock = 0;
      if (branchId) {
        const branchProduct = await prisma.kxTillBranchProduct.findUnique({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId,
            },
          },
          select: { stock: true },
        });
        stock = branchProduct?.stock || 0;
      } else {
        // Get total stock across all branches
        const totalStock = await prisma.kxTillBranchProduct.aggregate({
          where: {
            productId: item.productId,
            product: { organizationId },
          },
          _sum: { stock: true },
        });
        stock = totalStock._sum?.stock || 0;
      }

      return {
        productId: product?.id || '',
        name: product?.name || 'Unknown',
        sku: product?.sku || '',
        total: item._sum.total || 0,
        quantity: item._sum.quantity || 0,
        stock: stock,
      };
    })
  );

  return products;
};

// ============================================================
// LOW STOCK
// ============================================================

const getLowStock = async (organizationId, userId, branchId = null) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Enforce branch access
  if (!membership.hasAllBranches) {
    const assignments = await prisma.branchAssignment.findMany({
      where: { membershipId: membership.id },
      select: { branchId: true },
    });
    const assignedBranchIds = assignments.map(a => a.branchId);

    if (branchId) {
      if (!assignedBranchIds.includes(branchId)) {
        throw new Error('You do not have access to this branch');
      }
    } else {
      if (assignedBranchIds.length === 0) {
        throw new Error('You do not have access to any branch');
      }
      branchId = assignedBranchIds[0];
    }
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.view');
  if (!hasPermission) {
    throw new Error('You do not have permission to view inventory');
  }

  const where = {
    product: {
      organizationId,
      isActive: true,
      trackInventory: true,
    },
    isAvailable: true,
    stock: {
      lte: prisma.kxTillBranchProduct.fields.minStock,
    },
  };

  if (branchId) {
    where.branchId = branchId;
  }

  const branchProducts = await prisma.kxTillBranchProduct.findMany({
    where,
    include: {
      product: {
        include: {
          baseUnit: true,
        },
      },
      branch: true,
    },
    orderBy: { stock: 'asc' },
  });

  return branchProducts.map((bp) => ({
    id: bp.id,
    productId: bp.productId,
    name: bp.product.name,
    sku: bp.product.sku,
    stock: bp.stock,
    minStock: bp.minStock,
    unit: bp.product.baseUnit?.abbreviation || 'units',
    branchId: bp.branchId,
    branchName: bp.branch.name,
  }));
};


// ============================================================
// RECENT SALES
// ============================================================

const getRecentSales = async (organizationId, userId, limit = 10, branchId = null) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.sales.view');
  if (!hasPermission) {
    throw new Error('You do not have permission to view sales');
  }

  // Build where clause
  const where = {
    organizationId,
    status: 'COMPLETED',
  };

  // If branchId is provided, filter by it
  if (branchId) {
    where.branchId = branchId;
  } else if (!membership.hasAllBranches) {
    // If user doesn't have all branches, get their assigned branches
    const assignments = await prisma.branchAssignment.findMany({
      where: { membershipId: membership.id },
      select: { branchId: true },
    });
    const assignedBranchIds = assignments.map(a => a.branchId);

    if (assignedBranchIds.length === 0) {
      throw new Error('You do not have access to any branch');
    }

    where.branchId = { in: assignedBranchIds };
  }

  const sales = await prisma.kxTillSale.findMany({
    where,
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
      branch: {
        select: {
          name: true,
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
    branchName: s.branch?.name || 'Unknown',
    createdAt: s.createdAt,
  }));
};

const getTodaySales = async (organizationId, userId, branchId = null) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.sales.view');
  if (!hasPermission) {
    throw new Error('You do not have permission to view sales');
  }

  // Enforce branch access
  if (!membership.hasAllBranches) {
    const assignments = await prisma.branchAssignment.findMany({
      where: { membershipId: membership.id },
      select: { branchId: true },
    });
    const assignedBranchIds = assignments.map(a => a.branchId);

    if (branchId) {
      if (!assignedBranchIds.includes(branchId)) {
        throw new Error('You do not have access to this branch');
      }
    } else {
      if (assignedBranchIds.length === 0) {
        throw new Error('You do not have access to any branch');
      }
      branchId = assignedBranchIds[0];
    }
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const where = {
    organizationId,
    status: 'COMPLETED',
    createdAt: { gte: todayStart },
  };

  if (branchId) {
    where.branchId = branchId;
  }

  // Get today's sales
  const sales = await prisma.kxTillSale.findMany({
    where,
    include: {
      items: {
        include: {
          product: {
            select: { name: true },
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
    orderBy: { createdAt: 'desc' },
  });

  // Calculate totals
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const averageOrder = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;

  // Find top seller
  const productCounts = {};
  for (const sale of sales) {
    for (const item of sale.items) {
      const name = item.product?.name || 'Unknown';
      if (!productCounts[name]) {
        productCounts[name] = 0;
      }
      productCounts[name] += Number(item.quantity);
    }
  }
  let topSeller = '—';
  let maxCount = 0;
  for (const [name, count] of Object.entries(productCounts)) {
    if (count > maxCount) {
      maxCount = count;
      topSeller = name;
    }
  }

  // Recent transactions (last 10)
  const recentTransactions = sales.slice(0, 10).map((s) => ({
    id: s.id,
    invoice: s.id.slice(0, 8).toUpperCase(),
    customer: 'Walk-in', // Will be updated when customer module is added
    amount: Number(s.totalAmount),
    items: s.items.reduce((sum, i) => sum + Number(i.quantity), 0),
    time: new Date(s.createdAt).toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    user: s.user ? `${s.user.firstName} ${s.user.lastName}`.trim() : 'Unknown',
  }));

  return {
    today: {
      date: now.toISOString().split('T')[0],
      totalSales,
      totalRevenue,
      averageOrder,
      topSeller,
    },
    recentTransactions,
  };
};

// BRANCH OVERVIEW
const getBranchOverview = async (organizationId, userId, period = 'today') => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'branches.view');
  if (!hasPermission) {
    throw new Error('You do not have permission to view branches');
  }

  const now = new Date();
  let startDate = new Date(now);

  if (period === 'today') {
    startDate.setHours(0, 0, 0, 0);
  } else if (period === '7d') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '30d') {
    startDate.setDate(startDate.getDate() - 30);
  } else {
    startDate.setHours(0, 0, 0, 0);
  }

  // Get branches based on user's access
  let branchWhere = {
    organizationId,
    isActive: true,
  };

  // If user doesn't have all branches, filter by assignments
  if (!membership.hasAllBranches) {
    const assignments = await prisma.branchAssignment.findMany({
      where: { membershipId: membership.id },
      select: { branchId: true },
    });
    const assignedBranchIds = assignments.map(a => a.branchId);

    if (assignedBranchIds.length === 0) {
      throw new Error('You do not have access to any branch');
    }

    branchWhere.id = { in: assignedBranchIds };
  }

  const branches = await prisma.branch.findMany({
    where: branchWhere,
  });

  const branchData = await Promise.all(
    branches.map(async (branch) => {
      const sales = await prisma.kxTillSale.aggregate({
        where: {
          organizationId,
          branchId: branch.id,
          status: 'COMPLETED',
          createdAt: { gte: startDate },
        },
        _count: true,
        _sum: { totalAmount: true },
      });

      const activeUsers = await prisma.kxTillSale.groupBy({
        by: ['userId'],
        where: {
          organizationId,
          branchId: branch.id,
          status: 'COMPLETED',
          createdAt: { gte: startDate },
        },
      });

      const lowStockItems = await prisma.kxTillBranchProduct.count({
        where: {
          branchId: branch.id,
          isAvailable: true,
          product: {
            organizationId,
            isActive: true,
            trackInventory: true,
          },
          stock: {
            lte: prisma.kxTillBranchProduct.fields.minStock,
          },
        },
      });

      return {
        id: branch.id,
        name: branch.name,
        totalSales: sales._count || 0,
        totalRevenue: Number(sales._sum?.totalAmount || 0),
        activeUsers: activeUsers.length || 0,
        lowStockItems: lowStockItems || 0,
      };
    })
  );

  const total = {
    sales: branchData.reduce((sum, b) => sum + b.totalSales, 0),
    revenue: branchData.reduce((sum, b) => sum + b.totalRevenue, 0),
    users: branchData.reduce((sum, b) => sum + b.activeUsers, 0),
  };

  return {
    branches: branchData,
    total,
  };
};

const getInventoryAlerts = async (organizationId, userId, branchId = null, type = 'low-stock') => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasPermission = await checkPermission(userId, organizationId, 'kxtill.inventory.view');
  if (!hasPermission) {
    throw new Error('You do not have permission to view inventory');
  }

  // Build where clause for branch products
  const where = {
    product: {
      organizationId,
      isActive: true,
      trackInventory: true,
    },
    isAvailable: true,
  };

  if (branchId) {
    where.branchId = branchId;
  }

  // Apply type filter
  if (type === 'out-of-stock') {
    where.stock = 0;
  } else if (type === 'low-stock') {
    where.stock = {
      gt: 0,
      lte: prisma.kxTillBranchProduct.fields.minStock,
    };
  } else {
    // default: all alerts (low-stock + out-of-stock)
    where.OR = [
      { stock: 0 },
      {
        stock: {
          gt: 0,
          lte: prisma.kxTillBranchProduct.fields.minStock,
        },
      },
    ];
  }

  const alerts = await prisma.kxTillBranchProduct.findMany({
    where,
    include: {
      product: {
        select: {
          name: true,
          sku: true,
        },
      },
      branch: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { stock: 'asc' },
    take: 50,
  });

  const formattedAlerts = alerts.map((item) => {
    let status = 'low-stock';
    if (Number(item.stock) === 0) {
      status = 'out-of-stock';
    } else if (Number(item.stock) <= Number(item.minStock)) {
      status = 'low-stock';
    }

    return {
      id: item.id,
      productName: item.product.name,
      sku: item.product.sku,
      currentStock: Number(item.stock),
      minStock: Number(item.minStock),
      status,
      branch: item.branch.name,
      branchId: item.branchId,
    };
  });

  return {
    alerts: formattedAlerts,
    total: formattedAlerts.length,
  };
};
// ============================================================
// BRANCH BREAKDOWN
// ============================================================

const getBranchBreakdown = async (organizationId, userId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Check if user is owner
  const organization = await orgDb.findOrganizationById(organizationId);
  const isOwner = organization?.ownerId === userId;

  if (!isOwner) {
    throw new Error('Only the organization owner can view branch breakdown');
  }

  const { period = '30d' } = filters;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - (period === '7d' ? 7 : period === '90d' ? 90 : 30));
  startDate.setHours(0, 0, 0, 0);

  // Get all branches for this organization
  const branches = await prisma.branch.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  // Get sales per branch
  const branchSales = await Promise.all(
    branches.map(async (branch) => {
      const sales = await prisma.kxTillSale.aggregate({
        where: {
          organizationId,
          branchId: branch.id,
          status: 'COMPLETED',
          createdAt: { gte: startDate },
        },
        _sum: { totalAmount: true },
        _count: true,
      });

      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        sales: sales._sum?.totalAmount || 0,
        transactions: sales._count || 0,
      };
    })
  );

  // Calculate totals and percentages
  const totalSales = branchSales.reduce((sum, b) => sum + Number(b.sales), 0);
  const totalTransactions = branchSales.reduce((sum, b) => sum + b.transactions, 0);

  const data = branchSales.map((b) => ({
    name: b.name,
    code: b.code,
    sales: Number(b.sales),
    transactions: b.transactions,
    percentage: totalSales > 0 ? Math.round((Number(b.sales) / totalSales) * 100) : 0,
  }));

  return {
    data: data.sort((a, b) => b.sales - a.sales),
    totalSales,
    totalTransactions,
    branchCount: branches.length,
  };
};

const getPaymentMethodDistribution = async (organizationId, userId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const { branchId, period = '30d' } = filters;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - (period === '7d' ? 7 : period === '90d' ? 90 : 30));
  startDate.setHours(0, 0, 0, 0);

  const where = {
    organizationId,
    status: 'COMPLETED',
    createdAt: { gte: startDate },
  };

  if (branchId) {
    where.branchId = branchId;
  }

  const payments = await prisma.kxTillSalePayment.findMany({
    where: {
      sale: where,
    },
    select: {
      method: true,
      amount: true,
    },
  });

  // Aggregate by method
  const methodMap = {};
  for (const payment of payments) {
    const method = payment.method || 'OTHER';
    if (!methodMap[method]) {
      methodMap[method] = 0;
    }
    methodMap[method] += Number(payment.amount);
  }

  const total = Object.values(methodMap).reduce((sum, val) => sum + val, 0);

  const methods = Object.keys(methodMap).map((key) => ({
    name: key.charAt(0) + key.slice(1).toLowerCase(),
    value: total > 0 ? Math.round((methodMap[key] / total) * 100) : 0,
    amount: methodMap[key],
  }));

  return {
    paymentMethods: methods.sort((a, b) => b.value - a.value),
    total,
  };
};


// ============================================================
// RETURNS SUMMARY
// ============================================================

const getReturnsSummary = async (organizationId, userId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const { branchId, period = '30d' } = filters;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - (period === '7d' ? 7 : period === '90d' ? 90 : 30));
  startDate.setHours(0, 0, 0, 0);

  // Today start
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Week start
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const where = {
    organizationId,
    status: 'REFUNDED',
    updatedAt: { gte: startDate },
  };

  if (branchId) {
    where.branchId = branchId;
  }

  // Today where
  const todayWhere = {
    ...where,
    updatedAt: { gte: todayStart },
  };

  // Week where
  const weekWhere = {
    ...where,
    updatedAt: { gte: weekStart },
  };

  // Get all refunded sales (period)
  const refundedSales = await prisma.kxTillSale.findMany({
    where,
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
      branch: {
        select: {
          name: true,
        },
      },
    },
  });

  // Today refunds
  const todayRefunds = refundedSales.filter(s => new Date(s.updatedAt) >= todayStart);
  const todayTotal = todayRefunds.reduce((sum, s) => sum + Number(s.totalAmount), 0);

  // Week refunds
  const weekRefunds = refundedSales.filter(s => new Date(s.updatedAt) >= weekStart);
  const weekTotal = weekRefunds.reduce((sum, s) => sum + Number(s.totalAmount), 0);

  // Totals
  const totalReturns = refundedSales.length;
  const totalAmount = refundedSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);

  // Product breakdown
  const productMap = {};
  for (const sale of refundedSales) {
    for (const item of sale.items) {
      const productName = item.product?.name || 'Unknown';
      if (!productMap[productName]) {
        productMap[productName] = { count: 0, total: 0 };
      }
      productMap[productName].count += Number(item.quantity);
      productMap[productName].total += Number(item.total);
    }
  }

  // Branch breakdown
  const branchMap = {};
  for (const sale of refundedSales) {
    const branchName = sale.branch?.name || 'Unknown';
    if (!branchMap[branchName]) {
      branchMap[branchName] = { count: 0, total: 0 };
    }
    branchMap[branchName].count += 1;
    branchMap[branchName].total += Number(sale.totalAmount);
  }

  // Top returned products
  const topReturnedProducts = Object.keys(productMap)
    .map((name) => ({
      name,
      count: productMap[name].count,
      total: productMap[name].total,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // By branch
  const byBranch = Object.keys(branchMap).map((name) => ({
    branchName: name,
    count: branchMap[name].count,
    total: branchMap[name].total,
  }));

  // Return rate
  const totalSales = await prisma.kxTillSale.count({
    where: {
      organizationId,
      status: 'COMPLETED',
      createdAt: { gte: startDate },
    },
  });

  const returnRate = totalSales > 0 ? (totalReturns / totalSales) * 100 : 0;

  return {
    today: {
      total: todayTotal,
      count: todayRefunds.length,
    },
    totalReturns,
    thisMonth: totalAmount,
    thisWeek: weekTotal,
    returnRate: Math.round(returnRate * 100) / 100,
    totalAmount,
    topReturnedProducts,
    byBranch,
  };
};

// ============================================================
// INVENTORY DASHBOARD
// ============================================================

// 1. Inventory Summary (Stats Cards)
const getInventorySummary = async (organizationId, userId, branchId = null) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const whereBranch = branchId ? { branchId } : {};

  const branchProducts = await prisma.kxTillBranchProduct.findMany({
    where: {
      ...whereBranch,
      product: { organizationId, isActive: true },
    },
    include: {
      product: true,
    },
  });

  const totalProducts = await prisma.kxTillProduct.count({
    where: { organizationId, isActive: true },
  });

  let lowStock = 0;
  let outOfStock = 0;
  let totalStockValue = 0;

  for (const bp of branchProducts) {
    const stock = Number(bp.stock);
    const minStock = Number(bp.minStock);
    const cost = Number(bp.product?.cost || 0);

    // Stock value = stock * cost per unit (base unit)
    totalStockValue += stock * cost;

    if (stock === 0) outOfStock++;
    else if (stock <= minStock) lowStock++;
  }

  return {
    totalProducts,
    lowStock,
    outOfStock,
    totalStockValue,
  };
};

// 2. Inventory Health
const getInventoryHealth = async (organizationId, userId, branchId = null) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const whereBranch = branchId ? { branchId } : {};
  const whereProduct = { organizationId, isActive: true };

  const branchProducts = await prisma.kxTillBranchProduct.findMany({
    where: {
      ...whereBranch,
      product: { organizationId, isActive: true },
    },
  });

  let total = 0;
  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;

  for (const bp of branchProducts) {
    const stock = Number(bp.stock);
    const minStock = Number(bp.minStock);
    total++;

    if (stock === 0) outOfStock++;
    else if (stock <= minStock) lowStock++;
    else inStock++;
  }

  const health = total > 0 ? Math.round((inStock / total) * 100) : 0;

  return {
    health,
    inStock,
    lowStock,
    outOfStock,
  };
};

// 3. Needs Attention (Low Stock & Out of Stock)
const getNeedsAttention = async (organizationId, userId, filters = {}) => {
  const { branchId, status, limit = 20 } = filters;
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const whereBranch = branchId ? { branchId } : {};
  const whereProduct = { organizationId, isActive: true };

  const branchProducts = await prisma.kxTillBranchProduct.findMany({
    where: {
      ...whereBranch,
      product: { organizationId, isActive: true },
    },
    include: {
      product: true,
      branch: true,
    },
  });

  let items = [];

  for (const bp of branchProducts) {
    const stock = Number(bp.stock);
    const minStock = Number(bp.minStock);
    let itemStatus = '';

    if (stock === 0) itemStatus = 'Out of Stock';
    else if (stock <= minStock) itemStatus = 'Low Stock';

    if (!itemStatus) continue;
    if (status === 'low' && itemStatus !== 'Low Stock') continue;
    if (status === 'out' && itemStatus !== 'Out of Stock') continue;

    items.push({
      id: bp.id,
      product: bp.product?.name || 'Unknown',
      sku: bp.product?.sku || '',
      branch: bp.branch?.name || 'Unknown',
      currentStock: stock,
      minimumStock: minStock,
      status: itemStatus,
    });
  }

  // Sort: Out of Stock first, then Low Stock
  items.sort((a, b) => {
    if (a.status === 'Out of Stock' && b.status !== 'Out of Stock') return -1;
    if (a.status !== 'Out of Stock' && b.status === 'Out of Stock') return 1;
    return 0;
  });

  // Limit
  items = items.slice(0, limit);

  const lowStockCount = items.filter(i => i.status === 'Low Stock').length;
  const outOfStockCount = items.filter(i => i.status === 'Out of Stock').length;

  return {
    items,
    lowStockCount,
    outOfStockCount,
  };
};

// 4. Recent Stock Activity
const getStockActivity = async (organizationId, userId, filters = {}) => {
  const { branchId, period = 'today', activityType, limit = 10 } = filters;
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Calculate date range
  const now = new Date();
  let startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);

  if (period === '7d') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '30d') {
    startDate.setDate(startDate.getDate() - 30);
  }

  // Get sales for the period
  const sales = await prisma.kxTillSale.findMany({
    where: {
      organizationId,
      branchId: branchId || undefined,
      createdAt: { gte: startDate },
      status: 'COMPLETED',
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      user: true,
      branch: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit * 2, // Get more to filter
  });

  const activities = [];

  for (const sale of sales) {
    for (const item of sale.items) {
      if (activityType && activityType !== 'sale') continue;
      activities.push({
        id: `${sale.id}-${item.id}`,
        time: sale.createdAt,
        product: item.product?.name || 'Unknown',
        productId: item.productId,
        activity: 'Sale',
        quantity: -Number(item.baseQuantity || item.quantity),
        branch: sale.branch?.name || 'Unknown',
        user: sale.user?.firstName || 'Unknown',
      });
    }
  }

  // Sort by time
  activities.sort((a, b) => new Date(b.time) - new Date(a.time));

  return {
    items: activities.slice(0, limit),
    total: activities.length,
  };
};

// 5. Stock Across Branches (Owner only)
const getBranchStock = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const organization = await orgDb.findOrganizationById(organizationId);
  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can view branch stock breakdown');
  }

  const branches = await prisma.branch.findMany({
    where: { organizationId, isActive: true },
  });

  let totalProducts = 0;
  let totalLowStock = 0;
  let totalOutOfStock = 0;

  const branchData = await Promise.all(
    branches.map(async (branch) => {
      const branchProducts = await prisma.kxTillBranchProduct.findMany({
        where: { branchId: branch.id },
        include: {
          product: true,
        },
      });

      let lowStock = 0;
      let outOfStock = 0;
      const productCount = branchProducts.length;

      for (const bp of branchProducts) {
        const stock = Number(bp.stock);
        const minStock = Number(bp.minStock);

        if (stock === 0) outOfStock++;
        else if (stock <= minStock) lowStock++;
      }

      totalProducts += productCount;
      totalLowStock += lowStock;
      totalOutOfStock += outOfStock;

      return {
        branchId: branch.id,
        branch: branch.name,
        products: productCount,
        lowStock,
        outOfStock,
      };
    })
  );

  return {
    branches: branchData,
    totalProducts,
    totalLowStock,
    totalOutOfStock,
  };
};

const getProfit = async (organizationId, userId, branchId = null, period = 'today') => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Check if user has access to branch
  if (branchId) {
    const hasAccess = membership.hasAllBranches || await branchDb.hasBranchAccess(membership.id, branchId);
    if (!hasAccess) {
      throw new Error('You do not have access to this branch');
    }
  }

  const now = new Date();
  let startDate;

  switch (period) {
    case 'today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      break;
    case 'quarter':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 90);
      break;
    case 'year':
      startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
  }

  const branchFilter = branchId ? { branchId } : {};

  const sales = await prisma.kxTillSale.findMany({
    where: {
      organizationId,
      status: 'COMPLETED',
      createdAt: { gte: startDate },
      ...branchFilter,
    },
    include: {
      items: {
        include: {
          product: true,
          unit: true,
        },
      },
    },
  });

  let revenue = 0;
  let cost = 0;

  for (const sale of sales) {
    revenue += Number(sale.totalAmount);
    for (const item of sale.items) {
      const unitCost = item.unit?.cost !== null && item.unit?.cost !== undefined
        ? Number(item.unit.cost)
        : (Number(item.product?.cost || 0) * Number(item.conversionQty));
      cost += unitCost * Number(item.quantity);
    }
  }

  return {
    period,
    startDate,
    revenue,
    cost,
    profit: revenue - cost,
    margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
    salesCount: sales.length,
  };
};

const getSalesTrend = async (organizationId, userId, days = 7, branchId = null) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const org = await orgDb.findOrganizationById(organizationId);
  const isOwner = org?.ownerId === userId;
  const hasAllBranches = membership.hasAllBranches || false;

  // Determine branch filter
  let branchFilter = {};
  if (branchId) {
    branchFilter = { branchId };
  } else if (!isOwner && !hasAllBranches) {
    const assignments = await prisma.branchAssignment.findMany({
      where: { membershipId: membership.id },
    });
    const assignedBranchIds = assignments.map(a => a.branchId);
    if (assignedBranchIds.length === 0) {
      return { labels: [], values: [] };
    }
    if (assignedBranchIds.length === 1) {
      branchFilter = { branchId: assignedBranchIds[0] };
    } else {
      branchFilter = { branchId: { in: assignedBranchIds } };
    }
  }

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const where = {
    organizationId,
    status: 'COMPLETED',
    createdAt: { gte: startDate },
    ...branchFilter,
  };

  // Get sales grouped by day
  const sales = await prisma.kxTillSale.findMany({
    where,
    select: {
      createdAt: true,
      totalAmount: true,
    },
    orderBy: { createdAt: 'asc' },
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

  // Build labels and values
  const labels = [];
  const values = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const label = date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
    labels.push(label);
    values.push(salesByDay[dateStr] || 0);
  }

  return { labels, values };
};

const getTodaySalesTrend = async (organizationId, userId, branchId = null) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const org = await orgDb.findOrganizationById(organizationId);
  const isOwner = org?.ownerId === userId;
  const hasAllBranches = membership.hasAllBranches || false;

  let branchFilter = {};
  if (branchId) {
    branchFilter = { branchId };
  } else if (!isOwner && !hasAllBranches) {
    const assignments = await prisma.branchAssignment.findMany({
      where: { membershipId: membership.id },
    });
    const assignedBranchIds = assignments.map(a => a.branchId);
    if (assignedBranchIds.length === 0) {
      return { labels: [], values: [] };
    }
    if (assignedBranchIds.length === 1) {
      branchFilter = { branchId: assignedBranchIds[0] };
    } else {
      branchFilter = { branchId: { in: assignedBranchIds } };
    }
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Get all sales from today
  const sales = await prisma.kxTillSale.findMany({
    where: {
      organizationId,
      status: 'COMPLETED',
      createdAt: { gte: todayStart },
      ...branchFilter,
    },
    select: {
      createdAt: true,
      totalAmount: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by hour
  const salesByHour = {};
  for (let i = 0; i < 24; i++) {
    const hourStr = i.toString().padStart(2, '0') + ':00';
    salesByHour[hourStr] = 0;
  }

  for (const sale of sales) {
    const hour = sale.createdAt.getHours();
    const hourStr = hour.toString().padStart(2, '0') + ':00';
    salesByHour[hourStr] += Number(sale.totalAmount);
  }

  const labels = Object.keys(salesByHour);
  const values = Object.values(salesByHour);

  // Trim trailing zeros (after last sale)
  let lastNonZero = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] > 0) {
      lastNonZero = i;
      break;
    }
  }

  // If no sales yet, show only current hour and previous
  if (lastNonZero === 0 && values.every(v => v === 0)) {
    const currentHour = now.getHours();
    const startHour = Math.max(0, currentHour - 2);
    const endHour = Math.min(23, currentHour + 1);
    
    const trimmedLabels = [];
    const trimmedValues = [];
    for (let i = startHour; i <= endHour; i++) {
      const hourStr = i.toString().padStart(2, '0') + ':00';
      trimmedLabels.push(hourStr);
      trimmedValues.push(salesByHour[hourStr] || 0);
    }
    return { labels: trimmedLabels, values: trimmedValues };
  }

  // Show up to current hour + 1
  const currentHour = now.getHours();
  const endIndex = Math.min(currentHour + 1, 23);
  
  const trimmedLabels = labels.slice(0, endIndex + 1);
  const trimmedValues = values.slice(0, endIndex + 1);

  return { labels: trimmedLabels, values: trimmedValues };
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
  getBranchOverview,
  getInventoryAlerts,
  getTodaySales,
  getPaymentMethodDistribution,
  getBranchBreakdown,
  getReturnsSummary,
  getInventorySummary,
  getInventoryHealth,
  getNeedsAttention,
  getStockActivity,
  getBranchStock,
  getProfit,
  getTodayStats,
  getSalesTrend,
  getTodaySalesTrend,
};