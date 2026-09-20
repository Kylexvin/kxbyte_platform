// src/modules/platform/identity/controllers/dashboard.controller.js

import authDb from '../db/auth.db.js';
import orgDb from '../../organizations/db/org.db.js';
import authorizationService from '../../authorization/services/authorization.service.js';
import productDb from '../../products/db/product.db.js';
import subscriptionService from '../../subscriptions/services/subscription.service.js';
import prisma from '../../../../database/postgres/prisma.js';

const getDashboardContext = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const organizationId = req.query.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    // 1. Get user
    const user = await authDb.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password: _, ...userWithoutPassword } = user;

    // 2. Check membership
    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // 3. Get organization
    const organization = await orgDb.findOrganizationById(organizationId);

    // 4. Get permissions
    const permissions = await authorizationService.getAllUserPermissions(userId, organizationId);

    // 5. Get branches
    let branches = [];
    let hasAllBranches = membership.hasAllBranches || false;

    if (hasAllBranches) {
      const allBranches = await prisma.branch.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          isDefault: true,
          isActive: true,
        },
      });
      branches = allBranches;
    } else {
      const assignments = await prisma.branchAssignment.findMany({
        where: { membershipId: membership.id },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
              isDefault: true,
              isActive: true,
            },
          },
        },
      });
      branches = assignments.map(a => a.branch);
    }

    // 6. Get products
    const orgProducts = await productDb.findOrganizationProducts(organizationId);
    const products = await Promise.all(
      orgProducts.map(async (op) => {
        const subscription = await subscriptionService.getSubscriptionStatus(
          organizationId,
          op.product.key
        );
        return {
          key: op.product.key,
          name: op.product.name,
          description: op.product.description,
          isActive: op.isActive,
          subscriptionStatus: subscription.status,
          subscriptionIsActive: subscription.isActive,
        };
      })
    );

    // 7. Low stock count
    const lowStockCount = await prisma.kxTillBranchProduct.count({
      where: {
        branchId: { in: branches.map(b => b.id) },
        stock: { lte: prisma.kxTillBranchProduct.fields.minStock },
        isAvailable: true,
      },
    });

    res.status(200).json({
      user: userWithoutPassword,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        currency: organization.currency,
        timezone: organization.timezone,
      },
      membership: {
        id: membership.id,
        roleId: membership.roleId,
        hasAllBranches,
        isActive: membership.isActive,
      },
      permissions,
      branches,
      products,
      lowStockCount,
    });
  } catch (error) {
    console.error('Dashboard context error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getDashboardContext,
};