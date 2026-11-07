// src/modules/products/kxcrm/db/lead.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// STAGE SELECT (shared between findMany and findByIdWithRelations)
// ============================================================

const stageSelect = {
  id: true,
  name: true,
  key: true,
  order: true,
  isWon: true,
  isLost: true,
  isTerminal: true,
  color: true,
};

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
};

// ============================================================
// WHERE BUILDER (single source of truth for filters)
// ============================================================

const buildLeadWhere = (organizationId, filters = {}) => {
  const {
    stageId,
    assignedToId,
    search,
    source,
    hasConverted,
    hasLost,
  } = filters;

  const where = { organizationId, deletedAt: null };

  if (stageId) where.stageId = stageId;
  if (assignedToId) where.assignedToId = assignedToId;
  if (source) where.source = source;

  if (typeof hasConverted === 'boolean') {
    where.convertedOrganizationId = hasConverted ? { not: null } : null;
  }

  if (typeof hasLost === 'boolean') {
    where.lostAt = hasLost ? { not: null } : null;
  }

  if (search) {
    where.OR = [
      { businessName: { contains: search, mode: 'insensitive' } },
      { contactName: { contains: search, mode: 'insensitive' } },
      { contactEmail: { contains: search, mode: 'insensitive' } },
      { contactPhone: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
};

// ============================================================
// SORT WHITELIST
// ============================================================

const SORTABLE = new Set(['createdAt', 'updatedAt', 'businessName', 'dealValue']);

const buildOrderBy = (sortBy = 'createdAt', sortOrder = 'desc') => {
  const field = SORTABLE.has(sortBy) ? sortBy : 'createdAt';
  const direction = sortOrder === 'asc' ? 'asc' : 'desc';
  return { [field]: direction };
};

// ============================================================
// LEADS
// ============================================================

const create = async (data, tx = prisma) => {
  return tx.lead.create({ data });
};

const findById = async (organizationId, leadId) => {
  return prisma.lead.findFirst({
    where: { id: leadId, organizationId, deletedAt: null },
  });
};

const findByIdWithRelations = async (organizationId, leadId) => {
  return prisma.lead.findFirst({
    where: { id: leadId, organizationId, deletedAt: null },
    include: {
      stage: { select: stageSelect },
      assignedTo: { select: userSelect },
      convertedOrganization: {
        select: { id: true, name: true, slug: true },
      },
      convertedBy: { select: userSelect },
      _count: { select: { activities: true } },
    },
  });
};

const findMany = async (organizationId, filters = {}, pagination = {}) => {
  const { limit = 50, offset = 0, sortBy, sortOrder } = pagination;
  const where = buildLeadWhere(organizationId, filters);

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        stage: { select: stageSelect },
        assignedTo: { select: userSelect },
        convertedOrganization: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: buildOrderBy(sortBy, sortOrder),
      skip: offset,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, total, limit, offset };
};

const countMany = async (organizationId, filters = {}) => {
  const where = buildLeadWhere(organizationId, filters);
  return prisma.lead.count({ where });
};

const update = async (organizationId, leadId, data, tx = prisma) => {
  const result = await tx.lead.updateMany({
    where: { id: leadId, organizationId, deletedAt: null },
    data,
  });

  if (result.count === 0) return null;

  // Return the relation-included shape so PATCH responses match GET.
  return tx.lead.findFirst({
    where: { id: leadId, organizationId, deletedAt: null },
    include: {
      stage: { select: stageSelect },
      assignedTo: { select: userSelect },
      convertedOrganization: {
        select: { id: true, name: true, slug: true },
      },
      convertedBy: { select: userSelect },
      _count: { select: { activities: true } },
    },
  });
};

const softDelete = async (organizationId, leadId, tx = prisma) => {
  const result = await tx.lead.updateMany({
    where: { id: leadId, organizationId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return result.count;
};

const countByStage = async (organizationId) => {
  const rows = await prisma.lead.groupBy({
    by: ['stageId'],
    where: { organizationId, deletedAt: null },
    _count: { _all: true },
  });

  const map = {};
  for (const r of rows) {
    map[r.stageId] = r._count._all;
  }
  return map;
};

export default {
  create,
  findById,
  findByIdWithRelations,
  findMany,
  countMany,
  update,
  softDelete,
  countByStage,
};