// src/modules/products/admin/crm/services/conversion.service.js
//
// Admin orchestrator: links a Won lead to an EXISTING Organization.
//
// The customer signs up through the normal KXBYTE Identity flow and
// creates their own organization via Organizations onboarding. Admin
// then finds that organization and links it to the Won lead here.
//
// CRM never creates organizations. orgService is only used to look
// them up, never to create.
//
// Split of responsibilities:
//   - orgDb / orgService — lookup + verify org exists
//   - leadsService.markLeadAsConverted — engine primitive, records the link
//   - this service — orchestrates, is idempotent, reports orphans
//
// Route-gated by admin.leads.convert.

// TODO: Link-to-Organization flow is temporary. The proper conversion path
// will come from the Onboarding module: customer signs up → creates their
// org → onboarding links the Won lead. Until then, admin can link manually
// here via POST /admin/crm/leads/:leadId/convert with { organizationId }.

import prisma from '../../../../../database/postgres/prisma.js';
import leadsService from '../../../kxcrm/services/leads.service.js';
import audit from '../../../../platform/audit/index.js';
import { ValidationError, NotFoundError } from '../../../kxcrm/domain/errors.js';

const KXBYTE_SLUG = 'kxbyte';

// ============================================================
// CONVERT LEAD → LINK EXISTING ORGANIZATION
// ============================================================

const convertLeadToOrganization = async (userId, organizationId, leadId, { organizationId: targetOrgId }) => {
  if (!targetOrgId) {
    throw new ValidationError('ORG_ID_REQUIRED', 'organizationId is required to link a lead');
  }

  // 1. Load lead via engine (throws NotFoundError if missing)
  const lead = await leadsService.getLead(userId, organizationId, leadId);

  // 2. Idempotent short-circuit — already converted, return existing link.
  if (lead.convertedOrganizationId) {
    const existing = await prisma.organization.findUnique({
      where: { id: lead.convertedOrganizationId },
      select: { id: true, name: true, slug: true, isActive: true },
    });

    return {
      lead,
      organization: existing,
      alreadyConverted: true,
    };
  }

  // 3. Load the target organization (must exist, must not be kxbyte internal).
  const targetOrg = await prisma.organization.findUnique({
    where: { id: targetOrgId },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      isInternal: true,
      isArchived: true,
    },
  });

  if (!targetOrg) {
    throw new NotFoundError('ORGANIZATION_NOT_FOUND', 'Organization not found');
  }
  if (targetOrg.isInternal) {
    throw new ValidationError(
      'CANT_LINK_INTERNAL_ORG',
      'Leads cannot be linked to the internal KXBYTE organization'
    );
  }
  if (targetOrg.isArchived) {
    throw new ValidationError(
      'CANT_LINK_ARCHIVED_ORG',
      'Cannot link a lead to an archived organization'
    );
  }

  // 4. Ensure no other lead is already linked to this organization.
  //    A convertedOrganizationId is @unique in the schema, so this check
  //    is belt-and-suspenders — but it produces a clearer error message
  //    than the raw unique-violation.
  const existingLink = await prisma.lead.findFirst({
    where: {
      convertedOrganizationId: targetOrg.id,
      deletedAt: null,
    },
    select: { id: true, businessName: true, organizationId: true },
  });

  if (existingLink && existingLink.organizationId === organizationId) {
    throw new ValidationError(
      'ORGANIZATION_ALREADY_LINKED',
      `Organization "${targetOrg.name}" is already linked to lead "${existingLink.businessName}"`
    );
  }

  // 5. Link via engine primitive.
  let convertedLead;
  try {
    convertedLead = await leadsService.markLeadAsConverted(
      organizationId,
      userId,
      leadId,
      targetOrg.id
    );
  } catch (err) {
    console.error('LEAD_CONVERSION_LINK_FAILED', {
      leadId,
      organizationId,
      targetOrganizationId: targetOrg.id,
      error: err.message,
    });

    await audit.log({
      organizationId,
      userId,
      action: 'LEAD_CONVERSION_FAILED',
      resource: 'lead',
      resourceId: leadId,
      metadata: {
        attemptedOrganizationId: targetOrg.id,
        attemptedOrganizationName: targetOrg.name,
        reason: err.message,
      },
    });

    throw err;
  }

  return {
    lead: convertedLead,
    organization: targetOrg,
    alreadyConverted: false,
  };
};

export default {
  convertLeadToOrganization,
};