// src/modules/products/kxtill/services/receipt.service.js
import saleDb from '../db/sale.db.js';
import settingDb from '../db/setting.db.js';
import orgDb from '../../../platform/organizations/db/org.db.js';

/**
 * Returns structured receipt data for a sale.
 *
 * NOTE: This service does NOT render the receipt text.
 * Rendering is the frontend's responsibility — it lets us change
 * formatting (thermal widths, templates, locales) without a backend
 * deploy, and keeps the API contract stable.
 *
 * Consumers receive raw fields and format them via SettingsContext.
 */
const getReceiptData = async (organizationId, saleId) => {
  const sale = await saleDb.findSaleById(saleId, organizationId);
  if (!sale) {
    throw new Error('Sale not found');
  }

  const settings = await settingDb.findSettingByOrganization(organizationId);
  const org = await orgDb.findOrganizationById(organizationId);

  // ---------- Shop info ----------
  const shop = {
    name: settings?.shopName || org.name || 'Shop',
    phone: settings?.shopPhone || org.phone || '',
    address: settings?.shopAddress || org.address || '',
    email: settings?.shopEmail || org.email || '',
    taxNumber: settings?.taxNumber || '',
  };

  // ---------- Receipt-level settings ----------
  const receipt = {
    number: sale.reference || sale.id.slice(0, 8).toUpperCase(),
    header: settings?.receiptHeader || '',
    footer: settings?.receiptFooter || 'Thank you for shopping!',
    showTax: settings?.showTax ?? true,
    showCustomer: settings?.showCustomer ?? true,
    showCashier: settings?.showCashier ?? true,
    currency: settings?.currency || org.currency || 'KES',
    decimalPlaces: settings?.decimalPlaces ?? 2,
    template: settings?.receiptTemplate || 'classic',
  };

  // ---------- Sale meta ----------
  const saleMeta = {
    id: sale.id,
    reference: sale.reference || sale.id.slice(0, 8).toUpperCase(),
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    status: sale.status,
    customerId: sale.customerId || null,
    customerName: sale.customerName || null,
    cashierId: sale.userId || sale.user?.id || null,
    cashierName: sale.user
      ? `${sale.user.firstName || ''} ${sale.user.lastName || ''}`.trim() ||
        sale.user.name ||
        null
      : null,
    branchId: sale.branchId || null,
    branchName: sale.branch?.name || null,
    organizationName: org.name,
  };

  // ---------- Items ----------
  const items = (sale.items || []).map((item) => ({
    id: item.id,
    productId: item.productId || item.product?.id || null,
    name: item.product?.name || item.productName || 'Unknown',
    sku: item.product?.sku || item.sku || null,
    quantity: Number(item.quantity || 0),
    unitAbbrev: item.unitAbbrev || item.unitName || '',
    unitPrice: Number(item.unitPrice || 0),
    total: Number(item.total || 0),
  }));

  // ---------- Totals ----------
  const totals = {
    subtotal: Number(sale.subtotal || 0),
    tax: Number(sale.taxAmount || 0),
    taxRate: Number(sale.taxRate || settings?.taxRate || 0),
    discount: Number(sale.discount || 0),
    total: Number(sale.totalAmount || 0),
  };

  // ---------- Payments ----------
  const payments = (sale.payments || []).map((p) => ({
    method: p.method || 'CASH',
    amount: Number(p.amount || sale.totalAmount || 0),
    reference: p.reference || null,
    paidAt: p.paidAt || p.createdAt || null,
  }));

  // Fallback: if no payment rows, synthesize one from the total
  if (payments.length === 0) {
    payments.push({
      method: 'CASH',
      amount: totals.total,
      reference: null,
      paidAt: sale.createdAt,
    });
  }

  return {
    shop,
    receipt,
    sale: saleMeta,
    items,
    totals,
    payments,
  };
};

export default {
  getReceiptData,
};