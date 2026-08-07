// src/modules/platform/organizations/controllers/org.controller.js

import orgService from '../services/org.service.js';
import orgValidator from '../validators/org.validator.js';

const createOrganization = async (req, res) => {
  const validation = orgValidator.validateCreateOrganization(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await orgService.createOrganization(userId, req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getOrganizations = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const organizations = await orgService.getOrganizations(userId);
    res.status(200).json({ organizations });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getOrganization = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const organization = await orgService.getOrganizationById(id, userId);
    res.status(200).json({ organization });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateOrganization = async (req, res) => {
  const validation = orgValidator.validateUpdateOrganization(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const organization = await orgService.updateOrganization(id, userId, req.body);
    res.status(200).json({ organization });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can update this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const archiveOrganization = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const organization = await orgService.archiveOrganization(id, userId);
    res.status(200).json({ message: 'Organization archived successfully', organization });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can archive this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Archive organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMembers = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const members = await orgService.getOrganizationMembers(id, userId);
    res.status(200).json({ members });
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeMember = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id, memberId } = req.params;
    const result = await orgService.removeMember(id, userId, memberId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can remove members') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Organization owner cannot remove themselves. Transfer ownership first.') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Member not found in this organization') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createOrganization,
  getOrganizations,
  getOrganization,
  updateOrganization,
  archiveOrganization,
  getMembers,
  removeMember,
};