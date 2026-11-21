import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-secret-test-secret-test-secret',
      ENCRYPTION_KEY: 'test-encryption-key',
      NOTION_TOKEN: '',
      OPENAI_API_KEY: '',
    },
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
