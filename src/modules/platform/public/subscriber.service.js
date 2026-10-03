import subscriberDb from './subscriber.db.js';
import audit from '../audit/index.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_WAITLISTS = [
  'kxtill',
  'kxwork',
  'kxcrm',
  'kxinvoice',
  'kxpay',
  'kxhr',
  'kxhelp',
  'kxbi',
];

const subscribe = async ({ email, newsletter, waitlists, source }, req) => {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }

  const normalized = email.toLowerCase().trim();

  if (!EMAIL_RE.test(normalized)) {
    throw new Error('Invalid email');
  }

  if (normalized.length > 254) {
    throw new Error('Email too long');
  }

  // Clean up incoming waitlists — only allow known product keys
  const cleanWaitlists = Array.isArray(waitlists)
    ? waitlists.filter((k) => VALID_WAITLISTS.includes(k))
    : [];

  const existing = await subscriberDb.findByEmail(normalized);

  const ipAddress =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    null;

  await subscriberDb.upsertSubscriber(normalized, {
    newsletter: !!newsletter,
    waitlists: cleanWaitlists,
    existingWaitlists: existing?.waitlists || [],
    source: source || req.headers.origin || 'unknown',
    ipAddress,
    userAgent: req.headers['user-agent'] || null,
  });

  await audit.log({
    organizationId: null,
    userId: null,
    action: 'SUBSCRIBER_ADDED',
    resource: 'subscriber',
    resourceId: normalized,
    metadata: {
      newsletter: !!newsletter,
      waitlists: cleanWaitlists,
      source,
    },
    ipAddress,
    userAgent: req.headers['user-agent'],
  });

  return { message: "You're on the list" };
};

export default { subscribe };