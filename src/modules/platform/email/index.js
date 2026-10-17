// src/modules/platform/email/index.js
//
// Public API of the email module.
//   import email from '../../email/index.js';   email.sendVerificationEmail(...)
//   import { sendVerificationEmail } from '../../email/index.js';

import * as emailService from './services/email.service.js';

export * from './services/email.service.js';

export default { ...emailService };