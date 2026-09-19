import prisma from '../../../../database/postgres/prisma.js';

export const list = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { key: { not: 'admin' } },
      orderBy: { key: 'asc' },
    });

    const enriched = await Promise.all(
      products.map(async (p) => {
        const [active, trial, expired, total] = await Promise.all([
          prisma.subscription.count({ where: { productKey: p.key, status: 'ACTIVE', organization: { isInternal: false } } }),
          prisma.subscription.count({ where: { productKey: p.key, status: 'TRIAL', organization: { isInternal: false } } }),
          prisma.subscription.count({ where: { productKey: p.key, status: 'EXPIRED', organization: { isInternal: false } } }),
          prisma.subscription.count({ where: { productKey: p.key, organization: { isInternal: false } } }),
        ]);
        return { ...p, adoption: { active, trial, expired, total } };
      })
    );

    res.json({ data: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOne = async (req, res) => {
  try {
    const { key } = req.params;
    const product = await prisma.product.findUnique({ where: { key } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const [subs, payments] = await Promise.all([
      prisma.subscription.findMany({
        where: { productKey: key, organization: { isInternal: false } },
        include: { organization: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED', subscription: { productKey: key, organization: { isInternal: false } } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    res.json({
      data: {
        ...product,
        subscriptions: subs,
        revenue: { total: payments._sum.amount || 0, count: payments._count._all || 0 },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};