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
  // CUSTOMERS
  // ============================================================
  {
    key: 'customers.view',
    name: 'View Customers',
    description: 'View customer list and details',
  },
  {
    key: 'customers.create',
    name: 'Create Customers',
    description: 'Add new customers',
  },
  {
    key: 'customers.update',
    name: 'Update Customers',
    description: 'Modify customer information',
  },
  {
    key: 'customers.delete',
    name: 'Delete Customers',
    description: 'Delete customers',
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
// SUPPORT PERMISSIONS — designed to be portable to KxHelp
// ============================================================
// The support module today lives at the org level, but the
// permission keys and data model are shaped so that a future
// standalone KxHelp product can reuse them verbatim.
//
// Mapping (when KxHelp ships as its own product):
//   org               → workspace
//   branch contextId  → queue / site / team
//   support.tickets.* → kxhelp.tickets.*  (or left as-is)
//
// KxHelp's own permission catalog (in its product folder) should
// mirror these keys. If a key changes here, it should change
// there too, and the reverse.
// ============================================================

{
  key: 'support.tickets.view',
  name: 'View Support Tickets',
  description: 'View support tickets you have access to',
},
{
  key: 'support.tickets.view.all',
  name: 'View All Support Tickets',
  description: 'View every support ticket in the organization, regardless of branch',
},
{
  key: 'support.tickets.create',
  name: 'Create Support Tickets',
  description: 'Create new support tickets',
},
{
  key: 'support.tickets.manage',
  name: 'Manage Support Tickets',
  description: 'Update ticket status, priority, and post internal notes',
},

// ============================================================
// SETTINGS
// ============================================================
{
  key: 'settings.view',
  name: 'View Settings',
  description: 'View organization settings and preferences',
},
{
  key: 'settings.manage',
  name: 'Manage Settings',
  description: 'Update organization settings and preferences',
},
];

export default platformPermissions;