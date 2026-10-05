// src/modules/products/kxtill/controllers/export.controller.js

import exportService from '../services/export.service.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';

// ============================================================
// PERMISSION HELPER — delegates to the same service the rest
// of the app uses, so owners/platform-admins are handled correctly
// ============================================================
const checkPermission = (userId, organizationId, permissionKey) =>
  authorizationService.checkPermission(userId, organizationId, permissionKey);

const checkAnyPermission = async (userId, organizationId, keys) => {
  for (const key of keys) {
    if (await checkPermission(userId, organizationId, key)) return true;
  }
  return false;
};

// ============================================================
// HANDLE EXPORT (shared)
// ============================================================
const handleExport = async (req, res, exportFn, reportName, options = {}) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { startDate, endDate, branchId, format = 'csv' } = req.query;

    // Organization membership
    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res
        .status(403)
        .json({ error: 'You do not have access to this organization' });
    }

    // Date range validation
    if (options.requiresDateRange && (!startDate || !endDate)) {
      return res
        .status(400)
        .json({ error: 'startDate and endDate are required' });
    }

    // Owner lookup (used by requiresOwner)
    const organization = await orgDb.findOrganizationById(organizationId);
    const isOrgOwner = organization?.ownerId === userId;

    // Owner-only reports — bypass permission check entirely
    if (options.requiresOwner && !isOrgOwner) {
      // Platform admins still pass
      const isPlatformAdmin = await authorizationService.isPlatformAdmin(userId);
      if (!isPlatformAdmin) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Non-owner reports — check permission via authorizationService
    if (
      !isOrgOwner &&
      options.requiredPermissions &&
      options.requiredPermissions.length > 0
    ) {
      const hasPerm = await checkAnyPermission(
        userId,
        organizationId,
        options.requiredPermissions
      );
      if (!hasPerm) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Get data (branch-scoped or org-wide)
    const data = branchId
      ? await exportFn(organizationId, startDate, endDate, branchId)
      : await exportFn(organizationId, startDate, endDate);

    // ---- PDF ----
    if (format === 'pdf') {
      const pdfBuffer = await exportService.generatePDF(data, reportName);
      const filename = `${reportName}_${
        startDate || new Date().toISOString().split('T')[0]
      }.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      return res.status(200).send(pdfBuffer);
    }

    // ---- CSV (default) ----
    const csv = exportService.generateCSV(data);
    const filename = `${reportName}_${
      startDate || new Date().toISOString().split('T')[0]
    }.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.status(200).send(csv);
  } catch (error) {
    console.error(`Export ${reportName} error:`, error);
    res.status(500).json({ error: 'Failed to export report' });
  }
};

// ============================================================
// EXPORT ENDPOINTS
// ============================================================

// Sales Report — requires kxtill.reports.export OR kxtill.reports.view
const exportSales = async (req, res) => {
  return handleExport(req, res, exportService.exportSales, 'Sales_Report', {
    requiredPermissions: ['kxtill.reports.export', 'kxtill.reports.view'],
    requiresDateRange: true,
  });
};

// Stock Report — same permissions as sales, no date range needed
const exportStock = async (req, res) => {
  return handleExport(req, res, exportService.exportStock, 'Stock_Report', {
    requiredPermissions: ['kxtill.reports.export', 'kxtill.reports.view'],
    requiresDateRange: false,
  });
};

// Top Products — requires kxtill.reports.export OR kxtill.reports.view
const exportTopProducts = async (req, res) => {
  return handleExport(req, res, exportService.exportTopProducts, 'Top_Products', {
    requiredPermissions: ['kxtill.reports.export', 'kxtill.reports.view'],
    requiresDateRange: true,
  });
};

// Branch Performance — Owner only
const exportBranchPerformance = async (req, res) => {
  return handleExport(
    req,
    res,
    exportService.exportBranchPerformance,
    'Branch_Performance',
    { requiresOwner: true, requiresDateRange: true }
  );
};

// Tax Report — Owner only (disabled for now)
const exportTax = async (req, res) => {
  return handleExport(req, res, exportService.exportTax, 'Tax_Report', {
    requiresOwner: true,
    requiresDateRange: true,
  });
};

// Audit Log — requires audit.logs.export OR owner
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