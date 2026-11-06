// src/modules/platform/identity/controllers/admin.controller.js

import authDb from '../db/auth.db.js';
import orgDb from '../../organizations/db/org.db.js';
import authorizationService from '../../authorization/services/authorization.service.js';
import prisma from '../../../../database/postgres/prisma.js';

const KXBYTE_SLUG = 'kxbyte';

const getAdminContext = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await authDb.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password: _, ...userWithoutPassword } = user;

    const internalOrg = await orgDb.findOrganizationBySlug(KXBYTE_SLUG);
    if (!internalOrg) {
      return res.status(500).json({ error: 'Internal organization not configured' });
    }

    // Any active member of the kxbyte org can enter Admin.
    const membership = await orgDb.findMembership(userId, internalOrg.id);
    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: 'Not a platform staff member' });
    }

    // Permissions for that membership.
    // platform_admin / owner resolve to ["*"] via getAllUserPermissions.
    const permissions = await authorizationService.getAllUserPermissions(
      userId,
      internalOrg.id
    );

    const role = membership.roleId
      ? await prisma.role.findUnique({
          where: { id: membership.roleId },
          select: { id: true, name: true },
        })
      : null;

    res.status(200).json({
      user: userWithoutPassword,
      organization: {
        id: internalOrg.id,
        name: internalOrg.name,
        slug: internalOrg.slug,
      },
      membership: {
        id: membership.id,
        roleId: membership.roleId,
        roleName: role?.name ?? null,
        isActive: membership.isActive,
      },
      permissions,
    });
  } catch (error) {
    console.error('Admin context error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default { getAdminContext };