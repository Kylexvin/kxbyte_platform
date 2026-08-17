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
  // CUSTOMERS
  // ============================================================
  {
    key: 'kxtill.customers.create',
    name: 'Create Customers',
    description: 'Add new customers',
  },
  {
    key: 'kxtill.customers.view',
    name: 'View Customers',
    description: 'View customer list and details',
  },
  {
    key: 'kxtill.customers.update',
    name: 'Update Customers',
    description: 'Modify customer information',
  },
  {
    key: 'kxtill.customers.delete',
    name: 'Delete Customers',
    description: 'Delete customers',
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
  {
  key: 'audit.logs.export',
  name: 'Export Audit Logs',
  description: 'Export audit logs for the organization',
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