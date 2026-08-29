#!/usr/bin/env node
// Small, read-only safety scan for changed paths and added text.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HARD_FORBIDDEN = Object.freeze([
  { test: (path) => /(^|\/)\.env(?:\.|$)/i.test(path), reason: 'environment/secret file' },
  { test: (path) => /(^|\/)id_rsa(?:$|\.)|\.(?:pem|key)$/i.test(path), reason: 'private key material' },
  { test: (path) => /(^|\/)(?:node_modules|dist|coverage|\.tmp|tmp)(?:\/|$)/i.test(path), reason: 'generated or dependency output' },
  { test: (path) => /(^|\/)(?:delete|destroy|drop|truncate)(?:[-_.]|\/)/i.test(path), reason: 'destructive path name' },
]);

const PROTECTED = Object.freeze([
  { test: (path) => /^\.github\/workflows\//.test(path), label: 'deploy workflow' },
  { test: (path) => /(^|\/)(?:wrangler|worker|security|auth|capability)/i.test(path), label: 'runtime/security surface' },
  { test: (path) => /^src\/online\/(?:cloudflare|publicApp)\//.test(path), label: 'online security/runtime' },
  { test: (path) => /^docs\/contracts\//.test(path), label: 'contract' },
]);

const SECRET_PATTERNS = Object.freeze([
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:ghp|github_pat|xox[baprs])_[A-Za-z0-9_\-]{12,}\b/i,
  /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'`]?[A-Za-z0-9+/=_\-.]{20,}/i,
]);

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
}

export function parseArgs(args) {
  if (args.length === 0) return { diff: null };
  if (args.length === 2 && args[0] === '--diff' && args[1] && !args[1].startsWith('--')) return { diff: args[1] };
  throw new Error('Usage: check:forbidden [--diff <base>]');
}

function changedPaths(cwd, base) {
  const paths = [];
  if (base) paths.push(...git(cwd, ['diff', '--name-only', '--diff-filter=ACDMRTUXB', base, '--']).split(/\r?\n/u).filter(Boolean));
  paths.push(...git(cwd, ['diff', '--name-only', '--diff-filter=ACDMRTUXB', '--']).split(/\r?\n/u).filter(Boolean));
  paths.push(...git(cwd, ['diff', '--cached', '--name-only', '--diff-filter=ACDMRTUXB', '--']).split(/\r?\n/u).filter(Boolean));
  paths.push(...git(cwd, ['ls-files', '--others', '--exclude-standard']).split(/\r?\n/u).filter(Boolean));
  return [...new Set(paths.map((path) => path.replaceAll('\\', '/')).filter(Boolean))].sort();
}

function addedText(cwd, base, paths) {
  const chunks = [];
  if (base) chunks.push(git(cwd, ['diff', '--no-color', '--unified=0', base, '--']));
  else {
    chunks.push(git(cwd, ['diff', '--no-color', '--unified=0', '--']));
    chunks.push(git(cwd, ['diff', '--cached', '--no-color', '--unified=0', '--']));
  }
  for (const path of paths) {
    if (!existsSync(resolve(cwd, path))) continue;
    try {
      git(cwd, ['ls-files', '--error-unmatch', path]);
    } catch {
      chunks.push(`+++ ${path}\n${readFileSync(resolve(cwd, path), 'utf8').split(/\r?\n/u).map((line) => `+${line}`).join('\n')}`);
    }
  }
  const lines = chunks.join('\n').split(/\r?\n/u);
  return lines
    .filter((line, index) => {
      if (!line.startsWith('+')) return false;
      // A unified diff header is the `--- path` / `+++ path` pair. Added
      // content may itself begin with `+++`, so do not discard it by prefix.
      const previous = lines[index - 1];
      return !(line.startsWith('+++ ') && previous?.startsWith('--- '));
    })
    .join('\n');
}

export function scanDiff({ cwd = process.cwd(), base = null, diff = null } = {}) {
  const resolvedBase = diff?.base ?? base;
  const paths = changedPaths(cwd, resolvedBase);
  const findings = [];
  for (const path of paths) {
    if (path.startsWith('/') || path === '..' || path.startsWith('../')) findings.push({ code: 'UNSAFE_PATH', path });
    for (const rule of HARD_FORBIDDEN) if (rule.test(path)) findings.push({ code: 'FORBIDDEN_PATH', path, reason: rule.reason });
    try {
      if (lstatSync(resolve(cwd, path)).isSymbolicLink()) findings.push({ code: 'SYMLINK_PATH', path });
    } catch {
      // Deleted paths are valid diff members and need no filesystem read.
    }
  }
  const text = addedText(cwd, resolvedBase, paths);
  for (const pattern of SECRET_PATTERNS) if (pattern.test(text)) findings.push({ code: 'SECRET_LIKE_ADDED_TEXT' });
  const protectedPaths = paths
    .filter((path) => PROTECTED.some((rule) => rule.test(path)))
    .map((path) => ({ path, labels: PROTECTED.filter((rule) => rule.test(path)).map((rule) => rule.label) }));
  return { ok: findings.length === 0, paths, findings, protectedPaths };
}

export function runForbiddenCheck(options = {}) {
  const report = scanDiff(options);
  for (const protectedPath of report.protectedPaths) console.log(`NOTICE protected path: ${protectedPath.path} (${protectedPath.labels.join(', ')})`);
  if (!report.ok) {
    for (const finding of report.findings) console.error(`FAIL ${finding.code}${finding.path ? `: ${finding.path}` : ''}${finding.reason ? ` (${finding.reason})` : ''}`);
    return 1;
  }
  console.log(`forbidden-check: PASS (${report.paths.length} changed path${report.paths.length === 1 ? '' : 's'})`);
  return 0;
}

function runCli() {
  try {
    process.exitCode = runForbiddenCheck({ base: parseArgs(process.argv.slice(2)).diff });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
