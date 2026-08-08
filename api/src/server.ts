import 'dotenv/config';

import { createApp } from './app';
import { connectDatabase } from './utils/mongoose';
import { env } from './utils/env';

async function main() {
  await connectDatabase();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`gym-bro-api listening on port ${env.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
