// src/modules/products/kxtill/permissions.js

const permissions = [
  // ============================================================
  // SALES
  // ============================================================
  {
    key: 'kxtill.sales.create',
    name: 'Create Sales',
    description: 'Create sales transactions',
  },
  {
    key: 'kxtill.sales.view',
    name: 'View Sales',
    description: 'View sales transactions',
  },
  {
    key: 'kxtill.sales.refund',
    name: 'Refund Sales',
    description: 'Refund sales transactions',
  },

  // ============================================================
  // INVENTORY
  // ============================================================
  {
    key: 'kxtill.inventory.create',
    name: 'Create Inventory',
    description: 'Add inventory items',
  },
  {
    key: 'kxtill.inventory.view',
    name: 'View Inventory',
    description: 'View inventory items',
  },
  {
    key: 'kxtill.inventory.update',
    name: 'Update Inventory',
    description: 'Modify inventory items',
  },
  {
    key: 'kxtill.inventory.delete',
    name: 'Delete Inventory',
    description: 'Delete inventory items',
  },
  {
    key: 'kxtill.inventory.global.view',
    name: 'View Global Inventory',
    description: 'View organization-wide inventory across all branches',
  },

  // ============================================================
  // TRANSFERS
  // ============================================================
  {
    key: 'kxtill.inventory.transfers.create',
    name: 'Create Transfers',
    description: 'Create stock transfers between branches',
  },
  {
    key: 'kxtill.inventory.transfers.approve',
    name: 'Approve/Reject Transfers',
    description: 'Approve or reject pending stock transfers',
  },
  {
    key: 'kxtill.inventory.transfers.complete',
    name: 'Complete Transfers',
    description: 'Confirm receipt and complete stock transfers',
  },

  // ============================================================
  // REPORTS
  // ============================================================
  {
    key: 'kxtill.reports.view',
    name: 'View Reports',
    description: 'View KxTill reports',
  },
  {
    key: 'kxtill.reports.export',
    name: 'Export Reports',
    description: 'Export KxTill reports',
  },


  // ============================================================
  // SHIFTS
  // ============================================================
  {
    key: 'kxtill.shift.force_close',
    name: 'Force Close Shift',
    description: 'Force close any shift',
  },
  {
    key: 'kxtill.shift.resolve_handover',
    name: 'Resolve Handover',
    description: 'Resolve shift handover requests',
  },
  {
    key: 'kxtill.shift.resolve_variance',
    name: 'Resolve Variance',
    description: 'Review and resolve shift variance',
  },
  {
    key: 'kxtill.shift.settings',
    name: 'Shift Settings',
    description: 'Enable/disable shifts per branch',
  },
  // ============================================================
  // CREDIT (DENI)
  // ============================================================
  {
    key: 'kxtill.credit.view',
    name: 'View Credit Ledger',
    description: 'View customer credit balances and history',
  },
  {
    key: 'kxtill.credit.adjust',
    name: 'Adjust Credit',
    description: 'Adjust customer credit balance and set credit limits',
  },
  // ============================================================
  // SETTINGS
  // ============================================================
  {
    key: 'kxtill.settings.view',
    name: 'View Settings',
    description: 'View KxTill settings',
  },
  {
    key: 'kxtill.settings.update',
    name: 'Update Settings',
    description: 'Modify KxTill settings',
  },
];

export default permissions;