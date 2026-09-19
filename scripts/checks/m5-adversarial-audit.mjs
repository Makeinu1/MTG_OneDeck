#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function runM5AdversarialAudit({ cwd = process.cwd(), spawn = spawnSync } = {}) {
  const result = spawn(
    process.execPath,
    [
      'node_modules/vitest/vitest.mjs',
      'run',
      '--project',
      'dom',
      'scripts/__tests__/m5-adversarial-audit.test.mjs',
    ],
    { cwd, stdio: 'inherit', shell: false },
  );
  return result.status ?? 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = runM5AdversarialAudit();
}
