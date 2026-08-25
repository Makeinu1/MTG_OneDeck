import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '592bcc7ed69266f0b078bb8a4e3a3d4103113e1a';
const CLOSURE_SHA = '20064643cd2a3e25c2bf80f12a538028720664f2';
const AUDIT_RECORD =
  'research/cr-grounding/archive/gov-codex-56-program-orchestration-audit-record-2026-08-22.md';
const AUDIT_RECORD_SHA256 = '444fce44e947e6ebc27b2a5debbba64166c739c3bd356162123c3178af40d582';
const O4P_06_IDS = ['O4P-06A', 'O4P-06B', 'O4P-06C', 'O4P-06D', 'O4P-06E', 'O4P-06F'];
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');
const ledger = JSON.parse(read('research/cr-grounding/cr-backbone-ledger.json')) as {
  domains: Array<Record<string, unknown>>;
  plannedSequence: Array<Record<string, unknown>>;
};
const expectOrdered = (source: string, terms: string[]): void => {
  let cursor = -1;
  for (const term of terms) {
    const index = source.indexOf(term, cursor + 1);
    expect(index, `missing or out-of-order term: ${term}`).toBeGreaterThan(cursor);
    cursor = index;
  }
};

describe('GOV-CODEX-56-2026-08 program orchestration governance', () => {
  it('ships one bounded governance milestone after shipped O4P-06F', () => {
    const domains = ledger.domains.filter((entry) => entry.id === 'GOV-CODEX-56-2026-08');
    const planned = ledger.plannedSequence.filter(
      (entry) => entry.domainId === 'GOV-CODEX-56-2026-08',
    );
    expect(domains).toHaveLength(1);
    expect(planned).toHaveLength(1);
    const domain = domains[0];
    const checkpoint = planned[0];
    if (domain === undefined || checkpoint === undefined) throw new Error('missing GOV entry');
    expect(domain).toMatchObject({
      status: 'shipped',
      dependsOn: ['O4P-06F'],
      landingState: [
        'serialProgramSupervisor',
        'freshWorkerContext',
        'riskRoutedModels',
        'proportionateAudit',
      ],
    });
    expect(checkpoint).toMatchObject({
      type: 'checkpoint',
      domainId: 'GOV-CODEX-56-2026-08',
      status: 'shipped',
      dependsOn: ['O4P-06F'],
    });
    const { id: domainId, ...domainShared } = domain;
    const { type: checkpointType, domainId: checkpointId, ...checkpointShared } = checkpoint;
    expect(domainId).toBe('GOV-CODEX-56-2026-08');
    expect(checkpointType).toBe('checkpoint');
    expect(checkpointId).toBe(domainId);
    expect(checkpointShared).toEqual(domainShared);
    expect(domain.evidence).toEqual(expect.arrayContaining([
      AUDIT_RECORD,
      `terminal-record-sha256:${AUDIT_RECORD_SHA256}`,
    ]));
    const auditRecord = read(AUDIT_RECORD);
    expect(createHash('sha256').update(auditRecord).digest('hex')).toBe(AUDIT_RECORD_SHA256);
    expect(auditRecord).toContain('BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0');
    expect(auditRecord).toContain('Core: 227 files / 2093 tests passed.');
    expect(auditRecord).toContain('DOM: 325 files / 2204 tests passed.');
    expect(auditRecord).toContain('Machine-check total: 375421 milliseconds.');

    for (const id of O4P_06_IDS) {
      const domainEntries = ledger.domains.filter((entry) => entry.id === id);
      const plannedEntries = ledger.plannedSequence.filter((entry) => entry.domainId === id);
      expect(domainEntries, `${id} domains`).toHaveLength(1);
      expect(plannedEntries, `${id} plannedSequence`).toHaveLength(1);
      expect(domainEntries[0], `${id} domain status`).toMatchObject({ status: 'shipped' });
      expect(plannedEntries[0], `${id} planned status`).toMatchObject({ status: 'shipped' });
    }
  });

  it('keeps one active candidate while permitting an authorized serial supervisor', () => {
    const agents = read('AGENTS.md');
    const workflow = read(
      '.agents/skills/mtg-onedeck-development/references/document-governance.md',
    );
    const skill = read('.agents/skills/mtg-onedeck-development/SKILL.md');
    const judge = read('docs/judge-protocol.md');
    const canon = [agents, workflow, skill, judge].join('\n');

    expect(agents).toContain('1候補=1マイルストーン');
    expect(canon).toContain('program supervisor');
    expect(canon).toContain('fork_turns: "none"');
    expect(canon).not.toContain('fork_context: false');
    expect(canon).toContain('Context compaction is a recovery checkpoint');
    expect(canon).toContain('terminal metadata');
    expect(canon).toContain('exact-head');
    expectOrdered(agents, [
      '`AGENTS.md`',
      '`codex:context`',
      'active brief',
      '`docs/judge-protocol.md`',
      'Skill reference',
    ]);
    expectOrdered(workflow, [
      '`AGENTS.md`',
      '`codex:context',
      'active brief',
      '`docs/judge-protocol.md`',
      'this workflow',
    ]);
    expectOrdered(skill, [
      '`AGENTS.md`',
      '`codex:context`',
      'active brief',
      '`docs/judge-protocol.md`',
      'document-governance.md',
    ]);
    expectOrdered(judge, [
      '`AGENTS.md`',
      '`npm run codex:context',
      'active brief',
      '本文書',
      'document-governance.md',
    ]);
  });

  it('pins risk-routed Sol and Luna project defaults', () => {
    const config = read('.codex/config.toml');
    const coldAuditor = read('.codex/agents/onedeck-cold-auditor.toml');
    const workflow = read(
      '.agents/skills/mtg-onedeck-development/references/document-governance.md',
    );
    expect(config).toMatch(/^model = "gpt-5\.6-sol"$/m);
    expect(config).toMatch(/^model_reasoning_effort = "medium"$/m);
    expect(config).toMatch(/^project_doc_max_bytes = 32768$/m);
    expect(config).toMatch(/^max_concurrent_threads_per_session = 2$/m);
    expect(config).toMatch(/^default_subagent_model = "gpt-5\.6-luna"$/m);
    expect(config).toMatch(/^default_subagent_reasoning_effort = "medium"$/m);
    expect(coldAuditor).toMatch(/^model = "gpt-5\.6-sol"$/m);
    expect(coldAuditor).toMatch(/^model_reasoning_effort = "high"$/m);
    expect(coldAuditor).toMatch(/^sandbox_mode = "read-only"$/m);
    expect(workflow).toContain('R3/BROAD cold audit must not inherit the generic worker default');
    expect(Buffer.byteLength(read('AGENTS.md'), 'utf8')).toBeLessThan(32768);
  });

  it('projects the governance task explicitly and keeps O4P-06 complete', () => {
    const context = spawnSync(
      'node',
      ['scripts/codex-context.mjs', '--domain', 'GOV-CODEX-56-2026-08'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    expect(context.error).toBeUndefined();
    expect(context.signal).toBeNull();
    expect(context.stderr).toBe('');
    const projection = JSON.parse(context.stdout) as {
      health?: { ok?: boolean; errors?: unknown[] };
      selection?: { kind?: string; domainId?: string; reason?: string };
      activeProgram?: { id?: string; status?: string; nextDomainId?: string | null };
      loopState?: { status?: string };
    };
    expect(projection.health).toEqual({ ok: true, errors: [] });
    expect(projection.selection).toEqual({
      kind: 'selected',
      domainId: 'GOV-CODEX-56-2026-08',
      reason: 'explicit-domain',
    });
    for (const id of O4P_06_IDS) {
      expect(ledger.domains.find((entry) => entry.id === id)?.status, id).toBe('shipped');
      expect(ledger.plannedSequence.find((entry) => entry.domainId === id)?.status, id).toBe('shipped');
    }
    const o4p09Ids = [
      'O4P-09A', 'O4P-09B', 'O4P-09C', 'O4P-09C-UI', 'O4P-09D', 'O4P-09E',
      'O4P-09F', 'O4P-09G', 'O4P-09H', 'O4P-09I', 'O4P-09J',
    ] as const;
    const nextDomainId = o4p09Ids.find((id) => (
      ledger.domains.find((entry) => entry.id === id)?.status !== 'shipped'
    )) ?? null;
    expect(projection.activeProgram).toMatchObject({
      id: 'O4P-09',
      domainIds: o4p09Ids,
      status: nextDomainId === null ? 'complete' : 'active',
      nextDomainId,
    });
    expect(context.status).toBe(projection.loopState?.status === 'current' ? 0 : 5);
  });

  it('changes governance only and keeps the candidate diff well formed', () => {
    expect(() =>
      execFileSync('git', ['merge-base', '--is-ancestor', BASE_SHA, 'HEAD'], {
        cwd: ROOT,
        encoding: 'utf8',
      }),
    ).not.toThrow();
    const tracked = execFileSync('git', ['diff', '--name-only', BASE_SHA, CLOSURE_SHA], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
    const allowed = new Set([
      '.agents/skills/mtg-onedeck-development/SKILL.md',
      '.agents/skills/mtg-onedeck-development/references/document-governance.md',
      '.codex/agents/onedeck-cold-auditor.toml',
      '.codex/config.toml',
      'AGENTS.md',
      'docs/judge-protocol.md',
      'research/cr-grounding/archive/gov-codex-56-program-orchestration-audit-record-2026-08-22.md',
      'research/cr-grounding/archive/gov-codex-56-terminal-full-check-repair-audit-record-2026-08-22.md',
      'research/cr-grounding/codex-56-program-orchestration-cold-audit-brief.draft.md',
      'research/cr-grounding/codex-56-program-orchestration-acceptance.draft.md',
      'research/cr-grounding/codex-56-program-orchestration.contract.draft.md',
      'research/cr-grounding/cr-backbone-ledger.json',
      'research/cr-grounding/gov-codex-56-ci-reauthorization-cold-audit-brief-2026-08-22.draft.md',
      'research/cr-grounding/gov-codex-56-ci-reauthorization-record-2026-08-22.draft.md',
      'research/cr-grounding/gov-codex-56-terminal-full-check-repair-cold-audit-brief-2026-08-22.draft.md',
      'scripts/__tests__/review.codex-ops.test.mjs',
      'src/test/architecture/review.gov-codex-56-program-orchestration.test.ts',
      'src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts',
    ]);
    for (const path of tracked) {
      expect(allowed.has(path), `unexpected candidate path: ${path}`).toBe(true);
    }
    expect(() =>
      execFileSync('git', ['diff', '--check'], { cwd: ROOT, encoding: 'utf8' }),
    ).not.toThrow();
  });
});
