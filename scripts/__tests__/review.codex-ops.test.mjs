import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  analyzeSessionRecords,
  compareUsageReports,
} from '../codex-usage.mjs';
import {
  buildContextProjection,
  contextExitCode,
  parseLoopState,
} from '../codex-context.mjs';

const tokenCount = (timestamp, total, last) => ({
  timestamp,
  type: 'event_msg',
  payload: {
    type: 'token_count',
    info: {
      total_token_usage: total,
      last_token_usage: last,
      model_context_window: 258_400,
    },
  },
});

const usage = ({ input, cached, output, reasoning = 0 }) => ({
  input_tokens: input,
  cached_input_tokens: cached,
  cache_write_input_tokens: 0,
  output_tokens: output,
  reasoning_output_tokens: reasoning,
  total_tokens: input + output,
});

const baseLedger = () => ({
  object: 'fixture-ledger',
  plannedSequence: [
    { domainId: 'dep', status: 'shipped', crOrder: 100 },
    { domainId: 'early', status: 'pending', crOrder: 303.7, dependsOn: ['dep'] },
    { domainId: 'later', status: 'pending', crOrder: 609, dependsOn: ['dep'] },
  ],
  domains: [
    { id: 'dep', status: 'shipped', crOrder: 100, evidence: ['dep.review'] },
    {
      id: 'early',
      status: 'pending',
      crOrder: 303.7,
      dependsOn: ['dep'],
      evidence: [],
    },
    {
      id: 'later',
      status: 'pending',
      crOrder: 609,
      dependsOn: ['dep'],
      evidence: [],
    },
  ],
  selectionRule: 'fixture selection rule',
  statusDefinitions: {
    pending: 'pending',
    'implemented-not-audited': 'implemented-not-audited',
    shipped: 'shipped',
  },
  judgePolicy: { reference: 'fixture' },
  goalPolicy: { scope: 'normal-commander-edh', excludedScope: [] },
});

describe('review.codex-ops usage isolation', () => {
  it('excludes copied parent usage and never exposes transcript contents', () => {
    const records = [
      {
        timestamp: '2026-07-28T00:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'child-session',
          cwd: '/repo',
          source: {
            subagent: {
              thread_spawn: { parent_thread_id: 'parent-session', depth: 1 },
            },
          },
        },
      },
      {
        timestamp: '2026-07-28T00:00:00.001Z',
        type: 'session_meta',
        payload: { id: 'parent-session', cwd: '/repo', source: 'vscode' },
      },
      tokenCount(
        '2026-07-28T00:00:00.002Z',
        usage({ input: 1_000, cached: 900, output: 100 }),
        usage({ input: 1_000, cached: 900, output: 100 }),
      ),
      {
        timestamp: '2026-07-28T00:00:00.003Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'developer',
          content: [{ type: 'input_text', text: 'You are an agent in a team.' }],
        },
      },
      {
        timestamp: '2026-07-28T00:00:00.004Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'SECRET-PROMPT-MUST-NOT-LEAK' }],
        },
      },
      {
        timestamp: '2026-07-28T00:00:01.000Z',
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          call_id: 'actual-check',
          input:
            'const r = await Promise.all([tools.exec_command({cmd:"npm run check"}), tools.exec_command({cmd:"rg x"})]);',
        },
      },
      {
        timestamp: '2026-07-28T00:00:01.250Z',
        type: 'response_item',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'actual-check',
          output: [
            {
              type: 'input_text',
              text: JSON.stringify({
                output:
                  '\n> fixture@0.0.0 check\n> node scripts/checks/machine-checks.mjs\n\n=== machine-check: lint ===\n',
              }),
            },
          ],
        },
      },
      {
        timestamp: '2026-07-28T00:00:01.500Z',
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          input:
            'await tools.exec_command({cmd:"rg -n \\"npm run check\\" AGENTS.md"});',
        },
      },
      tokenCount(
        '2026-07-28T00:00:02.000Z',
        usage({ input: 1_040, cached: 924, output: 106, reasoning: 2 }),
        usage({ input: 40, cached: 24, output: 6, reasoning: 2 }),
      ),
      { timestamp: '2026-07-28T00:00:03.000Z', type: 'compacted', payload: {} },
    ];

    const report = analyzeSessionRecords(records, { filePath: '/tmp/child.jsonl' });

    expect(report.sessionId).toBe('child-session');
    expect(report.parentSessionId).toBe('parent-session');
    expect(report.inheritedContext).toBe(true);
    expect(report.usage).toMatchObject({
      inputTokens: 40,
      cachedInputTokens: 24,
      uncachedInputTokens: 16,
      outputTokens: 6,
      reasoningOutputTokens: 2,
    });
    expect(report.modelCycles).toBe(1);
    expect(report.compactions).toBe(1);
    expect(report.execCells).toBe(2);
    expect(report.parallelExecCells).toBe(1);
    expect(report.nestedToolCalls).toBe(3);
    expect(report.fullCheckInvocations).toBe(1);
    expect(JSON.stringify(report)).not.toContain('SECRET-PROMPT-MUST-NOT-LEAK');
    expect(JSON.stringify(report)).not.toContain('npm run check');
  });

  it('compares metrics without pretending to evaluate task quality', () => {
    const control = {
      usage: { inputTokens: 100, cachedInputTokens: 80, uncachedInputTokens: 20 },
      modelCycles: 10,
    };
    const treatment = {
      usage: { inputTokens: 70, cachedInputTokens: 50, uncachedInputTokens: 20 },
      modelCycles: 7,
    };

    const comparison = compareUsageReports(control, treatment);
    expect(comparison.efficiencySignal).toBe('positive');
    expect(comparison.qualityGate).toBe('external');
  });

  it('expires an unobserved full-check candidate with its own tool call', () => {
    const canonicalStart = JSON.stringify({
      output:
        '\n> fixture@0.0.0 check\n> node scripts/checks/machine-checks.mjs\n',
    });
    const records = [
      { type: 'session_meta', payload: { id: 'session', source: 'desktop' } },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          call_id: 'conditional',
          input: 'if (false) await tools.exec_command({cmd:"npm run check"});',
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'conditional',
          output: [{ type: 'input_text', text: 'no command ran' }],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          call_id: 'replay',
          input: 'await tools.exec_command({cmd:"sed -n 1,20p saved-check.log"});',
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'replay',
          output: [{ type: 'input_text', text: canonicalStart }],
        },
      },
    ];

    expect(analyzeSessionRecords(records).fullCheckInvocations).toBe(0);
  });

  it('keeps all current turns after inherited parent history', () => {
    const records = [
      {
        timestamp: '2026-07-28T01:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'child-session',
          source: {
            subagent: {
              thread_spawn: { parent_thread_id: 'parent-session', depth: 1 },
            },
          },
        },
      },
      {
        timestamp: '2026-07-27T23:00:00.000Z',
        type: 'session_meta',
        payload: { id: 'parent-session', source: 'desktop' },
      },
      tokenCount(
        '2026-07-27T23:10:00.000Z',
        usage({ input: 5_000, cached: 4_000, output: 500 }),
        usage({ input: 5_000, cached: 4_000, output: 500 }),
      ),
      {
        timestamp: '2026-07-28T01:00:00.010Z',
        type: 'event_msg',
        payload: { type: 'task_started' },
      },
      {
        timestamp: '2026-07-28T01:00:00.020Z',
        type: 'response_item',
        payload: { type: 'message', role: 'user', content: ['first current turn'] },
      },
      tokenCount(
        '2026-07-28T01:00:01.000Z',
        usage({ input: 40, cached: 24, output: 6 }),
        usage({ input: 40, cached: 24, output: 6 }),
      ),
      {
        timestamp: '2026-07-28T01:01:00.000Z',
        type: 'event_msg',
        payload: { type: 'task_started' },
      },
      {
        timestamp: '2026-07-28T01:01:00.010Z',
        type: 'response_item',
        payload: { type: 'message', role: 'user', content: ['second current turn'] },
      },
      tokenCount(
        '2026-07-28T01:01:01.000Z',
        usage({ input: 30, cached: 20, output: 4 }),
        usage({ input: 30, cached: 20, output: 4 }),
      ),
    ];

    const report = analyzeSessionRecords(records);
    expect(report.usage).toMatchObject({
      inputTokens: 70,
      cachedInputTokens: 44,
      uncachedInputTokens: 26,
      outputTokens: 10,
    });
    expect(report.modelCycles).toBe(2);
  });
});

describe('review.codex-ops context projection', () => {
  it('selects the earliest eligible CR domain and returns its dependency closure', () => {
    const ledger = baseLedger();
    const projection = buildContextProjection({
      ledger,
      headLedger: structuredClone(ledger),
      headSha: 'a'.repeat(40),
      sourceSha256: 'b'.repeat(64),
      loopStateText: [
        'milestone: complete',
        `baseSha: ${'a'.repeat(40)}`,
        'treeFingerprint: clean',
      ].join('\n'),
      treeFingerprint: 'clean',
    });

    expect(projection.health.ok).toBe(true);
    expect(projection.selection).toMatchObject({ kind: 'selected', domainId: 'early' });
    expect(projection.domain.id).toBe('early');
    expect(projection.dependencies.map((entry) => entry.id)).toEqual(['dep']);
    expect(Buffer.byteLength(JSON.stringify(projection))).toBeLessThanOrEqual(12 * 1024);
  });

  it('fails closed on a live domain/plannedSequence status contradiction', () => {
    const ledger = baseLedger();
    ledger.plannedSequence[1].status = 'shipped';
    const projection = buildContextProjection({
      ledger,
      headLedger: structuredClone(ledger),
      headSha: 'a'.repeat(40),
      sourceSha256: 'b'.repeat(64),
      loopStateText: '',
      treeFingerprint: 'clean',
    });

    expect(projection.health.ok).toBe(false);
    expect(projection.health.errors.some((item) => item.code === 'STATUS_MISMATCH')).toBe(true);
    expect(projection.selection.kind).toBe('integrity-error');
  });

  it('fails closed on missing and unknown live statuses', () => {
    for (const corruptStatus of [undefined, 'unknown-status']) {
      const ledger = baseLedger();
      if (corruptStatus === undefined) delete ledger.domains[1].status;
      else {
        ledger.domains[1].status = corruptStatus;
        ledger.plannedSequence[1].status = corruptStatus;
      }
      const projection = buildContextProjection({
        ledger,
        headLedger: structuredClone(ledger),
        headSha: 'a'.repeat(40),
        sourceSha256: 'b'.repeat(64),
        loopStateText: '',
        treeFingerprint: 'clean',
      });

      expect(projection.health.ok).toBe(false);
      expect(projection.health.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'INVALID_STATUS' })]),
      );
      expect(contextExitCode(projection)).toBe(2);
    }
  });

  it('marks legacy or mismatched loop state as stale', () => {
    expect(parseLoopState('milestone: old\nstep: 4').status).toBe('stale');

    const ledger = baseLedger();
    const projection = buildContextProjection({
      ledger,
      headLedger: structuredClone(ledger),
      headSha: 'a'.repeat(40),
      sourceSha256: 'b'.repeat(64),
      domainId: 'later',
      loopStateText: [
        'milestone: later',
        `baseSha: ${'c'.repeat(40)}`,
        'treeFingerprint: old-tree',
      ].join('\n'),
      treeFingerprint: 'new-tree',
    });

    expect(projection.loopState.status).toBe('stale');
    expect(projection.loopState.reasons).toEqual(
      expect.arrayContaining(['BASE_SHA_MISMATCH', 'TREE_FINGERPRINT_MISMATCH']),
    );
    expect(contextExitCode(projection)).toBe(5);
  });

  it('prioritizes implemented-not-audited work over a lower CR pending entry', () => {
    const ledger = baseLedger();
    ledger.plannedSequence[2].status = 'implemented-not-audited';
    ledger.domains[2].status = 'implemented-not-audited';
    const projection = buildContextProjection({
      ledger,
      headLedger: structuredClone(ledger),
      headSha: 'a'.repeat(40),
      sourceSha256: 'b'.repeat(64),
      loopStateText: [
        'milestone: complete',
        `baseSha: ${'a'.repeat(40)}`,
        'treeFingerprint: clean',
      ].join('\n'),
      treeFingerprint: 'clean',
    });

    expect(projection.selection).toMatchObject({
      kind: 'selected',
      domainId: 'later',
      reason: 'unaudited-implementation-first',
    });
    expect(contextExitCode(projection)).toBe(0);
  });
});

describe('review.codex-ops governance invariants', () => {
  it('keeps the root canon compact without deleting safety invariants', () => {
    const root = resolve(import.meta.dirname, '..', '..');
    const agents = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
    const judgeProtocol = readFileSync(resolve(root, 'docs/judge-protocol.md'), 'utf8');
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    expect(Buffer.byteLength(agents)).toBeLessThanOrEqual(14 * 1024);
    for (const required of [
      'fork_context: false',
      'BLOCKER/HIGH = 0',
      '1タスク=1マイルストーン',
      'npm run check',
      '右クリックメニューの代替',
      'CR を検査器にする',
      '理解と発見の快感',
      'メタは遊びに従属する',
      'STOP',
    ]) {
      expect(agents).toContain(required);
    }
    expect(judgeProtocol).toContain('npm run codex:context');
    expect(judgeProtocol).toContain('台帳全文');
    expect(packageJson.scripts['codex:usage']).toBe('node scripts/codex-usage.mjs');
    expect(packageJson.scripts['codex:context']).toBe('node scripts/codex-context.mjs');
  });
});
