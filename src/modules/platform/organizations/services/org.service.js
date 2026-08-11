// src/modules/platform/organizations/services/org.service.js

import orgDb from '../db/org.db.js';
import { getCountryDefaults } from '../utils/country.utils.js';
import { generateSlug } from '../utils/slug.utils.js';
import audit from '../../audit/index.js';
import prisma from '../../../../database/postgres/prisma.js';

const createOrganization = async (userId, data) => {
  const { name, country } = data;

  const slug = await generateSlug(name);
  const defaults = getCountryDefaults(country);

  const organization = await orgDb.createOrganization({
    name,
    slug,
    ownerId: userId,
    country: country.toUpperCase(),
    currency: defaults.currency,
    timezone: defaults.timezone,
  });

  const membership = await orgDb.createMembership({
    userId,
    organizationId: organization.id,
    isActive: true,
    hasAllBranches: true, // Owner has access to all branches
  });

  // ✅ Create default branch
  const defaultBranch = await prisma.branch.create({
    data: {
      organizationId: organization.id,
      name: 'Main Branch',
      code: 'MAIN',
      address: '',
      phone: '',
      email: '',
      isDefault: true,
      isActive: true,
    },
  });

  // Audit log: Organization created
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'ORGANIZATION_CREATED',
    resource: 'organization',
    resourceId: organization.id,
    metadata: {
      name: organization.name,
      slug: organization.slug,
      country: organization.country,
    },
  });

  // Audit log: Default branch created
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'BRANCH_CREATED',
    resource: 'branch',
    resourceId: defaultBranch.id,
    metadata: {
      name: defaultBranch.name,
      code: defaultBranch.code,
    },
  });

  return {
    organization,
    membership,
    defaultBranch,
  };
};

const getOrganizations = async (userId) => {
  const organizations = await orgDb.findOrganizationsByUserId(userId);
  return organizations;
};

const getOrganizationById = async (organizationId, userId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return organization;
};

const getOrganizationBySlug = async (slug, userId) => {
  const organization = await orgDb.findOrganizationBySlug(slug);
  if (!organization) {
    throw new Error('Organization not found');
  }

  const membership = await orgDb.findMembership(userId, organization.id);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  return organization;
};

const updateOrganization = async (organizationId, userId, data) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can update this organization');
  }

  const updateData = {};
  const allowedFields = ['name', 'logo', 'email', 'phone', 'address', 'country', 'currency', 'timezone'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  if (data.name && data.name !== organization.name) {
    updateData.slug = await generateSlug(data.name);
  }

  const updated = await orgDb.updateOrganization(organizationId, updateData);

  // Audit log: Organization updated
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'ORGANIZATION_UPDATED',
    resource: 'organization',
    resourceId: organization.id,
    metadata: {
      updatedFields: Object.keys(updateData),
      before: {
        name: organization.name,
        country: organization.country,
      },
    },
  });

  return updated;
};

const archiveOrganization = async (organizationId, userId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can archive this organization');
  }

  const archived = await orgDb.archiveOrganization(organizationId);

  // Audit log: Organization archived
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'ORGANIZATION_ARCHIVED',
    resource: 'organization',
    resourceId: organization.id,
    metadata: {
      name: organization.name,
    },
  });

  return archived;
};

const getOrganizationMembers = async (organizationId, userId) => {
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const members = await orgDb.findMembershipsByOrganization(organizationId);
  return members;
};

const removeMember = async (organizationId, userId, memberId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can remove members');
  }

  if (userId === memberId) {
    throw new Error('Organization owner cannot remove themselves. Transfer ownership first.');
  }

  const membership = await orgDb.findMembership(memberId, organizationId);
  if (!membership) {
    throw new Error('Member not found in this organization');
  }

  await orgDb.deleteMembership(membership.id);

  // Audit log: Member removed
  await audit.log({
    organizationId: organization.id,
    userId: userId,
    action: 'MEMBER_REMOVED',
    resource: 'membership',
    resourceId: membership.id,
    metadata: {
      removedUserId: memberId,
    },
  });

  return { message: 'Member removed successfully' };
};

export default {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  getOrganizationBySlug,
  updateOrganization,
  archiveOrganization,
  getOrganizationMembers,
  removeMember,
};