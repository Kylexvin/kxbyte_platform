// src/modules/platform/identity/utils/audit.helper.js

import prisma from '../../../../database/postgres/prisma.js';

export const logAudit = async (data) => {
  try {
    const {
      organizationId,
      userId,
      action,
      resource,
      resourceId,
      metadata,
      ipAddress,
      userAgent,
    } = data;

    const createData = {
      userId,
      action,
      resource,
      resourceId: resourceId || null,
      metadata: metadata || {},
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    };

    // Only include organizationId if it has a value
    if (organizationId) {
      createData.organizationId = organizationId;
    }

    await prisma.auditEvent.create({
      data: createData,
    });
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
};