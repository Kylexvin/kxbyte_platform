// src/modules/products/admin/onboarding/checks/kxtill.js
//
// KxTill auto-check resolvers. Each returns true when the underlying
// product state satisfies the check.
//
// Admin owns these queries. KxTill does not know onboarding exists.

import prisma from '../../../../../database/postgres/prisma.js';

// Org exists, has an owner, and at least one active membership.
const account_exists = async (organizationId) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      ownerId: true,
      memberships: { where: { isActive: true }, take: 1, select: { id: true } },
    },
  });
  return !!org?.ownerId && org.memberships.length > 0;
};

// At least one active branch.
const branch_exists = async (organizationId) => {
  const count = await prisma.branch.count({
    where: { organizationId, isActive: true },
  });
  return count > 0;
};

// At least one global product AND at least one branch stock row.
const inventory_exists = async (organizationId) => {
  const [productCount, branchProductCount] = await Promise.all([
    prisma.kxTillProduct.count({ where: { organizationId, isActive: true } }),
    prisma.kxTillBranchProduct.count({
      where: { branch: { organizationId }, product: { isActive: true } },
    }),
  ]);
  return productCount > 0 && branchProductCount > 0;
};

// At least two active memberships (owner + one other).
const team_member_exists = async (organizationId) => {
  const count = await prisma.membership.count({
    where: { organizationId, isActive: true },
  });
  return count >= 2;
};

// Valid M-Pesa config exists for the org.
const mpesa_config_exists = async (organizationId) => {
  const count = await prisma.kxMpesaConfig.count({
    where: { organizationId, isActive: true },
  });
  return count > 0;
};

// At least one completed, non-refunded sale.
const first_sale_exists = async (organizationId) => {
  const count = await prisma.kxTillSale.count({
    where: {
      organizationId,
      status: 'COMPLETED',
      refundedAt: null,
    },
  });
  return count > 0;
};

export default {
  account_exists,
  branch_exists,
  inventory_exists,
  team_member_exists,
  mpesa_config_exists,
  first_sale_exists,
};