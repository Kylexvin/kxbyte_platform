// src/modules/products/admin/crm/services/pipeline-template.service.js
//
// Admin template application. Applies the engine's default 8-stage
// pipeline to an org that has none. Idempotent on the "already
// configured" side: refuses if any stage already exists.
//
// Route-gated by admin.pipeline.manage.
//
// Bypasses pipelineService.createStage (which writes one audit event per
// stage) and instead creates all 8 inside one transaction with a single
// PIPELINE_INITIALIZED audit at the end.

import prisma from '../../../../../database/postgres/prisma.js';
import pipelineDb from '../../../kxcrm/db/pipeline.db.js';
import { PIPELINE_TEMPLATE } from '../../../kxcrm/domain/constants.js';
import audit from '../../../../platform/audit/index.js';
import { ConflictError } from '../../../kxcrm/domain/errors.js';

// ============================================================
// APPLY TEMPLATE
// ============================================================

const applyTemplate = async (userId, organizationId) => {
  // 1. Reject if any stage already exists (active or inactive).
  const existing = await pipelineDb.findByOrg(organizationId, { includeInactive: true });
  if (existing.length > 0) {
    throw new ConflictError(
      'PIPELINE_NOT_EMPTY',
      `Pipeline already configured (${existing.length} stage(s) exist). Delete them first or edit the existing pipeline.`
    );
  }

  // 2. Insert all 8 stages atomically.
  //    isTerminal is derived (isWon || isLost).
  const created = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction to guard against a race with another
    // apply-template click landing between step 1 and the insert.
    const count = await tx.pipelineStage.count({ where: { organizationId } });
    if (count > 0) {
      throw new ConflictError(
        'PIPELINE_NOT_EMPTY',
        'Pipeline already configured (concurrent apply).'
      );
    }

    const stages = [];
    for (const tpl of PIPELINE_TEMPLATE) {
      const stage = await pipelineDb.create(
        {
          organizationId,
          name: tpl.name,
          key: tpl.key,
          order: tpl.order,
          isWon: !!tpl.isWon,
          isLost: !!tpl.isLost,
          isTerminal: !!(tpl.isWon || tpl.isLost),
          color: tpl.color ?? null,
          isActive: true,
        },
        tx
      );
      stages.push(stage);
    }
    return stages;
  });

  // 3. Single audit event for the whole template application.
  await audit.log({
    organizationId,
    userId,
    action: 'PIPELINE_INITIALIZED',
    resource: 'pipeline',
    resourceId: null,
    metadata: {
      stageCount: created.length,
      stages: created.map((s) => ({ id: s.id, key: s.key, name: s.name })),
    },
  });

  // 4. Return the ordered list for the board to render.
  return pipelineDb.findByOrg(organizationId, { includeInactive: false });
};

export default {
  applyTemplate,
};