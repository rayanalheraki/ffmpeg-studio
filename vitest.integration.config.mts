import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Runs every operation through the bundled FFmpeg binary on generated sample media. */
export default defineConfig({
  resolve: { alias: { '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)) } },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
