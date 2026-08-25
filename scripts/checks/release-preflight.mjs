#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

import { createContextProjection } from '../codex-context.mjs';
import { collectChangedFiles } from './change-detector.mjs';
import { computeCandidateFingerprints, LOOP_STATE_PATH } from './terminal-metadata.mjs';

const GENERATED_API_PATH = 'docs/generated/engine-api.md';
const WORKFLOW_PATH = '.github/workflows/deploy-pages.yml';
const SECRET_MATERIAL = /\b[0-9a-f]{32}\b|gh[opsu]_[A-Za-z0-9]{20,}|Bearer[ \t]+[A-Za-z0-9._~-]{8,}|(?:capability|token|secret|authorization|account(?:Id|_id| identifier))[ \t]*[:=][ \t]*\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----/i;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const git = (root, args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const isReviewPath = (path) => /(^|\/|\.)review\./.test(path);

export function ownerViolation(path, owner) {
  if (owner === 'judge') return null;
  if (isReviewPath(path)) return 'review files are Judge-owned';
  if (/^(?:AGENTS|CLAUDE|QWEN)\.md$/.test(path)) return 'governance entry is Judge-owned';
  if (/^(?:docs|research|rule)\//.test(path)) return 'authority/evidence path is Judge-owned';
  if (path === LOOP_STATE_PATH) return 'loop state is Judge-owned';
  if (path === 'package.json' || path === 'package-lock.json') return 'package files are Judge-owned';
  if (path === 'eslint.config.js' || path.startsWith('.github/')) return 'configuration is Judge-owned';
  return null;
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

export function addedText(root, baseSha, path, untrackedPaths = new Set()) {
  if (!existsSync(resolve(root, path))) return '';
  if (untrackedPaths.has(path)) return readFileSync(resolve(root, path), 'utf8');
  try {
    return git(root, ['diff', '--unified=0', '--no-ext-diff', baseSha, '--', path])
      .split(/\r?\n/)
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.slice(1))
      .join('\n');
  } catch {
    return readFileSync(resolve(root, path), 'utf8');
  }
}

export function checkGeneratedApi(root) {
  const result = spawnSync(process.execPath, ['scripts/checks/generate-engine-api.mjs', '--check'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0 && !result.error && !result.signal;
}

export function fixedNextGuardPaths(root, programId) {
  const roots = [resolve(root, 'scripts/__tests__'), resolve(root, 'src/test')];
  const hasFixedNextExpectation = (path, text) => {
    const source = ts.createSourceFile(
      path,
      text,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const values = new Map();
    const helpers = new Map();
    const literal = (node) => {
      if (!node) return null;
      if (ts.isStringLiteralLike(node)) return node.text;
      if (ts.isIdentifier(node)) return values.get(node.text) ?? null;
      if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        return literal(node.expression);
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments.length === 0) {
        return helpers.get(node.expression.text) ?? null;
      }
      return null;
    };
    const returnedLiteral = (body) => {
      if (!body) return null;
      if (!ts.isBlock(body)) return literal(body);
      const statement = body.statements.find(ts.isReturnStatement);
      return statement ? literal(statement.expression) : null;
    };
    const collect = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const value = literal(node.initializer);
        if (value !== null) values.set(node.name.text, value);
        if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
          const helperValue = returnedLiteral(node.initializer.body);
          if (node.initializer.parameters.length === 0 && helperValue !== null) helpers.set(node.name.text, helperValue);
        }
      }
      if (ts.isFunctionDeclaration(node) && node.name && node.parameters.length === 0) {
        const helperValue = returnedLiteral(node.body);
        if (helperValue !== null) helpers.set(node.name.text, helperValue);
      }
      ts.forEachChild(node, collect);
    };
    collect(source);
    let fixed = false;
    const inspect = (node) => {
      if (fixed) return;
      if (
        ts.isPropertyAssignment(node) &&
        ((ts.isIdentifier(node.name) && node.name.text === 'nextDomainId') ||
          (ts.isStringLiteralLike(node.name) && node.name.text === 'nextDomainId')) &&
        literal(node.initializer) !== null
      ) fixed = true;
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ['toBe', 'toEqual'].includes(node.expression.name.text) &&
        ts.isCallExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        node.expression.expression.expression.text === 'expect'
      ) {
        const actual = node.expression.expression.arguments[0];
        if (
          actual?.getText(source).includes('activeProgram') &&
          actual.getText(source).includes('nextDomainId') &&
          literal(node.arguments[0]) !== null
        ) fixed = true;
      }
      ts.forEachChild(node, inspect);
    };
    inspect(source);
    return fixed;
  };
  return roots
    .flatMap(walk)
    .filter((path) => isReviewPath(relative(root, path).replaceAll('\\', '/')))
    .filter((path) => {
      const text = readFileSync(path, 'utf8');
      const relativePath = relative(root, path).replaceAll('\\', '/');
      return (
        !relativePath.includes('review.gov-codex-57-') &&
        text.includes(programId) &&
        text.includes('activeProgram') &&
        hasFixedNextExpectation(relativePath, text)
      );
    })
    .map((path) => relative(root, path).replaceAll('\\', '/'))
    .sort();
}

export function workflowHasCorrectDiffBase(root) {
  const path = resolve(root, WORKFLOW_PATH);
  if (!existsSync(path)) return false;
  const text = readFileSync(path, 'utf8');
  const allLines = text.split(/\r?\n/);
  const jobsIndex = allLines.findIndex((line) => /^jobs:\s*$/.test(line));
  const buildIndex = allLines.findIndex((line, index) => index > jobsIndex && /^  build:\s*$/.test(line));
  if (jobsIndex < 0 || buildIndex < 0) return false;
  const nextJobOffset = allLines.slice(buildIndex + 1).findIndex((line) => /^  [A-Za-z0-9_-]+:\s*$/.test(line));
  const buildEnd = nextJobOffset < 0 ? allLines.length : buildIndex + 1 + nextJobOffset;
  const lines = allLines.slice(buildIndex, buildEnd).filter((line) => !/^\s*#/.test(line));
  const steps = [];
  for (const line of lines) {
    const start = /^\s{6}-\s+(.*)$/.exec(line);
    if (start) {
      steps.push({ text: start[1] });
      continue;
    }
    if (steps.length > 0 && /^\s{8,}\S/.test(line)) steps.at(-1).text += `\n${line.trim()}`;
  }
  const indexOf = (predicate) => steps.findIndex((step) => predicate(step.text));
  const checkout = indexOf((value) => /uses:\s*actions\/checkout@/.test(value));
  const diffBase = indexOf((value) => (
    /(?:^|\n)id:\s*diff-base(?:\n|$)/.test(value) &&
    /run:\s*node scripts\/checks\/resolve-diff-base\.mjs --before/.test(value) &&
    /--head/.test(value)
  ));
  const changeLane = indexOf((value) => (
    /(?:^|\n)id:\s*change-lane(?:\n|$)/.test(value) &&
    /(?:check:terminal-metadata|scripts\/checks\/terminal-metadata\.mjs)/.test(value) &&
    /steps\.diff-base\.outputs\.base/.test(value)
  ));
  const forbidden = indexOf((value) => (
    /run:\s*npm run check:forbidden -- --diff/.test(value) &&
    /steps\.diff-base\.outputs\.base/.test(value)
  ));
  return (
    checkout >= 0 && /fetch-depth:\s*0/.test(steps[checkout].text) &&
    diffBase > checkout && changeLane > diffBase && forbidden > changeLane
  );
}

function reviewHashes(root, changedPaths) {
  return changedPaths
    .filter(isReviewPath)
    .filter((path) => existsSync(resolve(root, path)))
    .map((path) => ({ path, sha256: sha256(readFileSync(resolve(root, path))) }));
}

export function buildReleasePreflight({ root = process.cwd(), base, domain, owner } = {}) {
  const errors = [];
  let changes;
  try {
    changes = collectChangedFiles({ cwd: root, base });
  } catch (error) {
    return {
      ok: false,
      environment: { root: resolve(root), node: process.version, platform: process.platform, arch: process.arch },
      baseSha: null,
      headSha: null,
      domain: domain ?? null,
      owner: owner ?? null,
      changedPaths: [],
      semanticFingerprint: null,
      terminalFingerprint: null,
      checks: {},
      reviewHashes: [],
      errors: [{ code: 'INVALID_BASE', message: error instanceof Error ? error.message : String(error) }],
    };
  }
  let projection = null;
  try {
    projection = createContextProjection(root, domain);
    if (!projection.health.ok || projection.selection?.kind !== 'selected') {
      errors.push({ code: 'UNHEALTHY_CONTEXT_PROJECTION' });
    }
    if (projection.selection?.domainId !== domain) {
      errors.push({ code: 'DOMAIN_SELECTION_MISMATCH', expected: domain, actual: projection.selection?.domainId ?? null });
    }
    if (projection.loopState?.status !== 'current') {
      errors.push({ code: 'STALE_LOOP_STATE', reasons: projection.loopState?.reasons ?? [] });
    }
  } catch (error) {
    errors.push({ code: 'CONTEXT_PROJECTION_FAILED', message: error instanceof Error ? error.message : String(error) });
  }
  const untrackedPaths = new Set(
    git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean),
  );
  for (const path of changes.files) {
    const reason = ownerViolation(path, owner);
    if (reason) errors.push({ code: 'OWNER_PATH_VIOLATION', path, owner, reason });
    const added = addedText(root, changes.base, path, untrackedPaths);
    if (added && SECRET_MATERIAL.test(added)) errors.push({ code: 'SECRET_LIKE_CHANGED_TEXT', path });
  }
  const generatedApiCurrent = checkGeneratedApi(root);
  if (!generatedApiCurrent) errors.push({ code: 'STALE_GENERATED_ENGINE_API', path: GENERATED_API_PATH });
  const fixedGuards = fixedNextGuardPaths(root, projection?.activeProgram?.id ?? '');
  for (const path of fixedGuards) errors.push({ code: 'FIXED_ACTIVE_PROGRAM_NEXT_GUARD', path });
  const ciDiffBaseCorrect = workflowHasCorrectDiffBase(root);
  if (!ciDiffBaseCorrect) errors.push({ code: 'INCORRECT_CI_DIFF_BASE', path: WORKFLOW_PATH });
  const terminalPlanPresent = existsSync(resolve(root, LOOP_STATE_PATH));
  if (!terminalPlanPresent) errors.push({ code: 'MISSING_TERMINAL_PLAN', path: LOOP_STATE_PATH });
  let fingerprints = { semanticFingerprint: null, terminalFingerprint: null };
  try {
    fingerprints = computeCandidateFingerprints({ root });
  } catch (error) {
    errors.push({ code: 'FINGERPRINT_FAILED', message: error instanceof Error ? error.message : String(error) });
  }
  if (!fingerprints.semanticFingerprint) errors.push({ code: 'MISSING_SEMANTIC_FINGERPRINT' });
  if (!fingerprints.terminalFingerprint) errors.push({ code: 'MISSING_TERMINAL_FINGERPRINT' });
  return {
    ok: errors.length === 0,
    environment: { root: resolve(root), node: process.version, platform: process.platform, arch: process.arch },
    baseSha: changes.base,
    headSha: changes.head,
    domain,
    owner,
    changedPaths: changes.files,
    semanticFingerprint: fingerprints.semanticFingerprint,
    terminalFingerprint: fingerprints.terminalFingerprint,
    checks: {
      baseAncestor: true,
      contextHealthy: projection?.health?.ok === true,
      loopStateCurrent: projection?.loopState?.status === 'current',
      generatedApiCurrent,
      fixedNextGuardsAbsent: fixedGuards.length === 0,
      ciDiffBaseCorrect,
      terminalPlanPresent,
      secretLikeChangedTextAbsent: !errors.some((error) => error.code === 'SECRET_LIKE_CHANGED_TEXT'),
      ownerPathsValid: !errors.some((error) => error.code === 'OWNER_PATH_VIOLATION'),
    },
    reviewHashes: reviewHashes(root, changes.files),
    errors,
  };
}

function parseArguments(argv) {
  const options = {};
  const allowed = new Set(['--base', '--domain', '--owner']);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value || value.startsWith('--') || options[key.slice(2)] !== undefined) {
      throw new Error('usage: release-preflight.mjs --base <sha> --domain <id> --owner <judge|implementer>');
    }
    options[key.slice(2)] = value;
  }
  if (Object.keys(options).length !== 3 || !['judge', 'implementer'].includes(options.owner)) {
    throw new Error('usage: release-preflight.mjs --base <sha> --domain <id> --owner <judge|implementer>');
  }
  return options;
}

export function runReleasePreflightCli(argv = process.argv.slice(2), root = process.cwd()) {
  const report = buildReleasePreflight({ root, ...parseArguments(argv) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runReleasePreflightCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
