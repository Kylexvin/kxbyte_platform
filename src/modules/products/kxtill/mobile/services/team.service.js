// src/modules/products/kxtill/mobile/services/team.service.js

import prisma from '../../../../../database/postgres/prisma.js';
import orgDb from '../../../../platform/organizations/db/org.db.js';
import branchDb from '../../../../platform/branches/db/branch.db.js';

export async function composeBranchTeam(ctx, branchId) {
  const { organizationId, user, permissions } = ctx;
  const perms = await permissions();
  const has = (key) => {
    if (perms.includes('*')) return true;
    if (perms.includes(key)) return true;
    return perms.some((p) =>
      p.endsWith('.*') ? key.startsWith(p.replace('.*', '') + '.') : false
    );
  };

  if (!has('members.view')) return { forbidden: true };

  // Verify branch belongs to org
  const branch = await branchDb.findBranchById(branchId, organizationId);
  if (!branch) return { notFound: true };

  // Get all active memberships in the org
  const memberships = await prisma.membership.findMany({
    where: { organizationId, isActive: true },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      },
      role: {
        select: { id: true, name: true },
      },
      branchAssignments: {
        where: { branchId },
        select: { id: true },
      },
    },
  });

  // Get currently open shifts at this branch
  const openShifts = await prisma.kxTillShift.findMany({
    where: {
      organizationId,
      branchId,
      status: 'OPEN',
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      openedAt: true,
      openingFloat: true,
    },
  });

  const shiftByUser = new Map(
    openShifts.map((s) => [s.userId, s])
  );

  const org = await orgDb.findOrganizationById(organizationId);
  const isOrgOwner = org?.ownerId === user.id;

  const members = memberships
    .filter((m) => {
      // Branch filter: either explicitly assigned to this branch,
      // OR hasAllBranches true (sees all branches)
      const assigned = m.branchAssignments.length > 0;
      return assigned || m.hasAllBranches === true;
    })
    .map((m) => {
      const shift = shiftByUser.get(m.userId);
      const name =
        [m.user?.firstName, m.user?.lastName].filter(Boolean).join(' ') ||
        m.user?.email ||
        'Unknown';
      const isOwnerMember = org?.ownerId === m.userId;

      return {
        userId: m.userId,
        name,
        email: m.user?.email || null,
        role: isOwnerMember ? 'Owner' : m.role?.name || 'Member',
        isOwner: isOwnerMember,
        kxtill: {
          onShift: !!shift,
          shiftId: shift?.id || null,
          shiftStartedAt: shift?.openedAt || null,
          openingFloat: shift?.openingFloat != null
            ? Number(shift.openingFloat)
            : null,
        },
      };
    })
    .sort((a, b) => {
      // Owner first, then on-shift, then alphabetical
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      if (a.kxtill.onShift !== b.kxtill.onShift)
        return a.kxtill.onShift ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return {
    branch: { id: branch.id, name: branch.name },
    members,
    total: members.length,
    onShiftCount: members.filter((m) => m.kxtill.onShift).length,
  };
}