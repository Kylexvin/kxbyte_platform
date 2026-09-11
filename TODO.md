```md
# KXBYTE — TODO

## KxTill

### Done
- [x] Branch products list
- [x] Branch product detail
- [x] Branch stock adjust
- [x] Branch unit prices
- [x] Branch low stock
- [x] Product units CRUD
- [x] Product barcode search
- [x] Product update endpoint
- [x] Inventory mode (GLOBAL | BRANCH)

### Inventory — Restore unavailable products to a branch
**Status:** Deferred. Ship current branch screen first.

**Why**
`DELETE /organizations/:orgId/kxtill/branches/:branchId/products/:productId`
sets `isAvailable: false` on the `BranchProduct` row. The item disappears
from Branch Inventory and POS at that branch — correct, but there is no
UI path back.

**Blocked on**
Confirm the query param name with backend for:
```
GET /organizations/:orgId/kxtill/branches/:branchId/products
```
Candidates: `includeUnavailable=true` / `includeRemoved=true` / `all=true`

Also verify:
- Response still includes per-item `isAvailable`
- POS uses the same endpoint or respects the same filter (expected:
  POS filters `isAvailable: true`, so unaffected)

**Files to change**
- `src/pages/Inventory/Inventory.jsx`
- `src/pages/Inventory/Inventory.module.css`

**Frontend changes**
- [ ] Add `showRemoved` state (default false)
- [ ] Add confirmed param (`includeUnavailable=true`) to fetch params when toggled
- [ ] Add `[Show removed]` filter chip next to Refresh / view toggle
- [ ] Render unavailable rows dimmed with `Unavailable` badge
- [ ] Replace row actions for unavailable items with a single **Restore** button
- [ ] Restore handler: `PATCH /organizations/:orgId/kxtill/branches/:branchId/products/:productId` body `{ isAvailable: true }`
- [ ] Toast on success: "Product restored to this branch"
- [ ] Refetch on toggle

**CSS**
- [ ] `.productRowRemoved` — dim unavailable rows
- [ ] `.restoreBtn` — green accent, replaces action buttons
- [ ] `.filterToggle` — pill toggle, `.active` state

### Transfers — verification & refinements
Transfer flow is implemented end-to-end: create (PENDING) → approve
(stock moves, APPROVED) → complete (COMPLETED). Reject (REJECTED)
available while PENDING.

**Design note — stock moves at APPROVE, not at COMPLETE**
- PENDING   — nothing has moved
- APPROVED  — stock deducted from source + added to destination
- COMPLETED — receiving branch confirms physical handoff

This is a deliberate design choice; UI copy in `TransferDetailModal`
reflects it honestly ("Approve and move stock?"). Do NOT change this
without a product decision.

**Verify after deploy**
- [ ] Incoming transfers appear in a branch's transfer list
      (`transfer.db.js findTransfersByOrganization` must filter on
      source OR dest branch, not source only)
- [ ] Stock delta lands in destination branch inventory after approve
- [ ] Platform-level fallback (`branches.manage`) works on the backend,
      matching the frontend gate
- [ ] Non-owner with `kxtill.inventory.transfers.approve` can approve
- [ ] Non-owner without approve permission sees 403, not silent failure
- [ ] Test matrix:
      owner                            → all actions
      manager (transfers.approve)      → all actions
      clerk (transfers.create only)    → create only
      platform admin (branches.manage) → all actions
      cashier (sales.create only)      → read-only

**Deferred — not in this release**
- [ ] Notifications on transfer create / approve (service imports
      notifications but does not call it)
- [ ] Auto-generate `kxtill.inventory.transfers.reject` as a separate
      permission key (currently reject shares approve gate)
- [ ] Backend stats endpoint honours `branchId` (currently org-wide while
      list is branch-scoped; frontend computes stats client-side to match)

## Platform

### Auth
- [ ] Session timeout from settings

### Notifications
- [ ] Low stock alerts
- [ ] Daily sales report
- [ ] Weekly summary

## Frontend

### UI Polish — click-outside + toast behavior
- [ ] Toaster — auto-close after 3 seconds
- [ ] Toaster — manual close X button
- [ ] Profile dropdown — close when tapping outside
- [ ] All modals — close when tapping outside
- [ ] All dropdowns — close when tapping outside
- [ ] All popovers — close when tapping outside

## Permissions — migrate existing screens to `usePermissions()`

New `PermissionsContext` is the source of truth for permission checks.
Screens currently use `userPermissions?.includes('*')` which resolves to
`undefined` because AuthContext does not expose it — meaning `isOwner`
has been silently false in some flows.

Once `PermissionsContext` is confirmed working, migrate:
- [ ] `Transfers.jsx`
- [ ] `Inventory.jsx`
- [ ] `GlobalInventory.jsx`
- [ ] Any other screen using `userPermissions`

Replace:
```js
const isOwner = userPermissions?.includes('*') || false;
```
With:
```js
const { isOwner } = usePermissions();
```

## Route-level permission gates

Sidebar now hides links the user cannot access. This prevents accidental
clicks but does NOT prevent direct URL navigation.

Add per-page access checks. Pattern:

```jsx
import { usePermissions } from '../../contexts/PermissionsContext';

const { can } = usePermissions();
if (!can('kxtill.reports.view')) {
  return <NoAccess />;  // or redirect to /dashboard
}
```
```
## Polling — consider user-idle pause for app-level pollers

Current state:
- Route-level pollers (Dashboard, Inventory) unmount when navigating away ✅
- Tab-visibility pause in usePolling ✅
- TopBar heartbeat (20s) and TopBar sync (60s POS / 5 min idle) run
  permanently while logged in

Optional enhancement:
- Add `useIsIdle(thresholdMs)` hook to track last user interaction
  (mousemove / keydown / touchstart / scroll)
- Skip TopBar sync when idle > 10 min (POS left overnight edge case)
- Catch-up fetch on first activity after idle

NOT urgent — current pause-on-hidden already saves ~80% of idle load.
Ship this only if you observe real cost from overnight-open POS tabs.

DB Split — To-Do
Goal
Break the monolithic src/db/sqlite.js into domain-focused modules so each area (products, customers, sales, cart, sync) is independently readable, testable, and threadbare-simple. No file should be more than ~200 lines.

Target Structure
text
src/db/
├── sqlite.js              # engine core: initDb, getDb, saveToStore, run, query, resetDb, transactions
├── schema.js              # createTables + all CREATE TABLE / ALTER TABLE statements
├── products.js            # upsertProduct, getAllProducts, getProduct, clearProducts, units, branchProducts
├── customers.js           # upsertLocalCustomer, searchLocalCustomers, getUnsynced, upsertServerCustomer, markCustomerSynced, replaceCustomerIdInSales
├── cart.js                # saveCart, getActiveCart, clearCart
├── sales.js               # createLocalSale, getPendingSales, updateSaleStatus, receipts, formatters, counts, retry
├── sync-queue.js          # enqueueSync, getPendingSyncItems, updateSyncItemStatus, markAllFailedForRetry
├── sync-metadata.js       # getSyncMetadata, setSyncMetadata, getLast*Sync, setLast*Sync
└── index.js    