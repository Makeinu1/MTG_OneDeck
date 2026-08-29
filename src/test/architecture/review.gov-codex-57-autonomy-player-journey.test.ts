import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');
const ledger = JSON.parse(read('research/cr-grounding/cr-backbone-ledger.json')) as {
  goalPolicy: { activeProgram: Record<string, unknown> & { domainIds: string[] } };
  domains: Array<Record<string, unknown> & { id?: string }>;
  plannedSequence: Array<Record<string, unknown> & { domainId?: string; type?: string }>;
};
const PRODUCT_IDS = [
  'O4P-09A', 'O4P-09B', 'O4P-09C', 'O4P-09C-UI', 'O4P-09D', 'O4P-09E',
  'O4P-09F', 'O4P-09G', 'O4P-09H', 'O4P-09I', 'O4P-09J',
];
const PROGRAM_IDS = [
  ...PRODUCT_IDS.slice(0, 6),
  'GOV-CODEX-58A-2026-08',
  ...PRODUCT_IDS.slice(6),
];

const shared = (entry: Record<string, unknown>): Record<string, unknown> => {
  const copy = { ...entry };
  delete copy.id;
  delete copy.domainId;
  delete copy.type;
  return copy;
};

describe('GOV-CODEX-57 complete autonomy and player journey governance', () => {
  it('stores explicit authority without smuggling external writes', () => {
    expect(ledger.goalPolicy.activeProgram).toMatchObject({
      id: 'O4P-09',
      domainIds: PROGRAM_IDS,
      authority: {
        localWrites: true, commit: false, push: false, deploy: false, ship: false,
      },
      autonomy: { mode: 'complete' },
      journeyPolicy: {
        maxConsecutiveSubstrate: 2,
        enforceFromDomainId: 'O4P-09C-UI',
        legacyDebtDomainIds: ['O4P-09A', 'O4P-09B', 'O4P-09C'],
      },
      usagePolicy: { enforceFromDomainId: 'O4P-09C-UI' },
    });
  });

  it('keeps both ledger collections synchronized and advances the program only after shipment', () => {
    for (const id of [...PROGRAM_IDS, 'GOV-CODEX-57-2026-08']) {
      const domain = ledger.domains.filter((entry) => entry.id === id);
      const planned = ledger.plannedSequence.filter((entry) => entry.domainId === id);
      expect(domain, `${id} domain`).toHaveLength(1);
      expect(planned, `${id} planned`).toHaveLength(1);
      expect(shared(planned[0] ?? {}), id).toEqual(shared(domain[0] ?? {}));
    }
    const cUi = ledger.domains.find((entry) => entry.id === 'O4P-09C-UI');
    const d = ledger.domains.find((entry) => entry.id === 'O4P-09D');
    expect(cUi).toMatchObject({
      dependsOn: ['O4P-09C'], deliveryClass: 'player-outcome',
    });
    expect(['pending', 'audited', 'shipped']).toContain(cUi?.status);
    expect(d).toMatchObject({ dependsOn: ['O4P-09C-UI'], deliveryClass: 'player-outcome' });

    const expectedNextDomainId = PROGRAM_IDS.find((id) =>
      ledger.domains.find((entry) => entry.id === id)?.status !== 'shipped');
    expect(expectedNextDomainId).toEqual(expect.any(String));
    if (expectedNextDomainId === undefined) throw new Error('Active O4P-09 program requires a next domain');
    const expectedNextPlayerOutcomeId = PROGRAM_IDS.find((id) => {
      const entry = ledger.domains.find((candidate) => candidate.id === id);
      return entry?.status !== 'shipped' && entry?.deliveryClass === 'player-outcome';
    });
    expect(expectedNextPlayerOutcomeId).toEqual(expect.any(String));
    const context = spawnSync('node', ['scripts/codex-context.mjs', '--domain', expectedNextDomainId], {
      cwd: ROOT, encoding: 'utf8',
    });
    const projection = JSON.parse(context.stdout) as Record<string, unknown> & {
      loopState?: { status?: string };
    };
    expect(context.status).toBe(projection.loopState?.status === 'current' ? 0 : 5);
    expect(projection).toMatchObject({
      health: { ok: true, errors: [] },
      selection: { kind: 'selected', domainId: expectedNextDomainId, reason: 'explicit-domain' },
      activeProgram: { nextDomainId: expectedNextDomainId },
      nextTechnicalSlice: { domainId: expectedNextDomainId },
      nextPlayerOutcome: { domainId: expectedNextPlayerOutcomeId },
    });
  }, 15_000);

  it('records honest historical debt and requires outcomes after activation', () => {
    for (const id of ['O4P-09A', 'O4P-09B', 'O4P-09C']) {
      expect(ledger.domains.find((entry) => entry.id === id)).toMatchObject({
        status: 'shipped',
        deliveryClass: 'substrate',
        outcomeDeadlineDomainId: 'O4P-09C-UI',
        usage: { measurementStatus: 'historical-unavailable' },
      });
    }
    for (const id of PRODUCT_IDS.slice(3)) {
      const entry = ledger.domains.find((item) => item.id === id);
      expect(entry?.deliveryClass, id).toBe('player-outcome');
      expect(entry?.playerOutcome, id).toEqual(expect.any(String));
      expect(entry?.journeyEvidence, id).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(entry?.outcomeDeadlineDomainId, id).toBe(id);
    }
  });

  it('freezes autonomy, preflight, terminal, and usage meaning in active contracts', () => {
    const contract = read('research/cr-grounding/gov-codex-57-autonomy-player-journey.contract.draft.md');
    const normalization = read('.agents/skills/mtg-onedeck-development/references/request-normalization.md');
    const workflow = read('.agents/skills/mtg-onedeck-development/references/document-governance.md');
    const ci = read('.github/workflows/deploy-pages.yml');
    for (const term of [
      'authority', 'autonomy.mode', 'maxConsecutiveSubstrate',
      'check:release-preflight', 'check:terminal-metadata', 'historical-unavailable',
    ]) expect(contract, term).toContain(term);
    expect(normalization).toContain('does not turn a false authority bit into true');
    expect(workflow).toContain('cumulative telemetry and internal admission inputs');
    expect(workflow.replace(/\s+/gu, ' ')).toContain(
      'three consecutive substrate milestones are invalid',
    );
    expect(ci).toContain("steps.change-lane.outputs.lane == 'terminal'");
    expect(ci).toContain("steps.change-lane.outputs.lane == 'semantic'");
    expect(ci).toMatch(/if: needs\.build\.outputs\.lane == 'semantic'/);
  });

  it('keeps the shipped GOV-CODEX-57 semantic candidate free of O4P-09C-UI product bytes', () => {
    const status = spawnSync('git', ['diff', '--name-only',
      '027aed8b152421f0aa101c81eefcf766fbfc803b',
      'd62e84b4aca5091c76bb9108f02f9e298e917f83',
    ], {
      cwd: ROOT, encoding: 'utf8',
    });
    expect(status.status).toBe(0);
    const paths = status.stdout.split(/\r?\n/u).filter(Boolean);
    expect(paths.filter((path) => path.startsWith('src/components/') || path.startsWith('src/online/')))
      .toEqual([]);
  });
});
