// src/modules/products/admin/db/user.db.js

import prisma from '../../../../database/postgres/prisma.js';

// ============================================================
// SHARED SELECTS
// ============================================================

const userListSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isEmailVerified: true,
  verifiedAt: true,
  isActive: true,
  deactivatedAt: true,
  deactivatedBy: true,
  deactivationReason: true,
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
          id: true,
          name: true,
          slug: true,
          isInternal: true,
          isActive: true,
          isArchived: true,
          subscriptions: {
            select: {
              id: true,
              productKey: true,
              status: true,
              trialEnd: true,
              graceEnd: true,
              currentPeriodEnd: true,
            },
          },
        },
      },
    },
  },
  _count: {
    select: {
      memberships: true,
      sessions: true,
    },
  },
};

const userDetailSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isEmailVerified: true,
  verifiedAt: true,
  isActive: true,
  deactivatedAt: true,
  deactivatedBy: true,
  deactivationReason: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  ownedOrganizations: {
    select: {
      id: true,
      name: true,
      slug: true,
      isInternal: true,
      isActive: true,
      subscriptions: {
        select: {
          id: true,
          productKey: true,
          status: true,
          trialEnd: true,
          graceEnd: true,
          currentPeriodEnd: true,
        },
      },
    },
  },
  memberships: {
    select: {
      id: true,
      isActive: true,
      joinedAt: true,
      role: { select: { id: true, name: true } },
      organization: {
        select: { id: true, name: true, slug: true, isInternal: true },
      },
    },
  },
  sessions: {
    where: { isRevoked: false },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      expiresAt: true,
      isRevoked: true,
    },
  },
};

// ============================================================
// WHERE BUILDER
// ============================================================

const buildUserWhere = ({
  search,
  hasOrg,
  isActive,
  isEmailVerified,
  orgId,
} = {}) => {
  const where = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (typeof isActive === 'boolean') where.isActive = isActive;
  if (typeof isEmailVerified === 'boolean') where.isEmailVerified = isEmailVerified;

  if (orgId) {
    where.memberships = { some: { organizationId: orgId } };
  } else if (hasOrg === true) {
    where.memberships = { some: {} };
  } else if (hasOrg === false) {
    where.memberships = { none: {} };
  }

  return where;
};

// ============================================================
// HELPERS
// ============================================================

const findUsers = async ({
  search,
  hasOrg,
  isActive,
  isEmailVerified,
  orgId,
  sort = 'createdAt',
  order = 'desc',
  page = 1,
  limit = 50,
} = {}) => {
  const where = buildUserWhere({ search, hasOrg, isActive, isEmailVerified, orgId });
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sort]: order },
      select: userListSelect,
    }),
    prisma.user.count({ where }),
  ]);

  // Attach last-session IP/UA per user (latest active session)
  const userIds = users.map((u) => u.id);
  let lastSessionsByUser = {};

  if (userIds.length > 0) {
    const sessions = await prisma.session.findMany({
      where: { userId: { in: userIds }, isRevoked: false },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, ipAddress: true, userAgent: true, createdAt: true },
    });

    for (const s of sessions) {
      if (!lastSessionsByUser[s.userId]) {
        lastSessionsByUser[s.userId] = {
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          createdAt: s.createdAt,
        };
      }
    }
  }

  const enriched = users.map((u) => ({
    ...u,
    lastSession: lastSessionsByUser[u.id] || null,
  }));

  return { users: enriched, total };
};

const findUserDetail = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userDetailSelect,
  });

  if (!user) return null;

  const pendingInvitations = await prisma.invitation.findMany({
    where: { email: user.email, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      organizationId: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      organization: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return { ...user, pendingInvitations };
};

const countUsers = async (filters = {}) => {
  const where = buildUserWhere(filters);
  return prisma.user.count({ where });
};

export default { findUsers, findUserDetail, countUsers };