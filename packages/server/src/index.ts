import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app';

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Pilot Agent Server starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`✅ Server is running at http://localhost:${info.port}`);
});

