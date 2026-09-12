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