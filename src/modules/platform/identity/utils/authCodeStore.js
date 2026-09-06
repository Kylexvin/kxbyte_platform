// src/modules/platform/identity/utils/authCodeStore.js

import crypto from 'crypto';

const authCodes = new Map();
const AUTHORIZATION_CODE_EXPIRY = 60 * 10; // 10 minutes

const generateCode = () => crypto.randomBytes(32).toString('hex');

const createAuthCode = ({ userId, clientId, redirectUri }) => {
  const code = generateCode();
  authCodes.set(code, {
    userId,
    clientId,
    redirectUri,
    createdAt: Date.now(),
    used: false,
  });
  return code;
};

const getAuthCode = (code) => authCodes.get(code);

const consumeAuthCode = (code) => {
  const entry = authCodes.get(code);
  if (!entry) return null;
  entry.used = true;
  authCodes.set(code, entry);
  return entry;
};

const deleteAuthCode = (code) => authCodes.delete(code);

export default {
  createAuthCode,
  getAuthCode,
  consumeAuthCode,
  deleteAuthCode,
  AUTHORIZATION_CODE_EXPIRY,
};