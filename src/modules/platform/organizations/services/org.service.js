// src/modules/platform/organizations/services/org.service.js
import orgDb from '../db/org.db.js';
import { getCountryDefaults } from '../utils/country.utils.js';
import { generateSlug } from '../utils/slug.utils.js';

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
  });

  return {
    organization,
    membership,
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

  // Check if user has access
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
  // Check if organization exists
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  // Check if user is owner
  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can update this organization');
  }

  // Prepare update data
  const updateData = {};
  const allowedFields = ['name', 'logo', 'email', 'phone', 'address', 'country', 'currency', 'timezone'];
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  // If name is updated, regenerate slug
  if (data.name && data.name !== organization.name) {
    updateData.slug = await generateSlug(data.name);
  }

  const updated = await orgDb.updateOrganization(organizationId, updateData);
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
  return archived;
};

const getOrganizationMembers = async (organizationId, userId) => {
  // Check access
  const membership = await orgDb.findMembership(userId, organizationId);
  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  const members = await orgDb.findMembershipsByOrganization(organizationId);
  return members;
};

const removeMember = async (organizationId, userId, memberId) => {
  // Check if organization exists
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  // Check if user is owner
  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can remove members');
  }

  // Check if trying to remove self
  if (userId === memberId) {
    throw new Error('Organization owner cannot remove themselves. Transfer ownership first.');
  }

  // Check if member exists
  const membership = await orgDb.findMembership(memberId, organizationId);
  if (!membership) {
    throw new Error('Member not found in this organization');
  }

  await orgDb.deleteMembership(membership.id);
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