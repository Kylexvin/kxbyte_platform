// src/modules/products/kxcrm/permissions.js
//
// Engine-level permission catalogue. Namespace: `crm.*`
//
// These are the permissions the KxCRM engine itself checks via
// context.can(...). Any surface (admin/crm today, kxcrm/controllers
// later) maps its caller's role into these keys.
//
// Admin surface additionally declares admin.leads.* / admin.pipeline.*
// aliases in admin/permissions.js. That lets the admin UI gate buttons
// while the engine continues to speak crm.*.

const permissions = [
  // ============================================================
  // PIPELINE
  // ============================================================
  {
    key: 'crm.pipeline.view',
    name: 'View Pipeline',
    description: 'View pipeline stages and status',
  },
  {
    key: 'crm.pipeline.manage',
    name: 'Manage Pipeline',
    description: 'Create, update, reorder, delete pipeline stages',
  },

  // ============================================================
  // LEADS
  // ============================================================
  {
    key: 'crm.leads.view',
    name: 'View Leads',
    description: 'View leads and lead details',
  },
  {
    key: 'crm.leads.create',
    name: 'Create Leads',
    description: 'Create new leads',
  },
  {
    key: 'crm.leads.edit',
    name: 'Edit Leads',
    description: 'Edit lead details (excluding stage)',
  },
  {
    key: 'crm.leads.assign',
    name: 'Assign Leads',
    description: 'Assign leads to organization members',
  },
  {
    key: 'crm.leads.change_stage',
    name: 'Change Lead Stage',
    description: 'Move leads between pipeline stages',
  },
  {
    key: 'crm.leads.delete',
    name: 'Delete Leads',
    description: 'Soft-delete leads',
  },
  {
    key: 'crm.leads.convert',
    name: 'Convert Leads',
    description: 'Move a lead to Won and convert it into an organization',
  },

  // ============================================================
  // ACTIVITIES
  // ============================================================
  {
    key: 'crm.activities.view',
    name: 'View Lead Activities',
    description: 'View the activity timeline for leads',
  },
  {
    key: 'crm.activities.create',
    name: 'Log Lead Activities',
    description: 'Log calls, visits, notes and other activities against leads',
  },

  // ============================================================
  // ANALYTICS (deferred — Phase 6)
  // ============================================================
  {
    key: 'crm.analytics.view',
    name: 'View CRM Analytics',
    description: 'View CRM conversion metrics and agent performance',
  },
];

export default permissions;