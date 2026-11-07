// src/modules/products/kxcrm/index.js
//
// KxCRM engine manifest.
//
// Type: "engine" — headless. No HTTP surface, no subscription, no
// initialize hook. Surfaces (admin/crm today, kxcrm/controllers later)
// consume the exported services directly.
//
// The engine never imports from platform/ or from any surface. Its
// service functions accept a context object:
//
//   context = {
//     organizationId,  // string (required)
//     actorId,         // string (required)
//     audit,           // { log: (event) => Promise<void> }
//     can,             // (perm: string) => Promise<boolean>
//     userIdValid,     // (userId: string) => Promise<boolean>
//   }
//
// The engine writes audit events only through context.audit.log,
// checks permissions only through context.can, and validates user
// references only through context.userIdValid. This keeps the engine
// surface-agnostic and reusable by any future product.

import permissions from './permissions.js';
import pipelineService from './services/pipeline.service.js';
import leadsService from './services/leads.service.js';
import activitiesService from './services/activities.service.js';

const KxCRM = {
  key: 'kxcrm',
  name: 'KxCRM',
  version: '0.1.0',
  type: 'engine',

  permissions,

  services: {
    pipeline: pipelineService,
    leads: leadsService,
    activities: activitiesService,
  },

  // No register(app) — engine has no routes.
  // No initialize — engine is stateless; per-org setup happens via
  // the surface's pipeline-template.service (admin today).
};

export default KxCRM;