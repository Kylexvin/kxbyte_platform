import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';

const EMAIL = 'demo@kxbyte.co.ke';

const user = await prisma.user.findUnique({ where: { email: EMAIL } });

if (!user) {
  console.error(`User not found: ${EMAIL}`);
  process.exit(1);
}

console.log('Before:', {
  email: user.email,
  isEmailVerified: user.isEmailVerified,
  verifiedAt: user.verifiedAt,
});

const updated = await prisma.user.update({
  where: { email: EMAIL },
  data: {
    isEmailVerified: true,
    verifiedAt: user.verifiedAt || new Date(),
  },
});

console.log('After:', {
  email: updated.email,
  isEmailVerified: updated.isEmailVerified,
  verifiedAt: updated.verifiedAt,
});

// Also mark any unused email-verification tokens as used (cleanup)
const tokens = await prisma.verificationToken.updateMany({
  where: {
    userId: user.id,
    type: 'EMAIL_VERIFICATION',
    usedAt: null,
  },
  data: { usedAt: new Date() },
});
console.log(`Marked ${tokens.count} verification token(s) as used.`);

await prisma.$disconnect();