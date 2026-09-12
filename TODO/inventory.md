# Inventory — TODO

## Restore unavailable products to a branch
**Status:** Deferred. Ship current branch screen first.

### Why
`DELETE /organizations/:orgId/kxtill/branches/:branchId/products/:productId`
sets `isAvailable: false`. The item disappears from Branch Inventory
and POS at that branch — correct, but no UI path back.

### Blocked on
Confirm query param name with backend:

GET /organizations/:orgId/kxtill/branches/:branchId/products
Candidates: `includeUnavailable=true` / `includeRemoved=true` / `all=true`

Also verify:
- Response still includes per-item `isAvailable`
- POS uses the same endpoint or respects the same filter

### Frontend changes
- [ ] Add `showRemoved` state (default false)
- [ ] Add confirmed param when toggled
- [ ] Add `[Show removed]` filter chip
- [ ] Render unavailable rows dimmed with `Unavailable` badge
- [ ] Replace row actions with single Restore button
- [ ] Restore handler: `PATCH .../products/:productId` body `{ isAvailable: true }`
- [ ] Toast on success
- [ ] Refetch on toggle

### CSS
- [ ] `.productRowRemoved`
- [ ] `.restoreBtn`
- [ ] `.filterToggle`