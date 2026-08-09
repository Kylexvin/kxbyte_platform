// src/modules/products/kxtill/services/receipt.service.js

import saleDb from '../db/sale.db.js';
import settingDb from '../db/setting.db.js';
import orgDb from '../../../platform/organizations/db/org.db.js';
import prisma from '../../../../database/postgres/prisma.js';

const generateReceipt = async (organizationId, saleId) => {
  // Get sale with items
  const sale = await saleDb.findSaleById(saleId, organizationId);
  if (!sale) {
    throw new Error('Sale not found');
  }

  // Get store settings
  const settings = await settingDb.findSettingByOrganization(organizationId);
  const org = await orgDb.findOrganizationById(organizationId);

  // Build receipt data
  const shopName = settings?.shopName || org.name || 'Shop Name';
  const shopPhone = settings?.shopPhone || org.phone || '';
  const shopAddress = settings?.shopAddress || org.address || '';
  const shopEmail = settings?.shopEmail || org.email || '';
  const taxNumber = settings?.taxNumber || '';
  const receiptFooter = settings?.receiptFooter || 'Thank you for shopping!';
  const receiptHeader = settings?.receiptHeader || '';

  // Format date
  const date = new Date(sale.createdAt);
  const dateStr = date.toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Build receipt text
  const separator = '----------------------------------------';
  const lines = [];

  // Header
  lines.push(separator);
  lines.push(`  ${shopName.toUpperCase()}`);
  if (shopPhone) lines.push(`  Tel: ${shopPhone}`);
  if (shopAddress) lines.push(`  ${shopAddress}`);
  if (shopEmail) lines.push(`  Email: ${shopEmail}`);
  if (taxNumber) lines.push(`  Tax No: ${taxNumber}`);
  if (receiptHeader) lines.push(`  ${receiptHeader}`);
  lines.push(separator);

  // Receipt info
  const receiptNumber = sale.id.slice(0, 8).toUpperCase();
  lines.push(`  Receipt #${receiptNumber}`);
  lines.push(`  Date: ${dateStr} ${timeStr}`);
  const attendant = sale.user?.firstName || 'Unknown';
  lines.push(`  Attendant: ${attendant}`);
  lines.push(separator);

  // Items
  lines.push('  Qty  Item                     Price');
  for (const item of sale.items) {
    const qty = Number(item.quantity);
    const unit = item.unitAbbrev || '';
    const name = item.product?.name || 'Unknown';
    const price = Number(item.unitPrice);
    const total = Number(item.total);

    const itemLine = `  ${qty} × ${name}`;
    const priceLine = `  ${total.toFixed(2)}`;
    lines.push(`  ${itemLine.padEnd(25)} ${priceLine}`);
  }
  lines.push(separator);

  // Totals
  const subtotal = Number(sale.subtotal);
  const tax = Number(sale.taxAmount);
  const total = Number(sale.totalAmount);

  lines.push(`  Subtotal`.padEnd(25) + `  ${subtotal.toFixed(2)}`);
  if (tax > 0) {
    lines.push(`  Tax (16%)`.padEnd(25) + `  ${tax.toFixed(2)}`);
  }
  lines.push(separator);
  lines.push(`  TOTAL`.padEnd(25) + `  ${total.toFixed(2)}`);

  // Payment
  const payment = sale.payments?.[0];
  const method = payment?.method || 'CASH';
  lines.push(`  Payment: ${method}`);
  if (payment?.reference) {
    lines.push(`  Ref: ${payment.reference}`);
  }
  lines.push(separator);

  // Footer
  lines.push(`  ${receiptFooter}`);
  lines.push(separator);

  return {
    text: lines.join('\n'),
    data: {
      shopName,
      shopPhone,
      shopAddress,
      shopEmail,
      taxNumber,
      receiptNumber,
      date: dateStr,
      time: timeStr,
      attendant,
      items: sale.items.map((item) => ({
        name: item.product?.name || 'Unknown',
        quantity: Number(item.quantity),
        unit: item.unitAbbrev || '',
        price: Number(item.unitPrice),
        total: Number(item.total),
      })),
      subtotal,
      tax,
      total,
      paymentMethod: method,
      paymentReference: payment?.reference || null,
      footer: receiptFooter,
    },
  };
};

export default {
  generateReceipt,
};