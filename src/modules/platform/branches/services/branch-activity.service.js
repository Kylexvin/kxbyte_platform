// src/modules/platform/branches/services/branch-activity.service.js

import prisma from '../../../../database/postgres/prisma.js';
import orgDb from '../../organizations/db/org.db.js';

const getBranchActivity = async (organizationId, userId, days = 7) => {
  // Check membership
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Get all branches
  const branches = await prisma.branch.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
      isDefault: true,
    },
  });

  // Count active branches
  const activeBranches = branches.filter(b => b.isActive).length;
  const archivedBranches = branches.filter(b => !b.isActive).length;

  // Get activity count per branch
  // Activity = sales + invoices + staff actions (from audit logs)
  const branchActivity = await Promise.all(
    branches.map(async (branch) => {
      // Count sales (KxTill)
      const salesCount = await prisma.kxTillSale.count({
        where: {
          branchId: branch.id,
          status: 'COMPLETED',
        },
      });

      // Count invoices (KxInvoice - if implemented)
      // For now, we'll use audit logs for activity
      const auditCount = await prisma.auditEvent.count({
        where: {
          organizationId,
          OR: [
            { resourceId: branch.id },
            { metadata: { path: ['branchId'], equals: branch.id } },
          ],
          createdAt: {
            gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          },
        },
      });

      // Count staff assigned to branch
      const staffCount = await prisma.branchAssignment.count({
        where: { branchId: branch.id },
      });

      // Total activity = sales + audit events + staff
      const activity = salesCount + auditCount + staffCount;

      return {
        branch: branch.name,
        branchId: branch.id,
        code: branch.code,
        isActive: branch.isActive,
        isDefault: branch.isDefault,
        activity: activity,
        sales: salesCount,
        staff: staffCount,
      };
    })
  );

  // Sort by activity (most active first)
  branchActivity.sort((a, b) => b.activity - a.activity);

  return {
    branchActivity: branchActivity.map(b => ({
      branch: b.branch,
      activity: b.activity,
    })),
    branchStatus: {
      active: activeBranches,
      archived: archivedBranches,
      total: branches.length,
    },
    details: branchActivity, // Full details if needed
  };
};

export default {
  getBranchActivity,
};