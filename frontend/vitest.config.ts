import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    globals: true,
    include: ['__tests__/**/*.test.{ts,tsx}'],
    // Timeout settings according to TEST_STANDARDS.md
    testTimeout: 30000,     // 30 seconds for integration tests
    hookTimeout: 15000,     // 15 seconds for hooks
    teardownTimeout: 10000, // 10 seconds for teardown
    // Memory optimization settings
    pool: 'forks',          // Use fork pool for better memory isolation
    poolOptions: {
      forks: {
        singleFork: true,   // Run tests in single fork to reduce memory usage
        isolate: true,      // Isolate each test file
      }
    },
    // Force garbage collection between tests
    sequence: {
      hooks: 'stack',       // Run hooks in stack order for better cleanup
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', '__tests__/fixtures/', '__tests__/helpers/']
    }
  },
});