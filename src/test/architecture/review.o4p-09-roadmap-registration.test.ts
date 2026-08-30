import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '629de59eb244e6c9eeb78c3bdab29cfd15596b48';
const CLOSURE_SHA = '0c0c7a533fffd8e3495cf74bb7d86b827f222c2e';
const LEDGER_PATH = 'research/cr-grounding/cr-backbone-ledger.json';
const IDS = [
  'O4P-09A', 'O4P-09B', 'O4P-09C', 'O4P-09D', 'O4P-09E',
  'O4P-09F', 'O4P-09G', 'O4P-09H', 'O4P-09I', 'O4P-09J',
] as const;
const LIVE_IDS = [
  'O4P-09A', 'O4P-09B', 'O4P-09C', 'O4P-09C-UI', 'O4P-09D', 'O4P-09E',
  'O4P-09F', 'O4P-09G', 'O4P-09I',
] as const;
const DEPENDENCIES = [
  'O4P-08D', 'O4P-09A', 'O4P-09B', 'O4P-09C', 'O4P-09D',
  'O4P-09E', 'O4P-09F', 'O4P-09G', 'O4P-09H', 'O4P-09I',
] as const;
const AUDIT_RECORD_PATH =
  'research/cr-grounding/archive/o4p-09-roadmap-registration-cold-audit-record-2026-08-25.md';
const REGISTRATION_EVIDENCE = [
  'research/cr-grounding/o4p-09-shared-table-playable-roadmap.contract.draft.md',
  'research/cr-grounding/o4p-09-roadmap-registration-acceptance.draft.md',
  'research/cr-grounding/planned-sequence-batch-o4p-09.draft.md',
  'research/cr-grounding/o4p-09-roadmap-ledger-update.draft.json',
  'user-ruling:2026-08-25:shared-table-playable-mvp',
  AUDIT_RECORD_PATH,
  'cold-audit:/root/o4p09_registration_cold_audit:0/0/0/0:fingerprint=f7432d16a590969a5996fcb48aaeac66f378da2956cc9c302bf897606d02e11d',
] as const;
const OBSOLETE_GOVERNANCE_REVIEWS = new Set([
  'src/test/architecture/review.gov-codex-56-program-orchestration.test.ts',
  'src/test/architecture/review.gov-codex-56r2-request-normalization.test.ts',
]);
const O4P_09_DOMAIN_BYTES_SHA256 =
  '1592ce268d431c809bc5707840caf30018e0dc4c59b6249a2e468c803a6184a1';
const AUDIT_RECORD_BYTES_SHA256 =
  'ff852d8e36c9a5ac44bec8403669e7b7e92ff7ea3c0fb0983caa80f3400787b2';
const REQUIRED_CHANGED_PATHS = [
  LEDGER_PATH,
  ...REGISTRATION_EVIDENCE.slice(0, 4),
  'research/cr-grounding/o4p-09-roadmap-registration-cold-audit-brief.draft.md',
  AUDIT_RECORD_PATH,
  'src/test/architecture/review.o4p-05d-production-release-closure.test.ts',
  'src/test/architecture/review.o4p-06-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-07-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-08-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-09-roadmap-registration.test.ts',
] as const;

type Entry = Record<string, unknown> & {
  id?: string;
  domainId?: string;
  status?: string;
  evidence?: unknown;
};
type Ledger = {
  goalPolicy: Record<string, unknown> & {
    activeProgram?: { id?: string; domainIds?: string[] };
  };
  plannedSequence: Entry[];
  domains: Entry[];
  [key: string]: unknown;
};

const text = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');
const closureText = (path: string): string => execFileSync(
  'git',
  ['show', `${CLOSURE_SHA}:${path}`],
  { cwd: ROOT, encoding: 'utf8' },
);
const parse = (raw: string): Ledger => JSON.parse(raw) as Ledger;
const sha256Json = (value: unknown): string => createHash('sha256')
  .update(JSON.stringify(value))
  .digest('hex');
const sha256Text = (value: string): string => createHash('sha256').update(value).digest('hex');
const gitLines = (args: string[]): string[] => execFileSync('git', args, {
  cwd: ROOT,
  encoding: 'utf8',
}).trim().split(/\r?\n/u).filter(Boolean);
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

describe('O4P-09 Shared Table Playable roadmap registration', () => {
  it('appends one exact ten-slice active program without rewriting live history', () => {
    const before = parse(execFileSync('git', ['show', `${BASE_SHA}:${LEDGER_PATH}`], {
      cwd: ROOT,
      encoding: 'utf8',
    }));
    const after = parse(closureText(LEDGER_PATH));
    expect(withoutCollections(after)).toEqual(withoutCollections(before));
    expect(withoutActiveProgram(after.goalPolicy)).toEqual(withoutActiveProgram(before.goalPolicy));
    expect(after.goalPolicy.activeProgram).toEqual({ id: 'O4P-09', domainIds: IDS });
    expect(after.domains.slice(0, before.domains.length)).toEqual(before.domains);
    expect(after.plannedSequence.slice(0, before.plannedSequence.length)).toEqual(before.plannedSequence);
    expect(after.domains).toHaveLength(before.domains.length + IDS.length);
    expect(after.plannedSequence).toHaveLength(before.plannedSequence.length + IDS.length);
    expect(after.domains.find((entry) => entry.id === 'GOV-CODEX-56R2-2026-08')).toEqual(
      before.domains.find((entry) => entry.id === 'GOV-CODEX-56R2-2026-08'),
    );
  });

  it('keeps domains and plannedSequence synchronized in A-to-J order', () => {
    const ledger = parse(closureText(LEDGER_PATH));
    for (const [index, id] of IDS.entries()) {
      const domains = ledger.domains.filter((entry) => entry.id === id);
      const planned = ledger.plannedSequence.filter((entry) => entry.domainId === id);
      expect(domains, `${id} domains`).toHaveLength(1);
      expect(planned, `${id} planned`).toHaveLength(1);
      expect(shared(planned[0] ?? {}), id).toEqual(shared(domains[0] ?? {}));
      expect(domains[0], id).toMatchObject({
        crOrder: 1033 + index,
        status: 'pending',
        dependsOn: [DEPENDENCIES[index]],
        lane: 'backbone',
        edhValue: 'high',
        evidence: REGISTRATION_EVIDENCE,
      });
    }
    const exactDomains = IDS.map((id) => ledger.domains.find((entry) => entry.id === id));
    expect(exactDomains.every(Boolean)).toBe(true);
    expect(sha256Json(exactDomains)).toBe(O4P_09_DOMAIN_BYTES_SHA256);
  });

  it('freezes shared-table reuse, authority, privacy, and manual boundaries', () => {
    const contract = text(
      'research/cr-grounding/o4p-09-shared-table-playable-roadmap.contract.draft.md',
    );
    const normalizedContract = contract.replace(/\s+/gu, ' ').trim();
    for (const term of [
      'State is strict, rules are assisted',
      '`GameScreen` remains the sole adaptive player-surface root',
      'ROOM -> PREGAME -> PLAYING -> FINISHED',
      'Structured Manual',
      'Freeform Manual',
      'Every player may assert or clear HOLD',
      'Only the current steward may Resolve, Advance, or invoke shared UNDO',
      'Zustand history is not Remote',
      'complete two-player game and four-player continuity',
      '`PlayerGameScreen` and `SpectatorTable` are separate presentations',
    ]) expect(contract).toContain(term);
    expect(normalizedContract).toContain(
      'Agreement happens by voice; no voting or approval UI is implemented.',
    );
    expect(normalizedContract).toContain(
      'but no hidden-zone operation becomes executable before O4P-09E supplies exact audience, duration, decision authority, and secret-safe projection.',
    );
    expect(contract).toContain('The steward is not a game master');
    expect(contract).toContain('Registration does not claim a GameIntent layer exists');
    expect(contract).not.toContain('Takeback Proposal');
  });

  it('projects O4P-09A as the healthy active-program selection', () => {
    const liveLedger = parse(text(LEDGER_PATH));
    const nextDomainId = LIVE_IDS.find((id) => (
      liveLedger.domains.find((entry) => entry.id === id)?.status !== 'shipped'
    )) ?? null;
    expect(nextDomainId).not.toBeNull();
    expect(liveLedger.goalPolicy.activeProgram).toMatchObject({
      id: 'O4P-09',
      domainIds: LIVE_IDS,
    });
    expect(LIVE_IDS).toContain(nextDomainId);
    expect(nextDomainId).toBe('O4P-09G');
  });

  it('changes only Judge-owned registration and exact historical guards', () => {
    const changed = new Set(gitLines([
      'diff', '--name-only', BASE_SHA, CLOSURE_SHA,
    ]).filter((path) => existsSync(resolve(ROOT, path)) && !OBSOLETE_GOVERNANCE_REVIEWS.has(path)));
    const allowed = new Set<string>(REQUIRED_CHANGED_PATHS);
    for (const path of REQUIRED_CHANGED_PATHS) expect(changed, path).toContain(path);
    for (const path of changed) {
      expect(allowed.has(path), `unexpected O4P-09 registration path: ${path}`).toBe(true);
      if (path.startsWith('src/')) expect(path).toMatch(/^src\/test\/architecture\/review\./u);
    }
    const auditRecord = text(AUDIT_RECORD_PATH);
    expect(sha256Text(auditRecord)).toBe(AUDIT_RECORD_BYTES_SHA256);
    expect(auditRecord).toContain('BLOCKER 1 / HIGH 2 / MEDIUM 1 / LOW 0');
    expect(auditRecord).toContain('BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0');
    expect(auditRecord).toContain(
      'f7432d16a590969a5996fcb48aaeac66f378da2956cc9c302bf897606d02e11d',
    );
    expect(text('package-lock.json')).toBe(
      execFileSync('git', ['show', `${BASE_SHA}:package-lock.json`], {
        cwd: ROOT,
        encoding: 'utf8',
      }),
    );
    expect(text('wrangler.jsonc')).toBe(
      execFileSync('git', ['show', `${BASE_SHA}:wrangler.jsonc`], {
        cwd: ROOT,
        encoding: 'utf8',
      }),
    );
    expect(closureText('.github/workflows/deploy-pages.yml')).toBe(
      execFileSync('git', ['show', `${BASE_SHA}:.github/workflows/deploy-pages.yml`], {
        cwd: ROOT,
        encoding: 'utf8',
      }),
    );
    expect(() => execFileSync('git', ['diff', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    })).not.toThrow();
  });
});
