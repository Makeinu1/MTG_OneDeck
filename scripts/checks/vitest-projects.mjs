#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projects = ['core', 'dom'];

export function runVitestProjects({
  spawn = spawnSync,
  extraArgs = [],
  write = (line) => console.log(line),
} = {}) {
  const results = [];

  for (const project of projects) {
    write(`\n=== vitest project: ${project} ===`);
    const result = spawn(
      'npx',
      ['vitest', 'run', '--project', project, ...extraArgs],
      { stdio: 'inherit', shell: false },
    );
    const code = result.status ?? 1;
    results.push({ project, code, skipped: false });

    if (code !== 0) {
      for (const skippedProject of projects.slice(results.length)) {
        results.push({ project: skippedProject, code: null, skipped: true });
      }
      return { exitCode: code, results };
    }
  }

  return { exitCode: 0, results };
}

function runCli() {
  process.exitCode = runVitestProjects({
    extraArgs: process.argv.slice(2),
  }).exitCode;
}

const isCli = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isCli) runCli();
