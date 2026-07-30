import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Worktree checkouts under .claude/ would otherwise be collected as duplicate test files.
    exclude: [...configDefaults.exclude, '.claude/**'],
    projects: [
      {
        extends: true,
        test: {
          name: 'core',
          include: ['src/engine/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
          environment: 'node',
          fileParallelism: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: configDefaults.include,
          environment: 'jsdom',
          // Visual-fixture suites build large jsdom trees. Keep this lane serial so their
          // assertion timeouts do not become machine-load dependent.
          fileParallelism: false,
          exclude: [...configDefaults.exclude, '.claude/**', 'src/engine/**'],
        },
      },
    ],
  },
});
