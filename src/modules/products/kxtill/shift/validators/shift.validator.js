// src/modules/products/kxtill/shift/validators/shift.validator.js

const isNonNegativeNumber = (value) => {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
};

const validateOpenShift = (req, res, next) => {
  const { branchId, openingFloat, tillId } = req.body || {};

  if (!branchId || typeof branchId !== 'string') {
    return res.status(400).json({ error: 'branchId is required' });
  }

  const floatNum = Number(openingFloat);
  if (openingFloat === undefined || !isNonNegativeNumber(floatNum)) {
    return res.status(400).json({ error: 'openingFloat must be a non-negative number' });
  }

  if (tillId !== undefined && tillId !== null && typeof tillId !== 'string') {
    return res.status(400).json({ error: 'tillId must be a string if provided' });
  }

  req.body.openingFloat = floatNum;
  next();
};

const validateCloseShift = (req, res, next) => {
  const { declaredCash } = req.body || {};
  const num = Number(declaredCash);

  if (declaredCash === undefined || !isNonNegativeNumber(num)) {
    return res.status(400).json({ error: 'declaredCash must be a non-negative number' });
  }

  req.body.declaredCash = num;
  next();
};

const validateForceClose = (req, res, next) => {
  const { declaredCash, reason } = req.body || {};
  const num = Number(declaredCash);

  if (declaredCash === undefined || !isNonNegativeNumber(num)) {
    return res.status(400).json({ error: 'declaredCash must be a non-negative number' });
  }

  if (reason !== undefined && reason !== null && typeof reason !== 'string') {
    return res.status(400).json({ error: 'reason must be a string if provided' });
  }

  req.body.declaredCash = num;
  next();
};

const validateCancelShift = (req, res, next) => {
  next();
};

const validateHandoverRequest = (req, res, next) => {
  const { note } = req.body || {};
  if (note !== undefined && note !== null && typeof note !== 'string') {
    return res.status(400).json({ error: 'note must be a string if provided' });
  }
  next();
};

const validateHandoverResolve = (req, res, next) => {
  const { declaredCash, note } = req.body || {};
  const num = Number(declaredCash);

  if (declaredCash === undefined || !isNonNegativeNumber(num)) {
    return res.status(400).json({ error: 'declaredCash must be a non-negative number' });
  }

  if (note !== undefined && note !== null && typeof note !== 'string') {
    return res.status(400).json({ error: 'note must be a string if provided' });
  }

  req.body.declaredCash = num;
  next();
};

const validateHandoverReject = (req, res, next) => {
  const { note } = req.body || {};
  if (note !== undefined && note !== null && typeof note !== 'string') {
    return res.status(400).json({ error: 'note must be a string if provided' });
  }
  next();
};

const validateReviewVariance = (req, res, next) => {
  const { note } = req.body || {};

  if (!note || typeof note !== 'string' || note.trim().length === 0) {
    return res.status(400).json({ error: 'note is required' });
  }

  next();
};

export default {
  validateOpenShift,
  validateCloseShift,
  validateForceClose,
  validateCancelShift,
  validateHandoverRequest,
  validateHandoverResolve,
  validateHandoverReject,
  validateReviewVariance,
};