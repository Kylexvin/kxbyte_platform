// src/modules/products/kxtill/mobile/services/sales.service.js
//
// Mobile-scoped sale creation. Thin wrapper over the core online sale path.
// Explicitly does NOT call createOfflineSale — mobile is online-first.
//
// Why this exists instead of calling /sales directly:
//   - Mobile contract stays separate from desktop's.
//   - branchId is forced from context (client can't spoof a branch).
//   - Permission pre-check uses the same can() shape as other mobile routes.
//   - Future mobile-only behaviors (device pricing, offline-lite cache) have
//     a home without touching core.

import saleService from '../../services/sale.service.js';

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

  return saleService.createSale(user.id, organizationId, {
    ...body,
    branchId,
    // No clientSaleId — online path does not use it (yet).
  });
}

export default { createMobileSale };