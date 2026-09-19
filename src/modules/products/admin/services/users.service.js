// src/modules/products/admin/services/users.service.js

import prisma from '../../../../database/postgres/prisma.js';

const listUsers = async ({ search, page = 1, limit = 50 } = {}) => {
  const where = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isEmailVerified: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        memberships: {
          select: {
            id: true,
            isActive: true,
            joinedAt: true,
            role: { select: { id: true, name: true } },
            organization: {
              select: {
                id: true, name: true, slug: true,
                isInternal: true, isActive: true, isArchived: true,
                subscriptions: {
                  select: {
                    id: true, productKey: true, status: true,
                    trialEnd: true, graceEnd: true, currentPeriodEnd: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit };
};

const getUserDetail = async (userId) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      isEmailVerified: true, isActive: true, lastLoginAt: true, createdAt: true,
      ownedOrganizations: {
        select: {
          id: true, name: true, slug: true, isInternal: true, isActive: true,
          subscriptions: {
            select: {
              id: true, productKey: true, status: true,
              trialEnd: true, graceEnd: true, currentPeriodEnd: true,
            },
          },
        },
      },
      memberships: {
        select: {
          id: true, isActive: true, joinedAt: true,
          role: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true, slug: true, isInternal: true } },
        },
      },
    },
  });
};

export default { listUsers, getUserDetail };