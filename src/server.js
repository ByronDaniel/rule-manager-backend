import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectMongo } from './infrastructure/mongo.js';
import { createServices } from './services.js';

const SYNC_INTERVAL_MS = 5000;

const config = loadConfig();
const store = await connectMongo(config.mongoUri, config.mongoDatabase);

// Scheduled versions are activated and expired in the background.
const { versions } = createServices(store, config);
await versions.synchronizeAll();
const scheduler = setInterval(() => versions.synchronizeAll().catch(() => console.error('Unable to synchronize scheduled versions')), SYNC_INTERVAL_MS);

const server = createApp(store, config).listen(config.port, async error => {
  if (error) {
    clearInterval(scheduler);
    await store.client.close();
    console.error(`Unable to listen on port ${config.port}: ${error.code || error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`RMA listening on port ${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(scheduler);
    server.close(async () => {
      await store.client.close();
      process.exit(0);
    });
  });
}
