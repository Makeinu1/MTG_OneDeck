import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Several visual-fixture suites build large jsdom trees. Parallel files compete for
    // enough CPU that assertion timeouts become machine-load dependent; serial files keep
    // the assertions and their timeout budgets strict in both local checks and CI.
    fileParallelism: false,
    // Worktree checkouts under .claude/ would otherwise be collected as duplicate test files.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
