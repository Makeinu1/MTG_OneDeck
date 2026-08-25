#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { collectChangedFiles } from './change-detector.mjs';

export const LEDGER_PATH = 'research/cr-grounding/cr-backbone-ledger.json';
export const LOOP_STATE_PATH = '.claude/loop-state.md';
export const TERMINAL_ALLOWED_PATHS = Object.freeze([LOOP_STATE_PATH, LEDGER_PATH]);
export const TERMINAL_FIELDS = Object.freeze([
  'status',
  'evidence',
  'terminalEvidence',
  'nextGate',
  'terminalNextGate',
  'judge',
  'note',
  'usage',
  'measurementStatus',
  'modelCycles',
  'cachedInputTokens',
  'uncachedInputTokens',
  'compactions',
  'repairWaves',
  'fullChecks',
  'ciRuns',
  'elapsedMs',
]);

const REQUIRED_USAGE_FIELDS = Object.freeze([
  'modelCycles',
  'cachedInputTokens',
  'uncachedInputTokens',
  'compactions',
  'repairWaves',
  'fullChecks',
  'ciRuns',
  'elapsedMs',
]);
const TERMINAL_FIELD_SET = new Set(TERMINAL_FIELDS);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = (value) => createHash('sha256').update(value).digest('hex');

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const stripTerminalEntryFields = (entry) =>
  Object.fromEntries(Object.entries(entry).filter(([key]) => !TERMINAL_FIELD_SET.has(key)));

export const semanticLedger = (ledger) => ({
  ...ledger,
  domains: (ledger?.domains ?? []).map(stripTerminalEntryFields),
  plannedSequence: (ledger?.plannedSequence ?? []).map(stripTerminalEntryFields),
});

const terminalFields = (entry) =>
  Object.fromEntries(TERMINAL_FIELDS.filter((key) => key in entry).map((key) => [key, entry[key]]));

const gitText = (root, args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const readBaseText = (root, baseSha, path) => {
  try {
    return gitText(root, ['show', `${baseSha}:${path}`]);
  } catch {
    return null;
  }
};

const readCandidateEntry = (root, path) => {
  const absolute = resolve(root, path);
  let stat;
  try {
    stat = lstatSync(absolute);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return { kind: 'deleted' };
    throw error;
  }
  if (stat.isSymbolicLink()) return { kind: 'symlink', target: readlinkSync(absolute) };
  return { kind: 'file', content: readFileSync(absolute) };
};

const candidatePaths = (root) =>
  gitText(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .sort();

const hashEntries = (entries) => {
  const digest = createHash('sha256');
  for (const entry of entries.sort((a, b) => a.path.localeCompare(b.path))) {
    digest.update(`${entry.path}\0${entry.kind}\0`);
    if (entry.target !== undefined) digest.update(entry.target);
    if (entry.content !== undefined) digest.update(entry.content);
    digest.update('\0');
  }
  return digest.digest('hex');
};

function parseJson(text, label, errors) {
  try {
    return JSON.parse(text);
  } catch {
    errors.push({ code: 'INVALID_JSON', path: label });
    return null;
  }
}

const entriesById = (ledger, collection) => {
  const idKey = collection === 'domains' ? 'id' : 'domainId';
  return new Map((ledger?.[collection] ?? []).map((entry) => [entry?.[idKey], entry]));
};

const usageFor = (entry) => (isObject(entry?.usage) ? entry.usage : entry);

function validateStructuredUsage(baseLedger, candidateLedger, errors) {
  const program = candidateLedger?.goalPolicy?.activeProgram;
  const ids = Array.isArray(program?.domainIds) ? program.domainIds : [];
  const enforceIndex = ids.indexOf(program?.usagePolicy?.enforceFromDomainId);
  if (enforceIndex < 0) return;
  const before = entriesById(baseLedger, 'domains');
  const after = entriesById(candidateLedger, 'domains');
  for (let index = enforceIndex; index < ids.length; index += 1) {
    const id = ids[index];
    const prior = before.get(id);
    const next = after.get(id);
    if (prior?.status === 'shipped' || next?.status !== 'shipped') continue;
    const usage = usageFor(next);
    for (const field of REQUIRED_USAGE_FIELDS) {
      if (typeof usage?.[field] !== 'number' || !Number.isFinite(usage[field]) || usage[field] < 0) {
        errors.push({ code: 'INVALID_STRUCTURED_USAGE', domainId: id, field });
      }
    }
    if (usage?.measurementStatus === 'historical-unavailable') {
      errors.push({ code: 'HISTORICAL_USAGE_NOT_ALLOWED', domainId: id });
    }
  }
}

function validateTerminalTransitions(baseLedger, candidateLedger, reasons) {
  const allowedStatuses = new Set(Object.keys(candidateLedger?.statusDefinitions ?? {}));
  const collections = ['domains', 'plannedSequence'];
  const maps = Object.fromEntries(collections.flatMap((collection) => [
    [`base:${collection}`, entriesById(baseLedger, collection)],
    [`candidate:${collection}`, entriesById(candidateLedger, collection)],
  ]));
  for (const collection of collections) {
    for (const [id, entry] of maps[`candidate:${collection}`]) {
      if (!allowedStatuses.has(entry?.status)) {
        reasons.push({ code: 'INVALID_TERMINAL_STATUS', collection, domainId: id, status: entry?.status ?? null });
      }
    }
  }
  for (const id of new Set([
    ...maps['candidate:domains'].keys(),
    ...maps['candidate:plannedSequence'].keys(),
  ])) {
    const beforeDomain = maps['base:domains'].get(id);
    const beforeSequence = maps['base:plannedSequence'].get(id);
    const afterDomain = maps['candidate:domains'].get(id);
    const afterSequence = maps['candidate:plannedSequence'].get(id);
    const domainChanged = stableStringify(terminalFields(afterDomain ?? {}))
      !== stableStringify(terminalFields(beforeDomain ?? {}));
    const sequenceChanged = stableStringify(terminalFields(afterSequence ?? {}))
      !== stableStringify(terminalFields(beforeSequence ?? {}));
    if (!domainChanged && !sequenceChanged) continue;
    if (
      !beforeDomain || !beforeSequence || !afterDomain || !afterSequence ||
      !domainChanged || !sequenceChanged ||
      stableStringify(terminalFields(afterDomain)) !== stableStringify(terminalFields(afterSequence))
    ) {
      reasons.push({ code: 'UNSYNCHRONIZED_TERMINAL_METADATA', domainId: id });
      continue;
    }
    const beforeStatus = beforeDomain.status;
    const afterStatus = afterDomain.status;
    if (beforeStatus === 'shipped' && afterStatus !== 'shipped') {
      reasons.push({ code: 'SHIPPED_STATUS_REGRESSION', domainId: id, from: beforeStatus, to: afterStatus });
    } else if (beforeStatus !== afterStatus && !(beforeStatus === 'audited' && afterStatus === 'shipped')) {
      reasons.push({ code: 'INVALID_TERMINAL_STATUS_TRANSITION', domainId: id, from: beforeStatus, to: afterStatus });
    }
  }
}

export function computeCandidateFingerprints({ root = process.cwd(), ledger } = {}) {
  const candidateLedger = ledger ?? JSON.parse(readFileSync(resolve(root, LEDGER_PATH), 'utf8'));
  const semanticEntries = [];
  for (const path of candidatePaths(root)) {
    if (path === LOOP_STATE_PATH) continue;
    const entry = readCandidateEntry(root, path);
    if (entry.kind === 'deleted') continue;
    if (path === LEDGER_PATH && entry.kind === 'file') {
      semanticEntries.push({ path, kind: 'file', content: stableStringify(semanticLedger(candidateLedger)) });
    } else semanticEntries.push({ path, ...entry });
  }
  const ledgerTerminal = {};
  for (const collection of ['domains', 'plannedSequence']) {
    ledgerTerminal[collection] = (candidateLedger?.[collection] ?? []).map((entry) => ({
      id: entry?.[collection === 'domains' ? 'id' : 'domainId'] ?? null,
      fields: terminalFields(entry ?? {}),
    }));
  }
  const loopText = existsSync(resolve(root, LOOP_STATE_PATH))
    ? readFileSync(resolve(root, LOOP_STATE_PATH), 'utf8')
    : '';
  return {
    semanticFingerprint: hashEntries(semanticEntries),
    terminalFingerprint: hash(`${stableStringify(ledgerTerminal)}\0${loopText}`),
  };
}

export function verifyTerminalMetadata({ root = process.cwd(), base, head = 'HEAD', requireTerminal = false } = {}) {
  const reasons = [];
  let changes;
  try {
    changes = collectChangedFiles({ cwd: root, base, head });
  } catch (error) {
    return {
      ok: false,
      lane: 'semantic',
      baseSha: null,
      headSha: null,
      changedPaths: [],
      semanticFingerprint: null,
      terminalFingerprint: null,
      errors: [{ code: 'INVALID_BASE', message: error instanceof Error ? error.message : String(error) }],
    };
  }
  for (const path of changes.files) {
    if (!TERMINAL_ALLOWED_PATHS.includes(path)) reasons.push({ code: 'NON_TERMINAL_PATH', path });
  }
  const candidateText = existsSync(resolve(root, LEDGER_PATH))
    ? readFileSync(resolve(root, LEDGER_PATH), 'utf8')
    : '';
  const baseText = readBaseText(root, changes.base, LEDGER_PATH);
  const parseErrors = [];
  const candidateLedger = parseJson(candidateText, LEDGER_PATH, parseErrors);
  const baseLedger = baseText === null ? null : parseJson(baseText, `${changes.base}:${LEDGER_PATH}`, parseErrors);
  if (candidateLedger && baseLedger) {
    if (stableStringify(semanticLedger(candidateLedger)) !== stableStringify(semanticLedger(baseLedger))) {
      reasons.push({ code: 'SEMANTIC_LEDGER_CHANGE' });
    }
    validateTerminalTransitions(baseLedger, candidateLedger, reasons);
    validateStructuredUsage(baseLedger, candidateLedger, reasons);
  }
  let fingerprints = { semanticFingerprint: null, terminalFingerprint: null };
  if (candidateLedger) fingerprints = computeCandidateFingerprints({ root, ledger: candidateLedger });
  const lane = reasons.length === 0 && parseErrors.length === 0 ? 'terminal' : 'semantic';
  const errors = [...parseErrors];
  if (requireTerminal && lane !== 'terminal') errors.push(...reasons);
  return {
    ok: errors.length === 0,
    lane,
    baseSha: changes.base,
    headSha: changes.head,
    changedPaths: changes.files,
    ...fingerprints,
    reasons,
    errors,
  };
}

function parseArguments(argv) {
  const options = { head: 'HEAD', requireTerminal: false };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (seen.has(argument)) {
      throw new Error('usage: terminal-metadata.mjs --base <sha> [--head <ref>] --json [--require-terminal]');
    }
    seen.add(argument);
    if (argument === '--json') continue;
    if (argument === '--require-terminal') {
      options.requireTerminal = true;
      continue;
    }
    if (argument === '--base' || argument === '--head') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('usage: terminal-metadata.mjs --base <sha> [--head <ref>] --json [--require-terminal]');
      }
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error('usage: terminal-metadata.mjs --base <sha> [--head <ref>] --json [--require-terminal]');
  }
  if (!options.base) {
    throw new Error('usage: terminal-metadata.mjs --base <sha> [--head <ref>] --json [--require-terminal]');
  }
  return options;
}

export function runTerminalMetadataCli(argv = process.argv.slice(2), root = process.cwd()) {
  const report = verifyTerminalMetadata({ root, ...parseArguments(argv) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runTerminalMetadataCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
