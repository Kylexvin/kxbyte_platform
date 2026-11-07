// src/modules/products/kxcrm/db/pipeline.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// PIPELINE STAGES
// ============================================================

const create = async (data, tx = prisma) => {
  return tx.pipelineStage.create({ data });
};

const findById = async (organizationId, stageId) => {
  return prisma.pipelineStage.findFirst({
    where: { id: stageId, organizationId },
  });
};

// Default: active only (what the board, pickers, and move dropdowns want).
// Settings page passes { includeInactive: true }.
const findByOrg = async (organizationId, { includeInactive = false } = {}) => {
  const where = { organizationId };
  if (!includeInactive) where.isActive = true;

  return prisma.pipelineStage.findMany({
    where,
    orderBy: { order: 'asc' },
  });
};

const update = async (organizationId, stageId, data, tx = prisma) => {
  const result = await tx.pipelineStage.updateMany({
    where: { id: stageId, organizationId },
    data,
  });
  if (result.count === 0) return null;
  return tx.pipelineStage.findFirst({
    where: { id: stageId, organizationId },
  });
};

const remove = async (organizationId, stageId, tx = prisma) => {
  const result = await tx.pipelineStage.deleteMany({
    where: { id: stageId, organizationId },
  });
  return result.count;
};

// Atomic reorder. Throws (and rolls back) if any stage id doesn't
// belong to the org. Silent skip would leave a half-reordered pipeline.
const reorder = async (organizationId, updates, tx = prisma) => {
  return tx.$transaction(async (trx) => {
    for (const { id, order } of updates) {
      const res = await trx.pipelineStage.updateMany({
        where: { id, organizationId },
        data: { order },
      });
      if (res.count === 0) {
        throw new Error(`Stage ${id} not found in organization`);
      }
    }
    return trx.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
    });
  });
};

const countLeadsInStage = async (organizationId, stageId) => {
  return prisma.lead.count({
    where: { organizationId, stageId, deletedAt: null },
  });
};

// Uniqueness / settings lookup — returns the Won stage regardless of isActive.
const findWonStage = async (organizationId) => {
  return prisma.pipelineStage.findFirst({
    where: { organizationId, isWon: true },
  });
};

const findLostStage = async (organizationId) => {
  return prisma.pipelineStage.findFirst({
    where: { organizationId, isLost: true },
  });
};

// Engine move / conversion lookup — must be active.
const findActiveWonStage = async (organizationId) => {
  return prisma.pipelineStage.findFirst({
    where: { organizationId, isWon: true, isActive: true },
  });
};

const findActiveLostStage = async (organizationId) => {
  return prisma.pipelineStage.findFirst({
    where: { organizationId, isLost: true, isActive: true },
  });
};

const existsByKey = async (organizationId, key, { excludeStageId } = {}) => {
  const where = { organizationId, key };
  if (excludeStageId) where.id = { not: excludeStageId };

  const row = await prisma.pipelineStage.findFirst({
    where,
    select: { id: true },
  });
  return !!row;
};

export default {
  create,
  findById,
  findByOrg,
  update,
  remove,
  reorder,
  countLeadsInStage,
  findWonStage,
  findLostStage,
  findActiveWonStage,
  findActiveLostStage,
  existsByKey,
};