import * as svc from '../services/organizations.service.js';

export const list = async (req, res) => {
  try {
    const { search, status, page, limit } = req.query;
    const result = await svc.listOrganizations({
      search, status,
      page: Number(page) || 1,
      limit: Number(limit) || 50,
    });
    res.json({
      data: result.organizations,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOne = async (req, res) => {
  try {
    const org = await svc.getOrganization(req.params.orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json({ data: org });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const activate = async (req, res) => {
  try {
    const org = await svc.setActive(req.params.orgId, req.platformAdmin.userId, true);
    res.json({ data: org });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const suspend = async (req, res) => {
  try {
    const org = await svc.setActive(req.params.orgId, req.platformAdmin.userId, false);
    res.json({ data: org });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const archive = async (req, res) => {
  try {
    const org = await svc.setArchived(req.params.orgId, req.platformAdmin.userId, true);
    res.json({ data: org });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const unarchive = async (req, res) => {
  try {
    const org = await svc.setArchived(req.params.orgId, req.platformAdmin.userId, false);
    res.json({ data: org });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};