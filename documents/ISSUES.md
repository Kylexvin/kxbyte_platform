## Problem

Pharmacy offline sale fails with `P2028` — transaction timeout at 15s, actual 17.5s.

## Root cause

Pharmacy wrappers open `$transaction(..., { maxWait: 5000, timeout: 15000 })`.
The transaction does FEFO + Core sale + batch allocations, all serial.
On Neon (remote), 20+ sequential round trips exceed 15s.

## Fix (immediate)

Bump `timeout: 15000` → `timeout: 60000` in every pharmacy wrapper.

## Files

- `verticals/pharmacy/services/sales/createSale.js`
- `verticals/pharmacy/services/sales/createOfflineSale.js`
- `verticals/pharmacy/services/sales/refundSale.js`
- `verticals/pharmacy/services/transfers/approveTransfer.js`

## Acceptance

- Pharmacy offline sale completes
- No `P2028` in backend logs

## Follow-up

See Issue #2 (profile + real fix).
.

📝 Issue #2 — Profile the 17s Sale
Title: [backend] Profile pharmacy offline sale transaction — target <500ms

Labels: backend, pharmacy, perf, investigation

Body:

md
## Problem

Even after the timeout bump (Issue #1), the pharmacy offline sale takes ~17s.
It should take <500ms. Need to find where the time goes.

## Approach

Add timing logs inside `createOfflineSale`:

    console.log('[pharmacy-offline] FEFO:', t2 - t1, 'ms');
    console.log('[pharmacy-offline] core tx:', t3 - t2, 'ms');
    console.log('[pharmacy-offline] allocations:', t4 - t3, 'ms');
    console.log('[pharmacy-offline] total:', t4 - t0, 'ms');

Fire 1 sale. Capture timings.

## Candidates (by likelihood)

1. **Serial round trips to Neon** — 20+ awaits, each paying network latency
2. **FEFO row locks** — `SELECT ... FOR UPDATE` waits if contended
3. **Cold Prisma + Neon WebSocket** — first query pays reconnect cost
4. **N+1 in core sale** — per-item product/unit/branchProduct lookups

## Optimizations to evaluate (after profiling)

- Batch writes with `createMany` where possible
- Move read-only lookups (org, membership, permission, product, unit) outside the transaction
- Merge duplicate idempotency checks in `createOfflineSaleTx`
- Cache org/membership lookups per request
- Limit FEFO row locks to N candidates instead of all
- Confirm Neon pooled connection string is in use

## Acceptance

- Offline pharmacy sale completes in <500ms
- Same improvement applies to online sale, refund, transfer approve
