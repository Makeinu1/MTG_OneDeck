import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const LEDGER_PATH = 'research/cr-grounding/cr-backbone-ledger.json';
const LOOP_STATE_PATH = '.claude/loop-state.md';
const REQUIRED_LEDGER_KEYS = [
  'object',
  'plannedSequence',
  'domains',
  'selectionRule',
  'statusDefinitions',
  'judgePolicy',
  'goalPolicy',
];

const isObject = (value) => value !== null && typeof value === 'object';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function hashTreeEntries(entries) {
  const hash = createHash('sha256');
  for (const entry of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(`${entry.path}\0`);
    if (entry.kind === 'deleted') hash.update('deleted');
    else if (entry.kind === 'symlink') hash.update(`symlink\0${entry.target ?? ''}`);
    else hash.update(entry.content ?? Buffer.alloc(0));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function computeTreeFingerprint(root, filePaths) {
  const paths =
    filePaths ??
    execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\0')
      .filter(Boolean);
  const entries = paths.map((path) => {
    const absolutePath = resolve(root, path);
    if (!existsSync(absolutePath)) return { path, kind: 'deleted' };
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      return { path, kind: 'symlink', target: readlinkSync(absolutePath) };
    }
    return { path, kind: 'file', content: readFileSync(absolutePath) };
  });
  return hashTreeEntries(entries);
}

const compactDomain = (entry) => {
  if (!entry) return null;
  const result = {};
  for (const key of [
    'id',
    'type',
    'status',
    'crOrder',
    'lane',
    'edhValue',
    'dependsOn',
    'evidence',
    'landingState',
    'boundary',
    'manualBoundary',
    'nextGate',
    'judge',
  ]) {
    if (entry[key] !== undefined) result[key] = entry[key];
  }
  return result;
};

const parseLoopFields = (text) => {
  const fields = {};
  if (typeof text !== 'string') return fields;
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/.exec(line);
    if (match) fields[match[1]] = match[2];
  }
  return fields;
};

export function parseLoopState(text, options = {}) {
  const fields = parseLoopFields(text);
  const reasons = [];
  if (!fields.baseSha) reasons.push('MISSING_BASE_SHA');
  if (!fields.treeFingerprint) reasons.push('MISSING_TREE_FINGERPRINT');
  if (options.headSha && fields.baseSha && fields.baseSha !== options.headSha) {
    reasons.push('BASE_SHA_MISMATCH');
  }
  if (
    options.treeFingerprint &&
    fields.treeFingerprint &&
    fields.treeFingerprint !== options.treeFingerprint
  ) {
    reasons.push('TREE_FINGERPRINT_MISMATCH');
  }
  if (
    fields.milestone &&
    options.domainStatuses?.[fields.milestone] === 'shipped'
  ) {
    reasons.push('MATCHING_DOMAIN_ALREADY_SHIPPED');
  }
  return {
    status: reasons.length === 0 ? 'current' : 'stale',
    milestone: fields.milestone ?? null,
    step: fields.step ?? null,
    baseSha: fields.baseSha ?? null,
    treeFingerprint: fields.treeFingerprint ?? null,
    complete: fields.milestone === 'complete',
    reasons,
  };
}

const validateLedgerShape = (ledger, label) => {
  const errors = [];
  if (!isObject(ledger) || Array.isArray(ledger)) {
    return [{ code: 'INVALID_LEDGER', message: `${label} ledger must be an object` }];
  }
  for (const key of REQUIRED_LEDGER_KEYS) {
    if (!(key in ledger)) {
      errors.push({ code: 'MISSING_LEDGER_KEY', key, message: `${label} is missing ${key}` });
    }
  }
  if (!Array.isArray(ledger.domains)) {
    errors.push({ code: 'INVALID_DOMAINS', message: `${label}.domains must be an array` });
  }
  if (!Array.isArray(ledger.plannedSequence)) {
    errors.push({
      code: 'INVALID_PLANNED_SEQUENCE',
      message: `${label}.plannedSequence must be an array`,
    });
  }
  if (!isObject(ledger.statusDefinitions) || Array.isArray(ledger.statusDefinitions)) {
    errors.push({
      code: 'INVALID_STATUS_DEFINITIONS',
      message: `${label}.statusDefinitions must be an object`,
    });
    return errors;
  }
  const allowedStatuses = new Set(Object.keys(ledger.statusDefinitions));
  const validateStatuses = (entries, idKey, collection) => {
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (!isObject(entry)) continue;
      if (
        typeof entry.status !== 'string' ||
        !allowedStatuses.has(entry.status)
      ) {
        errors.push({
          code: 'INVALID_STATUS',
          label,
          collection,
          domainId: typeof entry[idKey] === 'string' ? entry[idKey] : null,
          status: typeof entry.status === 'string' ? entry.status : null,
        });
      }
    }
  };
  validateStatuses(ledger.domains, 'id', 'domains');
  validateStatuses(ledger.plannedSequence, 'domainId', 'plannedSequence');
  return errors;
};

const mergeLedgerEntries = (ledger, errors) => {
  const domainMap = new Map();
  const sequenceMap = new Map();

  for (const domain of ledger.domains ?? []) {
    if (!isObject(domain) || typeof domain.id !== 'string') {
      errors.push({ code: 'INVALID_DOMAIN_ID', message: 'Every domain requires an id' });
      continue;
    }
    if (domainMap.has(domain.id)) {
      errors.push({ code: 'DUPLICATE_DOMAIN_ID', domainId: domain.id });
      continue;
    }
    domainMap.set(domain.id, domain);
  }
  for (const item of ledger.plannedSequence ?? []) {
    if (!isObject(item) || typeof item.domainId !== 'string') {
      errors.push({
        code: 'INVALID_SEQUENCE_DOMAIN_ID',
        message: 'Every plannedSequence entry requires a domainId',
      });
      continue;
    }
    if (sequenceMap.has(item.domainId)) {
      const previous = sequenceMap.get(item.domainId);
      if (previous.status !== item.status) {
        errors.push({
          code: 'STATUS_MISMATCH',
          domainId: item.domainId,
          domainStatus: domainMap.get(item.domainId)?.status ?? null,
          plannedStatus: `${previous.status}/${item.status}`,
        });
      }
      continue;
    }
    sequenceMap.set(item.domainId, item);
  }

  const merged = new Map();
  for (const id of new Set([...domainMap.keys(), ...sequenceMap.keys()])) {
    const domain = domainMap.get(id);
    const planned = sequenceMap.get(id);
    if (domain && planned && domain.status !== planned.status) {
      errors.push({
        code: 'STATUS_MISMATCH',
        domainId: id,
        domainStatus: domain.status,
        plannedStatus: planned.status,
      });
    }
    merged.set(id, {
      ...(planned ?? {}),
      ...(domain ?? {}),
      id,
      status: domain?.status ?? planned?.status,
      type: planned?.type,
      sequenceIndex: planned ? ledger.plannedSequence.indexOf(planned) : null,
    });
  }
  return { merged, sequenceMap };
};

const dependencyClosure = (domainId, merged, errors) => {
  const result = [];
  const visited = new Set();
  const visiting = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      errors.push({ code: 'DEPENDENCY_CYCLE', domainId: id });
      return;
    }
    const entry = merged.get(id);
    if (!entry) {
      errors.push({ code: 'UNKNOWN_DEPENDENCY', domainId: id });
      return;
    }
    visiting.add(id);
    for (const dependency of entry.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    if (id !== domainId) result.push(entry);
  };
  visit(domainId);
  return result;
};

const isAutomaticCrEntry = (entry) => {
  const type = entry.type ?? '';
  if (type === 'design-slice' || type === 'maintenance' || type === 'checkpoint') {
    return false;
  }
  return typeof entry.crOrder === 'number' && Number.isFinite(entry.crOrder);
};

const chooseDomain = (merged, sequenceMap) => {
  const sequenceEntries = [...sequenceMap.keys()]
    .map((id) => merged.get(id))
    .filter(Boolean);
  const unaudited = sequenceEntries.filter(
    (entry) => entry.status === 'implemented-not-audited',
  );
  if (unaudited.length === 1) {
    return {
      kind: 'selected',
      domainId: unaudited[0].id,
      reason: 'unaudited-implementation-first',
    };
  }
  if (unaudited.length > 1) {
    return {
      kind: 'ambiguous',
      reason: 'multiple-unaudited-implementations',
      candidates: unaudited.map((entry) => entry.id).sort(),
    };
  }

  const eligible = sequenceEntries.filter(
    (entry) =>
      entry.status === 'pending' &&
      isAutomaticCrEntry(entry) &&
      (entry.dependsOn ?? []).every(
        (dependency) => merged.get(dependency)?.status === 'shipped',
      ),
  );
  if (eligible.length === 0) {
    return { kind: 'none', reason: 'no-eligible-pending-normal-commander-domain' };
  }
  const smallestOrder = Math.min(...eligible.map((entry) => entry.crOrder));
  const sameRank = eligible.filter((entry) => entry.crOrder === smallestOrder);
  if (sameRank.length > 1) {
    return {
      kind: 'ambiguous',
      reason: 'same-cr-order',
      crOrder: smallestOrder,
      candidates: sameRank.map((entry) => entry.id).sort(),
    };
  }
  return {
    kind: 'selected',
    domainId: sameRank[0].id,
    reason: 'earliest-eligible-cr-order',
    crOrder: smallestOrder,
  };
};

export function buildContextProjection({
  ledger,
  headLedger,
  headSha,
  sourceSha256,
  domainId,
  loopStateText = '',
  treeFingerprint,
}) {
  const errors = [
    ...validateLedgerShape(ledger, 'working tree'),
    ...validateLedgerShape(headLedger, 'HEAD'),
  ];
  const liveDomainCount = Array.isArray(ledger?.domains) ? ledger.domains.length : 0;
  const liveSequenceCount = Array.isArray(ledger?.plannedSequence)
    ? ledger.plannedSequence.length
    : 0;
  const headDomainCount = Array.isArray(headLedger?.domains) ? headLedger.domains.length : 0;
  const headSequenceCount = Array.isArray(headLedger?.plannedSequence)
    ? headLedger.plannedSequence.length
    : 0;
  if (liveDomainCount < headDomainCount) {
    errors.push({
      code: 'DOMAIN_COUNT_DECREASE',
      workingTree: liveDomainCount,
      head: headDomainCount,
    });
  }
  if (liveSequenceCount < headSequenceCount) {
    errors.push({
      code: 'PLANNED_SEQUENCE_COUNT_DECREASE',
      workingTree: liveSequenceCount,
      head: headSequenceCount,
    });
  }

  const safeLedger = isObject(ledger)
    ? {
        ...ledger,
        domains: Array.isArray(ledger.domains) ? ledger.domains : [],
        plannedSequence: Array.isArray(ledger.plannedSequence)
          ? ledger.plannedSequence
          : [],
      }
    : { domains: [], plannedSequence: [] };
  const { merged, sequenceMap } = mergeLedgerEntries(safeLedger, errors);
  let selection;
  if (domainId) {
    selection = merged.has(domainId)
      ? { kind: 'selected', domainId, reason: 'explicit-domain' }
      : { kind: 'integrity-error', reason: 'unknown-explicit-domain', domainId };
    if (!merged.has(domainId)) {
      errors.push({ code: 'UNKNOWN_DOMAIN', domainId });
    }
  } else {
    selection = chooseDomain(merged, sequenceMap);
  }
  if (errors.length > 0) {
    selection = { kind: 'integrity-error', reason: 'ledger-integrity-failed' };
  }

  const selected = selection.kind === 'selected' ? merged.get(selection.domainId) : null;
  const dependencyErrors = [];
  const dependencies = selected
    ? dependencyClosure(selected.id, merged, dependencyErrors)
    : [];
  errors.push(...dependencyErrors);
  if (dependencyErrors.length > 0) {
    selection = { kind: 'integrity-error', reason: 'dependency-integrity-failed' };
  }
  const domainStatuses = Object.fromEntries(
    [...merged].map(([id, entry]) => [id, entry.status]),
  );

  return {
    ledgerSha256: sourceSha256,
    headSha,
    treeFingerprint,
    counts: {
      domains: { workingTree: liveDomainCount, head: headDomainCount },
      plannedSequence: { workingTree: liveSequenceCount, head: headSequenceCount },
    },
    health: { ok: errors.length === 0, errors },
    selection,
    domain: compactDomain(selected),
    dependencies: dependencies.map(compactDomain),
    canonicalPaths: [
      'AGENTS.md',
      'docs/judge-protocol.md',
      LEDGER_PATH,
      LOOP_STATE_PATH,
      '.agents/skills/mtg-onedeck-development/SKILL.md',
      '.agents/skills/mtg-onedeck-development/references/cycle.md',
      '.agents/skills/mtg-onedeck-development/references/token-economy.md',
    ],
    loopState: parseLoopState(loopStateText, {
      headSha,
      treeFingerprint,
      domainStatuses,
    }),
  };
}

const parseArguments = (argv) => {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--domain') throw new Error(`Unknown argument: ${argv[index]}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error('Missing value for --domain');
    result.domain = value;
    index += 1;
  }
  return result;
};

const git = (root, args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

export function createContextProjection(root, domainId) {
  const ledgerText = readFileSync(resolve(root, LEDGER_PATH), 'utf8');
  let ledger;
  let headLedger;
  try {
    ledger = JSON.parse(ledgerText);
  } catch {
    throw new Error(`Invalid JSON: ${LEDGER_PATH}`);
  }
  try {
    headLedger = JSON.parse(git(root, ['show', `HEAD:${LEDGER_PATH}`]));
  } catch {
    throw new Error(`Unable to read HEAD:${LEDGER_PATH}`);
  }
  const headSha = git(root, ['rev-parse', 'HEAD']);
  const treeFingerprint = computeTreeFingerprint(root);
  const loopStatePath = resolve(root, LOOP_STATE_PATH);
  return buildContextProjection({
    ledger,
    headLedger,
    headSha,
    sourceSha256: sha256(ledgerText),
    domainId,
    loopStateText: existsSync(loopStatePath) ? readFileSync(loopStatePath, 'utf8') : '',
    treeFingerprint,
  });
}

export function contextExitCode(projection) {
  if (!projection?.health?.ok) return 2;
  if (projection.selection?.kind === 'ambiguous') return 3;
  if (projection.selection?.kind === 'none') return 4;
  if (projection.loopState?.status === 'stale') return 5;
  return 0;
}

export function runContextCli(argv = process.argv.slice(2), root = process.cwd()) {
  const args = parseArguments(argv);
  const projection = createContextProjection(root, args.domain);
  const output = `${JSON.stringify(projection, null, 2)}\n`;
  if (projection.health.ok && Buffer.byteLength(output) > 12 * 1024) {
    throw new Error('Successful context projection exceeds 12 KiB');
  }
  process.stdout.write(output);
  process.exitCode = contextExitCode(projection);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runContextCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
