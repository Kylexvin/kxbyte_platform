// src/server.js

import app, { initializeProducts } from './app.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initializeProducts();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

startServer();