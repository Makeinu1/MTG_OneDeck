import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '69559e13716e9d0767d8189714d8c14fb630db46';
const LEDGER_PATH = 'research/cr-grounding/cr-backbone-ledger.json';
const IDS = ['O4P-06A', 'O4P-06B', 'O4P-06C', 'O4P-06D', 'O4P-06E', 'O4P-06F'] as const;
const DEPENDENCIES = ['O4P-05D', 'O4P-06A', 'O4P-06B', 'O4P-06C', 'O4P-06D', 'O4P-06E'] as const;
const LANDING_STATES = [
  ['fourDeckBootstrap', 'deterministicRoomGenesis', 'roomStateSizeBudget'],
  ['playableCommandSurface', 'genericZoneMovement', 'permanentStateActions', 'turnPhaseActions'],
  ['formingLobby', 'seatDeckSubmission', 'readyStart', 'inviteCapability', 'browserCorsPolicy'],
  ['browserWebSocketClient', 'acknowledgedOutbox', 'snapshotResync', 'reconnectRecovery'],
  ['publicOnlineEntry', 'roomCreateJoinInvite', 'personalTableGuidedIntegration', 'responsiveOnlineUI'],
  ['fourBrowserAcceptance', 'fourRealDeckAcceptance', 'productionRelease', 'releaseClosure'],
] as const;
const REGISTRATION_EVIDENCE = [
  'research/cr-grounding/o4p-06-playable-four-player-roadmap.contract.draft.md',
  'research/cr-grounding/o4p-06-roadmap-registration-acceptance.draft.md',
  'research/cr-grounding/planned-sequence-batch-o4p-06.draft.md',
  'research/cr-grounding/o4p-06-roadmap-ledger-update.draft.json',
  'user-ruling:2026-08-15:playable-four-player-web-mvp',
] as const;
const REQUIRED_CHANGED_PATHS = [
  LEDGER_PATH,
  ...REGISTRATION_EVIDENCE.slice(0, 4),
  'research/cr-grounding/o4p-06-roadmap-registration-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-06-roadmap-registration-predecessor-gate-repair-1.draft.md',
  'research/cr-grounding/o4p-06-roadmap-registration-full-check-repair-1.draft.md',
  'scripts/checks/verify-o4p-05d-production-release-closure.ts',
  'scripts/checks/verify-o4p-05c-release-gates.ts',
  'src/test/architecture/review.o4p-04b-table-display-boundary.test.ts',
  'src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts',
  'src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts',
  'src/test/architecture/review.o4p-05d-production-release-closure.test.ts',
  'src/test/architecture/review.o4p-06-roadmap-registration.test.ts',
] as const;
const OPTIONAL_AUDIT_RECORD = 'research/cr-grounding/archive/o4p-06-roadmap-registration-cold-audit-2026-08-15.md';

type Entry = {
  id?: string;
  domainId?: string;
  type?: string;
  crOrder?: number;
  crRefs?: string[];
  lane?: string;
  edhValue?: string;
  status: string;
  dependsOn?: string[];
  landingState?: string[];
  boundary?: string;
  evidence?: string[];
  manualBoundary?: string;
  nextGate?: string;
  judge?: string;
  note?: string;
};

type Ledger = {
  goalPolicy: Record<string, unknown> & {
    activeProgram?: { id?: string; domainIds?: string[] };
  };
  plannedSequence: Entry[];
  domains: Entry[];
  [key: string]: unknown;
};

function text(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function parseLedger(raw: string): Ledger {
  return JSON.parse(raw) as Ledger;
}

function withoutCollections(ledger: Ledger): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...ledger };
  delete copy.goalPolicy;
  delete copy.plannedSequence;
  delete copy.domains;
  return copy;
}

function withoutActiveProgram(goalPolicy: Ledger['goalPolicy']): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...goalPolicy };
  delete copy.activeProgram;
  return copy;
}

function sharedEntry(entry: Entry): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...entry };
  delete copy.id;
  delete copy.domainId;
  delete copy.type;
  return copy;
}

function changedPaths(): string[] {
  const tracked = execFileSync('git', ['diff', '--name-only', BASE_SHA], {
    cwd: ROOT,
    encoding: 'utf8',
  }).split(/\r?\n/).filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).split(/\r?\n/).filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

describe('O4P-06 playable four-player roadmap registration', () => {
  it('appends six pending parents without mutating shipped ledger history', () => {
    const before = parseLedger(execFileSync('git', ['show', `${BASE_SHA}:${LEDGER_PATH}`], {
      cwd: ROOT,
      encoding: 'utf8',
    }));
    const after = parseLedger(text(LEDGER_PATH));

    expect(withoutCollections(after)).toEqual(withoutCollections(before));
    expect(withoutActiveProgram(after.goalPolicy)).toEqual(withoutActiveProgram(before.goalPolicy));
    expect(after.goalPolicy.activeProgram).toEqual({ id: 'O4P-06', domainIds: IDS });
    expect(after.domains.slice(0, before.domains.length)).toEqual(before.domains);
    expect(after.plannedSequence.slice(0, before.plannedSequence.length)).toEqual(before.plannedSequence);
    expect(after.domains).toHaveLength(before.domains.length + IDS.length);
    expect(after.plannedSequence).toHaveLength(before.plannedSequence.length + IDS.length);
  });

  it('keeps both collections synchronized in the approved A-to-F order', () => {
    const ledger = parseLedger(text(LEDGER_PATH));
    for (const [index, id] of IDS.entries()) {
      const domains = ledger.domains.filter((entry) => entry.id === id);
      const planned = ledger.plannedSequence.filter((entry) => entry.domainId === id);
      expect(domains, `${id} domains count`).toHaveLength(1);
      expect(planned, `${id} planned count`).toHaveLength(1);
      expect(planned[0]?.type, id).toBe('checkpoint');
      expect(sharedEntry(planned[0]), id).toEqual(sharedEntry(domains[0]));
      expect(domains[0], id).toMatchObject({
        crOrder: 1018 + index,
        crRefs: [],
        lane: 'backbone',
        edhValue: 'high',
        status: 'pending',
        dependsOn: [DEPENDENCIES[index]],
        landingState: LANDING_STATES[index],
        evidence: REGISTRATION_EVIDENCE,
        judge: 'Sol-orchestrator-2026-08-15',
      });
      expect(domains[0]?.note, id).toContain('product behavior remains unimplemented');
    }
  });

  it('freezes the product phase boundaries and keeps references idea-only', () => {
    const contract = text('research/cr-grounding/o4p-06-playable-four-player-roadmap.contract.draft.md');
    const acceptance = text('research/cr-grounding/o4p-06-roadmap-registration-acceptance.draft.md');
    for (const heading of [
      'Four Real-Deck Bootstrap & Size Gate',
      'Playable Table Command Surface',
      'Browser-Safe Lobby & Invite API',
      'Browser WebSocket, Outbox & Recovery',
      'Public App Four-Player Integration',
      'Four-Browser Production Acceptance & Release',
    ]) expect(contract).toContain(heading);
    for (const repository of [
      'github.com/Cockatrice/Webatrice',
      'github.com/cloudflare/partykit',
      'github.com/boardgameio/boardgame.io',
      'github.com/Tehes/poker',
    ]) expect(contract).toContain(repository);
    expect(contract).toMatch(/do\s+not authorize copying code/);
    expect(contract).toContain('Registering O4P-06 changes selection policy');
    expect(contract).toContain('A failed measurement is fail-closed');
    expect(contract).toContain('until a bounded alternative is implemented and');
    expect(acceptance).toContain('a design decision alone');
    expect(acceptance).toContain('does not start O4P-06A');
  });

  it('admits only Judge-owned roadmap registration files', () => {
    const changed = changedPaths();
    const allowed = new Set<string>([...REQUIRED_CHANGED_PATHS, OPTIONAL_AUDIT_RECORD]);
    for (const path of REQUIRED_CHANGED_PATHS) expect(changed, path).toContain(path);
    for (const path of changed) expect(allowed.has(path), `unexpected changed path: ${path}`).toBe(true);
    expect(text('package-lock.json')).toBe(
      execFileSync('git', ['show', `${BASE_SHA}:package-lock.json`], { cwd: ROOT, encoding: 'utf8' }),
    );
  });

  it('selects O4P-06A through the healthy explicit active program', () => {
    const projection = JSON.parse(execFileSync('node', ['scripts/codex-context.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    })) as {
      health?: { ok?: boolean; errors?: unknown[] };
      selection?: { kind?: string; domainId?: string; reason?: string };
      activeProgram?: { id?: string; status?: string; nextDomainId?: string };
      loopState?: { status?: string };
    };
    expect(projection.health).toEqual({ ok: true, errors: [] });
    expect(projection.selection).toMatchObject({
      kind: 'selected', domainId: 'O4P-06A', reason: 'active-program-order',
    });
    expect(projection.activeProgram).toMatchObject({
      id: 'O4P-06', status: 'active', nextDomainId: 'O4P-06A',
    });
    expect(projection.loopState?.status).toBe('current');
    expect(() => execFileSync('git', ['diff', '--check'], { cwd: ROOT, encoding: 'utf8' })).not.toThrow();
  });

  it('extends the O4P-05D gate only for the exact O4P-06 successor', () => {
    const predecessorReview = text('src/test/architecture/review.o4p-05d-production-release-closure.test.ts');
    const predecessorVerifier = text('scripts/checks/verify-o4p-05d-production-release-closure.ts');
    for (const source of [predecessorReview, predecessorVerifier]) {
      expect(source).toContain("id: 'O4P-05'");
      expect(source).toContain("id: 'O4P-06'");
      expect(source).toContain('O4P-06F');
      expect(source).not.toContain("id: 'O4P-07'");
    }
  });

  it('registers exact O4P-06 metadata in the three invalidated UI predecessor guards', () => {
    for (const path of [
      'src/test/architecture/review.o4p-04b-table-display-boundary.test.ts',
      'src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts',
      'src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts',
    ]) {
      const predecessor = text(path);
      expect(predecessor).toContain('o4p-06-playable-four-player-roadmap');
      expect(predecessor).toContain('o4p-06-roadmap-registration-cold-audit-2026-08-15');
      expect(predecessor).toContain('review\\.o4p-06-roadmap-registration');
      expect(predecessor).not.toContain('review\\.o4p-07');
    }
  });
});
