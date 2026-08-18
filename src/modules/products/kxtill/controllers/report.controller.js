// src/modules/products/kxtill/controllers/report.controller.js
import reportService from '../services/report.service.js';

const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { period = '30d', branchId } = req.query;

    const result = await reportService.getDashboardSummary(
      organizationId,
      userId,
      period,
      branchId
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization' ||
        error.message === 'You do not have permission to view sales' ||
        error.message === 'You do not have access to this branch' ||
        error.message === 'You do not have access to any branch') {
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
    const { period = '30d', branchId, interval = 'day' } = req.query;

    const result = await reportService.getSalesChart(
      organizationId,
      userId,
      period,
      branchId,
      interval
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization' ||
        error.message === 'You do not have permission to view sales' ||
        error.message === 'You do not have access to this branch' ||
        error.message === 'You do not have access to any branch') {
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
    const { limit = 10, branchId } = req.query;

    const result = await reportService.getTopProducts(
      organizationId,
      userId,
      parseInt(limit),
      branchId
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization' ||
        error.message === 'You do not have permission to view sales' ||
        error.message === 'You do not have access to this branch' ||
        error.message === 'You do not have access to any branch') {
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
    const { branchId } = req.query;

    const result = await reportService.getLowStock(
      organizationId,
      userId,
      branchId
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization' ||
        error.message === 'You do not have permission to view inventory' ||
        error.message === 'You do not have access to this branch' ||
        error.message === 'You do not have access to any branch') {
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
    const { limit = 10, branchId } = req.query;

    const result = await reportService.getRecentSales(
      organizationId,
      userId,
      parseInt(limit),
      branchId
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization' ||
        error.message === 'You do not have permission to view sales' ||
        error.message === 'You do not have access to this branch' ||
        error.message === 'You do not have access to any branch') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get recent sales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTodaySales = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { branchId } = req.query;

    const result = await reportService.getTodaySales(
      organizationId,
      userId,
      branchId
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization' ||
        error.message === 'You do not have permission to view sales' ||
        error.message === 'You do not have access to this branch' ||
        error.message === 'You do not have access to any branch') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get today sales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getBranchOverview = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { period = 'today' } = req.query;

    const result = await reportService.getBranchOverview(
      organizationId,
      userId,
      period
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization' ||
        error.message === 'You do not have permission to view branches') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get branch overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getInventoryAlerts = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { branchId, type = 'low-stock' } = req.query;

    const result = await reportService.getInventoryAlerts(
      organizationId,
      userId,
      branchId,
      type
    );
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization' ||
        error.message === 'You do not have permission to view inventory') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get inventory alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getPaymentMethodDistribution = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { branchId, period = '30d' } = req.query;

    const result = await reportService.getPaymentMethodDistribution(
      organizationId,
      userId,
      { branchId, period }
    );

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get payment method distribution error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getBranchBreakdown = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { period = '30d' } = req.query;

    const result = await reportService.getBranchBreakdown(
      organizationId,
      userId,
      { period }
    );

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Only the organization owner can view branch breakdown') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get branch breakdown error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getReturnsSummary = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId } = req.params;
    const { branchId, period = '30d' } = req.query;

    const result = await reportService.getReturnsSummary(
      organizationId,
      userId,
      { branchId, period }
    );

    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'You do not have access to this organization') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get returns summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add these functions:

const getInventorySummary = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const { branchId } = req.query;
    const result = await reportService.getInventorySummary(organizationId, userId, branchId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Get inventory summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getInventoryHealth = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const { branchId } = req.query;
    const result = await reportService.getInventoryHealth(organizationId, userId, branchId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Get inventory health error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getNeedsAttention = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const { branchId, status, limit } = req.query;
    const result = await reportService.getNeedsAttention(organizationId, userId, {
      branchId,
      status,
      limit: limit ? parseInt(limit) : 20,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('Get needs attention error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStockActivity = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const { branchId, period, activityType, limit } = req.query;
    const result = await reportService.getStockActivity(organizationId, userId, {
      branchId,
      period,
      activityType,
      limit: limit ? parseInt(limit) : 10,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('Get stock activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getBranchStock = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { organizationId } = req.params;
    const result = await reportService.getBranchStock(organizationId, userId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Only the organization owner can view branch stock breakdown') {
      return res.status(403).json({ error: error.message });
    }
    console.error('Get branch stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getDashboardSummary,
  getSalesChart,
  getTopProducts,
  getLowStock,
  getRecentSales,
  getBranchOverview,
  getInventoryAlerts,
  getTodaySales,
  getPaymentMethodDistribution,
  getBranchBreakdown,
  getReturnsSummary,
  getInventorySummary,    
  getInventoryHealth,     
  getNeedsAttention,      
  getStockActivity,       
  getBranchStock,        
};