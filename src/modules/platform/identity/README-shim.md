Temporary bridge so existing imports keep working while you migrate.
Replace the contents of src/modules/platform/identity/email/email.service.js with:

    export * from '../../email/index.js';
    export { sendEmail as default } from '../../email/index.js';

Delete it once `grep -rn "identity/email\|\.\./email/email.service" src/` shows no imports.