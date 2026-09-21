// src/modules/platform/identity/services/sso.service.js
import ssoCodeStore from '../utils/ssoCodeStore.js';
import authDb from '../db/auth.db.js';
import jwt from '../utils/jwt.js';
import audit from '../../audit/index.js';

const TOKEN_EXPIRY_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const mintCode = async (userId, target = 'suite') => {
  if (!userId) throw new Error('Unauthorized');

  const user = await authDb.findActiveUserById(userId);
  if (!user) throw new Error('User not found or inactive');

  const code = ssoCodeStore.createSsoCode({ userId, target });

  await audit.log({
    organizationId: null,
    userId,
    action: 'SSO_CODE_MINTED',
    resource: 'sso',
    resourceId: null,
    metadata: { target },
  });

  return {
    code,
    expiresIn: Math.floor(ssoCodeStore.SSO_CODE_TTL_MS / 1000),
  };
};

const exchangeCode = async (code) => {
  if (!code || typeof code !== 'string') {
    throw new Error('Invalid code');
  }

  const entry = ssoCodeStore.consumeSsoCode(code);
  if (!entry) {
    throw new Error('Invalid or expired code');
  }

  const user = await authDb.findActiveUserById(entry.userId);
  if (!user || !user.isActive || user.deletedAt) {
    throw new Error('User not found or inactive');
  }

  const accessToken = jwt.generateAccessToken(user);
  const refreshToken = jwt.generateRefreshToken(user);

  const session = await authDb.createSession({
    userId: user.id,
    refreshToken,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY_REFRESH_MS),
  });

  const organizations = await authDb.findOrganizationsByUserId(user.id);
  const formattedOrgs = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: org.ownerId === user.id ? 'Owner' : 'Member',
  }));

  await audit.log({
    organizationId: null,
    userId: user.id,
    action: 'SSO_CODE_EXCHANGED',
    resource: 'sso',
    resourceId: session.id,
    metadata: { target: entry.target },
  });

  await authDb.updateUser(user.id, { lastLoginAt: new Date() });

  const { password: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken,
    organizations: formattedOrgs,
  };
};

export default { mintCode, exchangeCode };