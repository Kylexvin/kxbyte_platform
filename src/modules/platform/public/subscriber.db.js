import prisma from '../../../database/postgres/prisma.js';

const upsertSubscriber = async (email, data) => {
  return prisma.subscriber.upsert({
    where: { email },
    update: {
      // Add new interests without clobbering existing ones
      newsletter: data.newsletter || undefined,
      waitlists: data.waitlists && data.waitlists.length > 0
        ? { set: Array.from(new Set([...(data.existingWaitlists || []), ...data.waitlists])) }
        : undefined,
      source: data.source || undefined,
      ipAddress: data.ipAddress || undefined,
      userAgent: data.userAgent || undefined,
    },
    create: {
      email,
      newsletter: data.newsletter || false,
      waitlists: data.waitlists || [],
      source: data.source || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    },
  });
};

const findByEmail = async (email) => {
  return prisma.subscriber.findUnique({ where: { email } });
};

export default {
  upsertSubscriber,
  findByEmail,
};