// src/modules/products/admin/controllers/products.controller.js
//
// Admin products catalogue — internal only.
// Handlers: list, getOne, update, getUploadSignature, deleteIcon.
// No tenant data (subscriptions, payments) — those belong to /organizations
// and /subscriptions.

import productsService from '../services/products.service.js';

// ============================================================
// ERROR MAP
// ============================================================

const STATUS_BY_TYPE = {
  ValidationError: 400,
  ForbiddenError: 403,
  NotFoundError: 404,
  ConflictError: 409,
};

const handleError = (res, err, label) => {
  const status = STATUS_BY_TYPE[err.name] || 500;
  if (status >= 500) console.error(`${label} error:`, err);
  res.status(status).json({ error: err.message, code: err.code });
};

// ============================================================
// LIST
// ============================================================

export const list = async (req, res) => {
  try {
    const products = await productsService.listProducts();
    res.json({ data: products });
  } catch (err) {
    handleError(res, err, 'admin products list');
  }
};

// ============================================================
// DETAIL
// ============================================================

export const getOne = async (req, res) => {
  try {
    const product = await productsService.getProductDetail(req.params.key);
    res.json({ data: product });
  } catch (err) {
    handleError(res, err, 'admin products getOne');
  }
};

// ============================================================
// UPDATE
// ============================================================

export const update = async (req, res) => {
  try {
    const product = await productsService.updateProduct(
      req.params.key,
      req.user.userId,
      req.body
    );
    res.json({ data: product });
  } catch (err) {
    handleError(res, err, 'admin products update');
  }
};

// ============================================================
// ICON UPLOAD — signature
// ============================================================

export const getUploadSignature = async (req, res) => {
  try {
    const signature = await productsService.issueProductIconSignature(
      req.params.key,
      req.user.userId
    );
    res.json({ data: signature });
  } catch (err) {
    handleError(res, err, 'admin products signature');
  }
};

// ============================================================
// ICON — delete
// ============================================================

export const deleteIcon = async (req, res) => {
  try {
    const { publicId } = req.body || {};
    const result = await productsService.deleteProductIcon(
      req.params.key,
      req.user.userId,
      publicId
    );
    res.json({ data: result });
  } catch (err) {
    handleError(res, err, 'admin products deleteIcon');
  }
};