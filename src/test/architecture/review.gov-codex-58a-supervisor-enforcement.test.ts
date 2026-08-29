import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '74d24c0311e0d58112b15c58d6f8546449a5b01a';
const DOMAIN_ID = 'GOV-CODEX-58A-2026-08';
const HISTORICAL_GUARD_REAUTHORIZATION_PATHS = new Set([
  'src/online/headless/__tests__/review.o4p-02e-local-room-gate.test.ts',
  'src/online/headless/__tests__/review.o4p-05b-four-player-release-scenario.test.ts',
  'src/online/headless/__tests__/review.o4p-06b-playable-table-command-surface.test.ts',
  'src/test/architecture/review.o4p-04b-table-display-boundary.test.ts',
  'src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts',
  'src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts',
  'src/test/architecture/review.o4p-05d-production-release-closure.test.ts',
  'src/test/architecture/review.o4p-06-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-07-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-08-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-09-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-09c-pregame-lifecycle.test.ts',
]);
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

type CandidateProjection = {
  id?: string;
  domainId?: string;
  state?: string;
  releaseHeadSha?: string | null;
  authoritySource?: string;
  counters?: Record<string, number>;
  lineages?: { implementer?: unknown[]; coldAuditor?: unknown[] };
  waitChains?: { audit?: unknown[]; ci?: unknown[] };
};

type ContextProjection = {
  treeFingerprint?: string;
  health?: { ok?: boolean; errors?: unknown[] };
  supervisionEnforced?: boolean;
  activeCandidate?: CandidateProjection | null;
  permissionRequired?: Record<string, boolean> | null;
  supervisionPolicy?: { limits?: Record<string, number> };
  trackedSupervisor?: { ok?: boolean; latestEventHash?: string | null };
};

const runJson = (path: string, args: string[]): {
  status: number | null;
  bytes: number;
  value: Record<string, unknown>;
} => {
  const result = spawnSync('node', [path, ...args], { cwd: ROOT, encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe('');
  return {
    status: result.status,
    bytes: Buffer.byteLength(result.stdout),
    value: JSON.parse(result.stdout) as Record<string, unknown>,
  };
};

describe('GOV-CODEX-58A executable supervisor enforcement', () => {
  it('keeps the synchronized candidate, authority, and uncached watchdogs machine-readable', () => {
    const ledger = JSON.parse(read('research/cr-grounding/cr-backbone-ledger.json')) as {
      goalPolicy: {
        activeProgram: { domainIds: string[] };
        supervisionPolicy: {
          enforceFromDomainId: string;
          limits: Record<string, number>;
          candidateOverrides: Record<string, Record<string, number>>;
        };
      };
      domains: Array<Record<string, unknown> & { id?: string }>;
      plannedSequence: Array<Record<string, unknown> & { domainId?: string; type?: string }>;
    };
    const domain = ledger.domains.filter((entry) => entry.id === DOMAIN_ID);
    const planned = ledger.plannedSequence.filter((entry) => entry.domainId === DOMAIN_ID);
    expect(domain).toHaveLength(1);
    expect(planned).toHaveLength(1);
    const stripIdentity = (entry: Record<string, unknown>): Record<string, unknown> => {
      const copy = { ...entry };
      delete copy.id;
      delete copy.domainId;
      delete copy.type;
      return copy;
    };
    expect(stripIdentity(planned[0] ?? {})).toEqual(stripIdentity(domain[0] ?? {}));
    expect(ledger.goalPolicy.activeProgram.domainIds).toEqual([
      'O4P-09A', 'O4P-09B', 'O4P-09C', 'O4P-09C-UI', 'O4P-09D', 'O4P-09E',
      DOMAIN_ID, 'O4P-09F', 'O4P-09G', 'O4P-09H', 'O4P-09I', 'O4P-09J',
    ]);
    expect(ledger.goalPolicy.supervisionPolicy).toMatchObject({
      enforceFromDomainId: DOMAIN_ID,
      limits: {
        fullChecks: 2,
        supervisorModelCycles: 160,
        supervisorUncachedInputTokens: 1_000_000,
        teamModelCycles: 400,
        teamUncachedInputTokens: 1_600_000,
      },
    });
    expect(ledger.goalPolicy.supervisionPolicy.limits).not.toHaveProperty('supervisorInputTokens');
    expect(ledger.goalPolicy.supervisionPolicy.limits).not.toHaveProperty('teamInputTokens');
    expect(ledger.goalPolicy.supervisionPolicy.candidateOverrides).toEqual({
      [DOMAIN_ID]: {
        correctionWaves: 3,
        freshContinuationsPerLineage: 3,
        supervisorModelCycles: 360,
        supervisorUncachedInputTokens: 2_100_000,
        teamModelCycles: 620,
        teamUncachedInputTokens: 3_400_000,
      },
    });
    expect(ledger.goalPolicy.supervisionPolicy.limits).toMatchObject({
      freshContinuationsPerLineage: 1,
      supervisorModelCycles: 160,
      teamUncachedInputTokens: 1_600_000,
    });
    expect(domain[0]).toMatchObject({
      authoritySource: 'user-ruling:2026-08-28:GOV-CODEX-58A:end-to-end-release',
      deliveryClass: 'substrate',
      outcomeDeadlineDomainId: 'O4P-09F',
    });
  });

  it('projects one live candidate and makes the standalone budget gate agree', () => {
    const contextResult = runJson('scripts/codex-context.mjs', ['--domain', DOMAIN_ID]);
    const context = contextResult.value as ContextProjection;
    expect(contextResult.status).toBe(0);
    expect(contextResult.bytes).toBeLessThanOrEqual(12 * 1024);
    expect(context.health).toEqual({ ok: true, errors: [] });
    expect(context.supervisionEnforced).toBe(true);
    expect(context.trackedSupervisor?.ok).toBe(true);
    expect(context.treeFingerprint).toMatch(/^[0-9a-f]{64}$/u);
    expect(context.trackedSupervisor?.latestEventHash).toMatch(/^[0-9a-f]{64}$/u);
    const auditEnvelope = createHash('sha256').update(JSON.stringify({
      trackedAuthorityEventHash: context.trackedSupervisor?.latestEventHash,
      treeFingerprint: context.treeFingerprint,
    })).digest('hex');
    expect(auditEnvelope).toMatch(/^[0-9a-f]{64}$/u);
    expect(context.activeCandidate).toMatchObject({
      domainId: DOMAIN_ID,
      authoritySource: 'user-ruling:2026-08-28:GOV-CODEX-58A:end-to-end-release',
      releaseHeadSha: null,
    });
    expect(context.permissionRequired).toEqual({
      commit: false,
      deploy: false,
      localWrites: false,
      push: false,
      ship: false,
    });
    const counters = context.activeCandidate?.counters ?? {};
    const limits = context.supervisionPolicy?.limits ?? {};
    expect(counters).not.toHaveProperty('supervisorInputTokens');
    expect(counters).not.toHaveProperty('teamInputTokens');
    expect(context.activeCandidate?.lineages?.implementer).toHaveLength(1);
    expect(context.activeCandidate?.lineages?.coldAuditor?.length ?? 0).toBeLessThanOrEqual(1);
    expect(context.activeCandidate?.waitChains?.audit?.length ?? 0).toBeLessThanOrEqual(1);
    expect(context.activeCandidate?.waitChains?.ci?.length ?? 0).toBeLessThanOrEqual(1);

    const budgetResult = runJson('scripts/checks/budget.mjs', ['--domain', DOMAIN_ID]);
    expect(budgetResult.status).toBe(0);
    expect(budgetResult.value).toMatchObject({ ok: true, domain: DOMAIN_ID });
    expect(budgetResult.value.counters).toEqual(counters);
    expect(budgetResult.value.limits).toEqual(limits);
    const advisories = budgetResult.value.advisories as Array<{ counter?: string }> | undefined;
    expect(advisories).toBeInstanceOf(Array);
    for (const counter of [
      'fullChecks',
      'correctionWaves',
      'supervisorModelCycles',
      'supervisorUncachedInputTokens',
      'teamModelCycles',
      'teamUncachedInputTokens',
    ]) {
      if ((counters[counter] ?? 0) > (limits[counter] ?? Number.POSITIVE_INFINITY)) {
        expect(advisories).toEqual(expect.arrayContaining([
          expect.objectContaining({ code: 'WATCHDOG_THRESHOLD_EXCEEDED', counter }),
        ]));
      }
    }
  }, 120_000);

  it('wires all three gates into the existing skill and keeps the candidate governance-only', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(packageJson.scripts).toMatchObject({
      'codex:program-step': 'node scripts/codex-program-step.mjs',
      'check:budget': 'node scripts/checks/budget.mjs',
      'check:guard-impact': 'node scripts/checks/guard-impact.mjs',
    });
    const programStep = read('scripts/codex-program-step.mjs');
    const supervisorAuthority = read('scripts/lib/supervisor-authority.mjs');
    expect(programStep).toContain('--receipt-plan');
    expect(programStep).toContain('refresh-fingerprint');
    expect(programStep).toContain('releaseHeadSha');
    expect(supervisorAuthority).toContain('deriveUsageReceipt');
    expect(supervisorAuthority).toContain('HEAD_SUPERVISOR_AUTHORITY_READ_FAILED');
    const terminalMetadata = read('scripts/checks/terminal-metadata.mjs');
    expect(terminalMetadata).toContain('verifySupervisorAuthorityOffline');
    expect(terminalMetadata).toContain('latestEventHash');
    const skill = read('.agents/skills/mtg-onedeck-development/SKILL.md');
    const workflow = read(
      '.agents/skills/mtg-onedeck-development/references/document-governance.md',
    );
    const agents = read('AGENTS.md');
    const contract = read(
      'research/cr-grounding/gov-codex-58a-supervisor-enforcement.contract.draft.md',
    );
    for (const command of ['codex:program-step', 'check:budget', 'check:guard-impact']) {
      expect(skill, command).toContain(command);
      expect(workflow, command).toContain(command);
    }
    expect(workflow).toContain('one');
    expect(workflow).toContain('internal watchdogs');
    expect(workflow.replace(/\s+/gu, ' ')).toContain('replacement-push objective');
    expect(workflow).toContain('two release full-check attempts');
    expect(workflow).toContain('A final green `npm run check` on the audited release tree remains mandatory');
    expect(workflow.replace(/\s+/gu, ' ')).toContain('Never ask for a numeric budget extension');
    expect(agents).toContain('成果契約（最優先）');
    expect(agents).toContain('数値を許諾質問にしない');
    expect(contract).toContain('A token, cycle, correction,');
    expect(contract).toContain('is never itself a user decision');
    expect(contract).toContain('release full-check attempt objective: 2');
    expect(contract).toContain('a final green');
    expect(contract).toContain('releaseHeadSha');
    expect(contract).toContain('immutable prefix');
    expect(contract).toContain('clean checkout');
    expect(contract).toContain('A replacement push always requires the explicit push authority');
    expect(contract).toContain('terminal diff base');
    expect(contract).toContain('same-length/different-hash');

    const tracked = execFileSync('git', ['diff', '--name-only', BASE_SHA, '--'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).split(/\r?\n/u).filter(Boolean);
    const untracked = execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: ROOT, encoding: 'utf8' },
    ).split(/\r?\n/u).filter(Boolean);
    const paths = [...new Set([...tracked, ...untracked])];
    expect(paths).toContain('scripts/codex-program-step.mjs');
    expect(paths).toContain(
      'research/cr-grounding/gov-codex-58a-supervisor-enforcement.contract.draft.md',
    );
    expect(paths.filter((path) =>
      path.startsWith('src/') &&
      !path.startsWith('src/test/architecture/review.gov-codex-') &&
      !HISTORICAL_GUARD_REAUTHORIZATION_PATHS.has(path),
    )).toEqual([]);
    expect(paths.filter((path) => path.includes('GOV-CODEX-58B'))).toEqual([]);
    expect(paths).not.toContain('package-lock.json');
  });
});
