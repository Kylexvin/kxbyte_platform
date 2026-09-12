# DB Split — TODO

Goal: break `src/db/sqlite.js` into domain-focused modules.
Each ≤ ~200 lines.

## Target structure
src/db/
├── sqlite.js # engine core: initDb, getDb, saveToStore, run, query
├── schema.js # createTables + all DDL
├── products.js # products, units, branchProducts
├── customers.js # all customer helpers
├── cart.js # cart CRUD
├── sales.js # local sales
├── sync-queue.js # queue operations
├── sync-metadata.js # cursor metadata
└── index.js # barrel re-export


## Migration order (one commit each)
1. Strip `sqlite.js` to core + create `schema.js`
2. Move products → `products.js`
3. Move customers → `customers.js`
4. Move cart → `cart.js`
5. Move sales → `sales.js`
6. Move queue → `sync-queue.js`
7. Move metadata → `sync-metadata.js`
8. Add `index.js` barrel + update all imports
9. Test full offline flow

## Rules
- One concern per file
- Named exports only
- Each file imports `{ run, runNoSave, query }` from `./sqlite`
- No cross-imports except `sales.js → sync-queue.js`