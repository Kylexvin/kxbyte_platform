// src/modules/products/kxtill/controllers/export.controller.js

import exportService from '../services/export.service.js';
import orgDb from '../../../platform/organizations/db/org.db.js';

// ============================================================
// PERMISSION HELPERS
// ============================================================

const hasPermission = (permissions, required) => {
  if (!required) return true;
  if (permissions.includes('*')) return true;
  return permissions.includes(required);
};

const hasAnyPermission = (permissions, requiredList) => {
  if (permissions.includes('*')) return true;
  for (const perm of requiredList) {
    if (permissions.includes(perm)) return true;
  }
  return false;
};

// ============================================================
// HANDLE EXPORT
// ============================================================

const handleExport = async (req, res, exportFn, reportName, options = {}) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { startDate, endDate, branchId, format = 'csv' } = req.query;

    // Check organization access
    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Validate dates for reports that need them
    if (options.requiresDateRange && (!startDate || !endDate)) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // Check permissions
    const permissions = req.user?.permissions || [];
    const organization = await orgDb.findOrganizationById(organizationId);
    const isOrgOwner = organization?.ownerId === userId;

    // Owner-only reports
    if (options.requiresOwner && !isOrgOwner && !permissions.includes('*')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check report-specific permissions (allow * or specific permission)
    if (options.requiredPermissions && options.requiredPermissions.length > 0) {
      const hasPerm = hasAnyPermission(permissions, options.requiredPermissions);
      if (!hasPerm && !isOrgOwner) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Get data
    let data;
    if (branchId) {
      data = await exportFn(organizationId, startDate, endDate, branchId);
    } else {
      data = await exportFn(organizationId, startDate, endDate);
    }

    // Handle format
    if (format === 'pdf') {
      const pdfBuffer = await exportService.generatePDF(data, reportName);
      const filename = `${reportName}_${startDate || new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(pdfBuffer);
    }

    // Default: CSV
    const csv = exportService.generateCSV(data);
    const filename = `${reportName}_${startDate || new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);

  } catch (error) {
    console.error(`Export ${reportName} error:`, error);
    res.status(500).json({ error: 'Failed to export report' });
  }
};

// ============================================================
// EXPORT ENDPOINTS
// ============================================================

// Sales Report - requires kxtill.reports.export OR kxtill.reports.view
const exportSales = async (req, res) => {
  return handleExport(req, res, exportService.exportSales, 'Sales_Report', {
    requiredPermissions: ['kxtill.reports.export', 'kxtill.reports.view'],
    requiresDateRange: true,
  });
};

// Stock Report - requires kxtill.reports.export OR kxtill.reports.view
const exportStock = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { branchId } = req.query;

    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Check permissions
    const permissions = req.user?.permissions || [];
    const hasViewPerm = permissions.includes('*') || 
                        permissions.includes('kxtill.reports.view') ||
                        permissions.includes('kxtill.reports.export');

    if (!hasViewPerm) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const data = await exportService.exportStock(organizationId, branchId);
    const format = req.query.format || 'csv';

    if (format === 'pdf') {
      const pdfBuffer = await exportService.generatePDF(data, 'Stock_Report');
      const filename = `Stock_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(pdfBuffer);
    }

    const csv = exportService.generateCSV(data);
    const filename = `Stock_Report_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);

  } catch (error) {
    console.error('Export stock error:', error);
    res.status(500).json({ error: 'Failed to export stock report' });
  }
};

// Top Products - requires kxtill.reports.export OR kxtill.reports.view
const exportTopProducts = async (req, res) => {
  return handleExport(req, res, exportService.exportTopProducts, 'Top_Products', {
    requiredPermissions: ['kxtill.reports.export', 'kxtill.reports.view'],
    requiresDateRange: true,
  });
};

// Branch Performance - Owner only
const exportBranchPerformance = async (req, res) => {
  return handleExport(req, res, exportService.exportBranchPerformance, 'Branch_Performance', {
    requiresOwner: true,
    requiresDateRange: true,
  });
};

// Tax Report - Owner only (disabled for now)
const exportTax = async (req, res) => {
  return handleExport(req, res, exportService.exportTax, 'Tax_Report', {
    requiresOwner: true,
    requiresDateRange: true,
  });
};

// Audit Log - requires audit.logs.export OR owner
const exportAudit = async (req, res) => {
  return handleExport(req, res, exportService.exportAudit, 'Audit_Log', {
    requiredPermissions: ['audit.logs.export'],
    requiresDateRange: true,
  });
};

export default {
  exportSales,
  exportStock,
  exportTopProducts,
  exportBranchPerformance,
  exportTax,
  exportAudit,
};