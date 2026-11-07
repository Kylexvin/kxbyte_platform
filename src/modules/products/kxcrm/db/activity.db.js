// src/modules/products/kxcrm/db/activity.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// WHERE BUILDER (single source of truth)
// ============================================================

const buildActivityWhere = (organizationId, filters = {}) => {
  const { leadId, userId, type, from, to } = filters;

  const where = { organizationId };
  if (leadId) where.leadId = leadId;
  if (userId) where.userId = userId;
  if (type) where.type = type;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  return where;
};

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
};

const leadSelect = {
  id: true,
  businessName: true,
};

// ============================================================
// LEAD ACTIVITIES
// ============================================================

const create = async (data, tx = prisma) => {
  return tx.leadActivity.create({ data });
};

// No lead include — matches findByLead shape. Service fetches lead
// separately if it needs it.
const findById = async (organizationId, activityId) => {
  return prisma.leadActivity.findFirst({
    where: { id: activityId, organizationId },
    include: {
      user: { select: userSelect },
    },
  });
};

const findByLead = async (organizationId, leadId, filters = {}, pagination = {}) => {
  const { limit = 50, offset = 0 } = pagination;
  const where = buildActivityWhere(organizationId, { ...filters, leadId });

  const [activities, total] = await Promise.all([
    prisma.leadActivity.findMany({
      where,
      include: {
        user: { select: userSelect },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.leadActivity.count({ where }),
  ]);

  return { activities, total, limit, offset };
};

const findByUser = async (organizationId, userId, filters = {}, pagination = {}) => {
  const { limit = 50, offset = 0 } = pagination;
  const where = buildActivityWhere(organizationId, { ...filters, userId });

  const [activities, total] = await Promise.all([
    prisma.leadActivity.findMany({
      where,
      include: {
        user: { select: userSelect },
        lead: { select: leadSelect },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.leadActivity.count({ where }),
  ]);

  return { activities, total, limit, offset };
};

const countByLead = async (organizationId, leadId) => {
  return prisma.leadActivity.count({
    where: { organizationId, leadId },
  });
};

const remove = async (organizationId, activityId, tx = prisma) => {
  const result = await tx.leadActivity.deleteMany({
    where: { id: activityId, organizationId },
  });
  return result.count;
};

export default {
  create,
  findById,
  findByLead,
  findByUser,
  countByLead,
  remove,
};