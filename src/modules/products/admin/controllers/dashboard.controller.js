// src/modules/products/admin/controllers/dashboard.controller.js
import * as dashboardService from '../services/dashboard.service.js';

export const get = async (req, res) => {
  try {
    const data = await dashboardService.getDashboard();
    res.json({ data });
  } catch (err) {
    console.error('admin dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
};