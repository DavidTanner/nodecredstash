import inspector from 'node:inspector';
import { defineConfig } from 'vitest/config';

const timeout = inspector.url() ? 1e8 : 5e3;

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*'],
      clean: true,
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
    testTimeout: timeout,
    hookTimeout: timeout,
    teardownTimeout: timeout,
    restoreMocks: true,
    mockReset: true,
  },
});
