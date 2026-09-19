import prisma from '../../../../database/postgres/prisma.js';
import { addDays } from 'date-fns';

export const list = async (req, res) => {
  try {
    const now = new Date();
    const next7d = addDays(now, 7);
    const realOrgFilter = { isInternal: false };

    const [expiringSoon, inGrace, expired, suspended] = await Promise.all([
      prisma.subscription.findMany({
        where: {
          status: { in: ['TRIAL', 'ACTIVE'] },
          organization: realOrgFilter,
          OR: [
            { trialEnd: { gte: now, lte: next7d } },
            { currentPeriodEnd: { gte: now, lte: next7d } },
          ],
        },
        orderBy: { trialEnd: 'asc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.subscription.findMany({
        where: { status: 'GRACE', organization: realOrgFilter },
        orderBy: { graceEnd: 'asc' },
        include: { organization: { select: { id: true, name: true, slug: true } } },
      }),
      prisma.subscription.findMany({
        where: { status: 'EXPIRED', organization: realOrgFilter },
        orderBy: { expiredAt: 'desc' },
        take: 100,
        include: { organization: { select: { id: true, name: true, slug: true } } },
      }),
      prisma.subscription.findMany({
        where: { status: 'SUSPENDED', organization: realOrgFilter },
        include: { organization: { select: { id: true, name: true, slug: true } } },
      }),
    ]);

    res.json({ data: { expiringSoon, inGrace, expired, suspended } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};