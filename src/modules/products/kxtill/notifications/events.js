// src/modules/products/kxtill/notifications/events.js
//
// Every KxTill notification event as a pure function of the entity that
// triggered it. Each event returns the exact payload `emit()` expects:
//
//   {
//     organizationId,
//     type,
//     permissionKey,
//     notification: { title, message, channel, productKey, resource,
//                     resourceId, metadata },
//     dedupe: { enabled, threshold? }
//   }
//
// Do not call these directly. Use kxtill.notifications.js, which forwards
// to the platform engine.

const PRODUCT_KEY = 'kxtill';

function formatMoney(v) {
  return Number(v || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 });
}

/* ── Shift variance ──────────────────────────────────────── */

export function shiftVariance(shift) {
  const amount = formatMoney(shift.variance);
  const branch = shift.branch?.name || 'Branch';
  const cashierName =
    [shift.user?.firstName, shift.user?.lastName].filter(Boolean).join(' ') ||
    'Cashier';

  return {
    organizationId: shift.organizationId,
    type: 'shift_variance',
    permissionKey: 'kxtill.shift.resolve_variance',
    notification: {
      title: `Cash variance ${amount}`,
      message: `${cashierName}'s shift at ${branch} closed with a variance of ${amount}. Review it.`,
      channel: 'IN_APP',
      productKey: PRODUCT_KEY,
      resource: 'shift',
      resourceId: shift.id,
      metadata: {
        branchId: shift.branchId,
        shiftOwnerId: shift.userId,
        variance: Number(shift.variance || 0),
        expectedCash: Number(shift.expectedCash || 0),
        declaredCash: Number(shift.declaredCash || 0),
      },
    },
    dedupe: { enabled: true },
  };
}

/* ── Low stock ───────────────────────────────────────────── */

export function lowStock({ organizationId, branchProduct, product, branch }) {
  const name = product?.name || 'Product';
  const branchName = branch?.name || 'Branch';
  const stock = Number(branchProduct.stock || 0);
  const minStock = Number(branchProduct.minStock || 0);
  const unit = product?.baseUnit?.abbreviation || 'units';

  return {
    organizationId,
    type: 'low_stock',
    permissionKey: 'kxtill.inventory.view',
    notification: {
      title: `${name} is low on stock`,
      message: `${stock} ${unit} left at ${branchName} (min ${minStock}).`,
      channel: 'IN_APP',
      productKey: PRODUCT_KEY,
      resource: 'branch_product',
      resourceId: branchProduct.id,
      metadata: {
        branchId: branchProduct.branchId,
        productId: branchProduct.productId,
        stock,
        minStock,
      },
    },
    dedupe: { enabled: true },
  };
}

/* ── Out of stock ────────────────────────────────────────── */

export function outOfStock({ organizationId, branchProduct, product, branch }) {
  const name = product?.name || 'Product';
  const branchName = branch?.name || 'Branch';

  return {
    organizationId,
    type: 'out_of_stock',
    permissionKey: 'kxtill.inventory.view',
    notification: {
      title: `${name} is out of stock`,
      message: `No units left at ${branchName}.`,
      channel: 'IN_APP',
      productKey: PRODUCT_KEY,
      resource: 'branch_product',
      resourceId: branchProduct.id,
      metadata: {
        branchId: branchProduct.branchId,
        productId: branchProduct.productId,
      },
    },
    dedupe: { enabled: true },
  };
}

export default { shiftVariance, lowStock, outOfStock };