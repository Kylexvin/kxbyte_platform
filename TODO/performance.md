# Performance — TODO

## Offline write optimization
Root cause: every `run()` serializes the whole DB to localStorage.

- [ ] Microtask coalescing in `saveToStore`
- [ ] Base64 storage instead of `JSON.stringify(Array.from(bytes))`
- [ ] Debounce cart saves in POS.jsx (or drop persistence)
- [ ] `pruneOldSyncedSales(days)` called daily
- [ ] (Later) Move sqlite to Web Worker if still slow

## Polling — idle pause for app-level pollers

Current state:
- Route-level pollers unmount on navigate ✅
- Tab-visibility pause in usePolling ✅
- TopBar heartbeat (20s) + sync (60s) run permanently while logged in

Optional:
- [ ] `useIsIdle(thresholdMs)` hook tracking last interaction
- [ ] Skip TopBar sync when idle > 10 min
- [ ] Catch-up fetch on first activity after idle

NOT urgent. Ship only if you observe real cost from overnight POS tabs.