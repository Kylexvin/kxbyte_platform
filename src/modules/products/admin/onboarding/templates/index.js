// src/modules/products/admin/onboarding/templates/index.js
//
// Registry: productKey → onboarding template.
// Adding a new product's onboarding = create templates/<product>.js
// and add it to this map. No engine changes needed.

import kxtill from './kxtill.js';

const templates = {
  kxtill,
};

export default templates;