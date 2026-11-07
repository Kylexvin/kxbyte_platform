// src/modules/products/kxcrm/services/leads.service.js
//
// Engine service for leads. Signature convention: (userId, organizationId, ...).
// Permissions: crm.leads.*.
//
// Leads convert to Organization rows, never to platform/customers.

import prisma from '../../../../database/postgres/prisma.js';
import leadDb from '../db/lead.db.js';
import pipelineDb from '../db/pipeline.db.js';
import activitiesService from './activities.service.js';
import audit from '../../../platform/audit/index.js';
import authorizationService from '../../../platform/authorization/services/authorization.service.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import {
  assertLeadCreatePayload,
  assertLeadUpdatePayload,
} from '../domain/leads/validation.js';
import {
  assertCanMoveToStage,
  assertNotConverted,
} from '../domain/pipeline/rules.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../domain/errors.js';

// ============================================================
// HELPERS
// ============================================================

const assertPermission = async (userId, organizationId, key, message) => {
  const ok = await authorizationService.checkPermission(userId, organizationId, key);
  if (!ok) throw new ForbiddenError('FORBIDDEN', message);
};

const loadLeadOrThrow = async (organizationId, leadId) => {
  const lead = await leadDb.findById(organizationId, leadId);
  if (!lead) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');
  return lead;
};

const assertAssigneeValid = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership || !membership.isActive) {
    throw new ValidationError('ASSIGNEE_NOT_MEMBER', 'Assignee is not an active member of this organization');
  }
};

// ============================================================
// LIST / DETAIL
// ============================================================

const listLeads = async (userId, organizationId, filters = {}, pagination = {}) => {
  await assertPermission(userId, organizationId, 'crm.leads.view', 'You do not have permission to view leads');
  return leadDb.findMany(organizationId, filters, pagination);
};

const getLead = async (userId, organizationId, leadId) => {
  await assertPermission(userId, organizationId, 'crm.leads.view', 'You do not have permission to view leads');
  const lead = await leadDb.findByIdWithRelations(organizationId, leadId);
  if (!lead) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');
  return lead;
};

// ============================================================
// CREATE
// ============================================================

const createLead = async (userId, organizationId, payload) => {
  await assertPermission(userId, organizationId, 'crm.leads.create', 'You do not have permission to create leads');

  assertLeadCreatePayload(payload);

  // Pipeline must be ready (exactly one active Won and one active Lost).
  const won = await pipelineDb.findActiveWonStage(organizationId);
  const lost = await pipelineDb.findActiveLostStage(organizationId);
  if (!won || !lost) {
    throw new ValidationError(
      'PIPELINE_NOT_READY',
      'Pipeline must have one active Won and one active Lost stage before leads can be created'
    );
  }

  const stage = await pipelineDb.findById(organizationId, payload.stageId);
  if (!stage) throw new ValidationError('STAGE_NOT_IN_ORG', 'Stage does not belong to this organization');
  if (!stage.isActive) throw new ValidationError('STAGE_DISABLED', 'Cannot create a lead in a disabled stage');

  if (payload.assignedToId) {
    await assertAssigneeValid(organizationId, payload.assignedToId);
  }

  const lead = await leadDb.create({
    organizationId,
    businessName: payload.businessName.trim(),
    businessCategory: payload.businessCategory ?? null,
    contactName: payload.contactName.trim(),
    contactEmail: payload.contactEmail ? payload.contactEmail.trim() : null,
    contactPhone: payload.contactPhone.trim(),
    location: payload.location ?? null,
    businessSize: payload.businessSize ?? null,
    interestedProduct: payload.interestedProduct ?? null,
    source: payload.source,
    sourceDetail: payload.sourceDetail ?? null,
    stageId: stage.id,
    dealValue: payload.dealValue ?? null,
    currency: payload.currency ?? 'KES',
    assignedToId: payload.assignedToId ?? null,
    notes: payload.notes ?? null,
  });

  // Initial STAGE_CHANGE activity: "created in stage X".
  await activitiesService.logSystemActivity(organizationId, userId, lead.id, {
    type: 'STAGE_CHANGE',
    summary: `Lead created in stage '${stage.name}'`,
    metadata: { to: stage.id, toName: stage.name },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'LEAD_CREATED',
    resource: 'lead',
    resourceId: lead.id,
    metadata: { businessName: lead.businessName, stageId: stage.id, source: lead.source },
  });

  return leadDb.findByIdWithRelations(organizationId, lead.id);
};

// ============================================================
// UPDATE (non-stage fields only)
// ============================================================

const updateLead = async (userId, organizationId, leadId, payload) => {
  await assertPermission(userId, organizationId, 'crm.leads.edit', 'You do not have permission to edit leads');

  const lead = await loadLeadOrThrow(organizationId, leadId);
  assertNotConverted(lead);

  assertLeadUpdatePayload(payload);

  if (payload.assignedToId) {
    await assertAssigneeValid(organizationId, payload.assignedToId);
  }

  const allowed = [
    'businessName', 'businessCategory', 'contactName', 'contactEmail',
    'contactPhone', 'location', 'businessSize', 'interestedProduct',
    'source', 'sourceDetail', 'dealValue', 'currency', 'assignedToId', 'notes',
  ];
  const update = {};
  for (const k of allowed) {
    if (payload[k] !== undefined) {
      update[k] = typeof payload[k] === 'string' && k !== 'contactEmail' && k !== 'currency'
        ? payload[k].trim()
        : payload[k];
    }
  }

  if (Object.keys(update).length === 0) {
    throw new ValidationError('NOTHING_TO_UPDATE', 'No valid fields to update');
  }

  const updated = await leadDb.update(organizationId, leadId, update);

  await audit.log({
    organizationId,
    userId,
    action: 'LEAD_UPDATED',
    resource: 'lead',
    resourceId: leadId,
    metadata: { updatedFields: Object.keys(update) },
  });

  return updated;
};

// ============================================================
// STAGE MOVE
// ============================================================

const moveLeadToStage = async (userId, organizationId, leadId, stageId, { lostReason } = {}) => {
  await assertPermission(userId, organizationId, 'crm.leads.change_stage', 'You do not have permission to change lead stage');

  const lead = await loadLeadOrThrow(organizationId, leadId);
  assertNotConverted(lead);

  if (lead.stageId === stageId) {
    throw new ValidationError('SAME_STAGE', 'Lead is already in this stage');
  }

  const target = await pipelineDb.findById(organizationId, stageId);
  if (!target) throw new ValidationError('STAGE_NOT_IN_ORG', 'Target stage does not belong to this organization');

  // Active-only + convert permission (checked here, passed to pure rule).
  const canConvert = target.isWon
    ? await authorizationService.checkPermission(userId, organizationId, 'crm.leads.convert')
    : true;
  assertCanMoveToStage(target, { canConvert });

  // Lost requires reason; non-lost clears lost fields.
  const isLost = !!target.isLost;
  if (isLost && (!lostReason || !String(lostReason).trim())) {
    throw new ValidationError('LOST_REASON_REQUIRED', 'lostReason is required when moving a lead to the Lost stage');
  }

  const updateData = {
    stageId: target.id,
    lostReason: isLost ? String(lostReason).trim() : null,
    lostAt: isLost ? new Date() : null,
  };

  // Atomic: lead update + STAGE_CHANGE activity in one transaction.
  const updated = await prisma.$transaction(async (tx) => {
    const res = await leadDb.update(organizationId, leadId, updateData, tx);
    if (!res) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');

    await activitiesService.logSystemActivity(
      organizationId,
      userId,
      leadId,
      {
        type: 'STAGE_CHANGE',
        summary: `Moved from '${lead.stageId === target.id ? '?' : 'previous stage'}' to '${target.name}'`,
        metadata: { from: lead.stageId, to: target.id, toName: target.name, reason: isLost ? updateData.lostReason : null },
      },
      tx
    );

    return res;
  });

  await audit.log({
    organizationId,
    userId,
    action: 'LEAD_STAGE_CHANGED',
    resource: 'lead',
    resourceId: leadId,
    metadata: { from: lead.stageId, to: target.id, toName: target.name, lost: isLost },
  });

  return updated;
};

// ============================================================
// ASSIGN
// ============================================================

const assignLead = async (userId, organizationId, leadId, assignedToId) => {
  await assertPermission(userId, organizationId, 'crm.leads.assign', 'You do not have permission to assign leads');

  const lead = await loadLeadOrThrow(organizationId, leadId);
  assertNotConverted(lead);

  await assertAssigneeValid(organizationId, assignedToId);

  const updated = await leadDb.update(organizationId, leadId, { assignedToId });

  await audit.log({
    organizationId,
    userId,
    action: 'LEAD_ASSIGNED',
    resource: 'lead',
    resourceId: leadId,
    metadata: { assignedToId, previousAssigneeId: lead.assignedToId || null },
  });

  return updated;
};

// ============================================================
// SOFT DELETE
// ============================================================

const deleteLead = async (userId, organizationId, leadId) => {
  await assertPermission(userId, organizationId, 'crm.leads.delete', 'You do not have permission to delete leads');

  const lead = await loadLeadOrThrow(organizationId, leadId);
  assertNotConverted(lead);

  const count = await leadDb.softDelete(organizationId, leadId);
  if (count === 0) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');

  await audit.log({
    organizationId,
    userId,
    action: 'LEAD_DELETED',
    resource: 'lead',
    resourceId: leadId,
    metadata: { businessName: lead.businessName },
  });

  return { message: 'Lead deleted' };
};

// ============================================================
// MARK CONVERTED (engine primitive — does NOT create orgs)
// ============================================================
//
// Called by admin/crm/services/conversion.service after the org has
// been created. Records the conversion; does not touch orgService.

const markLeadAsConverted = async (organizationId, userId, leadId, convertedOrganizationId) => {
  const lead = await loadLeadOrThrow(organizationId, leadId);

  if (lead.convertedOrganizationId) {
    throw new ConflictError(
      'LEAD_ALREADY_CONVERTED',
      'Lead is already converted to an organization'
    );
  }

  const wonStage = await pipelineDb.findActiveWonStage(organizationId);
  if (!wonStage) {
    throw new ValidationError('NO_ACTIVE_WON_STAGE', 'No active Won stage configured');
  }
  if (lead.stageId !== wonStage.id) {
    throw new ValidationError('LEAD_NOT_IN_WON', 'Lead must be in the Won stage to convert');
  }

  const updated = await leadDb.update(organizationId, leadId, {
    convertedOrganizationId,
    convertedAt: new Date(),
    convertedById: userId,
  });

  await activitiesService.logSystemActivity(organizationId, userId, leadId, {
    type: 'NOTE',
    summary: `Converted to organization ${convertedOrganizationId}`,
    metadata: { convertedOrganizationId },
  });

  await audit.log({
    organizationId,
    userId,
    action: 'LEAD_CONVERTED_TO_ORG',
    resource: 'lead',
    resourceId: leadId,
    metadata: { convertedOrganizationId },
  });

  return updated;
};

export default {
  listLeads,
  getLead,
  createLead,
  updateLead,
  moveLeadToStage,
  assignLead,
  deleteLead,
  markLeadAsConverted,
};