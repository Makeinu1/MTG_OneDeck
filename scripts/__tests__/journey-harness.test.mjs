import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import {
  classifyStageFailure,
  inspectJourneyCandidate,
  runJourneyPhase,
  runJourneyTurn,
  resolveLocalSandboxExecutable,
  safeChildEnvironment,
  stageInvocation,
  validateJourneyRegistry,
} from '../journeys/journey-harness.mjs';

const localStage = Object.freeze({
  id: 'evidence-contract',
  runner: 'vitest',
  project: 'dom',
  files: Object.freeze(['src/test/architecture/example.test.ts']),
  timeoutMs: 1000,
  failureClass: 'EVIDENCE',
  failureCode: 'EVIDENCE_CONTRACT_FAILED',
});

const liveStage = Object.freeze({
  id: 'production-journey',
  runner: 'tsx-entry',
  script: 'evidence:o4p-09i',
  timeoutMs: 1000,
  failureClass: 'IMPLEMENTATION',
  failureCode: 'PRODUCTION_JOURNEY_FAILED',
});

const journey = Object.freeze({
  id: 'TEST-01',
  goal: 'test journey',
  designSource: 'scripts/__tests__/fixtures/journey-design-test.json',
  acceptanceSource: 'scripts/__tests__/fixtures/journey-design-test.json',
  localStages: Object.freeze([localStage]),
  liveStage,
});

const candidate = Object.freeze({
  fingerprint: 'a'.repeat(64),
  head: 'b'.repeat(40),
  base: null,
  changedFiles: Object.freeze(['scripts/journeys/journey-harness.mjs']),
  selectedDomains: Object.freeze(['build-tooling']),
  escalation: 'full',
});

describe('journey harness', () => {
  test('stops before any stage when the machine design source is missing', () => {
    const spawn = vi.fn();
    const result = runJourneyTurn({
      journey: { ...journey, designSource: undefined },
      phase: 'local',
      candidate,
      localSandboxExecutable: '/sandbox-exec',
      spawn,
    });
    expect(result).toMatchObject({
      status: 'failed',
      nextAction: 'RETURN_TO_DESIGN',
      completedStages: [],
      failure: { class: 'DESIGN', code: 'DESIGN_SOURCE_MISSING', stage: 'design-gate' },
    });
    expect(spawn).not.toHaveBeenCalled();
  });

  test('returns prose-only design sources to DESIGN before spawning a stage', () => {
    const spawn = vi.fn();
    const result = runJourneyTurn({
      journey: { ...journey, designSource: 'research/legacy-brief.md' },
      phase: 'local',
      candidate,
      localSandboxExecutable: '/sandbox-exec',
      spawn,
    });
    expect(result).toMatchObject({
      status: 'failed',
      nextAction: 'RETURN_TO_DESIGN',
      failure: { class: 'DESIGN', code: 'DESIGN_CONTRACT_REQUIRED', stage: 'design-gate' },
    });
    expect(spawn).not.toHaveBeenCalled();
  });

  test('returns English and Japanese undecided product behavior to DESIGN before spawning a stage', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'onedeck-design-gate-'));
    try {
      const contract = {
        schemaVersion: 1,
        journeyId: 'TEST-01',
        canonicalRoute: ['surface', 'binder', 'Core'],
        eligibility: { authority: 'server', advisoryBoundary: 'projection only' },
        semantics: { supported: ['targetless cast'], deferred: ['対象は要検討です'] },
        outcomes: { unavailable: 'no attempt', accepted: 'shared revision', rejected: 'unchanged', failed: 'stop' },
        legacyRetirement: { sameSlice: ['old cast'], retained: ['manual move'] },
        acceptance: { positive: ['same stack'], negative: ['stale rejects'] },
        nextSlices: ['response'],
      };
      const spawn = vi.fn();
      for (const [path, value] of [
        ['semantics.json', contract],
        ['route.json', { ...contract, semantics: { ...contract.semantics, deferred: ['targeted cast'] }, canonicalRoute: ['surface', 'TBD route', 'Core'] }],
      ]) {
        writeFileSync(join(cwd, path), JSON.stringify(value));
        const result = runJourneyTurn({
          journey: { ...journey, designSource: path, acceptanceSource: path },
          phase: 'local',
          candidate,
          cwd,
          localSandboxExecutable: '/sandbox-exec',
          spawn,
        });
        expect(result).toMatchObject({
          status: 'failed',
          nextAction: 'RETURN_TO_DESIGN',
          failure: { class: 'DESIGN', code: 'DESIGN_SEMANTICS_UNDECIDED', stage: 'design-gate' },
        });
      }
      expect(spawn).not.toHaveBeenCalled();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('projects the same candidate into a deterministic inspect result', () => {
    const inspect = () =>
      inspectJourneyCandidate({
        cwd: '/repo',
        collectChanges: () => ({
          head: candidate.head,
          base: null,
          files: [...candidate.changedFiles],
        }),
        resolveDomains: () => ({
          selectedDomains: [...candidate.selectedDomains],
          escalation: candidate.escalation,
        }),
        fingerprint: () => candidate.fingerprint,
      });
    expect(inspect()).toEqual(inspect());
    expect(runJourneyTurn({ journey, phase: 'inspect', candidate: inspect() })).toMatchObject({
      status: 'ready',
      nextAction: 'RUN_LOCAL',
      failure: null,
    });
  });

  test('binds external authority to the inspected candidate fingerprint', () => {
    const spawn = vi.fn(() => ({ status: 0, signal: null, error: null, stdout: '', stderr: '' }));
    const absent = runJourneyTurn({ journey, phase: 'live', candidate, spawn });
    const unbound = runJourneyTurn({
      journey,
      phase: 'live',
      candidate,
      allowExternalWrite: true,
      spawn,
    });
    const mismatch = runJourneyTurn({
      journey,
      phase: 'live',
      candidate,
      allowExternalWrite: true,
      expectedFingerprint: 'c'.repeat(64),
      spawn,
    });
    expect(spawn).not.toHaveBeenCalled();
    expect(absent).toMatchObject({
      status: 'blocked',
      failure: { class: 'AUTHORITY', code: 'EXTERNAL_WRITE_NOT_AUTHORIZED' },
    });
    expect(unbound).toMatchObject({
      status: 'blocked',
      failure: { class: 'AUTHORITY', code: 'EXPECTED_FINGERPRINT_REQUIRED' },
    });
    expect(mismatch).toMatchObject({
      status: 'blocked',
      nextAction: 'REINSPECT_CANDIDATE',
      failure: { class: 'AUTHORITY', code: 'CANDIDATE_FINGERPRINT_MISMATCH' },
    });
  });

  test('classifies local contract failures without exposing raw output or its digest', () => {
    const privateValue = 'not-for-summary';
    const result = runJourneyTurn({
      journey,
      phase: 'local',
      candidate,
      currentFingerprint: () => candidate.fingerprint,
      localSandboxExecutable: '/sandbox-exec',
      spawn: () => ({
        status: 1,
        signal: null,
        error: null,
        stdout: '',
        stderr: `browser profile architecture test failed ${privateValue}`,
      }),
    });
    expect(result).toMatchObject({
      status: 'failed',
      nextAction: 'REPAIR_EVIDENCE',
      failure: { class: 'EVIDENCE', code: 'EVIDENCE_CONTRACT_FAILED', stage: 'evidence-contract' },
    });
    expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(result.failure).not.toHaveProperty('outputDigest');
  });

  test('permits one trusted environment retry, then stops', () => {
    const child = {
      status: 1,
      signal: null,
      error: null,
      stdout: '',
      stderr: '',
    };
    const trustedFailure = {
      class: 'ENVIRONMENT',
      code: 'RUNTIME_ENVIRONMENT_UNAVAILABLE',
      stage: 'production-journey',
    };
    const first = classifyStageFailure({
      stage: liveStage,
      result: child,
      environmentAttempt: 1,
      trustedFailure,
    });
    const second = classifyStageFailure({
      stage: liveStage,
      result: child,
      environmentAttempt: 2,
      trustedFailure,
    });
    expect(first).toMatchObject({
      class: 'ENVIRONMENT',
      code: 'RUNTIME_ENVIRONMENT_UNAVAILABLE',
      nextAction: 'RETRY_ENVIRONMENT',
      status: 'retryable',
    });
    expect(second).toMatchObject({
      class: 'ENVIRONMENT',
      code: 'RUNTIME_ENVIRONMENT_UNAVAILABLE',
      nextAction: 'STOP_FOR_ENVIRONMENT',
      status: 'blocked',
    });
    expect(first.evidence).toEqual(second.evidence);
  });

  test('classifies sandbox-exec application failure without confusing a child exit 71', () => {
    const result = { status: 71, signal: null, error: null, stdout: '', stderr: 'spoofable text' };
    const invocation = stageInvocation(localStage, {
      cwd: '/repo',
      localSandboxExecutable: '/sandbox-exec',
      temporaryDirectory: tmpdir(),
      configPath: join(tmpdir(), 'vitest.config.mjs'),
    });
    const sandboxFailure = classifyStageFailure({ stage: localStage, result, invocation });
    const childFailure = classifyStageFailure({
      stage: localStage,
      result,
      invocation: { command: process.execPath, args: [] },
    });
    expect(sandboxFailure).toMatchObject({
      class: 'ENVIRONMENT',
      code: 'LOCAL_SANDBOX_EXEC_FAILED',
      nextAction: 'RETRY_ENVIRONMENT',
      status: 'retryable',
    });
    expect(childFailure).toMatchObject({
      class: 'EVIDENCE',
      code: 'EVIDENCE_CONTRACT_FAILED',
      status: 'failed',
    });
    expect(invocation.args).toEqual(expect.arrayContaining([
      '/bin/sh',
      '-c',
      expect.stringContaining('if [ "$stage_status" -eq 71 ]; then exit 70'),
      'journey-stage',
      process.execPath,
    ]));
    expect(classifyStageFailure({
      stage: localStage,
      result: { ...result, status: 70 },
      invocation,
    })).toMatchObject({
      class: 'EVIDENCE',
      code: 'EVIDENCE_CONTRACT_FAILED',
      status: 'failed',
    });

    const spawn = vi.fn(() => result);
    const stopped = runJourneyPhase({
      journey,
      phase: 'local',
      candidate,
      currentFingerprint: () => candidate.fingerprint,
      localSandboxExecutable: '/sandbox-exec',
      spawn,
    });
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(stopped).toMatchObject({
      status: 'blocked',
      environmentAttempts: 2,
      nextAction: 'STOP_FOR_ENVIRONMENT',
      failure: { class: 'ENVIRONMENT', code: 'LOCAL_SANDBOX_EXEC_FAILED' },
    });
  });

  test('performs exactly one environment retry inside one phase run', () => {
    const spawn = vi
      .fn()
      .mockReturnValueOnce({
        status: null,
        signal: null,
        error: new Error('unavailable'),
        stdout: '',
        stderr: '',
      })
      .mockReturnValueOnce({ status: 0, signal: null, error: null, stdout: '', stderr: '' });
    const result = runJourneyPhase({
      journey,
      phase: 'local',
      candidate,
      currentFingerprint: () => candidate.fingerprint,
      localSandboxExecutable: '/sandbox-exec',
      spawn,
    });
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: 'passed', environmentAttempts: 2 });

    const unavailable = runJourneyPhase({
      journey,
      phase: 'local',
      candidate,
      localSandboxExecutable: null,
      spawn: vi.fn(),
    });
    expect(unavailable).toMatchObject({
      status: 'blocked',
      environmentAttempts: 2,
      failure: { class: 'ENVIRONMENT', environmentAttempt: 2 },
    });
  });

  test('ignores stdout markers and accepts only a trusted normalized design result', () => {
    const spoofed = classifyStageFailure({
      stage: liveStage,
      result: {
        status: 1,
        signal: null,
        error: null,
        stdout: 'JOURNEY_FAILURE:DESIGN:CONTRACT_UNDEFINED:stack-semantics\n',
        stderr: '',
      },
    });
    const failure = classifyStageFailure({
      stage: liveStage,
      result: { status: 1, signal: null, error: null, stdout: '', stderr: '' },
      trustedFailure: {
        class: 'DESIGN',
        code: 'CONTRACT_UNDEFINED',
        stage: 'stack-semantics',
      },
    });
    expect(spoofed).toMatchObject({
      class: 'IMPLEMENTATION',
      code: 'PRODUCTION_JOURNEY_FAILED',
      stage: 'production-journey',
    });
    expect(failure).toMatchObject({
      class: 'DESIGN',
      code: 'CONTRACT_UNDEFINED',
      stage: 'stack-semantics',
      nextAction: 'RETURN_TO_DESIGN',
    });
    expect(
      classifyStageFailure({
        stage: liveStage,
        result: { status: 1, signal: null, error: null, stdout: '', stderr: '' },
        trustedFailure: {
          class: 'AUTHORITY',
          code: 'AUTHORITY_SPOOF',
          stage: 'production-journey',
        },
      }),
    ).toMatchObject({ class: 'EVIDENCE', code: 'TRUSTED_FAILURE_INVALID' });
  });

  test('reads a live failure only from the private temporary result path', () => {
    let resultPath = '';
    const result = runJourneyTurn({
      journey,
      phase: 'live',
      candidate,
      allowExternalWrite: true,
      expectedFingerprint: candidate.fingerprint,
      currentFingerprint: () => candidate.fingerprint,
      spawn: (_command, _args, options) => {
        resultPath = options.env.JOURNEY_RESULT_PATH;
        writeFileSync(
          resultPath,
          JSON.stringify({
            class: 'ENVIRONMENT',
            code: 'BROWSER_ENVIRONMENT_UNAVAILABLE',
            stage: 'setup',
          }),
          { mode: 0o600 },
        );
        return { status: 1, signal: null, error: null, stdout: '', stderr: '' };
      },
    });
    expect(result).toMatchObject({
      status: 'retryable',
      failure: {
        class: 'ENVIRONMENT',
        code: 'BROWSER_ENVIRONMENT_UNAVAILABLE',
        stage: 'setup',
      },
    });
    expect(resultPath).not.toBe('');
    expect(existsSync(resultPath)).toBe(false);
  });

  test.each([0o400, 0o700])('rejects a trusted failure file with mode %s', (mode) => {
    const result = runJourneyTurn({
      journey,
      phase: 'live',
      candidate,
      allowExternalWrite: true,
      expectedFingerprint: candidate.fingerprint,
      currentFingerprint: () => candidate.fingerprint,
      spawn: (_command, _args, options) => {
        writeFileSync(options.env.JOURNEY_RESULT_PATH, JSON.stringify({
          class: 'ENVIRONMENT',
          code: 'BROWSER_ENVIRONMENT_UNAVAILABLE',
          stage: 'setup',
        }), { mode });
        return { status: 1, signal: null, error: null, stdout: '', stderr: '' };
      },
    });
    expect(result).toMatchObject({
      status: 'failed',
      failure: { class: 'EVIDENCE', code: 'TRUSTED_FAILURE_INVALID' },
    });
  });

  test('allows only local Vitest files and evidence scripts in the registry', () => {
    expect(
      validateJourneyRegistry({ schemaVersion: 1, journeys: [journey] }).journeys,
    ).toHaveLength(1);
    expect(() =>
      validateJourneyRegistry({
        schemaVersion: 1,
        journeys: [{ ...journey, localStages: [{ ...localStage, runner: 'command' }] }],
      }),
    ).toThrow('runner must be vitest');
    expect(() =>
      validateJourneyRegistry({
        schemaVersion: 1,
        journeys: [{ ...journey, liveStage: { ...liveStage, script: 'evidence:other' } }],
      }),
    ).toThrow('registered evidence script');
    const temporaryDirectory = tmpdir();
    const invocation = stageInvocation(localStage, {
      cwd: '/repo',
      localSandboxExecutable: '/sandbox-exec',
      temporaryDirectory,
      configPath: join(temporaryDirectory, 'vitest.config.mjs'),
    });
    expect(invocation.command).toBe('/sandbox-exec');
    expect(invocation.args).toEqual(
      expect.arrayContaining([
        '-p',
        expect.stringContaining('(deny network*)'),
        process.execPath,
        '--permission',
        '--allow-child-process',
        '--allow-fs-read=/repo',
        `--allow-fs-read=${resolve(temporaryDirectory)}`,
        `--allow-fs-write=${resolve(temporaryDirectory)}`,
        '--allow-addons',
        '--allow-worker',
        '/repo/node_modules/vitest/vitest.mjs',
        'run',
        '--pool',
        'threads',
        '--no-cache',
        '--root',
        '/repo',
        '--config',
        resolve(temporaryDirectory, 'vitest.config.mjs'),
        '--configLoader',
        'runner',
        '--project',
        'dom',
        ...localStage.files,
      ]),
    );
    expect(invocation.args[1]).toContain('(deny file-read* (subpath');
    expect(invocation.args[1]).toContain('(deny file-write*)');
    expect(invocation.args[1]).toContain('(allow file-write* (literal "/dev/null"))');
    expect(invocation.args[1]).toContain(
      `(allow file-write* (subpath ${JSON.stringify(resolve(temporaryDirectory))}))`,
    );
    expect(resolveLocalSandboxExecutable({ platform: 'linux' })).toBeNull();
    expect(resolveLocalSandboxExecutable({ platform: 'darwin', pathExists: () => true })).toBe(
      '/usr/bin/sandbox-exec',
    );
    expect(stageInvocation(liveStage, { cwd: '/repo' })).toEqual({
      command: process.execPath,
      args: [
        '/repo/node_modules/tsx/dist/cli.mjs',
        '/repo/scripts/online/o4p-09i-full-match-evidence.ts',
      ],
    });
  });

  test('passes only an explicit non-secret environment to child stages', () => {
    expect(
      safeChildEnvironment({ PATH: '/bin', TMPDIR: '/tmp', INTERNAL_MARKER: 'drop-me' }),
    ).toEqual({
      CI: '1',
      GIT_CONFIG_NOSYSTEM: '1',
      NODE_ENV: 'test',
      NO_COLOR: '1',
      PATH: '/bin',
      TMPDIR: '/tmp',
    });
  });

  test('stops when a read-only stage changes the candidate bytes', () => {
    let fingerprintReads = 0;
    const result = runJourneyTurn({
      journey,
      phase: 'local',
      candidate,
      currentFingerprint: () => (fingerprintReads++ === 0 ? candidate.fingerprint : 'd'.repeat(64)),
      localSandboxExecutable: '/sandbox-exec',
      spawn: () => ({ status: 0, signal: null, error: null, stdout: '', stderr: '' }),
    });
    expect(result).toMatchObject({
      status: 'failed',
      nextAction: 'REPAIR_EVIDENCE',
      failure: { class: 'EVIDENCE', code: 'LOCAL_SANDBOX_MUTATED_CANDIDATE' },
    });
  });

  test('revokes live authority when the candidate changes during execution', () => {
    let fingerprintReads = 0;
    const result = runJourneyTurn({
      journey,
      phase: 'live',
      candidate,
      allowExternalWrite: true,
      expectedFingerprint: candidate.fingerprint,
      currentFingerprint: () => (fingerprintReads++ === 0 ? candidate.fingerprint : 'd'.repeat(64)),
      spawn: () => ({ status: 0, signal: null, error: null, stdout: '', stderr: '' }),
    });
    expect(result).toMatchObject({
      status: 'blocked',
      nextAction: 'REINSPECT_CANDIDATE',
      failure: { class: 'AUTHORITY', code: 'CANDIDATE_FINGERPRINT_CHANGED' },
    });
  });

  test('fails closed when the local sandbox is unavailable', () => {
    const spawn = vi.fn();
    const first = runJourneyTurn({
      journey,
      phase: 'local',
      candidate,
      localSandboxExecutable: null,
      spawn,
    });
    const second = runJourneyTurn({
      journey,
      phase: 'local',
      candidate,
      environmentAttempt: 2,
      localSandboxExecutable: null,
      spawn,
    });
    expect(first).toMatchObject({
      status: 'retryable',
      nextAction: 'RETRY_ENVIRONMENT',
      failure: { class: 'ENVIRONMENT', code: 'LOCAL_SANDBOX_UNAVAILABLE' },
    });
    expect(second).toMatchObject({ status: 'blocked', nextAction: 'STOP_FOR_ENVIRONMENT' });
    expect(spawn).not.toHaveBeenCalled();
  });
});
