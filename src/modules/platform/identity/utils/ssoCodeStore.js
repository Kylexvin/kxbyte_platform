// src/modules/platform/identity/utils/ssoCodeStore.js
import crypto from 'crypto';

const ssoCodes = new Map();
const SSO_CODE_TTL_MS = 60 * 1000; // 60 seconds

const generateCode = () => crypto.randomBytes(32).toString('hex');

const createSsoCode = ({ userId, target }) => {
  const code = generateCode();
  ssoCodes.set(code, {
    userId,
    target,
    createdAt: Date.now(),
    used: false,
  });
  return code;
};

const consumeSsoCode = (code) => {
  const entry = ssoCodes.get(code);
  if (!entry) return null;
  if (entry.used) return null;
  if (Date.now() - entry.createdAt > SSO_CODE_TTL_MS) {
    ssoCodes.delete(code);
    return null;
  }
  entry.used = true;
  ssoCodes.set(code, entry);
  return entry;
};

// periodic cleanup so the map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of ssoCodes.entries()) {
    if (now - entry.createdAt > SSO_CODE_TTL_MS) ssoCodes.delete(code);
  }
}, 5 * 60 * 1000).unref?.();

export default {
  createSsoCode,
  consumeSsoCode,
  SSO_CODE_TTL_MS,
};