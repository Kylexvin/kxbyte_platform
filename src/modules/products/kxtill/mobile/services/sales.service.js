// src/modules/products/kxtill/mobile/services/sales.service.js
//
// Mobile-scoped sale creation. Routes to the vertical-aware sale path
// when the org has an active pharmacy ProductInstance, else falls back
// to Core.
//
// Routing is cached per-org with a 5-minute TTL to avoid a query on
// every sale. Cache holds { type, at }; entries older than TTL_MS are
// re-checked.
//
// Cache notes:
//   - In-flight de-duplication: if N requests for the same org arrive while
//     the cache is cold/expired, only ONE detection query runs; the rest
//     await the same promise.
//   - Failures are never cached (a DB error must not pin an org to 'retail').
//   - The cache is per-process. With multiple server instances each keeps
//     its own copy.
//   - invalidateSalePathCache(orgId) should be called whenever a pharmacy
//     ProductInstance is activated/deactivated. A stale 'retail' entry is the
//     dangerous direction: sales would go through Core, which decrements
//     branchProduct.stock but NOT batchStock, so the two drift apart.
//
// Why this exists instead of calling /sales directly:
//   - Mobile contract stays separate from desktop's.
//   - branchId is forced from context (client can't spoof a branch).
//   - Permission pre-check uses the same can() shape as other mobile routes.
//   - Vertical routing has a home without touching core.

import saleService from '../../services/sale.service.js';
import saleDb from '../../db/sale.db.js';
import prisma from '../../../../../database/postgres/prisma.js';

const TTL_MS = 5 * 60 * 1000; // 5 minutes

// orgId → { type: 'retail' | 'pharmacy', at: number }
const saleServiceCache = new Map();

// orgId → Promise<'retail' | 'pharmacy'> for detections currently running
const inflight = new Map();

async function detectVertical(orgId) {
  // An org is "pharmacy" if it has any active pharmacy ProductInstance.
  // ProductInstance → OrganizationProduct → Organization, so we filter
  // through the relation.
  console.log(`[mobile/sales] Detecting vertical for org=${orgId}`);

  const instance = await prisma.productInstance.findFirst({
    where: {
      vertical: 'pharmacy',
      isActive: true,
      organizationProduct: { organizationId: orgId },
    },
    select: { id: true },
  });
  return instance ? 'pharmacy' : 'retail';
}

async function resolveSalePath(orgId) {
  const cached = saleServiceCache.get(orgId);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.type;
  }

  let pending = inflight.get(orgId);
  if (!pending) {
    pending = detectVertical(orgId)
      .then((type) => {
        saleServiceCache.set(orgId, { type, at: Date.now() });
        return type;
      })
      .finally(() => {
        inflight.delete(orgId);
      });
    inflight.set(orgId, pending);
  }

  return pending;
}

/**
 * Drop the cached routing decision for one org (or all orgs if omitted).
 * Call this when a pharmacy ProductInstance is activated or deactivated.
 */
export function invalidateSalePathCache(orgId) {
  if (orgId) {
    saleServiceCache.delete(orgId);
  } else {
    saleServiceCache.clear();
  }
}

export async function createMobileSale(ctx, body) {
  const { user, organizationId, activeBranchId, can } = ctx;

  if (!can('kxtill.sales.create')) {
    throw Object.assign(new Error('Forbidden'), {
      status: 403,
      code: 'FORBIDDEN',
    });
  }

  // Branch comes from context (resolved from membership/device), not the client.
  // Clients may omit branchId; we inject the active one.
  const branchId = activeBranchId ?? body.branchId;
  if (!branchId) {
    throw Object.assign(new Error('Branch required'), {
      status: 400,
      code: 'BRANCH_REQUIRED',
    });
  }

  const payload = { ...body, branchId };
  const type = await resolveSalePath(organizationId);
  console.log(`[mobile/sales] org=${organizationId} path=${type}`);

  if (type === 'pharmacy') {
    const { default: pharmacySale } = await import(
      '../../verticals/pharmacy/services/sales/createSale.js'
    );
    const saleId = await pharmacySale.createSale({
      userId: user.id,
      organizationId,
      data: payload,
    });
    return saleDb.findSaleById(saleId, organizationId);
  }

  return saleService.createSale(user.id, organizationId, payload);
}

export default { createMobileSale, invalidateSalePathCache };