import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '2a50db07f3962a11ec5a77b93bedc74ca4f628b6';
const CLOSURE_SHA = '0c0c7a533fffd8e3495cf74bb7d86b827f222c2e';
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');
const ledger = JSON.parse(read('research/cr-grounding/cr-backbone-ledger.json')) as {
  domains: Array<Record<string, unknown>>;
  plannedSequence: Array<Record<string, unknown>>;
};

const gitLines = (args: string[]): string[] =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);

describe('GOV-CODEX-56R2 request normalization and bounded execution', () => {
  it('registers one governance-only candidate in both ledger collections', () => {
    const id = 'GOV-CODEX-56R2-2026-08';
    const domains = ledger.domains.filter((entry) => entry.id === id);
    const planned = ledger.plannedSequence.filter((entry) => entry.domainId === id);
    expect(domains).toHaveLength(1);
    expect(planned).toHaveLength(1);
    expect(domains[0]).toMatchObject({
      status: 'audited',
      dependsOn: ['GOV-CODEX-56-2026-08', 'O4P-08D'],
      landingState: [
        'requestNormalization',
        'leanActiveContract',
        'freshMilestonePackets',
        'hardExecutionCounters',
        'boundedPropertyTimeout',
        'futureSafeHistoricalReviews',
      ],
    });
    const { id: domainId, ...domainShared } = domains[0] ?? {};
    const { type, domainId: plannedId, ...plannedShared } = planned[0] ?? {};
    expect(domainId).toBe(id);
    expect(type).toBe('checkpoint');
    expect(plannedId).toBe(id);
    expect(plannedShared).toEqual(domainShared);

    const baseLedger = JSON.parse(
      execFileSync(
        'git',
        ['show', `${BASE_SHA}:research/cr-grounding/cr-backbone-ledger.json`],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    ) as typeof ledger;
    const successorIds = new Set([
      'O4P-09A', 'O4P-09B', 'O4P-09C', 'O4P-09C-UI', 'O4P-09D', 'O4P-09E',
      'O4P-09F', 'O4P-09G', 'O4P-09H', 'O4P-09I', 'O4P-09J',
      'GOV-CODEX-57-2026-08', 'GOV-CODEX-58A-2026-08',
      'GOV-PRODUCT-DELIVERY-2026-08',
    ]);
    expect(ledger.domains.filter((entry) => entry.id !== id && !successorIds.has(entry.id as string))).toEqual(baseLedger.domains);
    expect(ledger.plannedSequence.filter(
      (entry) => entry.domainId !== id && !successorIds.has(entry.domainId as string),
    )).toEqual(
      baseLedger.plannedSequence,
    );
    expect(ledger.domains.filter((entry) => successorIds.has(entry.id as string))).toHaveLength(14);
    expect(ledger.plannedSequence.filter(
      (entry) => successorIds.has(entry.domainId as string),
    )).toHaveLength(14);
  });

  it('makes the LLM normalize prose without transferring authority', () => {
    const agents = read('AGENTS.md');
    const skill = read('.agents/skills/mtg-onedeck-development/SKILL.md');
    const normalization = read(
      '.agents/skills/mtg-onedeck-development/references/request-normalization.md',
    );
    const canonical = normalization.match(
      /## Canonical form[\s\S]*?```md\r?\n([\s\S]*?)```/,
    )?.[1];
    expect(canonical).toBeDefined();
    const fields = [...(canonical ?? '').matchAll(/^([A-Z][A-Za-z ]+):/gm)].map(
      (match) => match[1],
    );
    expect(fields).toEqual([
      'Intent',
      'Program',
      'Goal',
      'Constraints',
      'Done when',
      'Budget objective',
      'Authority',
    ]);
    expect(new Set(fields).size).toBe(7);
    expect(canonical).toContain('- git commit: <yes | no>');
    expect(canonical).toContain('- local writes: <yes | no>');
    expect(canonical).toContain('- git push: <yes | no>');
    expect(canonical).toContain('- deploy/publish: <yes | no>');
    expect(canonical).toContain('- release/ship: <yes | no>');
    expect(normalization).not.toContain('Program: GOV-CODEX-56R2-2026-08');

    const cases = [
      ...normalization.matchAll(
        /^\| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \| `(yes|no)` \| `(yes|no)` \| `(yes|no)` \| `(yes|no)` \| `(yes|no)` \| `(yes|no)` \|$/gm,
      ),
    ].map((match) => match.slice(1));
    expect(cases).toEqual([
      ['inspect or explain', 'inspect', 'none', 'no', 'no', 'no', 'no', 'no', 'no'],
      ['rewrite one outcome', 'change', 'none', 'no', 'yes', 'no', 'no', 'no', 'no'],
      ['complete A -> B', 'goal', 'A -> B', 'no', 'yes', 'no', 'no', 'no', 'no'],
      ['commit changes', 'change', 'none', 'no', 'no', 'yes', 'no', 'no', 'no'],
      ['push branch', 'change', 'none', 'no', 'no', 'no', 'yes', 'no', 'no'],
      ['deploy preview', 'change', 'none', 'no', 'no', 'no', 'no', 'yes', 'no'],
      [
        'ship release end-to-end',
        'change + ship',
        'none',
        'yes',
        'no',
        'yes',
        'yes',
        'yes',
        'yes',
      ],
    ]);
    expect(agents).toContain('ユーザーに定型文への書き直しを求めず');
    expect(skill).toContain('Do not make the user write the schema');
    expect(skill).toContain('matching contract or ledger entry only when');
    expect(normalization).toContain('Do not ask the user to rewrite a request into this schema.');
    expect(normalization).toContain('Add `+ ship` only for explicit end-to-end');
    expect(normalization).toContain('not create a program');
    expect(normalization).toContain('never acquires the other authority bits');
    expect(normalization).toContain('Intent` selects the work shape but never grants');
    expect(normalization).toContain('replaces only `Budget objective`');
    expect(normalization).toContain('never become a');
    expect(normalization).toContain('larger number');
    expect(normalization).toContain('The original user message remains the authority');
  });

  it('pins compact packets, structural limits, watchdogs, preflight, and risk-routed effort', () => {
    const workflow = read(
      '.agents/skills/mtg-onedeck-development/references/document-governance.md',
    );
    const config = read('.codex/config.toml');
    const auditor = read('.codex/agents/onedeck-cold-auditor.toml');
    expect(workflow).toContain('terminal packet no larger than 4 KiB');
    expect(workflow).toContain('## Candidate execution counters and autonomous repair');
    expect(workflow).toContain('release full check: one normally; the second is the repair objective');
    expect(workflow).toContain('A final green `npm run check` on the audited release tree remains mandatory');
    expect(workflow.replace(/\s+/gu, ' ')).toContain('one replacement-push objective');
    expect(workflow.replace(/\s+/gu, ' ')).toContain('every replacement push stays cumulative');
    expect(workflow).toContain('At two compactions or one fresh same-role continuation');
    expect(workflow).toContain('internal watchdogs');
    expect(workflow.replace(/\s+/gu, ' ')).toContain('two correction waves');
    expect(workflow.replace(/\s+/gu, ' ')).toContain(
      'supervisor 1.0M uncached input tokens / 160 model cycles',
    );
    expect(workflow.replace(/\s+/gu, ' ')).toContain(
      'team 1.6M uncached input tokens / 400 model cycles',
    );
    expect(workflow).toContain('do not request a larger number from the user');
    expect(workflow).toContain(
      'Only a failure of the current milestone acceptance or a critical regression may',
    );
    expect(workflow).toContain('npm run check:release-preflight');
    expect(config).toMatch(/^model = "gpt-5\.6-sol"$/m);
    expect(config).toMatch(/^model_reasoning_effort = "medium"$/m);
    expect(auditor).toMatch(/^model = "gpt-5\.6-sol"$/m);
    expect(auditor).toMatch(/^model_reasoning_effort = "high"$/m);
    expect(auditor).toMatch(/^sandbox_mode = "read-only"$/m);
  });

  it('budgets the fixed-seed property tests without weakening their coverage', () => {
    const propertyPath =
      'src/engine/core/transition/__tests__/cardZoneTransitionProperty.test.ts';
    const propertyTest = read(
      propertyPath,
    );
    const basePropertyTest = execFileSync('git', ['show', `${BASE_SHA}:${propertyPath}`], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const viteConfig = read('vite.config.ts');
    expect(propertyTest).toContain('const PROPERTY_TEST_TIMEOUT_MS = 15_000;');
    expect(propertyTest.match(/timeout: PROPERTY_TEST_TIMEOUT_MS/g)).toHaveLength(2);
    expect(propertyTest).toContain(
      "it('keeps golden fixture coverage separate and resolves its declared inputs', () => {",
    );
    expect(propertyTest).toContain(
      "it('generates valid source, destination, placement, and controller records', { timeout: PROPERTY_TEST_TIMEOUT_MS }, () => {",
    );
    expect(propertyTest).toContain(
      "it('generates invalid records and rejects each atomically', { timeout: PROPERTY_TEST_TIMEOUT_MS }, () => {",
    );
    expect(propertyTest).toContain('{ numRuns: 128, seed: 2026080908 }');
    expect(propertyTest).toContain('{ numRuns: 64, seed: 2026080909 }');
    expect(viteConfig).toContain('fileParallelism: true');
    expect(viteConfig).not.toMatch(/\btestTimeout\s*:/);
    const timeoutOnlyNormalized = propertyTest
      .replace('const PROPERTY_TEST_TIMEOUT_MS = 15_000;\n', '')
      .replaceAll(', { timeout: PROPERTY_TEST_TIMEOUT_MS }', '');
    expect(timeoutOnlyNormalized).toBe(basePropertyTest);
  });

  it('keeps normalization canonical while old-domain context fails closed', () => {
    const context = spawnSync(
      'node',
      ['scripts/codex-context.mjs', '--domain', 'GOV-CODEX-56R2-2026-08'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    expect(context.error).toBeUndefined();
    expect(context.signal).toBeNull();
    expect(context.stderr).toBe('');
    const projection = JSON.parse(context.stdout) as {
      canonicalPaths?: string[];
      loopState?: { status?: string };
    };
    expect(projection.canonicalPaths).toContain(
      '.agents/skills/mtg-onedeck-development/references/request-normalization.md',
    );
    expect(context.status).toBe(2);
    expect(() =>
      execFileSync('git', ['merge-base', '--is-ancestor', BASE_SHA, 'HEAD'], {
        cwd: ROOT,
      }),
    ).not.toThrow();
    const changed = new Set(gitLines([
      'diff', '--name-only', BASE_SHA, CLOSURE_SHA,
    ]));
    const allowed = new Set([
      '.agents/skills/mtg-onedeck-development/SKILL.md',
      '.agents/skills/mtg-onedeck-development/references/document-governance.md',
      '.agents/skills/mtg-onedeck-development/references/request-normalization.md',
      '.codex/config.toml',
      'AGENTS.md',
      'research/cr-grounding/archive/o4p-09-roadmap-registration-cold-audit-record-2026-08-25.md',
      'research/cr-grounding/cr-backbone-ledger.json',
      'research/cr-grounding/gov-codex-56r2-request-normalization-acceptance.draft.md',
      'research/cr-grounding/gov-codex-56r2-request-normalization-cold-audit-brief.draft.md',
      'research/cr-grounding/gov-codex-56r2-request-normalization.contract.draft.md',
      'research/cr-grounding/archive/gov-codex-56r2-request-normalization-cold-audit-record-2026-08-25.md',
      'research/cr-grounding/o4p-09-roadmap-ledger-update.draft.json',
      'research/cr-grounding/o4p-09-roadmap-registration-acceptance.draft.md',
      'research/cr-grounding/o4p-09-roadmap-registration-cold-audit-brief.draft.md',
      'research/cr-grounding/o4p-09-shared-table-playable-roadmap.contract.draft.md',
      'research/cr-grounding/planned-sequence-batch-o4p-09.draft.md',
      'scripts/__tests__/review.codex-ops.test.mjs',
      'scripts/__tests__/review.check-gates.test.mjs',
      'scripts/checks/verify-o4p-05d-production-release-closure.ts',
      'scripts/codex-context.mjs',
      'src/engine/core/transition/__tests__/cardZoneTransitionProperty.test.ts',
      'src/test/architecture/review.gov-codex-56-program-orchestration.test.ts',
      'src/test/architecture/review.gov-codex-56r2-request-normalization.test.ts',
      'src/test/architecture/review.o4p-05d-production-release-closure.test.ts',
      'src/test/architecture/review.o4p-06-roadmap-registration.test.ts',
      'src/test/architecture/review.o4p-07-roadmap-registration.test.ts',
      'src/test/architecture/review.o4p-08-roadmap-registration.test.ts',
      'src/test/architecture/review.o4p-09-roadmap-registration.test.ts',
    ]);
    for (const path of changed) {
      expect(allowed.has(path), `unexpected governance candidate path: ${path}`).toBe(true);
    }
    expect(() =>
      execFileSync('git', ['diff', '--check'], { cwd: ROOT, encoding: 'utf8' }),
    ).not.toThrow();
  }, 60_000);
});
