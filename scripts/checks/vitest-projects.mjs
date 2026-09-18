#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { configDefaults } from 'vitest/config';

const projects = ['core', 'dom'];

const SUPPORTED_DEFAULT_INCLUDE = ['**/*.{test,spec}.?(c|m)[jt]s?(x)'];
const SUPPORTED_DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/cypress/**',
  '**/.{idea,git,cache,output,temp}/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
];

function assertSupportedVitestDefaults() {
  if (JSON.stringify(configDefaults.include) !== JSON.stringify(SUPPORTED_DEFAULT_INCLUDE)) {
    throw new Error(`Vitest default include changed: ${JSON.stringify(configDefaults.include)}`);
  }
  if (JSON.stringify(configDefaults.exclude) !== JSON.stringify(SUPPORTED_DEFAULT_EXCLUDE)) {
    throw new Error(`Vitest default exclude changed: ${JSON.stringify(configDefaults.exclude)}`);
  }
}
assertSupportedVitestDefaults();

export const DEFAULT_TEST_INCLUDE = [...configDefaults.include];
export const CORE_TEST_INCLUDE = configDefaults.include.map((pattern) => `src/engine/${pattern}`);
export const TEST_EXCLUDE = [...configDefaults.exclude, '.claude/**'];
export const DOM_ENGINE_EXCLUDE = 'src/engine/**';

export const TEST_FILE_SUFFIXES = Object.freeze([
  '.test.js', '.test.jsx', '.test.cjs', '.test.cjsx', '.test.mjs', '.test.mjsx',
  '.test.ts', '.test.tsx', '.test.cts', '.test.ctsx', '.test.mts', '.test.mtsx',
  '.spec.js', '.spec.jsx', '.spec.cjs', '.spec.cjsx', '.spec.mjs', '.spec.mjsx',
  '.spec.ts', '.spec.tsx', '.spec.cts', '.spec.ctsx', '.spec.mts', '.spec.mtsx',
]);

const TEST_LIKE_PATH = /(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/u;
const DEFAULT_EXCLUDED_DIRECTORIES = new Set([
  'node_modules', 'dist', 'cypress', '.idea', '.git', '.cache', '.output', '.temp',
]);
const DEFAULT_EXCLUDED_CONFIG_NAMES = new Set([
  'karma', 'rollup', 'webpack', 'vite', 'vitest', 'jest', 'ava', 'babel', 'nyc',
  'cypress', 'tsup', 'build', 'eslint', 'prettier',
]);

function normalizeRepositoryPath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function isExcludedTestPath(normalized) {
  const segments = normalized.split('/');
  if (segments.some((segment) => DEFAULT_EXCLUDED_DIRECTORIES.has(segment))) return true;
  if (normalized.startsWith('.claude/')) return true;
  const filename = segments.at(-1) ?? '';
  const configMatch = filename.match(/^([^.]+)\.config\./u);
  return configMatch ? DEFAULT_EXCLUDED_CONFIG_NAMES.has(configMatch[1]) : false;
}

export function isTestLikePath(path) {
  return TEST_LIKE_PATH.test(normalizeRepositoryPath(path));
}

export function vitestProjectForPath(path) {
  const normalized = normalizeRepositoryPath(path);
  if (!TEST_FILE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return null;
  if (isExcludedTestPath(normalized)) return null;
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
