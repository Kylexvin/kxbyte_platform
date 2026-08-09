// src/modules/products/kxtill/controllers/report.controller.js

import reportService from '../services/report.service.js';

const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const result = await reportService.getDashboardSummary(organizationId, userId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSalesChart = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { period = '7d' } = req.query;
    const result = await reportService.getSalesChart(organizationId, userId, period);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get sales chart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTopProducts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { limit = 10 } = req.query;
    const result = await reportService.getTopProducts(organizationId, userId, parseInt(limit));
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get top products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getLowStock = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const result = await reportService.getLowStock(organizationId, userId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getRecentSales = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { limit = 10 } = req.query;
    const result = await reportService.getRecentSales(organizationId, userId, parseInt(limit));
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get recent sales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getDashboardSummary,
  getSalesChart,
  getTopProducts,
  getLowStock,
  getRecentSales,
};