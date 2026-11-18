// src/modules/products/admin/onboarding/checks/index.js
//
// Registry: productKey → { autoCheckKey: resolverFn }.
// Engine looks up resolvers here. Adding a product's checks = one entry.

import kxtill from './kxtill.js';

const checks = {
  kxtill,
};

export default checks;