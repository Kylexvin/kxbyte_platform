// src/modules/products/kxtill/services/dashboardSync.service.js

import reportService from './report.service.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import branchDb from '../../../platform/branches/db/branch.db.js';

const PERIOD_TO_DAYS = {
  today: 1,
  week: 7,
  month: 30,
};

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const getDashboardSnapshot = async (organizationId, userId, { branchId, period = 'today' }) => {
  if (!branchId) {
    throw new Error('Branch ID is required');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const hasAccess =
    membership.hasAllBranches || (await branchDb.hasBranchAccess(membership.id, branchId));
  if (!hasAccess) {
    throw new Error('You do not have access to this branch');
  }

  const days = PERIOD_TO_DAYS[period] || 1;

  const [profit, salesTrend, todayTrend, topProducts, lowStock, recentSales] =
    await Promise.all([
      reportService.getProfit(organizationId, userId, branchId, period),
      reportService.getSalesTrend(organizationId, userId, days, branchId),
      reportService.getTodaySalesTrend(organizationId, userId, branchId),
      reportService.getTopProducts(organizationId, userId, 5, branchId),
      reportService.getLowStock(organizationId, userId, branchId),
      reportService.getRecentSales(organizationId, userId, 100, branchId),
    ]);

  return {
    branchId,
    period,
    profit: {
      period: profit.period,
      startDate: profit.startDate,
      revenue: toNumber(profit.revenue),
      cost: toNumber(profit.cost),
      profit: toNumber(profit.profit),
      margin: toNumber(profit.margin),
      salesCount: toNumber(profit.salesCount),
    },
    salesTrend: {
      labels: salesTrend.labels || [],
      values: (salesTrend.values || []).map(toNumber),
    },
    todayTrend: {
      labels: todayTrend.labels || [],
      values: (todayTrend.values || []).map(toNumber),
    },
    topProducts: (Array.isArray(topProducts) ? topProducts : []).map((p) => ({
      productId: p.productId,
      name: p.name,
      sku: p.sku,
      total: toNumber(p.total),
      quantity: toNumber(p.quantity),
      stock: toNumber(p.stock),
    })),
    lowStockCount: Array.isArray(lowStock) ? lowStock.length : 0,
    recentSalesCount: Array.isArray(recentSales) ? recentSales.length : 0,
    serverTime: new Date().toISOString(),
  };
};

export default {
  getDashboardSnapshot,
};