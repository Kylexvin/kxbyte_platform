// src/modules/platform/identity/config/passport.config.js

import dotenv from 'dotenv';
dotenv.config();

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import socialService from '../services/social.service.js';


// ============================================================
// GOOGLE
// ============================================================

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_REDIRECT_URI || '/api/v1/auth/google/callback',
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await socialService.findOrCreateUser(profile, 'google');
          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    )
  );

} else {

}

// ============================================================
// GITHUB
// ============================================================

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_REDIRECT_URI || '/api/v1/auth/github/callback',
        scope: ['user:email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let email = profile.emails?.[0]?.value;

          if (!email) {
            const emailRes = await fetch('https://api.github.com/user/emails', {
              headers: {
                Authorization: `token ${accessToken}`,
              },
            });
            const emails = await emailRes.json();
            const primary = emails.find((e) => e.primary && e.verified);
            if (primary) {
              email = primary.email;
            }
          }

          if (email && !profile.emails) {
            profile.emails = [{ value: email }];
          }

          const user = await socialService.findOrCreateUser(profile, 'github');
          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    )
  );
  

} else {

}

// ============================================================
// SERIALIZATION
// ============================================================

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const prisma = (await import('../../../../database/postgres/prisma.js')).default;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isEmailVerified: true,
        isActive: true,
      },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;