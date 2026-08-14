// src/modules/platform/admin/controllers/cleanup.controller.js

import prisma from '../../../../database/postgres/prisma.js';

// ⚠️ TEMPORARY — Only works in development
export const cleanupTestOrgs = async (req, res) => {
  // Safety: Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }

  try {
    const testOrgNames = [
      'Test Org',
      'Test Org2',
      'Test Org3',
      'Test Org4',
      'Test Org5',
      'Test Org6',
      'Grace Boutique',
      'Jane Pharmacy',
      'Test Shop',
    ];

    const deleted = [];

    for (const name of testOrgNames) {
      // Check if org exists
      const org = await prisma.organization.findFirst({
        where: { name },
      });

      if (org) {
        // Delete memberships first (cascade should handle, but just in case)
        await prisma.membership.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete invitations
        await prisma.invitation.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete branches
        await prisma.branch.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete organization products
        await prisma.organizationProduct.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete subscriptions
        await prisma.subscription.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete audit events
        await prisma.auditEvent.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete notifications
        await prisma.notification.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete payment configs
        await prisma.paymentMerchantConfig.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete payment transactions
        await prisma.paymentTransaction.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete payment IPN registrations
        await prisma.paymentIPNRegistration.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete KxTill products
        await prisma.kxTillProduct.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete KxTill sales
        await prisma.kxTillSale.deleteMany({
          where: { organizationId: org.id },
        });

        // Delete KxTill settings
        await prisma.kxTillStoreSetting.deleteMany({
          where: { organizationId: org.id },
        });

        // Finally delete the organization
        await prisma.organization.delete({
          where: { id: org.id },
        });

        deleted.push({ id: org.id, name: org.name });
        console.log(`🗑️ Deleted: ${org.name}`);
      }
    }

    res.status(200).json({
      message: 'Cleanup complete',
      deleted,
      kept: ['Kamau Supermarket'],
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: error.message });
  }
};