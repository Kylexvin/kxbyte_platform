// src/modules/products/admin/crm/routes/crm.routes.js
//
// Mounted at /admin/crm by admin.routes.js.
// authMiddleware.authenticate is applied at the parent router.
//
// Each route is gated by requirePlatformAdmin(<admin.* key>).
// Engine services have no permission checks; permission is enforced
// entirely at this layer.
//
// Special: POST /leads/:leadId/won is gated by admin.leads.change_stage
// at the route, and the controller additionally checks admin.leads.convert.

import express from 'express';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.middleware.js';

import * as pipelineCtrl from '../controllers/pipeline.controller.js';
import * as leadsCtrl from '../controllers/leads.controller.js';
import * as activitiesCtrl from '../controllers/activities.controller.js';
import * as assigneesCtrl from '../controllers/assignees.controller.js';
import pipelineTemplateService from '../services/pipeline-template.service.js';

const router = express.Router();

// ============================================================
// PIPELINE
// ============================================================

router.get(
  '/pipeline/stages',
  requirePlatformAdmin('admin.pipeline.view'),
  pipelineCtrl.list
);

router.get(
  '/pipeline/stages/:stageId',
  requirePlatformAdmin('admin.pipeline.view'),
  pipelineCtrl.getOne
);

router.get(
  '/pipeline/status',
  requirePlatformAdmin('admin.pipeline.view'),
  pipelineCtrl.getStatus
);

router.post(
  '/pipeline/stages',
  requirePlatformAdmin('admin.pipeline.manage'),
  pipelineCtrl.create
);

router.patch(
  '/pipeline/stages/:stageId',
  requirePlatformAdmin('admin.pipeline.manage'),
  pipelineCtrl.update
);

router.post(
  '/pipeline/stages/reorder',
  requirePlatformAdmin('admin.pipeline.manage'),
  pipelineCtrl.reorder
);

router.delete(
  '/pipeline/stages/:stageId',
  requirePlatformAdmin('admin.pipeline.manage'),
  pipelineCtrl.remove
);

router.post(
  '/pipeline/stages/apply-template',
  requirePlatformAdmin('admin.pipeline.manage'),
  async (req, res) => {
    try {
      const stages = await pipelineTemplateService.applyTemplate(
        req.user.userId,
        req.internalOrgId
      );
      res.status(201).json({ data: stages });
    } catch (err) {
      const STATUS_BY_TYPE = {
        ValidationError: 400,
        ForbiddenError: 403,
        NotFoundError: 404,
        ConflictError: 409,
      };
      const status = STATUS_BY_TYPE[err.name] || 500;
      if (status >= 500) console.error('admin crm pipeline apply-template error:', err);
      res.status(status).json({ error: err.message, code: err.code });
    }
  }
);

// ============================================================
// ASSIGNEES (org members — for the picker on lead form / detail)
// ============================================================

router.get(
  '/assignees',
  requirePlatformAdmin('admin.leads.view'),
  assigneesCtrl.list
);

// ============================================================
// LEADS
// ============================================================

router.get(
  '/leads',
  requirePlatformAdmin('admin.leads.view'),
  leadsCtrl.list
);

router.post(
  '/leads',
  requirePlatformAdmin('admin.leads.create'),
  leadsCtrl.create
);

router.get(
  '/leads/:leadId',
  requirePlatformAdmin('admin.leads.view'),
  leadsCtrl.getOne
);

router.patch(
  '/leads/:leadId',
  requirePlatformAdmin('admin.leads.edit'),
  leadsCtrl.update
);

router.post(
  '/leads/:leadId/stage',
  requirePlatformAdmin('admin.leads.change_stage'),
  leadsCtrl.moveStage
);

// Route gate: change_stage (can you enter); controller additionally
// checks admin.leads.convert (can you do this specific action).
router.post(
  '/leads/:leadId/won',
  requirePlatformAdmin('admin.leads.change_stage'),
  leadsCtrl.promoteToWon
);

// Assignees
router.get(
  '/leads/:leadId/assignees',
  requirePlatformAdmin('admin.leads.view'),
  leadsCtrl.listAssignees
);

router.post(
  '/leads/:leadId/assignees',
  requirePlatformAdmin('admin.leads.assign'),
  leadsCtrl.addAssignee
);

router.delete(
  '/leads/:leadId/assignees/:userId',
  requirePlatformAdmin('admin.leads.assign'),
  leadsCtrl.removeAssignee
);

// Convert (link to existing org)
router.post(
  '/leads/:leadId/convert',
  requirePlatformAdmin('admin.leads.convert'),
  leadsCtrl.convert
);

router.delete(
  '/leads/:leadId',
  requirePlatformAdmin('admin.leads.delete'),
  leadsCtrl.remove
);

// ============================================================
// ACTIVITIES
// ============================================================

router.get(
  '/leads/:leadId/activities',
  requirePlatformAdmin('admin.activities.view'),
  activitiesCtrl.listForLead
);

router.get(
  '/leads/:leadId/activities/count',
  requirePlatformAdmin('admin.activities.view'),
  activitiesCtrl.count
);

// Log uses the special controller that runs the Won/Lost gate first.
router.post(
  '/leads/:leadId/activities',
  requirePlatformAdmin('admin.activities.create'),
  leadsCtrl.logActivity
);

router.delete(
  '/activities/:activityId',
  requirePlatformAdmin('admin.activities.create'),
  activitiesCtrl.remove
);

export default router;