import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    globals: true,
    include: ['__tests__/**/*.test.{ts,tsx}'],
    // Timeout settings according to TEST_STANDARDS.md
    testTimeout: 30000,     // 30 seconds for integration tests
    hookTimeout: 15000,     // 15 seconds for hooks
    teardownTimeout: 10000, // 10 seconds for teardown
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', '__tests__/fixtures/', '__tests__/helpers/']
    }
  },
});