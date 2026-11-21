const env = process.env;

function required(name: string, fallbackForDev?: string): string {
  const value = env[name];
  if (value) return value;
  if (env.NODE_ENV !== 'production' && fallbackForDev) return fallbackForDev;
  throw new Error(`Missing required environment variable ${name}`);
}

export const config = {
  port: Number(env.PORT ?? 4000),
  nodeEnv: env.NODE_ENV ?? 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  corsOrigins: (env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-jwt-secret-change-me'),
  encryptionKey: required('ENCRYPTION_KEY', 'dev-only-insecure-encryption-key'),
  notion: {
    token: env.NOTION_TOKEN || undefined,
    targetId: env.NOTION_TARGET_ID || undefined,
    apiBase: 'https://api.notion.com/v1',
    version: '2022-06-28',
  },
  llm: {
    apiKey: env.OPENAI_API_KEY || undefined,
    baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  demo: {
    email: 'demo@studentos.app',
    password: 'demo1234',
    /** Demo data is regenerated relative to "now" when older than this, so deadlines stay realistic. */
    refreshAfterHours: 12,
  },
};
