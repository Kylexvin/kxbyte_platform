// src/modules/products/kxtill/mobile/services/dashboard.service.js
//
// Composes the mobile dashboard from existing report service methods.
// No data is recomputed here beyond shaping; the underlying queries do the
// work. Sections the caller cannot see come back as null.

import reportService from '../../services/report.service.js';
import shiftService from '../../shift/services/shift.service.js';

export const SECTION_PERMISSIONS = {
  sales: 'kxtill.sales.view',
  pulse: 'kxtill.sales.view',
  payments: 'kxtill.sales.view',
  products: 'kxtill.sales.view',
  recent: 'kxtill.sales.view',
  attentionStock: 'kxtill.inventory.view',
  branches: 'branches.view',
  profit: 'kxtill.reports.view',
  shift: null,
};

const SHORTCUTS = [
  {
    id: 'stock',
    label: 'Stock',
    icon: 'cube-outline',
    permission: 'kxtill.inventory.view',
  },
  {
    id: 'branches',
    label: 'Branches',
    icon: 'storefront-outline',
    permission: 'branches.view',
  },
];

const safe = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

// Merge attention items that share the same product name.
// Used only when the caller views org-wide (no branchId filter).
// Output keeps the first item's identity and augments `body` with a
// branch count so the row reads as one problem, not one-per-branch.
function mergeByProduct(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = (item.productName || item.title || '').trim().toLowerCase();
    if (!key) {
      // Nothing to group on — keep as-is.
      byKey.set(Symbol('unique'), item);
      continue;
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...item,
        branchIds: item.metadata?.branchId ? [item.metadata.branchId] : [],
        branchNames: item.branchName ? [item.branchName] : [],
      });
    } else {
      if (item.metadata?.branchId) existing.branchIds.push(item.metadata.branchId);
      if (item.branchName) existing.branchNames.push(item.branchName);
      existing.branchCount = (existing.branchCount || 1) + 1;
    }
  }

  return Array.from(byKey.values()).map((item) => {
    const count = item.branchCount || item.branchNames?.length || 1;
    if (count <= 1) return item;
    const names = item.branchNames || [];
    const suffix =
      names.length <= 2
        ? `at ${names.join(' & ')}`
        : `at ${count} branches`;
    return {
      ...item,
      title: item.title,
      body: `${item.body.split(' · ')[0]} · ${suffix}`,
      branchCount: count,
    };
  });
}

export async function composeDashboard(ctx) {
  const { organizationId, branchId, user, permissions } = ctx;

  const perms = await permissions();
  const hasPerm = (key) => {
    if (!key) return true;
    if (perms.includes('*')) return true;
    if (perms.includes(key)) return true;
    return perms.some((p) => {
      if (p.endsWith('.*')) return key.startsWith(p.replace('.*', '') + '.');
      return false;
    });
  };

  const canSales = hasPerm('kxtill.sales.view');
  const canInventory = hasPerm('kxtill.inventory.view');
  const canBranches = hasPerm('branches.view');
  const canReports = hasPerm('kxtill.reports.view');

  const organization = ctx.organization;
  const isOwner = organization?.ownerId === user.id || perms.includes('*');

  const [
    todayStats,
    trend7,
    stockAttention,
    branchData,
    paymentsRaw,
    productsRaw,
    recentRaw,
    currentShiftRaw,
  ] = await Promise.all([
    canSales
      ? safe(() =>
          reportService.getTodayStats(organizationId, user.id, branchId)
        )
      : Promise.resolve(null),

    canSales
      ? safe(
          () =>
            reportService.getSalesTrend(organizationId, user.id, 7, branchId),
          { labels: [], values: [] }
        )
      : Promise.resolve({ labels: [], values: [] }),

    canInventory
      ? safe(() =>
          reportService.getNeedsAttention(organizationId, user.id, {
            branchId,
            limit: 20,
          })
        )
      : Promise.resolve(null),

    canBranches
      ? (async () => {
          if (isOwner) {
            const breakdown = await safe(() =>
              reportService.getBranchBreakdown(organizationId, user.id, {
                period: 'today',
              })
            );
            return { kind: 'breakdown', data: breakdown, isOrgWide: true };
          }
          const overview = await safe(() =>
            reportService.getBranchOverview(organizationId, user.id, 'today')
          );
          return { kind: 'overview', data: overview, isOrgWide: false };
        })()
      : Promise.resolve(null),

    canSales
      ? safe(() =>
          reportService.getPaymentMethodDistribution(organizationId, user.id, {
            branchId,
            period: 'today',
          })
        )
      : Promise.resolve(null),

    canSales
      ? safe(() =>
          reportService.getTopProducts(organizationId, user.id, 10, branchId)
        )
      : Promise.resolve(null),

    canSales
      ? safe(() =>
          reportService.getRecentSales(organizationId, user.id, 4, branchId)
        )
      : Promise.resolve(null),

    branchId && !isOwner && shiftService?.getCurrentShift
      ? safe(() =>
          shiftService.getCurrentShift(user.id, organizationId)
        )
      : Promise.resolve(null),
  ]);

  // ---- Sales + pulse ----
  let sales = null;
  let pulse = null;
  if (canSales && todayStats) {
    const values = Array.isArray(trend7?.values) ? trend7.values : [];
    const todayValue = Number(todayStats.todaySales || 0);
    const prior = values.slice(0, -1);
    const priorAvg =
      prior.length > 0
        ? prior.reduce((s, v) => s + Number(v), 0) / prior.length
        : 0;
    const deltaPct =
      todayValue > 0 && priorAvg > 0
        ? Math.round(((todayValue - priorAvg) / priorAvg) * 1000) / 10
        : null;

    sales = {
      gross: todayValue,
      transactions: Number(todayStats.transactions || 0),
      itemsSold: Number(todayStats.itemsSold || 0),
      priorAvg,
      deltaPct,
      currency: ctx.organization.currency || 'KES',
    };
    pulse = {
      sales: todayValue,
      transactions: Number(todayStats.transactions || 0),
      profit: canReports ? Number(todayStats.profit || 0) : null,
    };
  }

  // ---- Attention ----
  const rawAttention = [];
  if (stockAttention?.items?.length) {
    for (const item of stockAttention.items) {
      rawAttention.push({
        id: item.id,
        kind: item.status === 'Out of Stock' ? 'out-of-stock' : 'low-stock',
        severity: item.status === 'Out of Stock' ? 'danger' : 'warning',
        icon:
          item.status === 'Out of Stock'
            ? 'alert-circle-outline'
            : 'cube-outline',
        title:
          item.status === 'Out of Stock'
            ? `${item.product} is out of stock`
            : `${item.product} is low on stock`,
        body: `${item.currentStock} ${
          item.currentStock === 1 ? 'unit' : 'units'
        } left at ${item.branch}`,
        productName: item.product,
        branchName: item.branch,
        metadata: { branchId: item.branchId },
        time: null,
      });
    }
  }

  if (canSales && sales?.deltaPct != null && sales.deltaPct < -10) {
    rawAttention.push({
      id: 'sales-behind',
      kind: 'sales',
      severity: 'warning',
      icon: 'trending-down-outline',
      title: `Sales ${Math.abs(sales.deltaPct)}% behind usual pace`,
      body: 'Compared to your 7-day average',
      productName: null,
      branchName: ctx.branch?.name || null,
      metadata: { branchId: branchId || null },
      time: null,
    });
  }

  // When scope is org-wide (no branchId), merge per-product. When scoped
  // to a branch, keep the branch's individual rows as-is.
  let attention;
  if (!branchId) {
    attention = mergeByProduct(rawAttention).slice(0, 3);
  } else {
    attention = rawAttention.slice(0, 3);
  }

  // ---- Branch performance ----
  let branches = null;
  let isOrgWide = false;
  if (branchData) {
    isOrgWide = branchData.isOrgWide;
    if (branchData.kind === 'breakdown' && branchData.data?.data?.length) {
      branches = branchData.data.data.map((b) => ({
        id: b.id,
        name: b.name,
        sales: Number(b.sales || 0),
        transactions: Number(b.transactions || 0),
        trend: null,
      }));
    } else if (
      branchData.kind === 'overview' &&
      branchData.data?.branches?.length
    ) {
      branches = branchData.data.branches.map((b) => ({
        id: b.id,
        name: b.name,
        sales: Number(b.totalRevenue || 0),
        transactions: Number(b.totalSales || 0),
        trend: null,
      }));
    }
  }

  // ---- Shift ----
  let shift = null;
  if (currentShiftRaw) {
    shift = {
      since: currentShiftRaw.openedAt || null,
      cashier: currentShiftRaw.openedByName || null,
      sales: Number(currentShiftRaw.totalSales || 0),
      tx: Number(currentShiftRaw.transactions || 0),
      float: Number(currentShiftRaw.openingFloat || 0),
    };
  }

  // ---- Payments ----
  let payments = null;
  if (paymentsRaw?.paymentMethods?.length) {
    payments = {
      total: Number(paymentsRaw.total || 0),
      methods: paymentsRaw.paymentMethods.map((m) => ({
        id: m.name.toLowerCase(),
        label: m.name,
        pct: Number(m.value || 0),
        amount: Number(m.amount || 0),
      })),
    };
  }

  // ---- Top products (deduped by name) ----
  let products = null;
  if (Array.isArray(productsRaw) && productsRaw.length) {
    const merged = new Map();
    for (const p of productsRaw) {
      const key = (p.name || '').trim().toLowerCase();
      if (!key) continue;
      const current = merged.get(key);
      if (current) {
        current.units += Number(p.quantity || 0);
        current.revenue += Number(p.total || 0);
      } else {
        merged.set(key, {
          id: p.productId,
          name: p.name,
          units: Number(p.quantity || 0),
          revenue: Number(p.total || 0),
        });
      }
    }
    products = Array.from(merged.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 4);
  }

  // ---- Recent ----
  let recent = null;
  if (Array.isArray(recentRaw) && recentRaw.length) {
    recent = recentRaw.map((s) => ({
      id: s.id,
      title: `Sale · ${s.branchName || 'Branch'}`,
      sub: `${s.user || 'Staff'} · ${(s.items || []).length} items`,
      amount: Number(s.total || 0),
      time: s.createdAt,
    }));
  }

  // ---- Shortcuts ----
  const shortcuts = SHORTCUTS.filter((s) => hasPerm(s.permission)).map(
    (s) => ({ id: s.id, label: s.label, icon: s.icon })
  );

  // ---- Scope ----
  const scope = {
    branchId: branchId || null,
    isOrgWide,
    coveredBranches:
      branches?.map((b) => ({ id: b.id, name: b.name })) ||
      (ctx.branch ? [{ id: ctx.branch.id, name: ctx.branch.name }] : []),
  };

  return {
    scope,
    sales,
    pulse,
    attention,
    branches,
    shift,
    payments,
    products,
    recent,
    shortcuts,
  };
}

export default { composeDashboard, SECTION_PERMISSIONS };