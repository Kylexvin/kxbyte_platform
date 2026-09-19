// src/modules/platform/subscriptions/jobs/subscriptionSweep.job.js
import cron from 'node-cron';
import subscriptionService from '../services/subscription.service.js';

export const startSubscriptionSweep = () => {
  // runs daily at 01:00 Africa/Nairobi
  cron.schedule('0 1 * * *', async () => {
    console.log('[subscription-sweep] starting');
    try {
      const result = await subscriptionService.runSweep();
      console.log('[subscription-sweep] done', result.length, 'transitions');
    } catch (err) {
      console.error('[subscription-sweep] failed', err);
    }
  }, { timezone: 'Africa/Nairobi' });
};

//TO DO
// Hook it in app.js and make sure it runs daily at 01:00 Africa/Nairobi