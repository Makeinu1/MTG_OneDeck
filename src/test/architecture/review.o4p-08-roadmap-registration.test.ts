import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '2973e60942623d57e6af53a5e36cb488a26f56b7';
const LEDGER_PATH = 'research/cr-grounding/cr-backbone-ledger.json';
const IDS = ['O4P-08A', 'O4P-08B', 'O4P-08C', 'O4P-08D'] as const;
const DEPENDENCIES = ['O4P-07C', 'O4P-08A', 'O4P-08B', 'O4P-08C'] as const;
const REGISTRATION_EVIDENCE = [
  'research/cr-grounding/o4p-08-online-room-ux-two-player-roadmap.contract.draft.md',
  'research/cr-grounding/o4p-08-roadmap-registration-acceptance.draft.md',
  'research/cr-grounding/planned-sequence-batch-o4p-08.draft.md',
  'research/cr-grounding/o4p-08-roadmap-ledger-update.draft.json',
  'user-ruling:2026-08-23:online-room-ux-two-player-flexible-deck',
  'research/cr-grounding/archive/o4p-08-roadmap-registration-cold-audit-record-2026-08-23.md',
] as const;

type Entry = Record<string, unknown> & { id?: string; domainId?: string; status?: string };
type Ledger = {
  goalPolicy: Record<string, unknown> & { activeProgram?: { id?: string; domainIds?: string[] } };
  plannedSequence: Entry[];
  domains: Entry[];
  [key: string]: unknown;
};

const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');
const parse = (raw: string): Ledger => JSON.parse(raw) as Ledger;
const withoutCollections = (ledger: Ledger): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...ledger };
  delete copy.goalPolicy;
  delete copy.plannedSequence;
  delete copy.domains;
  return copy;
};
const withoutActiveProgram = (policy: Ledger['goalPolicy']): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...policy };
  delete copy.activeProgram;
  return copy;
};
const shared = (entry: Entry): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...entry };
  delete copy.id;
  delete copy.domainId;
  delete copy.type;
  return copy;
};

describe('O4P-08 Online room UX and two-player roadmap registration', () => {
  it('appends one exact four-parent active program without rewriting history', () => {
    const before = parse(execFileSync('git', ['show', `${BASE_SHA}:${LEDGER_PATH}`], {
      cwd: ROOT,
      encoding: 'utf8',
    }));
    const after = parse(read(LEDGER_PATH));
    expect(withoutCollections(after)).toEqual(withoutCollections(before));
    expect(withoutActiveProgram(after.goalPolicy)).toEqual(withoutActiveProgram(before.goalPolicy));
    expect(after.goalPolicy.activeProgram).toEqual({ id: 'O4P-08', domainIds: IDS });
    expect(after.domains.slice(0, before.domains.length)).toEqual(before.domains);
    expect(after.plannedSequence.slice(0, before.plannedSequence.length)).toEqual(before.plannedSequence);
    expect(after.domains).toHaveLength(before.domains.length + IDS.length);
    expect(after.plannedSequence).toHaveLength(before.plannedSequence.length + IDS.length);
  });

  it('keeps both collections synchronized in A-to-D order', () => {
    const ledger = parse(read(LEDGER_PATH));
    for (const [index, id] of IDS.entries()) {
      const domains = ledger.domains.filter((entry) => entry.id === id);
      const planned = ledger.plannedSequence.filter((entry) => entry.domainId === id);
      expect(domains, `${id} domains`).toHaveLength(1);
      expect(planned, `${id} planned`).toHaveLength(1);
      expect(shared(planned[0] ?? {}), id).toEqual(shared(domains[0] ?? {}));
      expect(domains[0], id).toMatchObject({
        crOrder: 1028 + index,
        status: 'pending',
        dependsOn: [DEPENDENCIES[index]],
        lane: 'backbone',
        edhValue: 'high',
        evidence: REGISTRATION_EVIDENCE,
      });
    }
  });

  it('freezes the user-approved journey, moderation, recovery, and roster semantics', () => {
    const contract = read('research/cr-grounding/o4p-08-online-room-ux-two-player-roadmap.contract.draft.md');
    for (const term of [
      'one shared invitation link',
      'same-browser recovery record',
      'kick a non-host player only before start',
      'correlation ID',
      '`playerCount` is 2 or 4',
      'P3/P4 are absent',
      '40, 60, or 100 cards and zero commanders',
      'O4P-08D, not a protocol endpoint',
    ]) expect(contract).toContain(term);
    expect(contract).toContain('starting life is 20 or 40 for two-player');
    expect(contract).toContain('does not add deck-legality enforcement, accounts, matchmaking, bans, teams');
  });

  it('projects a healthy O4P-08A selection', () => {
    const context = spawnSync('node', ['scripts/codex-context.mjs', '--domain', 'O4P-08A'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(context.error).toBeUndefined();
    expect(context.signal).toBeNull();
    expect(context.stderr).toBe('');
    const projection = JSON.parse(context.stdout) as {
      health?: { ok?: boolean; errors?: unknown[] };
      selection?: unknown;
      activeProgram?: unknown;
      loopState?: { status?: string };
    };
    expect(projection.health).toEqual({ ok: true, errors: [] });
    expect(projection.selection).toEqual({
      kind: 'selected', domainId: 'O4P-08A', reason: 'explicit-domain',
    });
    expect(projection.activeProgram).toEqual({
      id: 'O4P-08', domainIds: IDS, status: 'active', nextDomainId: 'O4P-08A',
    });
    expect(context.status).toBe(projection.loopState?.status === 'current' ? 0 : 5);
  });

  it('changes only Judge-owned registration and exact historical guards', () => {
    const changed = execFileSync('git', ['diff', '--name-only', BASE_SHA], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split(/\r?\n/u).filter(Boolean);
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split(/\r?\n/u).filter(Boolean);
    const allowed = new Set([
      LEDGER_PATH,
      ...REGISTRATION_EVIDENCE.slice(0, 4),
      'research/cr-grounding/o4p-08-roadmap-registration-cold-audit-brief.draft.md',
      'research/cr-grounding/archive/o4p-08-roadmap-registration-cold-audit-record-2026-08-23.md',
      'scripts/checks/verify-o4p-05d-production-release-closure.ts',
      'scripts/checks/verify-o4p-05c-release-gates.ts',
      'src/online/cloudflare/persistence.ts',
      'src/online/cloudflare/runtime.ts',
      'src/online/cloudflare/support.ts',
      'src/online/cloudflare/worker.ts',
      'src/online/cloudflare/__tests__/review.o4p-08a-membership-runtime.test.ts',
      'src/online/lobby/index.ts',
      'src/online/lobby/__tests__/review.o4p-08a-shared-membership.test.ts',
      'src/online/publicApp/index.ts',
      'src/online/publicApp/types.ts',
      'src/online/publicApp/v2.ts',
      'src/online/publicApp/recoveryV1.ts',
      'src/online/publicApp/review.o4p-08a-recovery-client.test.ts',
      'research/cr-grounding/o4p-08a-shared-membership-recovery-errors.contract.draft.md',
      'research/cr-grounding/o4p-08a-acceptance-brief.draft.md',
      'research/cr-grounding/o4p-08a-implementation-brief.draft.md',
      'research/cr-grounding/o4p-08a-cold-audit-brief.draft.md',
      'research/cr-grounding/archive/o4p-08a-cold-audit-record-2026-08-24.md',
      'src/test/architecture/review.o4p-05d-production-release-closure.test.ts',
      'src/test/architecture/review.o4p-06-roadmap-registration.test.ts',
      'src/test/architecture/review.gov-codex-56-program-orchestration.test.ts',
      'src/test/architecture/review.o4p-07-roadmap-registration.test.ts',
      'src/test/architecture/review.o4p-08-roadmap-registration.test.ts',
    ]);
    for (const path of [...changed, ...untracked]) {
      expect(allowed.has(path), `unexpected changed path: ${path}`).toBe(true);
    }
    expect(read('package-lock.json')).toBe(
      execFileSync('git', ['show', `${BASE_SHA}:package-lock.json`], { cwd: ROOT, encoding: 'utf8' }),
    );
    expect(read('wrangler.jsonc')).toBe(
      execFileSync('git', ['show', `${BASE_SHA}:wrangler.jsonc`], { cwd: ROOT, encoding: 'utf8' }),
    );
    expect(() => execFileSync('git', ['diff', '--check'], { cwd: ROOT, encoding: 'utf8' })).not.toThrow();
  });
});
