// src/modules/platform/permissions.js

const platformPermissions = [
  // ============================================================
  // BRANCHES
  // ============================================================
  {
    key: 'branches.view',
    name: 'View Branches',
    description: 'View branch information and performance',
  },
  {
    key: 'branches.manage',
    name: 'Manage Branches',
    description: 'Create, update, and delete branches',
  },

  // ============================================================
  // MEMBERS
  // ============================================================
  {
    key: 'members.view',
    name: 'View Members',
    description: 'View organization members',
  },
  {
    key: 'members.manage',
    name: 'Manage Members',
    description: 'Add, remove, and manage members',
  },

  // ============================================================
  // AUDIT
  // ============================================================
  {
    key: 'audit.logs.view',
    name: 'View Audit Logs',
    description: 'View audit logs for the organization',
  },
  {
    key: 'audit.logs.export',
    name: 'Export Audit Logs',
    description: 'Export audit logs for the organization',
  },

  // ============================================================
  // SUBSCRIPTIONS
  // ============================================================
  {
    key: 'subscriptions.view',
    name: 'View Subscriptions',
    description: 'View organization subscriptions',
  },
  {
    key: 'subscriptions.manage',
    name: 'Manage Subscriptions',
    description: 'Manage organization subscriptions',
  },

  // ============================================================
  // SUPPORT
  // ============================================================
  {
    key: 'support.tickets.view',
    name: 'View Support Tickets',
    description: 'View support tickets',
  },
  {
    key: 'support.tickets.create',
    name: 'Create Support Tickets',
    description: 'Create support tickets',
  },
];

export default platformPermissions;