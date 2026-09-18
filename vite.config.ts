import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { CORE_TEST_INCLUDE, DOM_ENGINE_EXCLUDE, DOM_TEST_INCLUDE, TEST_ADDITIONAL_EXCLUDE } from './scripts/checks/vitest-projects.mjs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/cockpit': {
        target: process.env.COCKPIT_WORKER_ORIGIN ?? 'http://127.0.0.1:8789',
        headers: { origin: 'http://localhost:5173' },
      },
    },
  },
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      thresholds: {
        branches: 75,
      },
    },
    // Worktree checkouts under .claude/ would otherwise be collected as duplicate test files.
    exclude: [...configDefaults.exclude, ...TEST_ADDITIONAL_EXCLUDE],
    projects: [
      {
        extends: true,
        test: {
          name: 'core',
          include: CORE_TEST_INCLUDE,
          environment: 'node',
          fileParallelism: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: DOM_TEST_INCLUDE,
          environment: 'jsdom',
          // Two jsdom workers retain parallelism without starving fixed-time architecture checks.
          fileParallelism: true,
          maxWorkers: 2,
          exclude: [...configDefaults.exclude, ...TEST_ADDITIONAL_EXCLUDE, DOM_ENGINE_EXCLUDE],
        },
      },
    ],
  },
});