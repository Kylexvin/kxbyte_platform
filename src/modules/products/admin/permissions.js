// src/modules/products/admin/permissions.js

const permissions = [
  // ============================================================
  // USERS (platform-wide identities)
  // ============================================================
  { key: 'admin.users.view',          name: 'View Users',          description: 'View all platform users' },
  { key: 'admin.users.manage',        name: 'Manage Users',        description: 'Activate/deactivate users' },
  { key: 'admin.users.sessions.view', name: 'View User Sessions',  description: 'View active sessions in user detail' },

  // ============================================================
  // DASHBOARD
  // ============================================================
  { key: 'admin.dashboard.view', name: 'View Dashboard', description: 'Platform overview metrics' },

  // ============================================================
  // ORGANIZATIONS
  // ============================================================
  { key: 'admin.organizations.view',   name: 'View Organizations',   description: 'List and view all customer organizations' },
  { key: 'admin.organizations.manage', name: 'Manage Organizations', description: 'Activate, suspend, archive organizations' },


  // ============================================================
  // PRODUCTS
  // ============================================================
  { key: 'admin.products.view',   name: 'View Products',   description: 'View the internal product catalogue' },
  { key: 'admin.products.manage', name: 'Manage Products', description: 'Edit product name, description, icon and availability' },
  // ============================================================
  // SUBSCRIPTIONS
  // ============================================================
  { key: 'admin.subscriptions.view',      name: 'View Subscriptions',      description: 'View all subscriptions' },
  { key: 'admin.subscriptions.renew',     name: 'Renew Subscription',      description: 'Record payment and renew' },
  { key: 'admin.subscriptions.setDates',  name: 'Set Subscription Dates',  description: 'Edit trial/period/grace dates' },
  { key: 'admin.subscriptions.setStatus', name: 'Set Subscription Status', description: 'Force status changes' },
  { key: 'admin.subscriptions.suspend',   name: 'Suspend Subscription',    description: 'Suspend an active subscription' },
  { key: 'admin.payments.manage', name: 'Manage Billing', description: 'Edit platform payment config' },
  
  // ============================================================
  // PAYMENTS
  // ============================================================
  { key: 'admin.payments.view',   name: 'View Payments',   description: 'View payment history' },
  { key: 'admin.payments.record', name: 'Record Payment',  description: 'Record an offline payment' },

  // ============================================================
  // AUDIT
  // ============================================================
  { key: 'admin.audit.view', name: 'View Platform Audit', description: 'View platform-wide audit events' },

  // ============================================================
  // PLATFORM MEMBERS (KXBYTE internal staff)
  // ============================================================
  { key: 'admin.members.view',   name: 'View Platform Members',   description: 'View KxByte internal members' },
  { key: 'admin.members.manage', name: 'Manage Platform Members', description: 'Invite/remove KxByte staff' },

  // ============================================================
  // CRM — PIPELINE (admin UI gate; engine uses crm.* equivalents)
  // ============================================================
  { key: 'admin.pipeline.view',   name: 'View CRM Pipeline',   description: 'View CRM pipeline stages and board' },
  { key: 'admin.pipeline.manage', name: 'Manage CRM Pipeline', description: 'Configure CRM pipeline stages' },

  // ============================================================
  // CRM — LEADS (admin UI gate; engine uses crm.* equivalents)
  // ============================================================
  { key: 'admin.leads.view',         name: 'View CRM Leads',         description: 'View CRM leads and details' },
  { key: 'admin.leads.create',       name: 'Create CRM Leads',       description: 'Create new CRM leads' },
  { key: 'admin.leads.edit',         name: 'Edit CRM Leads',         description: 'Edit CRM lead details' },
  { key: 'admin.leads.assign',       name: 'Assign CRM Leads',       description: 'Assign CRM leads to staff' },
  { key: 'admin.leads.change_stage', name: 'Change Lead Stage',      description: 'Move CRM leads between pipeline stages' },
  { key: 'admin.leads.delete',       name: 'Delete CRM Leads',       description: 'Soft-delete CRM leads' },
  { key: 'admin.leads.convert',      name: 'Convert CRM Leads',      description: 'Convert Won leads into organizations' },

  // ============================================================
  // CRM — ACTIVITIES (admin UI gate; engine uses crm.* equivalents)
  // ============================================================
  { key: 'admin.activities.view',   name: 'View Lead Activities',   description: 'View CRM lead activity timelines' },
  { key: 'admin.activities.create', name: 'Log Lead Activities',    description: 'Log calls, visits, notes against CRM leads' },
];

export default permissions;