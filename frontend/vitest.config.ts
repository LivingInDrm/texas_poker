import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  cacheDir: 'node_modules/.vitest',
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
    
    // Enhanced memory and isolation settings
    pool: 'forks',          // Use fork pool for better memory isolation
    poolOptions: {
      forks: {
        singleFork: false,  // Run tests in separate forks for better isolation
        isolate: true,      // Isolate each test file
        minForks: 1,        // Minimum number of forks
        maxForks: 4,        // Maximum number of forks for parallel execution
      }
    },
    
    // Enhanced test isolation and cleanup
    sequence: {
      hooks: 'stack',       // Run hooks in stack order for better cleanup
      shuffle: false,       // Disable shuffling for predictable test order
    },
    
    // Comprehensive mock management
    clearMocks: true,       // Clear all mocks after each test
    restoreMocks: true,     // Restore all mocks after each test
    resetMocks: true,       // Reset all mocks after each test
    unstubEnvs: true,       // Unstub environment variables
    unstubGlobals: true,    // Unstub global variables
    
    // Memory management
    logHeapUsage: true,     // Log heap usage for memory monitoring
    
    // Enhanced error handling
    bail: 0,                // Continue running tests even if some fail
    retry: 0,               // Don't retry failed tests (for consistency)
    
    // Mock configuration for better isolation
    server: {
      deps: {
        inline: [
          // Inline dependencies that might need special handling
          '@testing-library/jest-dom',
        ],
      },
    },
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/', 
        '__tests__/fixtures/', 
        '__tests__/helpers/',
        '__tests__/test-infrastructure/',
        'types/'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    }
  },
});