// src/modules/products/kxcrm/db/lead.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// SHARED SELECTS
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

const assigneesSelect = {
  select: {
    id: true,
    createdAt: true,
    assignedById: true,
    user: { select: userSelect },
    assignedBy: { select: userSelect },
  },
};

// ============================================================
// WHERE BUILDER
// ============================================================

const buildLeadWhere = (organizationId, filters = {}) => {
  const {
    stageId,
    assigneeId,
    search,
    source,
    hasConverted,
    hasLost,
  } = filters;

  const where = { organizationId, deletedAt: null };

  if (stageId) where.stageId = stageId;

  // Assignee filter now targets the LeadAssignee relation.
  // A lead "assigned to user X" if any LeadAssignee row matches.
  if (assigneeId) {
    where.assignees = { some: { userId: assigneeId } };
  }

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
// LEADS — CORE
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
      assignees: assigneesSelect,
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
        assignees: assigneesSelect,
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

  return tx.lead.findFirst({
    where: { id: leadId, organizationId, deletedAt: null },
    include: {
      stage: { select: stageSelect },
      assignees: assigneesSelect,
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

// ============================================================
// LEAD ASSIGNEES
// ============================================================

const listAssignees = async (organizationId, leadId) => {
  return prisma.leadAssignee.findMany({
    where: { organizationId, leadId },
    include: {
      user: { select: userSelect },
      assignedBy: { select: userSelect },
    },
    orderBy: { createdAt: 'asc' },
  });
};

const addAssignee = async (organizationId, leadId, userId, assignedById, tx = prisma) => {
  // Use upsert to be idempotent: adding the same user twice is a no-op.
  const existing = await tx.leadAssignee.findUnique({
    where: { leadId_userId: { leadId, userId } },
    select: { id: true },
  });
  if (existing) {
    return tx.leadAssignee.findUnique({
      where: { id: existing.id },
      include: {
        user: { select: userSelect },
        assignedBy: { select: userSelect },
      },
    });
  }

  return tx.leadAssignee.create({
    data: {
      organizationId,
      leadId,
      userId,
      assignedById: assignedById || null,
    },
    include: {
      user: { select: userSelect },
      assignedBy: { select: userSelect },
    },
  });
};

const removeAssignee = async (organizationId, leadId, userId, tx = prisma) => {
  const result = await tx.leadAssignee.deleteMany({
    where: { organizationId, leadId, userId },
  });
  return result.count;
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
  listAssignees,
  addAssignee,
  removeAssignee,
};