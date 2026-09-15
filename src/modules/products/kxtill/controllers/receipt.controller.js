// src/modules/products/kxtill/controllers/receipt.controller.js
import receiptService from '../services/receipt.service.js';

/**
 * GET /organizations/:organizationId/kxtill/sales/:saleId/receipt
 *
 * Returns structured receipt data.
 * The frontend renders the receipt text using its own template engine.
 */
export const generateReceipt = async (req, res, next) => {
  try {
    const { organizationId, saleId } = req.params;
    const data = await receiptService.getReceiptData(organizationId, saleId);
    res.json(data);
  } catch (err) {
    console.error('Generate receipt error:', err);

    if (err.message === 'Sale not found') {
      return res.status(404).json({ error: 'Sale not found' });
    }

    next(err);
  }
};

export default { generateReceipt };