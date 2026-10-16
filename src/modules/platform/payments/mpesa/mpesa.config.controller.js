// src/modules/platform/payments/mpesa/mpesa.config.controller.js

import mpesaConfigService from './mpesa.config.service.js';
import orgDb from '../../organizations/db/org.db.js';

const requireOwner = async (userId, organizationId) => {
  const organization = await orgDb.findOrganizationById(organizationId);
  if (!organization) throw new Error('Organization not found');
  if (organization.ownerId !== userId) {
    throw new Error('Only the organization owner can manage payment settings');
  }
  return organization;
};

const getMpesaConfig = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { organizationId } = req.params;

  try {
    await requireOwner(userId, organizationId);
    const config = await mpesaConfigService.getMaskedConfig(organizationId);
    return res.status(200).json({ config });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Only the organization owner')) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get M-Pesa config error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const saveMpesaConfig = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { organizationId } = req.params;

  try {
    await requireOwner(userId, organizationId);
    const config = await mpesaConfigService.saveConfig(
      organizationId,
      req.body
    );
    return res.status(200).json({ config });
  } catch (error) {
    if (error.validationErrors) {
      return res.status(400).json({ errors: error.validationErrors });
    }
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Only the organization owner')) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Save M-Pesa config error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteMpesaConfig = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { organizationId } = req.params;

  try {
    await requireOwner(userId, organizationId);
    await mpesaConfigService.deleteConfig(organizationId);
    return res.status(200).json({ deleted: true });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Only the organization owner')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.code === 'P2025') {
      // Prisma: record not found on delete
      return res.status(404).json({ error: 'M-Pesa is not configured' });
    }
    console.error('Delete M-Pesa config error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const testMpesaConfig = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { organizationId } = req.params;

  try {
    await requireOwner(userId, organizationId);
    const result = await mpesaConfigService.testCredentials(organizationId);
    if (result.ok) {
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, reason: result.reason });
  } catch (error) {
    if (error.message === 'Organization not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Only the organization owner')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes('M-Pesa is not configured')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('could not be decrypted')) {
      // Return a generic message — never the crypto detail
      return res.status(400).json({
        ok: false,
        reason: 'Stored credentials are invalid. Please re-enter them.',
      });
    }
    console.error('Test M-Pesa config error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getMpesaConfig,
  saveMpesaConfig,
  deleteMpesaConfig,
  testMpesaConfig,
};