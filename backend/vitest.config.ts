import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      // Keep tests off the real cache directory and off the network.
      OPENF1_CACHE_DIR: '.cache/test',
    },
  },
});
