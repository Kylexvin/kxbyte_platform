// src/modules/products/admin/services/organizations.service.js

import prisma from '../../../../database/postgres/prisma.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import audit from '../../../platform/audit/index.js';

// ============================================================
// LIST
// ============================================================

export const listOrganizations = async ({ search, status, page = 1, limit = 50 } = {}) => {
  const where = { isInternal: false };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status === 'active') {
    where.isActive = true;
    where.isArchived = false;
  }
  if (status === 'archived') where.isArchived = true;
  if (status === 'suspended') where.isActive = false;

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            memberships: true,
            branches: true,
            organizationProducts: true,
            subscriptions: true,
          },
        },
        subscriptions: {
          where: { productKey: { not: 'admin' } },
          select: {
            id: true,
            productKey: true,
            status: true,
            trialEnd: true,
            graceEnd: true,
            currentPeriodEnd: true,
          },
        },
        owner: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  return { organizations, total, page, limit };
};

// ============================================================
// DETAIL
// ============================================================

export const getOrganization = async (orgId) => {
  const org = await prisma.organization.findFirst({
    where: { id: orgId, isInternal: false },
    include: {
      owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      memberships: {
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, lastLoginAt: true } },
          role: { select: { id: true, name: true } },
        },
      },
      branches: { select: { id: true, name: true, isActive: true, createdAt: true } },
      subscriptions: {
        where: { productKey: { not: 'admin' } },
        include: {
          payments: { orderBy: { paidAt: 'desc' }, take: 10 },
        },
        orderBy: { createdAt: 'desc' },
      },
      organizationProducts: {
        where: { product: { key: { not: 'admin' } } },
        include: { product: { select: { key: true, name: true } } },
      },
      _count: {
        select: {
          memberships: true,
          branches: true,
          organizationProducts: true,
          subscriptions: true,
          kxtillProducts: true,
          kxtillSales: true,
          customers: true,
        },
      },
    },
  });

  if (!org) return null;

  const usage = {
    members: org._count.memberships,
    branches: org._count.branches,
    products: org._count.kxtillProducts,
    sales: org._count.kxtillSales,
    customers: org._count.customers,
  };

  return { ...org, usage };
};

// ============================================================
// ACTIONS
// ============================================================

export const setActive = async (orgId, adminUserId, isActive) => {
  const org = await orgDb.updateOrganization(orgId, { isActive });

  await audit.log({
    organizationId: orgId,
    userId: adminUserId,
    action: isActive ? 'ORGANIZATION_ACTIVATED' : 'ORGANIZATION_SUSPENDED',
    resource: 'organization',
    resourceId: orgId,
    metadata: {},
  });

  return org;
};

export const setArchived = async (orgId, adminUserId, isArchived) => {
  const org = await orgDb.updateOrganization(orgId, { isArchived });

  await audit.log({
    organizationId: orgId,
    userId: adminUserId,
    action: isArchived ? 'ORGANIZATION_ARCHIVED' : 'ORGANIZATION_UNARCHIVED',
    resource: 'organization',
    resourceId: orgId,
    metadata: {},
  });

  return org;
};