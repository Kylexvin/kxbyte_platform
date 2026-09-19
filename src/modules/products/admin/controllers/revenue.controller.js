import prisma from '../../../../database/postgres/prisma.js';

export const summary = async (req, res) => {
  try {
    const { from, to, productKey } = req.query;

    const where = { status: 'COMPLETED' };
    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt.gte = new Date(from);
      if (to) where.paidAt.lte = new Date(to);
    }
    where.subscription = {
      organization: { isInternal: false },
      ...(productKey ? { productKey } : { productKey: { not: 'admin' } }),
    };

    const [total, byMethod, byProduct, byCurrency] = await Promise.all([
      prisma.payment.aggregate({ where, _sum: { amount: true }, _count: { _all: true } }),
      prisma.payment.groupBy({ by: ['method'], where, _sum: { amount: true }, _count: { _all: true } }),
      prisma.payment.groupBy({
        by: ['subscriptionId'],
        where,
        _sum: { amount: true },
      }),
      prisma.payment.groupBy({ by: ['currency'], where, _sum: { amount: true }, _count: { _all: true } }),
    ]);

    res.json({
      data: {
        total: total._sum.amount || 0,
        count: total._count._all || 0,
        byMethod: byMethod.map((m) => ({ method: m.method || 'UNKNOWN', amount: m._sum.amount || 0, count: m._count._all })),
        byCurrency: byCurrency.map((c) => ({ currency: c.currency, amount: c._sum.amount || 0, count: c._count._all })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const list = async (req, res) => {
  try {
    const { from, to, productKey, organizationId, limit = 100, offset = 0 } = req.query;

    const where = { status: 'COMPLETED' };
    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt.gte = new Date(from);
      if (to) where.paidAt.lte = new Date(to);
    }
    where.subscription = {
      organization: organizationId ? { id: organizationId } : { isInternal: false },
      ...(productKey ? { productKey } : { productKey: { not: 'admin' } }),
    };

    const [payments, count] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: Number(offset),
        take: Number(limit),
        include: {
          subscription: {
            select: {
              id: true, productKey: true,
              organization: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({ data: payments, meta: { total: count, limit: Number(limit), offset: Number(offset) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};