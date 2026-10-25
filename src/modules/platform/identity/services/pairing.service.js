// src/modules/platform/identity/services/pairing.service.js
//
// One-time device-pairing tokens.
//
// Flow:
//   create(userId, orgId, branchId, deviceLabel) → { token, expiresAt }
//     - POS calls this. Token is short-lived (5 min), single-use, hashed
//       in the DB. Only the raw token leaves the server (once) so the POS
//       can encode it in a QR.
//   redeem(token, { deviceLabel, userAgent, ipAddress }) →
//     { accessToken, refreshToken, user, organizations, organization, branch }
//     - Mobile calls this. If valid and unused, we mint a normal session
//       (same shape as /auth/login) and mark the pairing row used.

import crypto from 'crypto';
import pairingDb from '../db/pairing.db.js';
import authDb from '../db/auth.db.js';
import orgDb from '../../organizations/db/org.db.js';
import jwt from '../utils/jwt.js';
import audit from '../../audit/index.js';

const TTL_MS = 5 * 60 * 1000; // 5 minutes

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Create a pairing session on behalf of an authenticated user.
 * The token is returned once and never again.
 */
export async function create(userId, { organizationId, branchId, deviceLabel }) {
  const user = await authDb.findActiveUserById(userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  // If orgId provided, verify membership.
  if (organizationId) {
    const membership = await orgDb.findMembership(userId, organizationId);
    if (!membership) {
      throw Object.assign(
        new Error('You do not have access to that organization'),
        { status: 403 }
      );
    }
  }

  const raw = generateToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TTL_MS);

  const record = await pairingDb.createSession({
    tokenHash,
    userId,
    organizationId: organizationId || null,
    branchId: branchId || null,
    deviceLabel: deviceLabel || null,
    expiresAt,
  });

  await audit.log({
    organizationId: organizationId || null,
    userId,
    action: 'PAIRING_SESSION_CREATED',
    resource: 'pairing_session',
    resourceId: record.id,
    metadata: { branchId: branchId || null, deviceLabel: deviceLabel || null },
  });

  return {
    token: raw,
    expiresAt: record.expiresAt,
    pairingId: record.id,
  };
}

/**
 * Redeem a pairing token. Returns a session identical to /auth/login.
 */
export async function redeem(rawToken, { deviceLabel, userAgent, ipAddress } = {}) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw Object.assign(new Error('Missing token'), { status: 400 });
  }

  const tokenHash = hashToken(rawToken);
  const row = await pairingDb.findByTokenHash(tokenHash);
  if (!row) {
    throw Object.assign(new Error('Invalid pairing code'), { status: 400 });
  }
  if (row.revokedAt) {
    throw Object.assign(new Error('Pairing was revoked'), { status: 400 });
  }
  if (row.usedAt) {
    throw Object.assign(new Error('Pairing already used'), { status: 400 });
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw Object.assign(new Error('Pairing expired'), { status: 400 });
  }
  if (!row.user || !row.user.isActive) {
    throw Object.assign(new Error('Account inactive'), { status: 403 });
  }

  // Consume: mark used BEFORE creating the session, so a race cannot
  // redeem twice. The unique constraint on tokenHash guarantees one row.
  await pairingDb.markUsed(row.id);

  const user = await authDb.findActiveUserById(row.userId);
  const accessToken = jwt.generateAccessToken(user);
  const refreshToken = jwt.generateRefreshToken(user);

  await authDb.createSession({
    userId: user.id,
    refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const organizations = await authDb.findOrganizationsByUserId(user.id);
  const formattedOrgs = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: org.ownerId === user.id ? 'Owner' : 'Member',
  }));

  const { password: _pw, ...userWithoutPassword } = user;

  await audit.log({
    organizationId: row.organizationId || null,
    userId: user.id,
    action: 'PAIRING_SESSION_REDEEMED',
    resource: 'pairing_session',
    resourceId: row.id,
    metadata: {
      deviceLabel: deviceLabel || null,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    },
  });

  return {
    accessToken,
    refreshToken,
    user: userWithoutPassword,
    organizations: formattedOrgs,
    pairingContext: {
      organizationId: row.organizationId || null,
      branchId: row.branchId || null,
    },
  };
}

/**
 * Revoke a pairing session (owner of the session only).
 */
export async function revoke(userId, pairingId) {
  const target = await pairingDb.findById(pairingId);
  if (!target || target.userId !== userId) {
    throw Object.assign(new Error('Pairing not found'), { status: 404 });
  }
  if (target.revokedAt) return { revoked: true };
  await pairingDb.revoke(target.id);
  await audit.log({
    organizationId: target.organizationId || null,
    userId,
    action: 'PAIRING_SESSION_REVOKED',
    resource: 'pairing_session',
    resourceId: target.id,
  });
  return { revoked: true };
}

export async function getStatus(pairingId, requestingUserId) {
  const row = await pairingDb.findById(pairingId);
  if (!row || row.userId !== requestingUserId) {
    throw Object.assign(new Error('Pairing not found'), {
      status: 404,
      code: 'NOT_FOUND',
    });
  }

  let status;
  if (row.revokedAt) status = 'revoked';
  else if (row.usedAt) status = 'redeemed';
  else if (row.expiresAt.getTime() < Date.now()) status = 'expired';
  else status = 'pending';

  return {
    status,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    deviceLabel: row.deviceLabel,
  };
}

/**
 * Sweep expired sessions. Call from a cron job.
 */
export async function sweepExpired() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count } = await pairingDb.deleteExpiredBefore(cutoff);
  return { removed: count };
}

export default { create, redeem, revoke, getStatus, sweepExpired };