#!/usr/bin/env node
/**
 * Read-only release gate. It validates a clean checkout and exact HEAD, then
 * runs the explicit-diff safety scan before the ordinary semantic checks. The
 * gate never edits tracked files (build output remains the normal ignored
 * dist/ artifact).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { constants as osConstants } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { runForbiddenCheck } from './forbidden-files.mjs';

export const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const usage = 'Usage: npm run check:release -- [--base <sha>] [--head <sha>] [--build-base=<path>]';

export function parseArgs(args) {
  const options = { base: null, head: 'HEAD', buildBase: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--base' || argument === '--head') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`missing value for ${argument}`);
      const key = argument.slice(2);
      if (options[key] !== (key === 'head' ? 'HEAD' : null)) throw new Error(`duplicate ${argument}`);
      options[key] = value;
      index += 1;
      continue;
    }
    if (argument.startsWith('--build-base=')) {
      if (options.buildBase !== null || argument.length === '--build-base='.length) throw new Error('duplicate or empty --build-base');
      options.buildBase = argument.slice('--build-base='.length);
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
}

function resolveObject(cwd, ref, label) {
  let objectSha;
  try {
    objectSha = git(cwd, ['rev-parse', '--verify', `${ref}^{object}`]);
  } catch {
    throw new Error(`invalid ${label}: ${ref}`);
  }
  let type;
  try {
    type = git(cwd, ['cat-file', '-t', objectSha]);
  } catch {
    throw new Error(`invalid ${label}: ${ref}`);
  }
  return { ref, objectSha, type };
}

function resolveCommit(cwd, ref, label) {
  const object = resolveObject(cwd, ref, label);
  if (object.type !== 'commit') throw new Error(`${label} must resolve to a commit: ${ref}`);
  return object.objectSha;
}

export function assertCleanCheckout(cwd) {
  const status = git(cwd, ['status', '--porcelain=v1', '--untracked-files=normal']);
  if (status) throw new Error('release checkout must be clean');
}

export function assertHead(cwd, requestedHead) {
  const actual = resolveCommit(cwd, 'HEAD', 'HEAD');
  const expected = resolveCommit(cwd, requestedHead, 'head');
  if (actual !== expected) throw new Error(`HEAD mismatch: expected ${expected}, got ${actual}`);
  return actual;
}

function assertAncestor(cwd, baseSha, headSha) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', baseSha, headSha], { cwd, stdio: 'ignore' });
  } catch {
    throw new Error(`base is not an ancestor of head: ${baseSha} -> ${headSha}`);
  }
}

/** Resolve a release diff while accepting only a commit or the canonical empty tree. */
export function resolveDiff(cwd, base, headSha) {
  if (!base) return null;
  const normalizedBase = base.trim();
  if (normalizedBase === EMPTY_TREE_SHA) {
    const object = resolveObject(cwd, normalizedBase, 'base');
    if (object.type !== 'tree') throw new Error(`base must be the canonical empty tree: ${normalizedBase}`);
    return Object.freeze({ base: EMPTY_TREE_SHA, head: headSha, baseType: 'tree' });
  }
  const object = resolveObject(cwd, normalizedBase, 'base');
  if (object.type !== 'commit') {
    throw new Error(`base must resolve to a commit or the canonical empty tree: ${normalizedBase}`);
  }
  assertAncestor(cwd, object.objectSha, headSha);
  return Object.freeze({ base: object.objectSha, head: headSha, baseType: 'commit' });
}

function signalExitCode(signal) {
  const signalNumber = osConstants.signals?.[signal];
  return typeof signalNumber === 'number' ? 128 + signalNumber : 1;
}

function spawnErrorExitCode(error) {
  if (typeof error?.code === 'number') return error.code;
  if (error?.code === 'ENOENT') return 127;
  if (error?.code === 'EACCES') return 126;
  return 1;
}

function runChildStage(stage, invoke, { error }) {
  let result;
  try {
    result = invoke();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    error(`release-check: ${stage} spawn error: ${message}`);
    return { exitCode: 1, kind: 'spawn-error' };
  }
  if (typeof result?.status === 'number') return { exitCode: result.status, kind: 'exit' };
  if (result?.signal) {
    const exitCode = signalExitCode(result.signal);
    error(`release-check: ${stage} terminated by ${result.signal} (exit ${exitCode})`);
    return { exitCode, kind: 'signal' };
  }
  if (result?.error) {
    const message = result.error instanceof Error ? result.error.message : String(result.error);
    const exitCode = spawnErrorExitCode(result.error);
    error(`release-check: ${stage} spawn error (${result.error.code ?? 'unknown'}; exit ${exitCode}): ${message}`);
    return { exitCode, kind: 'spawn-error' };
  }
  error(`release-check: ${stage} returned no exit status`);
  return { exitCode: 1, kind: 'unknown' };
}

function runForbiddenStage(forbidden, { cwd, diff }, { error }) {
  try {
    const result = forbidden({ cwd, base: diff.base, head: diff.head, diff });
    if (typeof result === 'number') return result;
    if (result && typeof result.exitCode === 'number') return result.exitCode;
    error('release-check: forbidden returned no numeric exit status');
    return 1;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    error(`release-check: forbidden error: ${message}`);
    return 1;
  }
}

export function runReleaseCheck({
  cwd = process.cwd(),
  base = null,
  head = 'HEAD',
  buildBase = null,
  spawn = spawnSync,
  forbidden = runForbiddenCheck,
  write = (line) => console.log(line),
  error = (line) => console.error(line),
} = {}) {
  assertCleanCheckout(cwd);
  const headSha = assertHead(cwd, head);
  const diff = resolveDiff(cwd, base, headSha);
  if (diff) {
    const forbiddenExitCode = runForbiddenStage(forbidden, { cwd, diff }, { error });
    if (forbiddenExitCode !== 0) return { exitCode: forbiddenExitCode, stage: 'forbidden', diff };
  }
  const checkArgs = ['run', 'check'];
  if (buildBase) checkArgs.push('--', `--build-base=${buildBase}`);
  const check = runChildStage('check', () => spawn('npm', checkArgs, { cwd, stdio: 'inherit', shell: false }), { error });
  if (check.exitCode !== 0) return { exitCode: check.exitCode, stage: 'check', diff };
  try {
    assertCleanCheckout(cwd);
  } catch (cause) {
    error(cause instanceof Error ? cause.message : String(cause));
    return { exitCode: 1, stage: 'clean-checkout', diff };
  }
  write(`release-check: PASS (${headSha})`);
  return { exitCode: 0, stage: 'complete', head: headSha, diff };
}

function runCli() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause));
    console.error(usage);
    process.exitCode = 2;
    return;
  }
  try {
    process.exitCode = runReleaseCheck(options).exitCode;
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
