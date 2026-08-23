import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '20064643cd2a3e25c2bf80f12a538028720664f2';
const CLOSURE_SHA = '55fe011700bd6bb10a699e1bd431f0bf12cc40cb';
const LEDGER_PATH = 'research/cr-grounding/cr-backbone-ledger.json';
const IDS = ['O4P-07A', 'O4P-07B', 'O4P-07C'] as const;
const DEPENDENCIES = ['O4P-06F', 'O4P-07A', 'O4P-07B'] as const;
const REGISTRATION_EVIDENCE = [
  'research/cr-grounding/o4p-07-dynamic-online-catalog-roadmap.contract.draft.md',
  'research/cr-grounding/o4p-07-roadmap-registration-acceptance.draft.md',
  'research/cr-grounding/planned-sequence-batch-o4p-07.draft.md',
  'research/cr-grounding/o4p-07-roadmap-ledger-update.draft.json',
  'user-ruling:2026-08-22:remove-fixed-online-catalog',
  'research/cr-grounding/archive/o4p-07-roadmap-registration-cold-audit-record-2026-08-22.md',
] as const;

type Entry = Record<string, unknown> & { id?: string; domainId?: string; status?: string };
type Ledger = {
  goalPolicy: Record<string, unknown> & { activeProgram?: { id?: string; domainIds?: string[] } };
  plannedSequence: Entry[];
  domains: Entry[];
  [key: string]: unknown;
};

const closureRead = (path: string): string => execFileSync(
  'git',
  ['show', `${CLOSURE_SHA}:${path}`],
  { cwd: ROOT, encoding: 'utf8' },
);
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

describe('O4P-07 dynamic Online catalog roadmap registration', () => {
  it('appends one exact three-parent active program without rewriting history', () => {
    const before = parse(execFileSync('git', ['show', `${BASE_SHA}:${LEDGER_PATH}`], {
      cwd: ROOT, encoding: 'utf8',
    }));
    const after = parse(closureRead(LEDGER_PATH));
    expect(withoutCollections(after)).toEqual(withoutCollections(before));
    expect(withoutActiveProgram(after.goalPolicy)).toEqual(withoutActiveProgram(before.goalPolicy));
    expect(after.goalPolicy.activeProgram).toEqual({ id: 'O4P-07', domainIds: IDS });
    expect(after.domains.slice(0, before.domains.length)).toEqual(before.domains);
    expect(after.plannedSequence.slice(0, before.plannedSequence.length)).toEqual(before.plannedSequence);
    expect(after.domains).toHaveLength(before.domains.length + IDS.length);
    expect(after.plannedSequence).toHaveLength(before.plannedSequence.length + IDS.length);
  });

  it('keeps both collections synchronized in A-to-C order', () => {
    const ledger = parse(closureRead(LEDGER_PATH));
    for (const [index, id] of IDS.entries()) {
      const domains = ledger.domains.filter((entry) => entry.id === id);
      const planned = ledger.plannedSequence.filter((entry) => entry.domainId === id);
      expect(domains, `${id} domains`).toHaveLength(1);
      expect(planned, `${id} planned`).toHaveLength(1);
      expect(shared(planned[0] ?? {}), id).toEqual(shared(domains[0] ?? {}));
      expect(domains[0], id).toMatchObject({
        crOrder: 1025 + index,
        status: 'pending',
        dependsOn: [DEPENDENCIES[index]],
        lane: 'backbone',
        edhValue: 'high',
        evidence: REGISTRATION_EVIDENCE,
      });
    }
  });

  it('freezes the product semantics and O4P-07C completion boundary', () => {
    const contract = closureRead('research/cr-grounding/o4p-07-dynamic-online-catalog-roadmap.contract.draft.md');
    for (const term of [
      'server-side Scryfall resolution',
      'Identical decks',
      'Room snapshot',
      'owner-only',
      'O4P-07C, not the presence of a v2 endpoint',
      'built client/Worker graphs contain no fixed',
      'Single-operator seat switching',
    ]) expect(contract).toContain(term);
    expect(contract).toContain('1,048,576-byte');
    expect(contract).toContain('No client-definition fallback');
  });

  it('projects a healthy O4P-07A selection', () => {
    const context = spawnSync('node', ['scripts/codex-context.mjs', '--domain', 'O4P-07A'], {
      cwd: ROOT, encoding: 'utf8',
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
      kind: 'selected', domainId: 'O4P-07A', reason: 'explicit-domain',
    });
    expect(projection.activeProgram).toEqual({
      id: 'O4P-08',
      domainIds: ['O4P-08A', 'O4P-08B', 'O4P-08C', 'O4P-08D'],
      status: 'active',
      nextDomainId: 'O4P-08C',
    });
    expect(context.status).toBe(projection.loopState?.status === 'current' ? 0 : 5);
  });

  it('changes only Judge-owned registration and historical-gate files', () => {
    const changed = execFileSync('git', ['diff', '--name-only', BASE_SHA, CLOSURE_SHA], {
      cwd: ROOT, encoding: 'utf8',
    }).trim().split(/\r?\n/u).filter(Boolean);
    const allowed = new Set([
      LEDGER_PATH,
      ...REGISTRATION_EVIDENCE.slice(0, 4),
      'research/cr-grounding/o4p-07-roadmap-registration-cold-audit-brief.draft.md',
      'research/cr-grounding/archive/o4p-07-roadmap-registration-cold-audit-record-2026-08-22.md',
      'research/cr-grounding/o4p-07-roadmap-registration-ci-reauthorization-cold-audit-brief-2026-08-22.draft.md',
      'research/cr-grounding/o4p-07-roadmap-registration-ci-reauthorization-record-2026-08-22.draft.md',
      'research/cr-grounding/o4p-07-roadmap-registration-full-check-repair-1.draft.md',
      'research/cr-grounding/o4p-07-roadmap-registration-full-check-repair-1-cold-audit-brief.draft.md',
      'research/cr-grounding/archive/o4p-07-roadmap-registration-full-check-repair-1-audit-record-2026-08-22.md',
      'research/cr-grounding/o4p-07-roadmap-registration-terminal-ci-reauthorization-record-2026-08-22.draft.md',
      'research/cr-grounding/o4p-07-roadmap-registration-terminal-ci-reauthorization-cold-audit-brief-2026-08-22.draft.md',
      'scripts/checks/verify-o4p-05d-production-release-closure.ts',
      'src/test/architecture/review.o4p-05d-production-release-closure.test.ts',
      'src/test/architecture/review.o4p-06-roadmap-registration.test.ts',
      'src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts',
      'src/test/architecture/review.gov-codex-56-program-orchestration.test.ts',
      'src/test/architecture/review.o4p-07-roadmap-registration.test.ts',
    ]);
    for (const path of changed) {
      expect(allowed.has(path), `unexpected changed path: ${path}`).toBe(true);
    }
    expect(closureRead('package-lock.json')).toBe(
      execFileSync('git', ['show', `${BASE_SHA}:package-lock.json`], { cwd: ROOT, encoding: 'utf8' }),
    );
    expect(closureRead('wrangler.jsonc')).toBe(
      execFileSync('git', ['show', `${BASE_SHA}:wrangler.jsonc`], { cwd: ROOT, encoding: 'utf8' }),
    );
    expect(() => execFileSync('git', ['diff', '--check'], { cwd: ROOT, encoding: 'utf8' })).not.toThrow();
  });
});
