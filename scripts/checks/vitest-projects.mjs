#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projects = ['core', 'dom'];

export const TEST_FILE_SUFFIXES = Object.freeze([
  '.test.ts', '.test.tsx', '.test.js', '.test.jsx',
  '.test.mts', '.test.mjs', '.test.cts', '.test.cjs',
  '.spec.ts', '.spec.tsx', '.spec.js', '.spec.jsx',
  '.spec.mts', '.spec.mjs', '.spec.cts', '.spec.cjs',
]);
export const TEST_IGNORED_DIRECTORIES = Object.freeze([
  '.git', '.claude', '.tmp', 'coverage', 'dist', 'node_modules',
]);
export const DOM_TEST_INCLUDE = TEST_FILE_SUFFIXES.map((suffix) => `**/*${suffix}`);
export const CORE_TEST_INCLUDE = TEST_FILE_SUFFIXES.map((suffix) => `src/engine/**/*${suffix}`);
export const TEST_ADDITIONAL_EXCLUDE = TEST_IGNORED_DIRECTORIES.map((directory) => `${directory}/**`);
export const DOM_ENGINE_EXCLUDE = 'src/engine/**';

const TEST_LIKE_PATH = /(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/u;
const EXCLUDED_PATH_SEGMENTS = new Set(TEST_IGNORED_DIRECTORIES);

function normalizeRepositoryPath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function isTestLikePath(path) {
  return TEST_LIKE_PATH.test(normalizeRepositoryPath(path));
}

export function vitestProjectForPath(path) {
  const normalized = normalizeRepositoryPath(path);
  if (!TEST_FILE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return null;
  if (normalized.split('/').some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment))) return null;
  return normalized.startsWith('src/engine/') ? 'core' : 'dom';
}

export function partitionVitestTestFiles(paths) {
  const result = { core: [], dom: [] };
  for (const path of paths) {
    const project = vitestProjectForPath(path);
    if (project) result[project].push(path);
  }
  return result;
}

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
