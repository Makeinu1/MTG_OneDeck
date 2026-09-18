#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projects = ['core', 'dom'];

export const CORE_TEST_INCLUDE = ['src/engine/**/*.{test,spec}.?(c|m)[jt]s?(x)'];
export const DOM_ENGINE_EXCLUDE = 'src/engine/**';

const TEST_LIKE_PATH = /(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/u;
const RUNNABLE_TEST_PATH = /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const EXCLUDED_PATH_SEGMENTS = new Set(['.git', '.claude', '.tmp', 'coverage', 'dist', 'node_modules']);

function normalizeRepositoryPath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function isTestLikePath(path) {
  return TEST_LIKE_PATH.test(normalizeRepositoryPath(path));
}

export function vitestProjectForPath(path) {
  const normalized = normalizeRepositoryPath(path);
  if (!RUNNABLE_TEST_PATH.test(normalized)) return null;
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
