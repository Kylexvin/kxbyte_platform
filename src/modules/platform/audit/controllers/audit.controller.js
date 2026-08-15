// src/modules/platform/audit/controllers/audit.controller.js

import auditService from '../services/audit.service.js';
import orgDb from '../../organizations/db/org.db.js';
import authorizationService from '../../authorization/services/authorization.service.js';

const getAuditEvents = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;

    // Check if user has access to organization
    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Check if user has permission to view audit logs
    const hasPermission = await authorizationService.checkPermission(
      userId,
      organizationId,
      'audit.logs.view'
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions to view audit logs' });
    }

    const {
      action,
      resource,
      resourceId,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = req.query;

    const filters = {
      action,
      resource,
      resourceId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    };

    const result = await auditService.getAuditEvents(organizationId, filters);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get audit events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAuditEvent = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, eventId } = req.params;

    // Check if user has access to organization
    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Check if user has permission to view audit logs
    const hasPermission = await authorizationService.checkPermission(
      userId,
      organizationId,
      'audit.logs.view'
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions to view audit logs' });
    }

    const event = await auditService.getAuditEventById(eventId);

    // Verify event belongs to the organization
    if (event.organizationId !== organizationId) {
      return res.status(403).json({ error: 'You do not have access to this audit event' });
    }

    res.status(200).json({ event });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Audit event not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get audit event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAuditStats = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;

    // Check access
    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Check permission
    const hasPermission = await authorizationService.checkPermission(
      userId,
      organizationId,
      'audit.logs.view'
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions to view audit logs' });
    }

    const stats = await auditService.getAuditStats(organizationId);
    res.status(200).json(stats);
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const exportAuditLogs = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;

    // Check access
    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Check permission
    const hasPermission = await authorizationService.checkPermission(
      userId,
      organizationId,
      'audit.logs.export'
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions to export audit logs' });
    }

    const { startDate, endDate, action, userId: filterUserId, search } = req.query;
    const logs = await auditService.exportAuditLogs(organizationId, {
      startDate,
      endDate,
      action,
      userId: filterUserId,
      search,
    });

    // Generate CSV
    const headers = ['Time', 'User', 'Email', 'Action', 'Resource', 'Resource ID', 'IP Address', 'User Agent', 'Metadata'];
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.time.toISOString(),
        `"${log.user}"`,
        `"${log.email}"`,
        `"${log.action}"`,
        `"${log.resource}"`,
        `"${log.resourceId || ''}"`,
        `"${log.ipAddress || ''}"`,
        `"${log.userAgent || ''}"`,
        `"${log.metadata}"`,
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');
    const fileName = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export default {
  getAuditEvents,
  getAuditEvent,
  getAuditStats,
  exportAuditLogs,
};