md
# Verticals — Where They Live and Why

## The Concept

`kxtill` is one product, but it runs as **multiple verticals**:

- `retail` — plain POS
- `pharmacy` — POS + batches + expiry + FEFO
- `restaurant` — (future)
- `hotel` — (future)

Each vertical is a **separate app** (separate frontend, separate entry point), but they
share the same `kxtill` product key and the same activation endpoint.

## Where Verticals Are Declared (3 Places)

### 1. Source of truth — the app's own `index.js`
src/modules/products/kxtill/index.js
→ vertical: 'retail'

text

Each kxtill variant declares its own vertical here. When the pharmacy app is cloned,
only this line changes:
src/modules/products/kxtill/index.js → vertical: 'retail'
src/modules/products/kxtill-pharmacy/index.js → vertical: 'pharmacy' (future)
src/modules/products/kxtill-restaurant/... → vertical: 'restaurant' (future)

text

### 2. Runtime flow — passed to activation

The standalone app calls activation with its own vertical:

```js
POST /api/v1/products/organizations/:orgId/products/activate
Body: {
  productKey: KxTill.key,        // "kxtill"
  vertical:   KxTill.vertical,   // "retail" | "pharmacy" | ...
}
3. Storage — on ProductInstance (DB)
prisma
model ProductInstance {
  vertical String   // currently untyped; not yet a Prisma enum
}
The service persists whatever vertical the app declared.

