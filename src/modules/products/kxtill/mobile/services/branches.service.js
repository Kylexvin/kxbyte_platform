// src/modules/products/kxtill/mobile/services/branches.service.js
//
// Composes the mobile Branches tab from getBranchOverview. Field-level
// permission stripping happens here so the controller stays thin and
// the same rules apply however the service is invoked.

import reportService from '../../services/report.service.js';
import shiftService from '../../shift/services/shift.service.js';

const buildBranch = (b, { canSeeRevenue, canSeeInventory, canSeeMembers }) => ({
  id: b.id,
  name: b.name,
  // Revenue/transactions: kxtill.sales.view
  revenue: canSeeRevenue ? Number(b.totalRevenue || 0) : null,
  transactions: canSeeRevenue ? Number(b.totalSales || 0) : null,
  // Staff count: members.view
  activeUsers: canSeeMembers ? Number(b.activeUsers || 0) : null,
  // Stock alerts: kxtill.inventory.view
  lowStockItems: canSeeInventory ? Number(b.lowStockItems || 0) : null,
});

export async function composeBranches(ctx, { period = 'today' } = {}) {
  const { organizationId, user, permissions } = ctx;
  const perms = await permissions();
  const has = (key) => {
    if (perms.includes('*')) return true;
    if (perms.includes(key)) return true;
    return perms.some((p) =>
      p.endsWith('.*') ? key.startsWith(p.replace('.*', '') + '.') : false
    );
  };

  const canSeeRevenue = has('kxtill.sales.view');
  const canSeeInventory = has('kxtill.inventory.view');
  const canSeeMembers = has('members.view');

  const overview = await reportService.getBranchOverview(
    organizationId,
    user.id,
    period
  );

  const raw = Array.isArray(overview?.branches) ? overview.branches : [];
  const branches = raw.map((b) =>
    buildBranch(b, { canSeeRevenue, canSeeInventory, canSeeMembers })
  );

  // Rank by revenue where revenue is visible. If revenue is not visible,
  // keep the server's order (which is stable enough for a member view).
  if (canSeeRevenue) {
    branches.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  }

  const isOrgWide =
    canSeeRevenue === false ? false : raw.length > 1;

  return {
    scope: {
      isOrgWide,
      canSeeRevenue,
      canSeeInventory,
      canSeeMembers,
    },
    period,
    branches,
    total: branches.length,
  };
}

export async function composeBranchDetail(ctx, branchId, { period = 'today' } = {}) {
  const { organizationId, user, permissions } = ctx;
  const perms = await permissions();
  const has = (key) => {
    if (perms.includes('*')) return true;
    if (perms.includes(key)) return true;
    return perms.some((p) =>
      p.endsWith('.*') ? key.startsWith(p.replace('.*', '') + '.') : false
    );
  };

  const canSales = has('kxtill.sales.view');
  const canInventory = has('kxtill.inventory.view');
  const canMembers = has('members.view');

  // Verify the branch belongs to the org. getBranchOverview will filter
  // to the user's authorized set — if the branch is not in it, we return
  // null rather than a leaky shape.
  const overview = await reportService.getBranchOverview(
    organizationId,
    user.id,
    period
  );
  const branch = (overview?.branches || []).find((b) => b.id === branchId);
  if (!branch) {
    return { notFound: true };
  }

  const [trend7, paymentsRaw, productsRaw] = await Promise.all([
    canSales
      ? reportService
          .getSalesTrend(organizationId, user.id, 7, branchId)
          .catch(() => ({ labels: [], values: [] }))
      : Promise.resolve({ labels: [], values: [] }),
    canSales
      ? reportService
          .getPaymentMethodDistribution(organizationId, user.id, {
            branchId,
            period: 'today',
          })
          .catch(() => null)
      : Promise.resolve(null),
    canSales
      ? reportService
          .getTopProducts(organizationId, user.id, 5, branchId)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  // Dedup products by name, same as the main dashboard.
  let products = null;
  if (Array.isArray(productsRaw) && productsRaw.length) {
    const merged = new Map();
    for (const p of productsRaw) {
      const key = (p.name || '').trim().toLowerCase();
      if (!key) continue;
      const cur = merged.get(key);
      if (cur) {
        cur.units += Number(p.quantity || 0);
        cur.revenue += Number(p.total || 0);
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
      .slice(0, 3);
  }

  const payments = paymentsRaw?.paymentMethods?.length
    ? {
        total: Number(paymentsRaw.total || 0),
        methods: paymentsRaw.paymentMethods.map((m) => ({
          id: m.name.toLowerCase(),
          label: m.name,
          pct: Number(m.value || 0),
          amount: Number(m.amount || 0),
        })),
      }
    : null;

  return {
    branch: {
      id: branch.id,
      name: branch.name,
      revenue: canSales ? Number(branch.totalRevenue || 0) : null,
      transactions: canSales ? Number(branch.totalSales || 0) : null,
      activeUsers: canMembers ? Number(branch.activeUsers || 0) : null,
      lowStockItems: canInventory ? Number(branch.lowStockItems || 0) : null,
    },
    scope: {
      canSeeRevenue: canSales,
      canSeeInventory: canInventory,
      canSeeMembers: canMembers,
    },
    trend: canSales
      ? {
          labels: trend7?.labels || [],
          values: (trend7?.values || []).map((v) => Number(v) || 0),
        }
      : null,
    payments,
    products,
    period,
  };
}

export async function composeBranchSales(ctx, branchId, { period = 'today' } = {}) {
  const { organizationId, user, permissions } = ctx;
  const perms = await permissions();
  const has = (key) => {
    if (perms.includes('*')) return true;
    if (perms.includes(key)) return true;
    return perms.some((p) =>
      p.endsWith('.*') ? key.startsWith(p.replace('.*', '') + '.') : false
    );
  };

  if (!has('kxtill.sales.view')) {
    return { forbidden: true };
  }

  // Verify branch access by reusing getBranchOverview, which respects
  // the caller's authorized branch set. If the branch is not in it,
  // they cannot see its sales.
  const overview = await reportService.getBranchOverview(
    organizationId,
    user.id,
    period
  );
  const branch = (overview?.branches || []).find((b) => b.id === branchId);
  if (!branch) {
    return { notFound: true };
  }

  const [recentRaw, topRaw, paymentsRaw] = await Promise.all([
    reportService
      .getRecentSales(organizationId, user.id, 20, branchId)
      .catch(() => []),
    reportService
      .getTopProducts(organizationId, user.id, 10, branchId)
      .catch(() => []),
    reportService
      .getPaymentMethodDistribution(organizationId, user.id, {
        branchId,
        period: 'today',
      })
      .catch(() => null),
  ]);

  // Recent transactions
  const recent = (Array.isArray(recentRaw) ? recentRaw : []).map((s) => ({
    id: s.id,
    total: Number(s.total || 0),
    items: (s.items || []).length,
    itemsSummary: (s.items || [])
      .slice(0, 2)
      .map((i) => i.name)
      .join(', '),
    cashier: s.user || 'Staff',
    createdAt: s.createdAt,
  }));

  // Top products, deduped by name, top 5
  let topProducts = [];
  if (Array.isArray(topRaw) && topRaw.length) {
    const merged = new Map();
    for (const p of topRaw) {
      const key = (p.name || '').trim().toLowerCase();
      if (!key) continue;
      const cur = merged.get(key);
      if (cur) {
        cur.units += Number(p.quantity || 0);
        cur.revenue += Number(p.total || 0);
      } else {
        merged.set(key, {
          id: p.productId,
          name: p.name,
          units: Number(p.quantity || 0),
          revenue: Number(p.total || 0),
        });
      }
    }
    topProducts = Array.from(merged.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  // Payment mix
  const payments = paymentsRaw?.paymentMethods?.length
    ? {
        total: Number(paymentsRaw.total || 0),
        methods: paymentsRaw.paymentMethods.map((m) => ({
          id: m.name.toLowerCase(),
          label: m.name,
          pct: Number(m.value || 0),
          amount: Number(m.amount || 0),
        })),
      }
    : null;

  return {
    branch: { id: branch.id, name: branch.name },
    period,
    recent,
    topProducts,
    payments,
    summary: {
      revenue: Number(branch.totalRevenue || 0),
      transactions: Number(branch.totalSales || 0),
    },
  };
}

export async function composeBranchStock(ctx, branchId, { status } = {}) {
  const { organizationId, user, permissions } = ctx;
  const perms = await permissions();
  const has = (key) => {
    if (perms.includes('*')) return true;
    if (perms.includes(key)) return true;
    return perms.some((p) =>
      p.endsWith('.*') ? key.startsWith(p.replace('.*', '') + '.') : false
    );
  };

  if (!has('kxtill.inventory.view')) {
    return { forbidden: true };
  }

  // Verify branch access the same way other branch endpoints do.
  const overview = await reportService.getBranchOverview(
    organizationId,
    user.id,
    'today'
  );
  const branch = (overview?.branches || []).find((b) => b.id === branchId);
  if (!branch) {
    return { notFound: true };
  }

  const [lowRaw, attentionRaw] = await Promise.all([
    reportService
      .getLowStock(organizationId, user.id, branchId)
      .catch(() => []),
    reportService
      .getNeedsAttention(organizationId, user.id, {
        branchId,
        limit: 100,
      })
      .catch(() => ({ items: [], lowStockCount: 0, outOfStockCount: 0 })),
  ]);

  // getLowStock: [{ id, productId, name, sku, stock, minStock, unit, branchId, branchName }]
  // getNeedsAttention.items: [{ id, product, sku, branch, currentStock, minimumStock, status }]
  // Merge — prefer getNeedsAttention because it already distinguishes
  // out-of-stock from low-stock and includes a status field.
  const items = [];
  const seen = new Set();
  for (const a of attentionRaw?.items || []) {
    const key = a.id || `${a.product}-${a.currentStock}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: a.id,
      productId: null,
      name: a.product,
      sku: a.sku,
      stock: Number(a.currentStock || 0),
      minStock: Number(a.minimumStock || 0),
      unit: 'units',
      status: a.status === 'Out of Stock' ? 'out' : 'low',
    });
  }
  // If attention missed anything that getLowStock reported, add it.
  // This guards against the two services disagreeing on what counts as
  // "needs attention."
  for (const l of lowRaw || []) {
    const key = l.id;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: l.id,
      productId: l.productId,
      name: l.name,
      sku: l.sku,
      stock: Number(l.stock || 0),
      minStock: Number(l.minStock || 0),
      unit: l.unit || 'units',
      status: Number(l.stock) === 0 ? 'out' : 'low',
    });
  }

  // Sort: out first, then low, then alphabetical
  items.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'out' ? -1 : 1;
    return String(a.name).localeCompare(String(b.name));
  });

  const outCount = items.filter((i) => i.status === 'out').length;
  const lowCount = items.filter((i) => i.status === 'low').length;

  const filtered =
    status === 'out'
      ? items.filter((i) => i.status === 'out')
      : status === 'low'
        ? items.filter((i) => i.status === 'low')
        : items;

  return {
    branch: { id: branch.id, name: branch.name },
    summary: { outCount, lowCount, total: items.length },
    items: filtered,
  };
}

export async function composeBranchShifts(ctx, branchId, { status } = {}) {
  const { organizationId, user, permissions } = ctx;
  const perms = await permissions();
  const has = (key) => {
    if (perms.includes('*')) return true;
    if (perms.includes(key)) return true;
    return perms.some((p) =>
      p.endsWith('.*') ? key.startsWith(p.replace('.*', '') + '.') : false
    );
  };

  if (!has('branches.view')) return { forbidden: true };

  const overview = await reportService.getBranchOverview(
    organizationId,
    user.id,
    'today'
  );
  const branch = (overview?.branches || []).find((b) => b.id === branchId);
  if (!branch) return { notFound: true };

  const canReview = has('kxtill.shift.resolve_variance');
  const canForceClose = has('kxtill.shift.force_close');
  const canViewAllShifts = has('kxtill.sales.view');

  const filters = { branchId, limit: 30 };
  if (status) filters.status = status;

  const [list, myCurrent] = await Promise.all([
    canViewAllShifts
      ? shiftService.getShifts(organizationId, user.id, filters).catch(() => ({
          items: [],
          total: 0,
        }))
      : Promise.resolve({ items: [], total: 0 }),
    shiftService.getCurrentShift(user.id, organizationId).catch(() => null),
  ]);

  const items = (list.items || []).map((s) => ({
    id: s.id,
    status: s.status,
    userId: s.userId,
    cashier:
      [s.user?.firstName, s.user?.lastName].filter(Boolean).join(' ') ||
      'Staff',
    branchId: s.branchId,
    branchName: s.branch?.name || null,
    openedAt: s.openedAt,
    closedAt: s.closedAt,
    openingFloat: s.openingFloat != null ? Number(s.openingFloat) : null,
    expectedCash: s.expectedCash != null ? Number(s.expectedCash) : null,
    declaredCash: s.declaredCash != null ? Number(s.declaredCash) : null,
    variance: s.variance != null ? Number(s.variance) : null,
    closureType: s.closureType || null,
    salesCount: s._count?.sales ?? null,
    refundsCount: s._count?.refunds ?? null,
  }));

  const branchCurrent = items.find(
    (s) => s.status === 'OPEN' && s.branchId === branchId
  );
  const currentForCaller =
    myCurrent && myCurrent.branchId === branchId
      ? {
          id: myCurrent.id,
          status: myCurrent.status,
          openedAt: myCurrent.openedAt,
          openingFloat:
            myCurrent.openingFloat != null
              ? Number(myCurrent.openingFloat)
              : null,
        }
      : null;

  const summary = {
    open: items.filter((s) => s.status === 'OPEN').length,
    pendingReview: items.filter((s) => s.status === 'CLOSED_PENDING_REVIEW')
      .length,
    closedToday: items.filter(
      (s) =>
        (s.status === 'CLOSED' || s.status === 'CLOSED_PENDING_REVIEW') &&
        s.closedAt &&
        new Date(s.closedAt).toDateString() === new Date().toDateString()
    ).length,
  };

  return {
    branch: { id: branch.id, name: branch.name },
    current: branchCurrent || null,
    myCurrentShift: currentForCaller,
    shifts: items,
    summary,
    canReview,
    canForceClose,
    canViewAllShifts,
  };
}

export async function reviewShiftVariance(ctx, branchId, shiftId, note) {
  const { organizationId, user } = ctx;
  if (!(await ctx.can('kxtill.shift.resolve_variance'))) {
    return { forbidden: true };
  }
  const shift = await shiftService.getShift(organizationId, user.id, shiftId);
  if (!shift || shift.branchId !== branchId) return { notFound: true };
  const updated = await shiftService.reviewVariance(
    user.id,
    organizationId,
    shiftId,
    note || null
  );
  return { shift: updated };
}

export async function forceCloseShift(ctx, branchId, shiftId, declaredCash, reason) {
  const { organizationId, user } = ctx;
  if (!(await ctx.can('kxtill.shift.force_close'))) {
    return { forbidden: true };
  }
  const shift = await shiftService.getShift(organizationId, user.id, shiftId);
  if (!shift || shift.branchId !== branchId) return { notFound: true };
  const updated = await shiftService.forceCloseShift(
    user.id,
    organizationId,
    shiftId,
    declaredCash,
    reason || null
  );
  return { shift: updated };
}

export default { composeBranches, composeBranchDetail, composeBranchSales, composeBranchStock  };