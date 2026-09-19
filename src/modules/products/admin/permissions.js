// src/modules/products/admin/permissions.js
const permissions = [

  { key: 'admin.users.view',   name: 'View Users',   description: 'View all platform users' },
  { key: 'admin.users.manage', name: 'Manage Users', description: 'Activate/deactivate users' },


 { key: 'admin.dashboard.view',      name: 'View Dashboard',      description: 'Platform overview metrics' },
 { key: 'admin.organizations.view',  name: 'View Organizations',  description: 'List and view all customer organizations' },
 { key: 'admin.organizations.manage',name: 'Manage Organizations',description: 'Activate, suspend, archive organizations' },


  { key: 'admin.dashboard.view', name: 'View Dashboard', description: 'Platform overview metrics' },

  { key: 'admin.organizations.view',     name: 'View Organizations',      description: 'View all customer organizations' },
  { key: 'admin.organizations.manage',   name: 'Manage Organizations',    description: 'Activate/deactivate orgs' },

  { key: 'admin.subscriptions.view',     name: 'View Subscriptions',      description: 'View all subscriptions' },
  { key: 'admin.subscriptions.renew',    name: 'Renew Subscription',      description: 'Record payment and renew' },
  { key: 'admin.subscriptions.setDates', name: 'Set Subscription Dates',  description: 'Edit trial/period/grace dates' },
  { key: 'admin.subscriptions.setStatus',name: 'Set Subscription Status', description: 'Force status changes' },
  { key: 'admin.subscriptions.suspend',  name: 'Suspend Subscription',    description: 'Suspend an active subscription' },

  { key: 'admin.payments.view',          name: 'View Payments',           description: 'View payment history' },
  { key: 'admin.payments.record',        name: 'Record Payment',          description: 'Record an offline payment' },

  { key: 'admin.audit.view',             name: 'View Platform Audit',     description: 'View platform-wide audit events' },
  { key: 'admin.members.view',           name: 'View Platform Members',   description: 'View KxByte internal members' },
  { key: 'admin.members.manage',         name: 'Manage Platform Members', description: 'Invite/remove KxByte staff' },
  { key: 'admin.audit.view', name: 'View Platform Audit', description: 'View audit logs across all organizations' },
];

export default permissions;