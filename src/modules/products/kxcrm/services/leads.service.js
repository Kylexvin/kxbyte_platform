// src/modules/products/kxcrm/services/leads.service.js
//
// Engine service for leads. Signature: (userId, organizationId, ...).
// Permissions enforced at the route layer. No internal permission checks.
//
// Leads convert to Organization rows, never to platform/customers.

import prisma from '../../../../database/postgres/prisma.js';
import leadDb from '../db/lead.db.js';
import pipelineDb from '../db/pipeline.db.js';
import activitiesService from './activities.service.js';
import audit from '../../../platform/audit/index.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import {
  assertLeadCreatePayload,
  assertLeadUpdatePayload,
} from '../domain/leads/validation.js';
import { assertNotConverted } from '../domain/pipeline/rules.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../domain/errors.js';

// ============================================================
// HELPERS
// ============================================================

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

// Block user activity when the lead has reached a terminal stage.
// Won and Lost are both read-only for user-supplied activities;
// only system events (STAGE_CHANGE, conversion NOTE) may still appear.
const assertActivityAllowed = (lead) => {
  if (lead?.stage?.isWon) {
    throw new ValidationError(
      'LEAD_WON_READONLY',
      'This lead is Won. No new activities can be logged.'
    );
  }
  if (lead?.stage?.isLost) {
    throw new ValidationError(
      'LEAD_LOST_READONLY',
      'This lead is Lost. No new activities can be logged.'
    );
  }
};

// ============================================================
// LIST / DETAIL
// ============================================================

const listLeads = async (userId, organizationId, filters = {}, pagination = {}) => {
  return leadDb.findMany(organizationId, filters, pagination);
};

const getLead = async (userId, organizationId, leadId) => {
  const lead = await leadDb.findByIdWithRelations(organizationId, leadId);
  if (!lead) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');
  return lead;
};

// ============================================================
// CREATE (accepts assignedToIds: string[])
// ============================================================

const createLead = async (userId, organizationId, payload) => {
  assertLeadCreatePayload(payload);

  const won = await pipelineDb.findActiveWonStage(organizationId);
  if (!won) {
    throw new ValidationError('PIPELINE_NOT_READY', 'Pipeline must have an active Won stage before leads can be created');
  }

  const stage = await pipelineDb.findById(organizationId, payload.stageId);
  if (!stage) throw new ValidationError('STAGE_NOT_IN_ORG', 'Stage does not belong to this organization');
  if (!stage.isActive) throw new ValidationError('STAGE_DISABLED', 'Cannot create a lead in a disabled stage');

  const assigneeIds = Array.isArray(payload.assignedToIds)
    ? Array.from(new Set(payload.assignedToIds.filter(Boolean)))
    : [];
  for (const uid of assigneeIds) {
    await assertAssigneeValid(organizationId, uid);
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
    notes: payload.notes ?? null,
  });

  // Initial STAGE_CHANGE activity: "created in stage X".
  await activitiesService.logSystemActivity(organizationId, userId, lead.id, {
    type: 'STAGE_CHANGE',
    summary: `Lead created in stage '${stage.name}'`,
    metadata: { to: stage.id, toName: stage.name },
  });

  // Add initial assignees (if any).
  if (assigneeIds.length > 0) {
    for (const uid of assigneeIds) {
      await leadDb.addAssignee(organizationId, lead.id, uid, userId);
    }

    await audit.log({
      organizationId,
      userId,
      action: 'LEAD_ASSIGNED',
      resource: 'lead',
      resourceId: lead.id,
      metadata: { assignedToIds: assigneeIds, initial: true },
    });
  }

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
// UPDATE (no assignment, no stage; those have dedicated endpoints)
// ============================================================

const updateLead = async (userId, organizationId, leadId, payload) => {
  const lead = await leadDb.findByIdWithRelations(organizationId, leadId);
  if (!lead) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');
  assertNotConverted(lead);

  assertLeadUpdatePayload(payload);

  const allowed = [
    'businessName', 'businessCategory', 'contactName', 'contactEmail',
    'contactPhone', 'location', 'businessSize', 'interestedProduct',
    'source', 'sourceDetail', 'dealValue', 'currency', 'notes',
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
// STAGE MOVE (non-terminal stages only)
// ============================================================

const moveLeadToStage = async (userId, organizationId, leadId, stageId, { lostReason } = {}) => {
  const lead = await loadLeadOrThrow(organizationId, leadId);
  assertNotConverted(lead);

  if (lead.stageId === stageId) {
    throw new ValidationError('SAME_STAGE', 'Lead is already in this stage');
  }

  const target = await pipelineDb.findById(organizationId, stageId);
  if (!target) throw new ValidationError('STAGE_NOT_IN_ORG', 'Target stage does not belong to this organization');

  if (!target.isActive) {
    throw new ValidationError('CANT_MOVE_TO_DISABLED_STAGE', 'Cannot move a lead to a disabled stage');
  }
  if (target.isWon) {
    throw new ValidationError('USE_PROMOTE_ENDPOINT', 'Use POST /leads/:id/won to move a lead into the Won stage');
  }

  const isLost = !!target.isLost;
  if (isLost && (!lostReason || !String(lostReason).trim())) {
    throw new ValidationError('LOST_REASON_REQUIRED', 'lostReason is required when moving a lead to the Lost stage');
  }

  const fromStage = lead.stageId
    ? await pipelineDb.findById(organizationId, lead.stageId)
    : null;

  const updateData = {
    stageId: target.id,
    lostReason: isLost ? String(lostReason).trim() : null,
    lostAt: isLost ? new Date() : null,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const res = await leadDb.update(organizationId, leadId, updateData, tx);
    if (!res) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');

    await activitiesService.logSystemActivity(
      organizationId,
      userId,
      leadId,
      {
        type: 'STAGE_CHANGE',
        summary: `Moved from '${fromStage?.name ?? 'unknown'}' to '${target.name}'`,
        metadata: {
          from: lead.stageId,
          fromName: fromStage?.name ?? null,
          to: target.id,
          toName: target.name,
          reason: isLost ? updateData.lostReason : null,
        },
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
    metadata: {
      from: lead.stageId,
      fromName: fromStage?.name ?? null,
      to: target.id,
      toName: target.name,
      lost: isLost,
    },
  });

  return updated;
};

// ============================================================
// PROMOTE TO WON
// ============================================================

const promoteLeadToWon = async (userId, organizationId, leadId) => {
  const lead = await loadLeadOrThrow(organizationId, leadId);
  assertNotConverted(lead);

  const wonStage = await pipelineDb.findActiveWonStage(organizationId);
  if (!wonStage) {
    throw new ValidationError('NO_ACTIVE_WON_STAGE', 'No active Won stage configured');
  }
  if (lead.stageId === wonStage.id) {
    throw new ValidationError('SAME_STAGE', 'Lead is already in the Won stage');
  }

  const fromStage = lead.stageId
    ? await pipelineDb.findById(organizationId, lead.stageId)
    : null;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await leadDb.update(
      organizationId,
      leadId,
      { stageId: wonStage.id, lostReason: null, lostAt: null },
      tx
    );
    if (!res) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');

    await activitiesService.logSystemActivity(
      organizationId,
      userId,
      leadId,
      {
        type: 'STAGE_CHANGE',
        summary: `Moved from '${fromStage?.name ?? 'unknown'}' to '${wonStage.name}' (Won)`,
        metadata: {
          from: lead.stageId,
          fromName: fromStage?.name ?? null,
          to: wonStage.id,
          toName: wonStage.name,
          terminal: 'won',
        },
      },
      tx
    );

    return res;
  });

  await audit.log({
    organizationId,
    userId,
    action: 'LEAD_PROMOTED_TO_WON',
    resource: 'lead',
    resourceId: leadId,
    metadata: { from: lead.stageId, fromName: fromStage?.name ?? null, to: wonStage.id },
  });

  return updated;
};

// ============================================================
// ASSIGNEES
// ============================================================

const listAssignees = async (userId, organizationId, leadId) => {
  const lead = await leadDb.findById(organizationId, leadId);
  if (!lead) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');
  return leadDb.listAssignees(organizationId, leadId);
};

const addAssignee = async (userId, organizationId, leadId, assigneeUserId) => {
  const lead = await leadDb.findByIdWithRelations(organizationId, leadId);
  if (!lead) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');
  assertNotConverted(lead);

  await assertAssigneeValid(organizationId, assigneeUserId);

  const row = await leadDb.addAssignee(organizationId, leadId, assigneeUserId, userId);

  await audit.log({
    organizationId,
    userId,
    action: 'LEAD_ASSIGNED',
    resource: 'lead',
    resourceId: leadId,
    metadata: { assigneeUserId, assigneeEmail: row.user?.email },
  });

  return row;
};

const removeAssignee = async (userId, organizationId, leadId, assigneeUserId) => {
  const lead = await leadDb.findById(organizationId, leadId);
  if (!lead) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');
  assertNotConverted(lead);

  const count = await leadDb.removeAssignee(organizationId, leadId, assigneeUserId);
  if (count === 0) {
    throw new NotFoundError('ASSIGNEE_NOT_FOUND', 'This user is not assigned to this lead');
  }

  await audit.log({
    organizationId,
    userId,
    action: 'LEAD_UNASSIGNED',
    resource: 'lead',
    resourceId: leadId,
    metadata: { assigneeUserId },
  });

  return { message: 'Assignee removed' };
};

// ============================================================
// SOFT DELETE
// ============================================================

const deleteLead = async (userId, organizationId, leadId) => {
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

const markLeadAsConverted = async (organizationId, userId, leadId, convertedOrganizationId) => {
  const lead = await loadLeadOrThrow(organizationId, leadId);

  if (lead.convertedOrganizationId) {
    throw new ConflictError('LEAD_ALREADY_CONVERTED', 'Lead is already converted to an organization');
  }

  const wonStage = await pipelineDb.findActiveWonStage(organizationId);
  if (!wonStage) throw new ValidationError('NO_ACTIVE_WON_STAGE', 'No active Won stage configured');
  if (lead.stageId !== wonStage.id) throw new ValidationError('LEAD_NOT_IN_WON', 'Lead must be in the Won stage to convert');

  const updated = await leadDb.update(organizationId, leadId, {
    convertedOrganizationId,
    convertedAt: new Date(),
    convertedById: userId,
  });

  await activitiesService.logSystemActivity(organizationId, userId, leadId, {
    type: 'NOTE',
    summary: `Linked to organization ${convertedOrganizationId}`,
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

// ============================================================
// ACTIVITY GUARD (exported so the activities controller can use it)
// ============================================================

const assertCanLogActivity = async (organizationId, leadId) => {
  const lead = await leadDb.findByIdWithRelations(organizationId, leadId);
  if (!lead) throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');
  assertActivityAllowed(lead);
};

export default {
  listLeads,
  getLead,
  createLead,
  updateLead,
  moveLeadToStage,
  promoteLeadToWon,
  listAssignees,
  addAssignee,
  removeAssignee,
  deleteLead,
  markLeadAsConverted,
  assertCanLogActivity,
};