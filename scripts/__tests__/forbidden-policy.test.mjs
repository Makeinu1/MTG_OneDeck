import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { computeTreeFingerprint } from '../codex-context.mjs';
import { buildGuardImpact } from '../checks/guard-impact.mjs';
import { computeAcceptanceFingerprint, emptyCandidateCounters } from '../lib/supervisor-state.mjs';
import {
  createSupervisorBootstrap,
  createSupervisorEvent,
  hashSupervisorEvent,
  supervisorAuthorityPath,
} from '../lib/supervisor-authority.mjs';

const FORBIDDEN_SCRIPT = join(process.cwd(), 'scripts/checks/forbidden-files.mjs');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function createRepository() {
  const cwd = mkdtempSync(join(tmpdir(), 'onedeck-forbidden-policy-'));
  mkdirSync(join(cwd, 'src', 'engine'), { recursive: true });
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'validation@example.test');
  git(cwd, 'config', 'user.name', 'Validation Test');
  writeFileSync(join(cwd, 'src', 'engine', 'example.ts'), 'export const value = 1;\n');
  writeFileSync(join(cwd, 'AGENTS.md'), 'baseline\n');
  git(cwd, 'add', 'src/engine/example.ts', 'AGENTS.md');
  git(cwd, 'commit', '-m', 'base');
  const base = git(cwd, 'rev-parse', 'HEAD');
  return { cwd, base };
}

function run(repository, ...args) {
  return spawnSync(process.execPath, [FORBIDDEN_SCRIPT, ...args], {
    cwd: repository.cwd,
    encoding: 'utf8',
  });
}

const DOMAIN_ID = 'GOV-CODEX-58A-2026-08';
const SUPERVISOR_ID = '11111111-1111-4111-8111-111111111111';
const IMPLEMENTER_ID = '22222222-2222-4222-8222-222222222222';
const AUDITOR_ID = '33333333-3333-4333-8333-333333333333';
const candidateAuthority = { commit: true, deploy: true, localWrites: true, push: true, ship: true };

function write(repository, path, value) {
  const target = join(repository.cwd, path);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, value);
}

function governedLedger() {
  const domain = {
    id: DOMAIN_ID,
    status: 'drafted',
    dependsOn: [],
    deliveryClass: 'player-outcome',
    playerOutcome: 'Forbidden scanner fixture',
    journeyEvidence: ['production-browser:fixture'],
    outcomeDeadlineDomainId: DOMAIN_ID,
    boundary: 'fixture',
    landingState: ['fixture'],
    manualBoundary: 'none',
    evidence: ['contract.md', 'acceptance.md'],
  };
  return {
    object: 'fixture',
    selectionRule: 'fixture',
    statusDefinitions: { pending: 'pending', drafted: 'drafted', shipped: 'shipped' },
    judgePolicy: { reference: 'fixture' },
    goalPolicy: {
      activeProgram: {
        id: 'PROGRAM',
        domainIds: [DOMAIN_ID],
        authority: candidateAuthority,
        autonomy: { mode: 'complete' },
        journeyPolicy: { maxConsecutiveSubstrate: 2, enforceFromDomainId: DOMAIN_ID, legacyDebtDomainIds: [] },
        usagePolicy: { enforceFromDomainId: DOMAIN_ID },
      },
      supervisionPolicy: {
        version: 1,
        enforceFromDomainId: DOMAIN_ID,
        limits: {
          implementerLineages: 1,
          coldAuditorLineages: 1,
          auditWaitChains: 1,
          ciWaitChains: 1,
          correctionWaves: 2,
          fullChecks: 2,
          semanticPushes: 1,
          replacementPushes: 1,
          compactionsPerLineage: 2,
          freshContinuationsPerLineage: 1,
          supervisorModelCycles: 160,
          supervisorUncachedInputTokens: 1_000_000,
          teamModelCycles: 400,
          teamUncachedInputTokens: 1_600_000,
        },
        candidateOverrides: {
          [DOMAIN_ID]: {
            correctionWaves: 3,
            freshContinuationsPerLineage: 3,
            supervisorModelCycles: 360,
            supervisorUncachedInputTokens: 2_100_000,
            teamModelCycles: 620,
            teamUncachedInputTokens: 3_400_000,
          },
        },
      },
    },
    domains: [domain],
    plannedSequence: [{ ...structuredClone(domain), domainId: DOMAIN_ID }],
  };
}

function createGovernedRepository(extraForbiddenPath = null) {
  const repository = createRepository();
  repository.seed = repository.base;
  const ledger = governedLedger();
  write(repository, 'research/cr-grounding/cr-backbone-ledger.json', `${JSON.stringify(ledger, null, 2)}\n`);
  write(repository, 'research/cr-grounding/reauthorization.md', 'baseline\n');
  const reviewedBaseline = 'export const reviewed = 1;\n';
  const reviewedBaselineSha = createHash('sha256').update(reviewedBaseline).digest('hex');
  write(repository, 'src/test/architecture/review.fixture.test.ts', reviewedBaseline);
  write(repository, 'scripts/guard.mjs', [
    "export const protectedPath = 'src/test/architecture/review.fixture.test.ts';",
    `export const predecessorSha256 = '${reviewedBaselineSha}';`,
  ].join('\n'));
  write(repository, 'CLAUDE.md', 'baseline\n');
  write(repository, 'eslint.config.js', 'export default [];\n');
  git(repository.cwd, 'add', '.');
  git(repository.cwd, 'commit', '-m', 'governed base');
  const semanticBase = git(repository.cwd, 'rev-parse', 'HEAD');
  const domain = ledger.domains[0];
  const counters = {
    ...emptyCandidateCounters(),
    supervisorModelCycles: 1,
    supervisorUncachedInputTokens: 1,
    teamModelCycles: 2,
    teamUncachedInputTokens: 2,
    implementerLineages: 1,
    coldAuditorLineages: 1,
    auditWaitChains: 1,
    fullChecks: 1,
  };
  const candidate = {
    version: 1,
    id: `${DOMAIN_ID}-candidate-1`,
    domainId: DOMAIN_ID,
    state: 'repair-required',
    baseSha: semanticBase,
    treeFingerprint: computeTreeFingerprint(repository.cwd),
    acceptanceFingerprint: computeAcceptanceFingerprint(domain),
    authority: candidateAuthority,
    authoritySource: 'goalPolicy.activeProgram.authority',
    counters,
    lineages: {
      implementer: [{ id: IMPLEMENTER_ID, compactions: 0, freshContinuations: 0 }],
      coldAuditor: [{ id: AUDITOR_ID, compactions: 0, freshContinuations: 0 }],
    },
    waitChains: { audit: [AUDITOR_ID], ci: [] },
    guardImpact: { reportFingerprint: null, acknowledgement: null },
    repairReason: 'guard-impact',
  };
  const receiptFor = (contextFingerprint) => ({
    version: 1,
    contextFingerprint,
    baseline: { modelCycles: 0, uncachedInputTokens: 0 },
    supervisor: { sessionId: SUPERVISOR_ID, role: 'supervisor', byteLength: 1, prefixSha256: 'a'.repeat(64) },
    participants: [
      { sessionId: IMPLEMENTER_ID, role: 'implementer', byteLength: 1, prefixSha256: 'b'.repeat(64) },
      { sessionId: AUDITOR_ID, role: 'cold-auditor', byteLength: 1, prefixSha256: 'c'.repeat(64) },
    ],
    observed: {
      supervisorModelCycles: 1,
      supervisorUncachedInputTokens: 1,
      teamModelCycles: 2,
      teamUncachedInputTokens: 2,
      cachedInputTokens: 0,
      totalInputTokens: 2,
    },
  });
  const receipt = receiptFor(candidate.treeFingerprint);
  const path = supervisorAuthorityPath(DOMAIN_ID);
  let authority = createSupervisorBootstrap({
    candidate,
    receipt,
    actorSessionId: SUPERVISOR_ID,
    actorRole: 'supervisor',
  });
  write(repository, path, `${JSON.stringify(authority, null, 2)}\n`);
  git(repository.cwd, 'add', '.');
  git(repository.cwd, 'commit', '-m', 'tracked authority anchor');
  repository.base = git(repository.cwd, 'rev-parse', 'HEAD');

  write(repository, 'research/cr-grounding/reauthorization.md', 'judge evidence\n');
  write(repository, 'src/test/architecture/review.fixture.test.ts', 'export const reviewed = 2;\n');
  if (extraForbiddenPath) write(repository, extraForbiddenPath, 'judge-authorized change\n');
  const append = (action, nextCandidate, nextReceipt = receiptFor(nextCandidate.treeFingerprint)) => {
    authority.events.push(createSupervisorEvent({
      sequence: authority.events.length,
      action,
      actorSessionId: SUPERVISOR_ID,
      actorRole: 'supervisor',
      candidate: nextCandidate,
      receipt: nextReceipt,
      previousHash: authority.events.at(-1).eventHash,
    }));
  };
  let nextCandidate = structuredClone(candidate);
  nextCandidate.id = `${DOMAIN_ID}-candidate-2`;
  nextCandidate.repairOf = candidate.id;
  nextCandidate.state = 'implementing';
  nextCandidate.baseSha = repository.base;
  delete nextCandidate.repairReason;
  append('derive-repair', nextCandidate);

  nextCandidate = structuredClone(nextCandidate);
  nextCandidate.treeFingerprint = computeTreeFingerprint(repository.cwd);
  const report = buildGuardImpact({
    root: repository.cwd,
    base: repository.base,
    domain: DOMAIN_ID,
    projection: { activeCandidate: nextCandidate },
  });
  nextCandidate.guardImpact = {
    reportFingerprint: report.reportFingerprint,
    acknowledgement: report.acknowledgementRequired,
  };
  append('refresh-fingerprint', nextCandidate);
  nextCandidate = { ...structuredClone(nextCandidate), state: 'audit-ready' };
  append('mark-audit-ready', nextCandidate);
  nextCandidate = { ...structuredClone(nextCandidate), state: 'audited' };
  append('mark-audited', nextCandidate);
  nextCandidate = structuredClone(nextCandidate);
  nextCandidate.counters.fullChecks += 1;
  append('start-full-check', nextCandidate);
  nextCandidate = { ...structuredClone(nextCandidate), state: 'full-check-passed' };
  append('mark-full-check-passed', nextCandidate);
  nextCandidate = { ...structuredClone(nextCandidate), state: 'push-ready' };
  append('commit', nextCandidate);
  authority.candidateId = nextCandidate.id;
  write(repository, path, `${JSON.stringify(authority, null, 2)}\n`);
  git(repository.cwd, 'add', '.');
  git(repository.cwd, 'commit', '-m', 'judge-owned candidate');
  return { ...repository, path };
}

function mutateAcknowledgement(repository, mutate) {
  const authority = JSON.parse(readFileSync(join(repository.cwd, repository.path), 'utf8'));
  const latest = authority.events.at(-1);
  mutate(latest.candidate.guardImpact.acknowledgement);
  latest.eventHash = hashSupervisorEvent(latest);
  write(repository, repository.path, `${JSON.stringify(authority, null, 2)}\n`);
  git(repository.cwd, 'add', repository.path);
  git(repository.cwd, 'commit', '-m', 'mutated acknowledgement');
}

test('supervisor-event size never changes guard references or fingerprints', () => {
  const repository = createGovernedRepository();
  const activeCandidate = JSON.parse(readFileSync(join(repository.cwd, repository.path), 'utf8')).events.at(-1).candidate;
  const changedPath = 'src/test/architecture/review.fixture.test.ts';
  const reportFor = (padding) => {
    write(repository, repository.path, JSON.stringify({ changedPath, padding }));
    return buildGuardImpact({
      root: repository.cwd,
      base: repository.base,
      domain: DOMAIN_ID,
      projection: { activeCandidate },
    });
  };
  const small = reportFor('x');
  const large = reportFor('x'.repeat(2_000_001));
  expect(small.guards).toEqual(large.guards);
  expect(small.predecessorHashes).toEqual(large.predecessorHashes);
  expect(small.reportFingerprint).toBe(large.reportFingerprint);
  expect(small.guards).toEqual(expect.arrayContaining([
    expect.objectContaining({ changedPath, guardPath: 'scripts/guard.mjs' }),
  ]));
});

function rehashAuthority(authority) {
  let previousHash = null;
  for (const event of authority.events) {
    event.previousHash = previousHash;
    event.eventHash = hashSupervisorEvent(event);
    previousHash = event.eventHash;
  }
}

describe('forbidden policy boundaries', () => {
  test('default policy allows ordinary source changes', () => {
    const repository = createRepository();
    try {
      writeFileSync(join(repository.cwd, 'src/engine/example.ts'), 'export const value = 2;\n');
      const result = run(repository, '--diff', repository.base);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('NEEDS-REAUTH');
      expect(result.stdout).not.toContain('FORBIDDEN(');
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('default policy protects governance files', () => {
    const repository = createRepository();
    try {
      writeFileSync(join(repository.cwd, 'AGENTS.md'), 'changed\n');
      const result = run(repository, '--diff', repository.base);
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status).toBe(1);
      expect(output).toContain('FORBIDDEN');
      expect(output).toContain('AGENTS.md');
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('accepts exact supervisor-proven Judge review and research bytes after commit', () => {
    const repository = createGovernedRepository();
    try {
      const result = run(repository, '--diff', repository.base);
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status, output).toBe(0);
      expect(output).toContain('JUDGE-REAUTHORIZED');
      expect(output).not.toContain('FORBIDDEN(');
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test.each([
    ['omitted path', (acknowledgement) => { acknowledgement.paths.shift(); }],
    ['additional path', (acknowledgement) => {
      acknowledgement.paths.push({
        path: 'docs/extra.md',
        owner: 'judge',
        base: { kind: 'absent', sha256: null },
        current: { kind: 'file', sha256: 'd'.repeat(64) },
      });
    }],
    ['wildcard path', (acknowledgement) => { acknowledgement.paths[0].path = 'src/**'; }],
    ['wrong candidate', (acknowledgement) => { acknowledgement.candidateId = 'forged-candidate'; }],
    ['wrong tree', (acknowledgement) => { acknowledgement.candidateTreeFingerprint = '0'.repeat(64); }],
    ['wrong guard ID', (acknowledgement) => { acknowledgement.guardReferenceIds = ['0'.repeat(64)]; }],
    ['wrong predecessor ID', (acknowledgement) => { acknowledgement.predecessorHashReferenceIds = ['0'.repeat(64)]; }],
    ['additional unknown guard ID', (acknowledgement) => { acknowledgement.guardReferenceIds.push('e'.repeat(64)); }],
    ['additional unknown predecessor ID', (acknowledgement) => {
      acknowledgement.predecessorHashReferenceIds.push('e'.repeat(64));
    }],
  ])('rejects %s in tracked acknowledgement', (_, mutate) => {
    const repository = createGovernedRepository();
    try {
      mutateAcknowledgement(repository, mutate);
      const result = run(repository, '--diff', repository.base);
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status).toBe(1);
      expect(output).toContain('JUDGE-REAUTHORIZATION-REJECTED');
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('rejects stale Judge bytes, wrong base, corrupt authority, and extra authority paths', () => {
    for (const defect of ['stale-byte', 'wrong-base', 'corrupt-authority', 'extra-authority']) {
      const repository = createGovernedRepository();
      try {
        let base = repository.base;
        if (defect === 'stale-byte') {
          write(repository, 'src/test/architecture/review.fixture.test.ts', 'export const reviewed = 3;\n');
          git(repository.cwd, 'add', '.');
          git(repository.cwd, 'commit', '-m', 'stale reviewed bytes');
        } else if (defect === 'wrong-base') {
          base = repository.seed;
        } else if (defect === 'corrupt-authority') {
          const authority = JSON.parse(readFileSync(join(repository.cwd, repository.path), 'utf8'));
          authority.events[0].eventHash = '0'.repeat(64);
          write(repository, repository.path, `${JSON.stringify(authority, null, 2)}\n`);
          git(repository.cwd, 'add', repository.path);
          git(repository.cwd, 'commit', '-m', 'corrupt authority');
        } else {
          write(repository, supervisorAuthorityPath('OTHER'), '{"unexpected":true}\n');
          git(repository.cwd, 'add', '.');
          git(repository.cwd, 'commit', '-m', 'extra authority');
        }
        const result = run(repository, '--diff', base);
        const output = `${result.stdout}${result.stderr}`;
        expect(result.status, defect).toBe(1);
        expect(output).toContain('JUDGE-REAUTHORIZATION-REJECTED');
      } finally {
        rmSync(repository.cwd, { recursive: true, force: true });
      }
    }
  }, 15_000);

  test('rejects an implementer-authored acknowledgement even with a fully rehashed chain', () => {
    const repository = createGovernedRepository();
    try {
      const authority = JSON.parse(readFileSync(join(repository.cwd, repository.path), 'utf8'));
      const refresh = authority.events.find((event) => event.action === 'refresh-fingerprint');
      refresh.actorRole = 'implementer';
      refresh.actorSessionId = IMPLEMENTER_ID;
      rehashAuthority(authority);
      write(repository, repository.path, `${JSON.stringify(authority, null, 2)}\n`);
      git(repository.cwd, 'add', repository.path);
      git(repository.cwd, 'commit', '-m', 'implementer-authored acknowledgement');
      const result = run(repository, '--diff', repository.base);
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain('JUDGE-REAUTHORIZATION-REJECTED');
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('does not accept caller-provided owner or use reauthorization in governance-reset mode', () => {
    const repository = createGovernedRepository();
    try {
      expect(run(repository, '--diff', repository.base, '--owner', 'judge').status).toBe(2);
      const reset = run(repository, '--diff', repository.base, '--policy', 'governance-reset');
      expect(reset.status).toBe(1);
      expect(`${reset.stdout}${reset.stderr}`).not.toContain('JUDGE-REAUTHORIZED:');
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test.each(['AGENTS.md', 'CLAUDE.md', 'eslint.config.js'])(
    'keeps non-review hard path %s forbidden even inside an exact acknowledgement',
    (path) => {
      const repository = createGovernedRepository(path);
      try {
        const result = run(repository, '--diff', repository.base);
        const output = `${result.stdout}${result.stderr}`;
        expect(result.status).toBe(1);
        expect(output).toContain(path === 'AGENTS.md'
          ? 'JUDGE-REAUTHORIZATION-REJECTED: INVALID_AGENTS_REAUTHORIZATION_EPOCH'
          : 'JUDGE-REAUTHORIZATION-REJECTED: NON_REVIEW_FORBIDDEN_PATH');
        expect(output).toContain(path);
      } finally {
        rmSync(repository.cwd, { recursive: true, force: true });
      }
    },
  );

  test('governance-reset is restrictive only when explicitly selected', () => {
    const repository = createRepository();
    try {
      writeFileSync(join(repository.cwd, 'src/engine/example.ts'), 'export const value = 2;\n');
      const result = run(repository, '--diff', repository.base, '--policy', 'governance-reset');
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status).toBe(1);
      expect(output).toContain('DOC-GOV-RESET scope');
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });

  test('invalid diff references never succeed', () => {
    const repository = createRepository();
    try {
      const result = run(repository, '--diff', 'missing-base');
      expect(result.status).not.toBe(0);
    } finally {
      rmSync(repository.cwd, { recursive: true, force: true });
    }
  });
});
