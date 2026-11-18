// src/modules/products/admin/onboarding/services/onboarding.service.js
//
// Onboarding engine. Seeding, listing, detail, mutations, auto-check sync.
// Auto-checks resolve via checks/index.js, keyed by productKey.
// Templates resolve via templates/index.js, keyed by productKey.
//
// Sync policy:
//   - getOnboarding() lazily syncs that one onboarding
//   - listOnboardings() does not sync (board reads persisted state)
//   - Cron calls syncAllActive() every N minutes
//
// Ad-hoc tasks: onboardingId: null, category: GENERAL, source: 'admin'.

import prisma from '../../../../../database/postgres/prisma.js';
import templates from '../templates/index.js';
import checks from '../checks/index.js';
import audit from '../../../../platform/audit/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================
// HELPERS
// ============================================================

const computeDueAt = (startedAt, dueInDays) =>
  dueInDays != null
    ? new Date(new Date(startedAt).getTime() + dueInDays * DAY_MS)
    : null;

const isOverdue = (task) =>
  task.status === 'PENDING' && task.dueAt && new Date(task.dueAt) < new Date();

const computeProgress = (tasks) => {
  const required = tasks.filter((t) => t.required);
  const applicable = required.filter((t) => t.status !== 'IGNORED');
  const completed = applicable.filter((t) => t.status === 'COMPLETED');
  const ignored = required.filter((t) => t.status === 'IGNORED');
  const pending = applicable.filter((t) => t.status === 'PENDING');
  const overdue = applicable.filter(isOverdue);

  return {
    requiredCount: required.length,
    applicableCount: applicable.length,
    completedCount: completed.length,
    pendingCount: pending.length,
    ignoredCount: ignored.length,
    overdueCount: overdue.length,
    progressPercent:
      applicable.length > 0
        ? Math.round((completed.length / applicable.length) * 100)
        : 0,
  };
};

const getResolver = (productKey, autoCheckKey) => {
  const productChecks = checks[productKey];
  if (!productChecks) return null;
  return productChecks[autoCheckKey] || null;
};

const loadOnboardingOrThrow = async (onboardingId) => {
  const onboarding = await prisma.organizationOnboarding.findUnique({
    where: { id: onboardingId },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      owner: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!onboarding) {
    const err = new Error('Onboarding not found');
    err.name = 'NotFoundError';
    err.code = 'ONBOARDING_NOT_FOUND';
    throw err;
  }
  return onboarding;
};

const loadTaskOrThrow = async (onboardingId, taskId) => {
  const task = await prisma.onboardingTask.findFirst({
    where: { id: taskId, onboardingId },
    select: { id: true, status: true, required: true, title: true, key: true },
  });
  if (!task) {
    const err = new Error('Task not found');
    err.name = 'NotFoundError';
    err.code = 'TASK_NOT_FOUND';
    throw err;
  }
  return task;
};

// ============================================================
// SEEDING (called by activation hook)
// ============================================================

const seedForProduct = async (organizationId, productKey) => {
  const template = templates[productKey];
  if (!template) return null;

  const existing = await prisma.organizationOnboarding.findUnique({
    where: { organizationId_productKey: { organizationId, productKey } },
    select: { id: true },
  });
  if (existing) return existing;

  const startedAt = new Date();

  const onboarding = await prisma.organizationOnboarding.create({
    data: {
      organizationId,
      productKey,
      templateKey: template.templateKey,
      status: 'IN_PROGRESS',
      startedAt,
      tasks: {
        create: template.tasks.map((t) => ({
          organizationId,
          key: t.key,
          title: t.title,
          description: t.description,
          category: t.category,
          source: 'template',
          autoCheck: t.autoCheck || null,
          required: t.required !== false,
          status: 'PENDING',
          dueAt: computeDueAt(startedAt, t.dueInDays),
        })),
      },
    },
    select: { id: true },
  });

  await audit.log({
    organizationId,
    userId: null,
    action: 'ONBOARDING_SEEDED',
    resource: 'organization_onboarding',
    resourceId: onboarding.id,
    metadata: {
      productKey,
      templateKey: template.templateKey,
      taskCount: template.tasks.length,
    },
  });

  return onboarding;
};

// ============================================================
// AUTO-CHECK SYNC
// ============================================================

const syncAutoChecksForOnboarding = async (onboardingId) => {
  const onboarding = await prisma.organizationOnboarding.findUnique({
    where: { id: onboardingId },
    include: {
      tasks: { where: { status: 'PENDING', autoCheck: { not: null } } },
    },
  });
  if (!onboarding) return { updated: 0 };

  let updated = 0;
  for (const task of onboarding.tasks) {
    const resolver = getResolver(onboarding.productKey, task.autoCheck);
    if (!resolver) continue;

    let satisfied = false;
    try {
      satisfied = await resolver(onboarding.organizationId);
    } catch (err) {
      console.error(
        `[onboarding] Resolver ${onboarding.productKey}.${task.autoCheck} failed:`,
        err.message
      );
      continue;
    }
    if (!satisfied) continue;

    await prisma.onboardingTask.update({
      where: { id: task.id },
      data: { status: 'COMPLETED', completedAt: new Date(), completedById: null },
    });
    updated++;
  }

  if (updated > 0) await maybeCompleteOnboarding(onboardingId);
  return { updated };
};

const maybeCompleteOnboarding = async (onboardingId) => {
  const onboarding = await prisma.organizationOnboarding.findUnique({
    where: { id: onboardingId },
    include: { tasks: { where: { required: true } } },
  });
  if (!onboarding) return;
  if (onboarding.status === 'COMPLETED') return;

  const allDone = onboarding.tasks.every(
    (t) => t.status === 'COMPLETED' || t.status === 'IGNORED'
  );
  if (!allDone) return;

  await prisma.organizationOnboarding.update({
    where: { id: onboardingId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  await audit.log({
    organizationId: onboarding.organizationId,
    userId: null,
    action: 'ONBOARDING_COMPLETED',
    resource: 'organization_onboarding',
    resourceId: onboardingId,
    metadata: { productKey: onboarding.productKey },
  });
};

const syncAllActive = async () => {
  const active = await prisma.organizationOnboarding.findMany({
    where: { status: 'IN_PROGRESS' },
    select: { id: true },
  });

  let total = 0;
  for (const { id } of active) {
    try {
      const { updated } = await syncAutoChecksForOnboarding(id);
      total += updated;
    } catch (err) {
      console.error(`[onboarding] Sync failed for ${id}:`, err.message);
    }
  }
  return { onboardingsSynced: active.length, tasksUpdated: total };
};

// ============================================================
// LIST
// ============================================================

const listOnboardings = async (filters = {}) => {
  const { productKey, ownerId, status, page = 1, limit = 50 } = filters;

  const where = {};
  if (productKey) where.productKey = productKey;
  if (ownerId === 'unassigned') where.ownerId = null;
  else if (ownerId) where.ownerId = ownerId;
  if (status) where.status = status;

  const [rows, total] = await Promise.all([
    prisma.organizationOnboarding.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            required: true,
            status: true,
            dueAt: true,
            category: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organizationOnboarding.count({ where }),
  ]);

  const data = rows.map((o) => {
    const progress = computeProgress(o.tasks);
    const nextTask = o.tasks
      .filter((t) => t.required && t.status === 'PENDING')
      .sort((a, b) => {
        if (a.dueAt && b.dueAt) return new Date(a.dueAt) - new Date(b.dueAt);
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return 0;
      })[0];

    return {
      id: o.id,
      organizationId: o.organizationId,
      organization: o.organization,
      productKey: o.productKey,
      templateKey: o.templateKey,
      status: o.status,
      owner: o.owner,
      startedAt: o.startedAt,
      completedAt: o.completedAt,
      progress,
      nextTask: nextTask
        ? { id: nextTask.id, title: nextTask.title, dueAt: nextTask.dueAt }
        : null,
    };
  });

  return { data, total, page, limit };
};

// ============================================================
// DETAIL (with lazy auto-check sync)
// ============================================================

const getOnboarding = async (onboardingId) => {
  // Lazy sync — makes the detail page always fresh.
  await syncAutoChecksForOnboarding(onboardingId);

  const o = await prisma.organizationOnboarding.findUnique({
    where: { id: onboardingId },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, createdAt: true },
      },
      owner: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      tasks: {
        include: {
          completedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
  if (!o) {
    const err = new Error('Onboarding not found');
    err.name = 'NotFoundError';
    err.code = 'ONBOARDING_NOT_FOUND';
    throw err;
  }

  const progress = computeProgress(o.tasks);

  // Group tasks by category
  const grouped = {};
  for (const task of o.tasks) {
    if (!grouped[task.category]) grouped[task.category] = [];
    grouped[task.category].push({
      ...task,
      isOverdue: isOverdue(task),
    });
  }

  // Ad-hoc tasks (onboardingId null, org-scoped)
  const adHocTasks = await prisma.onboardingTask.findMany({
    where: { organizationId: o.organizationId, onboardingId: null },
    include: {
      completedBy: { select: { id: true, firstName: true, lastName: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    id: o.id,
    organizationId: o.organizationId,
    organization: o.organization,
    productKey: o.productKey,
    templateKey: o.templateKey,
    status: o.status,
    owner: o.owner,
    startedAt: o.startedAt,
    completedAt: o.completedAt,
    progress,
    tasksByCategory: grouped,
    adHocTasks,
  };
};

// ============================================================
// ALL AD-HOC TASKS (for the Tasks tab)
// ============================================================

const listAdHocTasks = async (filters = {}) => {
  const { status, orgId, overdue, page = 1, limit = 50 } = filters;

  const where = { onboardingId: null, source: 'admin' };
  if (status) where.status = status;
  if (orgId) where.organizationId = orgId;
  if (overdue === true) {
    where.status = 'PENDING';
    where.dueAt = { lt: new Date() };
  }

  const [tasks, total] = await Promise.all([
    prisma.onboardingTask.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        completedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.onboardingTask.count({ where }),
  ]);

  return { data: tasks, total, page, limit };
};
// ============================================================
// TASK MUTATIONS
// ============================================================

const markComplete = async (onboardingId, taskId, userId) => {
  const task = await loadTaskOrThrow(onboardingId, taskId);
  if (task.status === 'COMPLETED') return task;

  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: { status: 'COMPLETED', completedAt: new Date(), completedById: userId },
  });

  const onboarding = await prisma.organizationOnboarding.findUnique({
    where: { id: onboardingId },
    select: { organizationId: true, productKey: true },
  });

  await audit.log({
    organizationId: onboarding.organizationId,
    userId,
    action: 'ONBOARDING_TASK_COMPLETED',
    resource: 'onboarding_task',
    resourceId: taskId,
    metadata: { onboardingId, taskKey: task.key, productKey: onboarding.productKey },
  });

  await maybeCompleteOnboarding(onboardingId);
  return updated;
};

const markIgnored = async (onboardingId, taskId, userId) => {
  const task = await loadTaskOrThrow(onboardingId, taskId);
  if (task.status === 'IGNORED') return task;

  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: { status: 'IGNORED', completedAt: new Date(), completedById: userId },
  });

  const onboarding = await prisma.organizationOnboarding.findUnique({
    where: { id: onboardingId },
    select: { organizationId: true, productKey: true },
  });

  await audit.log({
    organizationId: onboarding.organizationId,
    userId,
    action: 'ONBOARDING_TASK_IGNORED',
    resource: 'onboarding_task',
    resourceId: taskId,
    metadata: { onboardingId, taskKey: task.key, productKey: onboarding.productKey },
  });

  await maybeCompleteOnboarding(onboardingId);
  return updated;
};

const reopen = async (onboardingId, taskId, userId) => {
  const task = await loadTaskOrThrow(onboardingId, taskId);
  if (task.status === 'PENDING') return task;

  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: { status: 'PENDING', completedAt: null, completedById: null },
  });

  const onboarding = await prisma.organizationOnboarding.findUnique({
    where: { id: onboardingId },
    select: { organizationId: true, productKey: true },
  });

  // If onboarding was COMPLETED, flip back to IN_PROGRESS.
  await prisma.organizationOnboarding.updateMany({
    where: { id: onboardingId, status: 'COMPLETED' },
    data: { status: 'IN_PROGRESS', completedAt: null },
  });

  await audit.log({
    organizationId: onboarding.organizationId,
    userId,
    action: 'ONBOARDING_TASK_REOPENED',
    resource: 'onboarding_task',
    resourceId: taskId,
    metadata: { onboardingId, taskKey: task.key, productKey: onboarding.productKey },
  });

  return updated;
};

const setDueDate = async (onboardingId, taskId, dueAt, userId) => {
  await loadTaskOrThrow(onboardingId, taskId);

  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: { dueAt: dueAt ? new Date(dueAt) : null },
  });

  await audit.log({
    organizationId: (await prisma.organizationOnboarding.findUnique({
      where: { id: onboardingId },
      select: { organizationId: true },
    })).organizationId,
    userId,
    action: 'ONBOARDING_TASK_DUE_DATE_SET',
    resource: 'onboarding_task',
    resourceId: taskId,
    metadata: { onboardingId, dueAt },
  });

  return updated;
};

const setTaskNotes = async (onboardingId, taskId, notes) => {
  await loadTaskOrThrow(onboardingId, taskId);
  return prisma.onboardingTask.update({
    where: { id: taskId },
    data: { notes: notes || null },
  });
};

// ============================================================
// OWNER
// ============================================================

const assignOwner = async (onboardingId, ownerId, actorId) => {
  await loadOnboardingOrThrow(onboardingId);

  if (ownerId) {
    const user = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true },
    });
    if (!user) {
      const err = new Error('Owner user not found');
      err.name = 'ValidationError';
      err.code = 'OWNER_NOT_FOUND';
      throw err;
    }
  }

  const updated = await prisma.organizationOnboarding.update({
    where: { id: onboardingId },
    data: { ownerId: ownerId || null },
  });

  const onboarding = await loadOnboardingOrThrow(onboardingId);

  await audit.log({
    organizationId: onboarding.organizationId,
    userId: actorId,
    action: 'ONBOARDING_OWNER_ASSIGNED',
    resource: 'organization_onboarding',
    resourceId: onboardingId,
    metadata: { ownerId: ownerId || null },
  });

  return updated;
};

// ============================================================
// AD-HOC TASKS (onboardingId: null)
// ============================================================

const addAdHocTask = async (organizationId, actorId, payload) => {
  if (!payload.title || !payload.title.trim()) {
    const err = new Error('Title is required');
    err.name = 'ValidationError';
    err.code = 'TITLE_REQUIRED';
    throw err;
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!org) {
    const err = new Error('Organization not found');
    err.name = 'NotFoundError';
    err.code = 'ORGANIZATION_NOT_FOUND';
    throw err;
  }

  if (payload.assignedToId) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId: payload.assignedToId,
        isActive: true,
        organization: { slug: 'kxbyte' },
      },
      select: { userId: true },
    });
    if (!membership) {
      const err = new Error('Assignee is not an active KXBYTE staff member');
      err.name = 'ValidationError';
      err.code = 'ASSIGNEE_NOT_STAFF';
      throw err;
    }
  }

  const task = await prisma.onboardingTask.create({
    data: {
      organizationId,
      onboardingId: null,
      key: `adhoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      category: 'GENERAL',
      source: 'admin',
      autoCheck: null,
      required: false,
      status: 'PENDING',
      dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
      assignedToId: payload.assignedToId || null,
    },
  });

  await audit.log({
    organizationId,
    userId: actorId,
    action: 'ONBOARDING_ADHOC_TASK_CREATED',
    resource: 'onboarding_task',
    resourceId: task.id,
    metadata: { title: task.title, assignedToId: task.assignedToId || null },
  });

  return task;
};

const deleteAdHocTask = async (organizationId, taskId, actorId) => {
  const task = await prisma.onboardingTask.findFirst({
    where: { id: taskId, organizationId, onboardingId: null, source: 'admin' },
    select: { id: true, title: true },
  });
  if (!task) {
    const err = new Error('Ad-hoc task not found');
    err.name = 'NotFoundError';
    err.code = 'ADHOC_TASK_NOT_FOUND';
    throw err;
  }

  await prisma.onboardingTask.delete({ where: { id: taskId } });

  await audit.log({
    organizationId,
    userId: actorId,
    action: 'ONBOARDING_ADHOC_TASK_DELETED',
    resource: 'onboarding_task',
    resourceId: taskId,
    metadata: { title: task.title },
  });

  return { message: 'Task deleted' };
};

const loadAdHocTaskOrThrow = async (organizationId, taskId) => {
  const task = await prisma.onboardingTask.findFirst({
    where: {
      id: taskId,
      organizationId,
      onboardingId: null,
      source: 'admin',
    },
    select: { id: true, title: true, status: true, organizationId: true },
  });
  if (!task) {
    const err = new Error('Ad-hoc task not found');
    err.name = 'NotFoundError';
    err.code = 'ADHOC_TASK_NOT_FOUND';
    throw err;
  }
  return task;
};

const completeAdHocTask = async (organizationId, taskId, userId) => {
  const task = await loadAdHocTaskOrThrow(organizationId, taskId);
  if (task.status === 'COMPLETED') return task;

  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: { status: 'COMPLETED', completedAt: new Date(), completedById: userId },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'ADHOC_TASK_COMPLETED',
    resource: 'onboarding_task',
    resourceId: taskId,
    metadata: { title: task.title },
  });

  return updated;
};

const ignoreAdHocTask = async (organizationId, taskId, userId) => {
  const task = await loadAdHocTaskOrThrow(organizationId, taskId);
  if (task.status === 'IGNORED') return task;

  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: { status: 'IGNORED', completedAt: new Date(), completedById: userId },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'ADHOC_TASK_IGNORED',
    resource: 'onboarding_task',
    resourceId: taskId,
    metadata: { title: task.title },
  });

  return updated;
};

const reopenAdHocTask = async (organizationId, taskId, userId) => {
  const task = await loadAdHocTaskOrThrow(organizationId, taskId);
  if (task.status === 'PENDING') return task;

  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: { status: 'PENDING', completedAt: null, completedById: null },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'ADHOC_TASK_REOPENED',
    resource: 'onboarding_task',
    resourceId: taskId,
    metadata: { title: task.title },
  });

  return updated;
};

const assignAdHocTask = async (organizationId, taskId, assigneeId, actorId) => {
  await loadAdHocTaskOrThrow(organizationId, taskId);

  if (assigneeId) {
    // Assignee must be an active KXBYTE staff member.
    const membership = await prisma.membership.findFirst({
      where: {
        userId: assigneeId,
        isActive: true,
        organization: { slug: 'kxbyte' },
      },
      select: { userId: true },
    });
    if (!membership) {
      const err = new Error('Assignee is not an active KXBYTE staff member');
      err.name = 'ValidationError';
      err.code = 'ASSIGNEE_NOT_STAFF';
      throw err;
    }
  }

  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: { assignedToId: assigneeId || null },
  });

  await audit.log({
    organizationId,
    userId: actorId,
    action: 'ADHOC_TASK_ASSIGNED',
    resource: 'onboarding_task',
    resourceId: taskId,
    metadata: { assignedToId: assigneeId || null },
  });

  return updated;
};

// ============================================================
// ORG MATRIX — for the "all orgs" board
// ============================================================

const listOrgsWithOnboarding = async (filters = {}) => {
  const { search, page = 1, limit = 25 } = filters;

  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        isInternal: true,
        isActive: true,
        createdAt: true,
        onboardings: {
          select: {
            id: true,
            productKey: true,
            status: true,
            owner: { select: { id: true, firstName: true, lastName: true } },
            startedAt: true,
            completedAt: true,
            tasks: {
              select: { required: true, status: true, dueAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organization.count({ where }),
  ]);

  const data = orgs.map((org) => {
    const products = {};
    for (const o of org.onboardings) {
      products[o.productKey] = {
        onboardingId: o.id,
        status: o.status,
        owner: o.owner,
        startedAt: o.startedAt,
        completedAt: o.completedAt,
        progress: computeProgress(o.tasks),
      };
    }
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      isInternal: org.isInternal,
      isActive: org.isActive,
      createdAt: org.createdAt,
      products,
    };
  });

  return { data, total, page, limit };
};

const startOnboarding = async (organizationId, productKey, userId) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!org) {
    const err = new Error('Organization not found');
    err.name = 'NotFoundError';
    err.code = 'ORGANIZATION_NOT_FOUND';
    throw err;
  }

  const seeded = await seedForProduct(organizationId, productKey);
  if (!seeded) {
    const err = new Error(`No onboarding template for product '${productKey}'`);
    err.name = 'ValidationError';
    err.code = 'NO_TEMPLATE';
    throw err;
  }

  await audit.log({
    organizationId,
    userId,
    action: 'ONBOARDING_STARTED_MANUALLY',
    resource: 'organization_onboarding',
    resourceId: seeded.id,
    metadata: { productKey },
  });

  return seeded;
};



// ============================================================
// EXPORT
// ============================================================

export default {
  // Seed + sync
  seedForProduct,
  syncAutoChecksForOnboarding,
  syncAllActive,
  // Read
  listOnboardings,
  getOnboarding,
  listAdHocTasks,
  // Task mutations
  markComplete,
  markIgnored,
  reopen,
  setDueDate,
  setTaskNotes,
  // Owner
  assignOwner,
  // Ad-hoc
  addAdHocTask,
  deleteAdHocTask,
  // Org matrix
  listOrgsWithOnboarding,
  startOnboarding,
 // Ad-hoc task mutations
  completeAdHocTask,
  ignoreAdHocTask,
  reopenAdHocTask,
  assignAdHocTask,
};