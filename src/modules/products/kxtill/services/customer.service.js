// src/modules/products/kxtill/services/customer.service.js

import prisma from '../../../../database/postgres/prisma.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import audit from '../../../platform/audit/index.js';

// ============================================================
// SYNC: GET CUSTOMERS FOR LOCAL DB
// ============================================================

const getCustomersForSync = async (organizationId, userId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const { since, limit = 500 } = filters;
  const where = { organizationId, isActive: true };

  if (since) {
    where.updatedAt = { gte: new Date(since) };
  }

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      customerType: true,
      phone: true,
      email: true,
      taxNumber: true,
      companyName: true,
      address: true,
      city: true,
      country: true,
      source: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return {
    customers,
    serverTime: new Date().toISOString(),
    total: customers.length,
  };
};

// ============================================================
// SYNC: PUSH OFFLINE-CREATED CUSTOMERS
// ============================================================

const syncOfflineCustomers = async (organizationId, userId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const { customers } = data;
  if (!customers || customers.length === 0) {
    return { synced: [], failed: [] };
  }

  const synced = [];
  const failed = [];

  for (const customer of customers) {
    try {
      // Validate required fields
      if (!customer.name) {
        failed.push({
          clientCustomerId: customer.clientCustomerId,
          reason: 'Name is required',
        });
        continue;
      }

      if (!customer.phone && !customer.email) {
        failed.push({
          clientCustomerId: customer.clientCustomerId,
          reason: 'Either phone or email is required',
        });
        continue;
      }

      // Check for existing by phone (avoid duplicates)
      let existing = null;
      if (customer.phone) {
        existing = await prisma.customer.findFirst({
          where: {
            organizationId,
            phone: customer.phone,
          },
        });
      }

      if (existing) {
        // Update existing
        await prisma.customer.update({
          where: { id: existing.id },
          data: {
            name: customer.name,
            email: customer.email || existing.email,
            address: customer.address || existing.address,
            city: customer.city || existing.city,
            country: customer.country || existing.country,
            source: customer.source || existing.source,      
            notes: customer.notes || existing.notes,
          },
        });

        synced.push({
          clientCustomerId: customer.clientCustomerId,
          serverId: existing.id,
          status: 'UPDATED',
        });

        await audit.log({
          organizationId,
          userId,
          action: 'CUSTOMER_SYNCED_UPDATED',
          resource: 'customer',
          resourceId: existing.id,
          metadata: {
            clientCustomerId: customer.clientCustomerId,
            name: customer.name,
          },
        });
      } else {
        // Create new
        const created = await prisma.customer.create({
          data: {
            organizationId,
            name: customer.name,
            customerType: customer.customerType || 'INDIVIDUAL',
            phone: customer.phone || null,
            email: customer.email || null,
            taxNumber: customer.taxNumber || null,
            companyName: customer.companyName || null,
            address: customer.address || null,
            city: customer.city || null,
            country: customer.country || null,
            source: customer.source || 'WALK_IN',
            createdByProduct: 'kxtill',
            notes: customer.notes || null,
            isActive: true,
          },
        });

        synced.push({
          clientCustomerId: customer.clientCustomerId,
          serverId: created.id,
          status: 'CREATED',
        });

        await audit.log({
          organizationId,
          userId,
          action: 'CUSTOMER_SYNCED_CREATED',
          resource: 'customer',
          resourceId: created.id,
          metadata: {
            clientCustomerId: customer.clientCustomerId,
            name: customer.name,
          },
        });
      }
    } catch (error) {
      failed.push({
        clientCustomerId: customer.clientCustomerId,
        reason: error.message,
      });
    }
  }

  return { synced, failed };
};

// Add these methods to existing customer.service.js

// ============================================================
// LIST CUSTOMERS WITH SALES STATS
// ============================================================

const getCustomersWithStats = async (organizationId, userId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const { limit = 50, offset = 0, search, customerType, source } = filters;
  const where = { organizationId, isActive: true };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (customerType) where.customerType = customerType;
  if (source) where.source = source;

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: offset,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  // Get sales stats for each customer
  const customerIds = customers.map(c => c.id);

  const salesStats = await prisma.kxTillSale.groupBy({
    by: ['customerId'],
    where: {
      organizationId,
      customerId: { in: customerIds },
      status: 'COMPLETED',
    },
    _count: true,
    _sum: {
      totalAmount: true,
    },
  });

  const statsMap = Object.fromEntries(
    salesStats.map(s => [s.customerId, {
      salesCount: s._count,
      totalSpent: Number(s._sum.totalAmount || 0),
    }])
  );

  const items = customers.map(customer => ({
    ...customer,
    salesCount: statsMap[customer.id]?.salesCount || 0,
    totalSpent: statsMap[customer.id]?.totalSpent || 0,
  }));

  return { items, total, limit, offset };
};

// ============================================================
// GET CUSTOMER DETAIL WITH STATS
// ============================================================

const getCustomerWithStats = async (organizationId, userId, customerId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId, isActive: true },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Get sales stats
  const salesStats = await prisma.kxTillSale.aggregate({
    where: {
      organizationId,
      customerId: customer.id,
      status: 'COMPLETED',
    },
    _count: true,
    _sum: {
      totalAmount: true,
    },
  });

  // Get last purchase
  const lastSale = await prisma.kxTillSale.findFirst({
    where: {
      organizationId,
      customerId: customer.id,
      status: 'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  return {
    ...customer,
    stats: {
      salesCount: salesStats._count || 0,
      totalSpent: Number(salesStats._sum.totalAmount || 0),
      lastPurchaseAt: lastSale?.createdAt || null,
    },
  };
};

// ============================================================
// GET CUSTOMER SALES HISTORY
// ============================================================

const getCustomerSales = async (organizationId, userId, customerId, filters = {}) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Verify customer exists
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  const { limit = 50, offset = 0 } = filters;

  const [items, total] = await Promise.all([
    prisma.kxTillSale.findMany({
      where: {
        organizationId,
        customerId,
        status: 'COMPLETED',
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        payments: {
          select: {
            method: true,
            amount: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.kxTillSale.count({
      where: {
        organizationId,
        customerId,
        status: 'COMPLETED',
      },
    }),
  ]);

  return { items, total, limit, offset };
};

// ============================================================
// CREATE CUSTOMER FROM KXTILL
// ============================================================

const createCustomerFromKxTill = async (organizationId, userId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Validate
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('Customer name is required');
  }

  if (!data.phone && !data.email) {
    throw new Error('Either phone or email is required');
  }

  // Check for existing by phone
  if (data.phone) {
    const existing = await prisma.customer.findFirst({
      where: {
        organizationId,
        phone: data.phone,
      },
    });

    if (existing) {
      throw new Error('A customer with this phone number already exists');
    }
  }

  const customer = await prisma.customer.create({
    data: {
      organizationId,
      name: data.name,
      customerType: data.customerType || 'INDIVIDUAL',
      phone: data.phone || null,
      email: data.email || null,
      taxNumber: data.taxNumber || null,
      companyName: data.companyName || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      source: data.source || 'WALK_IN',
      createdByProduct: 'kxtill',
      notes: data.notes || null,
      isActive: true,
    },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_CUSTOMER_CREATED',
    resource: 'customer',
    resourceId: customer.id,
    metadata: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    },
  });

  return customer;
};

// ============================================================
// UPDATE CUSTOMER (KxTill-created only)
// ============================================================

const updateCustomerFromKxTill = async (organizationId, userId, customerId, data) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId, isActive: true },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Only KxTill-created customers can be edited from KxTill
  if (customer.createdByProduct !== 'kxtill') {
    throw new Error('This customer can only be edited from the product that created it');
  }

  // Check for duplicate phone
  if (data.phone && data.phone !== customer.phone) {
    const existing = await prisma.customer.findFirst({
      where: {
        organizationId,
        phone: data.phone,
        id: { not: customerId },
      },
    });
    if (existing) {
      throw new Error('A customer with this phone number already exists');
    }
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: data.name !== undefined ? data.name : customer.name,
      customerType: data.customerType !== undefined ? data.customerType : customer.customerType,
      phone: data.phone !== undefined ? data.phone : customer.phone,
      email: data.email !== undefined ? data.email : customer.email,
      taxNumber: data.taxNumber !== undefined ? data.taxNumber : customer.taxNumber,
      companyName: data.companyName !== undefined ? data.companyName : customer.companyName,
      address: data.address !== undefined ? data.address : customer.address,
      city: data.city !== undefined ? data.city : customer.city,
      country: data.country !== undefined ? data.country : customer.country,
      source: data.source !== undefined ? data.source : customer.source,
      notes: data.notes !== undefined ? data.notes : customer.notes,
    },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_CUSTOMER_UPDATED',
    resource: 'customer',
    resourceId: customerId,
    metadata: {
      updatedFields: Object.keys(data),
    },
  });

  return updated;
};

// ============================================================
// DELETE CUSTOMER (KxTill-created only)
// ============================================================

const deleteCustomerFromKxTill = async (organizationId, userId, customerId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId, isActive: true },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Only KxTill-created customers can be deleted from KxTill
  if (customer.createdByProduct !== 'kxtill') {
    throw new Error('This customer can only be deleted from the product that created it');
  }

  // Check if customer has sales
  const saleCount = await prisma.kxTillSale.count({
    where: { customerId },
  });

  if (saleCount > 0) {
    throw new Error(`Cannot delete customer with ${saleCount} existing sales. Deactivate instead.`);
  }

  // Soft delete
  await prisma.customer.update({
    where: { id: customerId },
    data: { isActive: false },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'KXTILL_CUSTOMER_DELETED',
    resource: 'customer',
    resourceId: customerId,
    metadata: {
      name: customer.name,
      phone: customer.phone,
    },
  });

  return { message: 'Customer deleted successfully' };
};

export default {
  getCustomersForSync,
  syncOfflineCustomers,
  getCustomersWithStats,      
  getCustomerWithStats,       
  getCustomerSales,           
  createCustomerFromKxTill,
  updateCustomerFromKxTill,    
  deleteCustomerFromKxTill,  
};