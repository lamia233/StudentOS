import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`StudentOS API listening on http://localhost:${config.port}`);
  console.log(`Notion: ${config.notion.token ? 'live token configured' : 'demo mode (no NOTION_TOKEN)'} · Assistant: ${config.llm.apiKey ? 'LLM + fallback' : 'rule-based'}`);
});

const shutdown = () => server.close(() => prisma.$disconnect().then(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
