// src/modules/platform/notifications/providers/firebase.provider.js
//
// Named Firebase Admin app registry, keyed by productKey.
//
// Each product has its own Firebase project and service account. The app
// name passed to initializeApp is the productKey, so getApps() lookups by
// name never collide across products. Credentials come from a single env
// var per product: FCM_SERVICE_ACCOUNT_<PRODUCT> as a JSON string.
//
// Products without credentials are treated as "not configured" — the
// caller gets null and can decide what to do (skip push, log, etc.),
// rather than accidentally using another product's Firebase app.

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const cachedMessaging = new Map();

function envKeyFor(productKey) {
  return `FCM_SERVICE_ACCOUNT_${String(productKey).toUpperCase()}`;
}

function loadServiceAccount(productKey) {
  const raw = process.env[envKeyFor(productKey)];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(
      `[firebase.provider] invalid JSON in ${envKeyFor(productKey)}:`,
      e.message
    );
    return null;
  }
}

export function getFirebaseMessaging(productKey) {
  if (!productKey) return null;
  if (cachedMessaging.has(productKey)) return cachedMessaging.get(productKey);

  const serviceAccount = loadServiceAccount(productKey);
  if (!serviceAccount) return null;

  const appName = productKey;
  let app = getApps().find((candidate) => candidate.name === appName);
  if (!app) {
    app = initializeApp({ credential: cert(serviceAccount) }, appName);
  }

  const messaging = getMessaging(app);
  cachedMessaging.set(productKey, messaging);
  return messaging;
}

export function isConfigured(productKey) {
  return !!loadServiceAccount(productKey);
}

export default { getFirebaseMessaging, isConfigured };