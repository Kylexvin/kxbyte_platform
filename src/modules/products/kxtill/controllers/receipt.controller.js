// src/modules/products/kxtill/controllers/receipt.controller.js

import receiptService from '../services/receipt.service.js';

const generateReceipt = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { organizationId, saleId } = req.params;

    const receipt = await receiptService.generateReceipt(organizationId, saleId);
    res.status(200).json(receipt);
  } catch (error) {
    if (error.message === 'Sale not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Generate receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  generateReceipt,
};