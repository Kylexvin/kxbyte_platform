// src/server.js

import app, { initializeProducts } from './app.js';
import { startSubscriptionSweep } from './modules/platform/subscriptions/jobs/subscriptionSweep.job.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initializeProducts();

    // start daily subscription sweep (TRIAL → GRACE → EXPIRED + notifications)
    startSubscriptionSweep();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

startServer();  