#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { collectChangedFiles } from '../checks/change-detector.mjs';
import { candidateFingerprint } from '../checks/fingerprint.mjs';
import { DEFAULT_ROOT, resolveDomainSelection } from '../checks/validation-domain-resolver.mjs';

export const JOURNEY_FAILURE_CLASSES = Object.freeze([
  'DESIGN',
  'IMPLEMENTATION',
  'EVIDENCE',
  'ENVIRONMENT',
  'AUTHORITY',
]);

export const JOURNEY_NEXT_ACTIONS = Object.freeze([
  'RUN_LOCAL',
  'RETURN_TO_DESIGN',
  'FIX_PRODUCT',
  'REPAIR_EVIDENCE',
  'RETRY_ENVIRONMENT',
  'STOP_FOR_ENVIRONMENT',
  'REINSPECT_CANDIDATE',
  'REQUEST_EXTERNAL_AUTHORITY',
  'RUN_INDEPENDENT_REVIEW',
]);

const FAILURE_CLASS_SET = new Set(JOURNEY_FAILURE_CLASSES);
const PHASES = new Set(['inspect', 'local', 'live']);
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const FAILURE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/u;
const FAILURE_STAGE_PATTERN = /^[a-z0-9][a-z0-9/-]{0,95}$/u;
const TEST_FILE_PATTERN = /^(?:scripts|src)\/.+\.(?:test|spec)\.(?:mjs|ts|tsx)$/u;
const DESIGN_UNDECIDED_PATTERN = /(?:\b(?:TBD|TODO|UNDECIDED|UNKNOWN)\b|未定|未決|要検討)/iu;
const LIVE_SCRIPT_ENTRIES = Object.freeze({
  'evidence:o4p-09i': 'scripts/online/o4p-09i-full-match-evidence.ts',
});
const SAFE_ENVIRONMENT_KEYS = Object.freeze([
  'PATH',
  'TMPDIR',
  'TMP',
  'TEMP',
  'LANG',
  'LC_ALL',
  'TZ',
  'TERM',
  'COLORTERM',
  'O4P06F_CHROME',
  'O4P06F_OPERATOR_TIMEOUT_MS',
]);

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`${label} must be a non-empty string`);
}

function assertExactKeys(value, keys, label) {
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has unsupported fields`);
  }
}

function repositoryPath(value, label) {
  assertString(value, label);
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//u, '');
  const segments = normalized.split('/');
  if (
    normalized.startsWith('/') ||
    segments.some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`${label} must be a safe repository-relative path`);
  }
  return normalized;
}

function validateFailureFields(stage, label) {
  if (!Number.isInteger(stage.timeoutMs) || stage.timeoutMs <= 0)
    throw new Error(`${label}.timeoutMs must be a positive integer`);
  if (!FAILURE_CLASS_SET.has(stage.failureClass) || stage.failureClass === 'AUTHORITY') {
    throw new Error(
      `${label}.failureClass must be DESIGN, IMPLEMENTATION, EVIDENCE, or ENVIRONMENT`,
    );
  }
  if (!/^[A-Z][A-Z0-9_]{0,63}$/u.test(stage.failureCode))
    throw new Error(`${label}.failureCode is invalid`);
}

function validateLocalStage(stage, label) {
  if (stage === null || typeof stage !== 'object' || Array.isArray(stage))
    throw new Error(`${label} must be an object`);
  assertExactKeys(
    stage,
    ['id', 'runner', 'project', 'files', 'timeoutMs', 'failureClass', 'failureCode'],
    label,
  );
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(stage.id)) throw new Error(`${label}.id is invalid`);
  if (stage.runner !== 'vitest') throw new Error(`${label}.runner must be vitest`);
  if (stage.project !== 'core' && stage.project !== 'dom')
    throw new Error(`${label}.project must be core or dom`);
  if (!Array.isArray(stage.files) || stage.files.length === 0)
    throw new Error(`${label}.files must not be empty`);
  const files = stage.files.map((file, index) => repositoryPath(file, `${label}.files[${index}]`));
  if (files.some((file) => !TEST_FILE_PATTERN.test(file)))
    throw new Error(`${label}.files must contain test files only`);
  if (new Set(files).size !== files.length) throw new Error(`${label}.files must be unique`);
  validateFailureFields(stage, label);
}

function validateLiveStage(stage, label) {
  if (stage === null || typeof stage !== 'object' || Array.isArray(stage))
    throw new Error(`${label} must be an object`);
  assertExactKeys(
    stage,
    ['id', 'runner', 'script', 'timeoutMs', 'failureClass', 'failureCode'],
    label,
  );
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(stage.id)) throw new Error(`${label}.id is invalid`);
  if (stage.runner !== 'tsx-entry') throw new Error(`${label}.runner must be tsx-entry`);
  if (!Object.hasOwn(LIVE_SCRIPT_ENTRIES, stage.script))
    throw new Error(`${label}.script must be a registered evidence script`);
  validateFailureFields(stage, label);
}

function validateDesignContract(contract, label = 'design contract') {
  if (contract === null || typeof contract !== 'object' || Array.isArray(contract))
    throw new Error(`${label} must be an object`);
  assertExactKeys(contract, [
    'schemaVersion', 'journeyId', 'canonicalRoute', 'eligibility', 'semantics',
    'outcomes', 'legacyRetirement', 'acceptance', 'nextSlices',
  ], label);
  if (contract.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`);
  assertString(contract.journeyId, `${label}.journeyId`);
  if (!Array.isArray(contract.canonicalRoute) || contract.canonicalRoute.length < 3)
    throw new Error(`${label}.canonicalRoute must contain at least 3 steps`);
  if (contract.canonicalRoute.some(
    (value) => typeof value !== 'string' || value.length === 0 || DESIGN_UNDECIDED_PATTERN.test(value),
  )) throw new Error(`${label}.canonicalRoute must contain decided strings`);
  for (const [section, keys] of Object.entries({
    eligibility: ['authority', 'advisoryBoundary'],
    semantics: ['supported', 'deferred'],
    outcomes: ['unavailable', 'accepted', 'rejected', 'failed'],
    legacyRetirement: ['sameSlice', 'retained'],
    acceptance: ['positive', 'negative'],
  })) {
    const value = contract[section];
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      throw new Error(`${label}.${section} must be an object`);
    assertExactKeys(value, keys, `${label}.${section}`);
    for (const key of keys) {
      const entry = value[key];
      if (typeof entry === 'string') {
        if (entry.length === 0 || DESIGN_UNDECIDED_PATTERN.test(entry))
          throw new Error(`${label}.${section}.${key} must be decided`);
      } else if (!Array.isArray(entry) || entry.length === 0 || entry.some(
        (item) => typeof item !== 'string' || item.length === 0 || DESIGN_UNDECIDED_PATTERN.test(item),
      )) {
        throw new Error(`${label}.${section}.${key} must contain decided values`);
      }
    }
  }
  if (!Array.isArray(contract.nextSlices) || contract.nextSlices.length === 0 || contract.nextSlices.some(
    (value) => typeof value !== 'string' || value.length === 0 || DESIGN_UNDECIDED_PATTERN.test(value),
  )) throw new Error(`${label}.nextSlices must contain decided values`);
  return contract;
}

function designFailure(journey, code, evidence = ['design:invalid']) {
  return fixedFailure({
    failureClass: 'DESIGN',
    code,
    stage: 'design-gate',
    evidence,
    nextAction: 'RETURN_TO_DESIGN',
  });
}

function readDesignContract(journey, cwd) {
  if (typeof journey.designSource !== 'string' || journey.designSource.length === 0)
    return { failure: designFailure(journey, 'DESIGN_SOURCE_MISSING') };
  if (!journey.designSource.endsWith('.json')) {
    return { failure: designFailure(journey, 'DESIGN_CONTRACT_REQUIRED', ['design:machine-contract-required']) };
  }
  try {
    const source = resolve(cwd, repositoryPath(journey.designSource, 'journey.designSource'));
    const parsed = JSON.parse(readFileSync(source, 'utf8'));
    if (DESIGN_UNDECIDED_PATTERN.test(JSON.stringify(parsed))) {
      return {
        failure: designFailure(journey, 'DESIGN_SEMANTICS_UNDECIDED', [
          'design:semantics-undecided',
          'design:resolve-before-implementation',
        ]),
      };
    }
    const contract = validateDesignContract(parsed);
    if (contract.journeyId !== journey.id)
      return { failure: designFailure(journey, 'DESIGN_JOURNEY_MISMATCH', ['design:journey-mismatch']) };
    return { contract };
  } catch {
    return { failure: designFailure(journey, 'DESIGN_CONTRACT_INVALID') };
  }
}

export function validateJourneyRegistry(registry) {
  if (registry === null || typeof registry !== 'object' || Array.isArray(registry))
    throw new Error('journey registry must be an object');
  assertExactKeys(registry, ['schemaVersion', 'journeys'], 'journey registry');
  if (registry.schemaVersion !== 1) throw new Error('journey registry schemaVersion must be 1');
  if (!Array.isArray(registry.journeys) || registry.journeys.length === 0)
    throw new Error('journey registry must contain journeys');
  const ids = new Set();
  for (const [index, journey] of registry.journeys.entries()) {
    const label = `journeys[${index}]`;
    if (journey === null || typeof journey !== 'object' || Array.isArray(journey))
      throw new Error(`${label} must be an object`);
    const journeyKeys = ['id', 'goal', 'designSource', 'acceptanceSource', 'localStages', 'liveStage'];
    const unknownJourneyKeys = Object.keys(journey).filter((key) => !journeyKeys.includes(key));
    if (unknownJourneyKeys.length > 0) throw new Error(`${label} has unsupported fields`);
    if (!/^[A-Z0-9][A-Z0-9-]{1,63}$/u.test(journey.id)) throw new Error(`${label}.id is invalid`);
    if (ids.has(journey.id)) throw new Error(`duplicate journey id: ${journey.id}`);
    ids.add(journey.id);
    assertString(journey.goal, `${label}.goal`);
    if (journey.designSource !== undefined) repositoryPath(journey.designSource, `${label}.designSource`);
    repositoryPath(journey.acceptanceSource, `${label}.acceptanceSource`);
    if (!Array.isArray(journey.localStages) || journey.localStages.length === 0)
      throw new Error(`${label}.localStages must not be empty`);
    journey.localStages.forEach((stage, stageIndex) =>
      validateLocalStage(stage, `${label}.localStages[${stageIndex}]`),
    );
    if (new Set(journey.localStages.map((stage) => stage.id)).size !== journey.localStages.length)
      throw new Error(`${label}.localStages ids must be unique`);
    validateLiveStage(journey.liveStage, `${label}.liveStage`);
  }
  return registry;
}

export function loadJourneyRegistry(root = DEFAULT_ROOT) {
  const registry = validateJourneyRegistry(
    JSON.parse(readFileSync(resolve(root, 'scripts/journeys/registry.json'), 'utf8')),
  );
  for (const journey of registry.journeys) {
    if (!existsSync(resolve(root, journey.acceptanceSource)))
      throw new Error(`acceptance source missing for ${journey.id}`);
  }
  return registry;
}

export function findJourney(registry, journeyId) {
  const journey = registry.journeys.find((candidate) => candidate.id === journeyId);
  if (journey === undefined) throw new Error(`unknown journey: ${journeyId}`);
  return journey;
}

export function resolveLocalSandboxExecutable({
  platform = process.platform,
  pathExists = existsSync,
} = {}) {
  const executable = '/usr/bin/sandbox-exec';
  return platform === 'darwin' && pathExists(executable) ? executable : null;
}

function sandboxProfile(cwd, temporaryDirectory) {
  const runtimeRoot = dirname(dirname(process.execPath));
  const userRoot = resolve(homedir());
  const temporaryRoots = new Set([resolve(temporaryDirectory), realpathSync(temporaryDirectory)]);
  const readableRoots = [resolve(cwd), ...temporaryRoots, runtimeRoot];
  const metadataPaths = new Set([userRoot]);
  for (const target of [resolve(cwd), runtimeRoot]) {
    let current = dirname(target);
    while (current === userRoot || current.startsWith(`${userRoot}${sep}`)) {
      metadataPaths.add(current);
      if (current === userRoot) break;
      current = dirname(current);
    }
  }
  const probePaths = workspaceRootProbePaths(cwd);
  return [
    '(version 1)',
    '(allow default)',
    '(deny network*)',
    `(deny file-read* (subpath ${JSON.stringify(userRoot)}))`,
    ...[...metadataPaths].map(
      (metadataPath) => `(allow file-read-metadata (literal ${JSON.stringify(metadataPath)}))`,
    ),
    ...readableRoots.map(
      (readableRoot) => `(allow file-read* (subpath ${JSON.stringify(readableRoot)}))`,
    ),
    ...probePaths.map((probePath) => `(allow file-read* (literal ${JSON.stringify(probePath)}))`),
    '(deny file-write*)',
    '(allow file-read* (literal "/dev/null"))',
    '(allow file-write* (literal "/dev/null"))',
    ...[...temporaryRoots].map(
      (temporaryRoot) => `(allow file-write* (subpath ${JSON.stringify(temporaryRoot)}))`,
    ),
  ].join('\n');
}

function workspaceRootProbePaths(cwd) {
  const names = ['pnpm-workspace.yaml', 'lerna.json', 'package.json', 'deno.json', 'deno.jsonc'];
  const paths = [];
  let current = dirname(resolve(cwd));
  while (true) {
    for (const name of names) paths.push(join(current, name));
    const parent = dirname(current);
    if (parent === current) return paths;
    current = parent;
  }
}

function writeLocalVitestConfig(cwd, temporaryDirectory) {
  const configPath = join(temporaryDirectory, 'vitest.config.mjs');
  const source = [
    `import baseConfig from ${JSON.stringify(pathToFileURL(resolve(cwd, 'vite.config.ts')).href)};`,
    "const configEnvironment = { command: 'serve', mode: 'test', isSsrBuild: false, isPreview: false };",
    "const resolved = typeof baseConfig === 'function' ? await baseConfig(configEnvironment) : await baseConfig;",
    'const server = resolved.server ?? {};',
    'const fileSystem = server.fs ?? {};',
    `export default { ...resolved, root: ${JSON.stringify(resolve(cwd))}, server: { ...server, fs: { ...fileSystem, allow: [${JSON.stringify(resolve(cwd))}] } } };`,
    '',
  ].join('\n');
  writeFileSync(configPath, source, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return configPath;
}

export function stageInvocation(
  stage,
  { cwd = DEFAULT_ROOT, localSandboxExecutable, temporaryDirectory, configPath } = {},
) {
  if (stage.runner === 'vitest') {
    if (localSandboxExecutable === null || localSandboxExecutable === undefined)
      throw new Error('local sandbox executable is required');
    if (temporaryDirectory === null || temporaryDirectory === undefined)
      throw new Error('temporary directory is required');
    if (configPath === null || configPath === undefined)
      throw new Error('local Vitest config is required');
    const temporaryRoots = new Set([resolve(temporaryDirectory), realpathSync(temporaryDirectory)]);
    return Object.freeze({
      command: localSandboxExecutable,
      launcher: 'sandbox-exec',
      args: Object.freeze([
        '-p',
        sandboxProfile(cwd, temporaryDirectory),
        '/bin/sh',
        '-c',
        '"$@"; stage_status=$?; if [ "$stage_status" -eq 71 ]; then exit 70; fi; exit "$stage_status"',
        'journey-stage',
        process.execPath,
        '--permission',
        '--allow-child-process',
        `--allow-fs-read=${resolve(cwd)}`,
        ...[...temporaryRoots].map((path) => `--allow-fs-read=${path}`),
        ...workspaceRootProbePaths(cwd).map((path) => `--allow-fs-read=${path}`),
        ...[...temporaryRoots].map((path) => `--allow-fs-write=${path}`),
        '--allow-addons',
        '--allow-worker',
        resolve(cwd, 'node_modules/vitest/vitest.mjs'),
        'run',
        '--pool',
        'threads',
        '--no-cache',
        '--root',
        resolve(cwd),
        '--config',
        resolve(configPath),
        '--configLoader',
        'runner',
        '--project',
        stage.project,
        ...stage.files,
      ]),
    });
  }
  if (stage.runner === 'tsx-entry') {
    const entry = LIVE_SCRIPT_ENTRIES[stage.script];
    if (entry === undefined) throw new Error(`unregistered evidence script: ${stage.script}`);
    return Object.freeze({
      command: process.execPath,
      args: Object.freeze([resolve(cwd, 'node_modules/tsx/dist/cli.mjs'), resolve(cwd, entry)]),
    });
  }
  throw new Error(`unsupported stage runner: ${stage.runner}`);
}

export function safeChildEnvironment(source = process.env) {
  const environment = {
    CI: '1',
    NODE_ENV: 'test',
    NO_COLOR: '1',
    GIT_CONFIG_NOSYSTEM: '1',
  };
  for (const key of SAFE_ENVIRONMENT_KEYS) {
    if (typeof source[key] === 'string') environment[key] = source[key];
  }
  return Object.freeze(environment);
}

function exitCode(result) {
  if (typeof result.status === 'number') return result.status;
  if (result.error !== undefined && result.error !== null) return 127;
  if (result.signal !== undefined && result.signal !== null) return 128;
  return 1;
}

function assertEnvironmentAttempt(environmentAttempt) {
  if (environmentAttempt !== 1 && environmentAttempt !== 2)
    throw new Error('environmentAttempt must be 1 or 2');
}

function nextActionFor(failureClass, environmentAttempt) {
  if (failureClass === 'DESIGN') return 'RETURN_TO_DESIGN';
  if (failureClass === 'IMPLEMENTATION') return 'FIX_PRODUCT';
  if (failureClass === 'EVIDENCE') return 'REPAIR_EVIDENCE';
  if (failureClass === 'AUTHORITY') return 'REQUEST_EXTERNAL_AUTHORITY';
  return environmentAttempt === 1 ? 'RETRY_ENVIRONMENT' : 'STOP_FOR_ENVIRONMENT';
}

function statusFor(failureClass, nextAction) {
  if (failureClass === 'AUTHORITY' || nextAction === 'STOP_FOR_ENVIRONMENT') return 'blocked';
  if (nextAction === 'RETRY_ENVIRONMENT') return 'retryable';
  return 'failed';
}

function fixedFailure({
  failureClass,
  code,
  stage,
  evidence,
  environmentAttempt = 1,
  nextAction = nextActionFor(failureClass, environmentAttempt),
}) {
  return Object.freeze({
    class: failureClass,
    code,
    stage,
    evidence: Object.freeze([...evidence]),
    environmentAttempt,
    nextAction,
    status: statusFor(failureClass, nextAction),
  });
}

function normalizeTrustedFailure(trustedFailure) {
  if (trustedFailure === null || trustedFailure === undefined) return null;
  if (
    typeof trustedFailure !== 'object' ||
    Array.isArray(trustedFailure) ||
    Object.keys(trustedFailure).sort().join(',') !== 'class,code,stage'
  ) {
    throw new Error('trusted failure has unsupported fields');
  }
  if (!FAILURE_CLASS_SET.has(trustedFailure.class) || trustedFailure.class === 'AUTHORITY')
    throw new Error('trusted failure class is invalid');
  if (!FAILURE_CODE_PATTERN.test(trustedFailure.code))
    throw new Error('trusted failure code is invalid');
  if (!FAILURE_STAGE_PATTERN.test(trustedFailure.stage))
    throw new Error('trusted failure stage is invalid');
  return trustedFailure;
}

function readTrustedFailure(path) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 4096) {
      return Object.freeze({ invalid: true });
    }
    if ((stat.mode & 0o777) !== 0o600) return Object.freeze({ invalid: true });
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return null;
    return Object.freeze({ invalid: true });
  }
}

export function classifyStageFailure({
  stage,
  result,
  invocation,
  environmentAttempt = 1,
  trustedFailure,
}) {
  assertEnvironmentAttempt(environmentAttempt);
  const spawnUnavailable = result.error !== undefined && result.error !== null;
  // sandbox-exec returning 71 means its own sandbox could not be applied. The
  // harness-owned shell wrapper remaps a child-stage exit 71 to 70, so this
  // reserved status cannot be spoofed by the test process.
  const sandboxApplicationFailed =
    invocation?.launcher === 'sandbox-exec' &&
    result.status === 71 &&
    !spawnUnavailable &&
    (result.signal === undefined || result.signal === null);
  let normalizedFailure;
  try {
    normalizedFailure = normalizeTrustedFailure(trustedFailure);
  } catch {
    return fixedFailure({
      failureClass: 'EVIDENCE',
      code: 'TRUSTED_FAILURE_INVALID',
      stage: stage.id,
      evidence: [`stage:${stage.id}`, `exit:${exitCode(result)}`],
      environmentAttempt,
    });
  }
  const failureClass =
    normalizedFailure?.class ??
    (spawnUnavailable || sandboxApplicationFailed ? 'ENVIRONMENT' : stage.failureClass);
  const code =
    normalizedFailure?.code ??
    (sandboxApplicationFailed
      ? 'LOCAL_SANDBOX_EXEC_FAILED'
      : spawnUnavailable
        ? 'CHILD_PROCESS_UNAVAILABLE'
        : stage.failureCode);
  const failedStage = normalizedFailure?.stage ?? stage.id;
  return fixedFailure({
    failureClass,
    code,
    stage: failedStage,
    evidence: [`stage:${stage.id}`, `exit:${exitCode(result)}`],
    environmentAttempt,
  });
}

function authorityFailure(stage, code, evidence, nextAction = 'REQUEST_EXTERNAL_AUTHORITY') {
  return fixedFailure({ failureClass: 'AUTHORITY', code, stage: stage.id, evidence, nextAction });
}

function readCurrentFingerprint(reader) {
  try {
    const value = reader();
    return FINGERPRINT_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function inspectJourneyCandidate({
  cwd = DEFAULT_ROOT,
  base,
  collectChanges = collectChangedFiles,
  resolveDomains = resolveDomainSelection,
  fingerprint = candidateFingerprint,
} = {}) {
  const changes = collectChanges({ cwd, base });
  const domains = resolveDomains({ root: cwd, files: changes.files });
  return Object.freeze({
    fingerprint: fingerprint({ cwd, base: changes.base, head: changes.head }),
    head: changes.head,
    base: changes.base,
    changedFiles: Object.freeze([...changes.files]),
    selectedDomains: Object.freeze([...domains.selectedDomains]),
    escalation: domains.escalation,
  });
}

export function runJourneyTurn({
  journey,
  phase,
  candidate,
  allowExternalWrite = false,
  expectedFingerprint,
  environmentAttempt = 1,
  cwd = DEFAULT_ROOT,
  spawn = spawnSync,
  currentFingerprint = () =>
    candidateFingerprint({ cwd, base: candidate?.base, head: candidate?.head ?? 'HEAD' }),
  childEnvironment = safeChildEnvironment(),
  localSandboxExecutable = resolveLocalSandboxExecutable(),
  createTemporaryDirectory = () => mkdtempSync(join(tmpdir(), 'onedeck-journey-')),
  removeTemporaryDirectory = (path) => rmSync(path, { recursive: true, force: true }),
} = {}) {
  if (!PHASES.has(phase)) throw new Error(`unknown journey phase: ${phase}`);
  if (journey === undefined) throw new Error('journey is required');
  validateJourneyRegistry({ schemaVersion: 1, journeys: [journey] });
  if (candidate === undefined || !FINGERPRINT_PATTERN.test(candidate.fingerprint))
    throw new Error('candidate with a valid fingerprint is required');
  assertEnvironmentAttempt(environmentAttempt);
  const baseResult = {
    kind: 'journey-loop-turn-v1',
    schemaVersion: 1,
    journeyId: journey.id,
    goal: journey.goal,
    acceptanceSource: journey.acceptanceSource,
    designSource: journey.designSource,
    phase,
    candidate,
  };
  const design = readDesignContract(journey, cwd);
  if (design.failure) {
    return Object.freeze({
      ...baseResult,
      status: design.failure.status,
      completedStages: Object.freeze([]),
      failure: design.failure,
      nextAction: design.failure.nextAction,
    });
  }
  if (phase === 'inspect')
    return Object.freeze({
      ...baseResult,
      status: 'ready',
      completedStages: Object.freeze([]),
      failure: null,
      nextAction: 'RUN_LOCAL',
    });

  const stages = phase === 'local' ? journey.localStages : [journey.liveStage];
  if (phase === 'local' && localSandboxExecutable === null) {
    const failure = fixedFailure({
      failureClass: 'ENVIRONMENT',
      code: 'LOCAL_SANDBOX_UNAVAILABLE',
      stage: journey.localStages[0].id,
      evidence: [`stage:${journey.localStages[0].id}`, 'local-sandbox:unavailable'],
      environmentAttempt,
    });
    return Object.freeze({
      ...baseResult,
      status: failure.status,
      completedStages: Object.freeze([]),
      failure,
      nextAction: failure.nextAction,
    });
  }
  if (phase === 'live' && !allowExternalWrite) {
    const failure = authorityFailure(journey.liveStage, 'EXTERNAL_WRITE_NOT_AUTHORIZED', [
      `stage:${journey.liveStage.id}`,
      'external-write:required',
    ]);
    return Object.freeze({
      ...baseResult,
      status: failure.status,
      completedStages: Object.freeze([]),
      failure,
      nextAction: failure.nextAction,
    });
  }
  if (phase === 'live' && !FINGERPRINT_PATTERN.test(expectedFingerprint ?? '')) {
    const failure = authorityFailure(journey.liveStage, 'EXPECTED_FINGERPRINT_REQUIRED', [
      `stage:${journey.liveStage.id}`,
      'candidate-fingerprint:required',
    ]);
    return Object.freeze({
      ...baseResult,
      status: failure.status,
      completedStages: Object.freeze([]),
      failure,
      nextAction: failure.nextAction,
    });
  }
  if (phase === 'live' && expectedFingerprint !== candidate.fingerprint) {
    const failure = authorityFailure(
      journey.liveStage,
      'CANDIDATE_FINGERPRINT_MISMATCH',
      [`stage:${journey.liveStage.id}`, 'candidate-fingerprint:mismatch'],
      'REINSPECT_CANDIDATE',
    );
    return Object.freeze({
      ...baseResult,
      status: failure.status,
      completedStages: Object.freeze([]),
      failure,
      nextAction: failure.nextAction,
    });
  }

  const completedStages = [];
  const authorizedFingerprint = phase === 'live' ? expectedFingerprint : candidate.fingerprint;
  for (const stage of stages) {
    const beforeFingerprint = readCurrentFingerprint(currentFingerprint);
    if (beforeFingerprint !== authorizedFingerprint) {
      const failure = authorityFailure(
        stage,
        'CANDIDATE_FINGERPRINT_CHANGED',
        [`stage:${stage.id}`, 'candidate-fingerprint:changed'],
        'REINSPECT_CANDIDATE',
      );
      return Object.freeze({
        ...baseResult,
        status: failure.status,
        completedStages: Object.freeze(completedStages),
        failure,
        nextAction: failure.nextAction,
      });
    }
    const temporaryDirectory = createTemporaryDirectory();
    const trustedFailurePath = join(temporaryDirectory, 'failure.json');
    const isolatedGitConfigPath = join(temporaryDirectory, 'gitconfig');
    let result;
    let invocation;
    let trustedFailure = null;
    try {
      writeFileSync(isolatedGitConfigPath, '', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      invocation = stageInvocation(stage, {
        cwd,
        localSandboxExecutable,
        temporaryDirectory,
        configPath:
          stage.runner === 'vitest' ? writeLocalVitestConfig(cwd, temporaryDirectory) : undefined,
      });
      result = spawn(invocation.command, invocation.args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: stage.timeoutMs,
        maxBuffer: 32 * 1024 * 1024,
        env: {
          ...childEnvironment,
          GIT_CONFIG_GLOBAL: isolatedGitConfigPath,
          GIT_CONFIG_NOSYSTEM: '1',
          TMPDIR: temporaryDirectory,
          TMP: temporaryDirectory,
          TEMP: temporaryDirectory,
          ...(phase === 'live' ? { JOURNEY_RESULT_PATH: trustedFailurePath } : {}),
        },
      });
      if (phase === 'live') trustedFailure = readTrustedFailure(trustedFailurePath);
    } finally {
      removeTemporaryDirectory(temporaryDirectory);
    }
    const afterFingerprint = readCurrentFingerprint(currentFingerprint);
    if (afterFingerprint !== beforeFingerprint) {
      const failure =
        phase === 'live'
          ? authorityFailure(
              stage,
              'CANDIDATE_FINGERPRINT_CHANGED',
              [`stage:${stage.id}`, 'candidate-fingerprint:changed'],
              'REINSPECT_CANDIDATE',
            )
          : fixedFailure({
              failureClass: 'EVIDENCE',
              code: 'LOCAL_SANDBOX_MUTATED_CANDIDATE',
              stage: stage.id,
              evidence: [`stage:${stage.id}`, 'candidate-fingerprint:mutated'],
            });
      return Object.freeze({
        ...baseResult,
        status: failure.status,
        completedStages: Object.freeze(completedStages),
        failure,
        nextAction: failure.nextAction,
      });
    }
    if (
      result.status !== 0 ||
      (result.error !== undefined && result.error !== null) ||
      (result.signal !== undefined && result.signal !== null)
    ) {
      const failure = classifyStageFailure({
        stage,
        result,
        invocation,
        environmentAttempt,
        trustedFailure,
      });
      return Object.freeze({
        ...baseResult,
        status: failure.status,
        completedStages: Object.freeze(completedStages),
        failure,
        nextAction: failure.nextAction,
      });
    }
    completedStages.push(stage.id);
  }

  const nextAction = phase === 'local' ? 'REQUEST_EXTERNAL_AUTHORITY' : 'RUN_INDEPENDENT_REVIEW';
  return Object.freeze({
    ...baseResult,
    status: 'passed',
    completedStages: Object.freeze(completedStages),
    failure: null,
    nextAction,
  });
}

export function runJourneyPhase(options) {
  const first = runJourneyTurn({ ...options, environmentAttempt: 1 });
  if (first.failure?.class !== 'ENVIRONMENT' || first.nextAction !== 'RETRY_ENVIRONMENT') {
    return Object.freeze({ ...first, environmentAttempts: 1 });
  }
  const second = runJourneyTurn({ ...options, environmentAttempt: 2 });
  return Object.freeze({ ...second, environmentAttempts: 2 });
}

function requiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function parseArguments(argv) {
  const options = {
    journeyId: 'O4P-CAST-PILOT',
    phase: 'inspect',
    allowExternalWrite: false,
    expectedFingerprint: undefined,
    base: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--allow-external-write') options.allowExternalWrite = true;
    else if (argument === '--journey') {
      options.journeyId = requiredValue(argv, index, argument);
      index += 1;
    } else if (argument === '--phase') {
      options.phase = requiredValue(argv, index, argument);
      index += 1;
    } else if (argument === '--expected-fingerprint') {
      options.expectedFingerprint = requiredValue(argv, index, argument);
      index += 1;
    } else if (argument === '--base') {
      options.base = requiredValue(argv, index, argument);
      index += 1;
    } else if (argument === '--help') options.help = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function usage() {
  return [
    'Usage: npm run journey:loop -- [--journey O4P-CAST-PILOT] [--phase inspect|local|live]',
    '       [--base <git-ref>]',
    '       [--allow-external-write --expected-fingerprint <sha256>]',
    '',
    'inspect and local execute only repository tests with a restricted environment.',
    'environment failures retry once in the same candidate-bound invocation, then stop.',
    'live requires explicit external-write authority bound to the inspected fingerprint.',
  ].join('\n');
}

export function main(
  argv = process.argv.slice(2),
  { cwd = DEFAULT_ROOT, write = console.log, error = console.error } = {},
) {
  try {
    const options = parseArguments(argv);
    if (options.help) {
      write(usage());
      return 0;
    }
    const candidate = inspectJourneyCandidate({ cwd, base: options.base });
    const registry = loadJourneyRegistry(cwd);
    const journey = findJourney(registry, options.journeyId);
    const result = runJourneyPhase({
      journey,
      phase: options.phase,
      candidate,
      allowExternalWrite: options.allowExternalWrite,
      expectedFingerprint: options.expectedFingerprint,
      cwd,
      currentFingerprint: () =>
        candidateFingerprint({ cwd, base: candidate.base, head: candidate.head }),
    });
    write(JSON.stringify(result, null, 2));
    if (result.status === 'blocked') return 2;
    if (result.status === 'failed' || result.status === 'retryable') return 1;
    return 0;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'unknown harness error';
    error(`journey harness configuration error: ${message}`);
    return 2;
  }
}

const entryPath =
  process.argv[1] === undefined ? null : pathToFileURL(resolve(process.argv[1])).href;
if (entryPath === import.meta.url) process.exitCode = main();
