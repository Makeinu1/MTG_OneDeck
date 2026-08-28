import { mkdtempSync, mkdirSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  analyzeSessionRecords,
  compareUsageReports,
  findSessionFile,
  readSessionUsageReceipt,
} from '../codex-usage.mjs';

const tokenRecord = (input, cached, output, reasoning = 0) => ({
  type: 'event_msg',
  payload: {
    type: 'token_count',
    info: {
      total_token_usage: { input_tokens: 999_999, output_tokens: 999_999 },
      last_token_usage: {
        input_tokens: input,
        cached_input_tokens: cached,
        output_tokens: output,
        reasoning_output_tokens: reasoning,
      },
    },
  },
});

describe('codex usage analysis', () => {
  it('sums per-cycle usage and classifies tool activity without returning content', () => {
    const records = [
      {
        type: 'session_meta',
        timestamp: '2026-08-26T00:00:00.000Z',
        payload: { id: 'child', source: { subagent: { thread_spawn: {} } } },
      },
      {
        type: 'turn_context',
        payload: { model: 'test-model', effort: 'high' },
      },
      { ...tokenRecord(100, 60, 10, 3), timestamp: '2026-08-26T00:00:00.000Z' },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          call_id: 'parallel-check',
          input:
            'await Promise.all([tools.exec_command({cmd:"npm run check"}), tools.exec_command({cmd:"SECRET"})])',
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'parallel-check',
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
      { type: 'response_item', payload: { type: 'function_call', arguments: '{}' } },
      { ...tokenRecord(80, 50, 8, 2), timestamp: '2026-08-26T00:00:01.250Z' },
    ];

    const report = analyzeSessionRecords(records);

    expect(report.usage).toEqual({
      inputTokens: 180,
      cachedInputTokens: 110,
      uncachedInputTokens: 70,
      outputTokens: 18,
      reasoningOutputTokens: 5,
    });
    expect(report).toMatchObject({
      model: 'test-model',
      effort: 'high',
      sourceKind: 'subagent',
      modelCycles: 2,
      execCells: 1,
      parallelExecCells: 1,
      nestedToolCalls: 2,
      directFunctionCalls: 1,
      fullCheckInvocations: 1,
      terminalUsage: {
        cachedInputTokens: 110,
        uncachedInputTokens: 70,
        modelCycles: 2,
        compactions: 0,
        repairWaves: null,
        fullChecks: 1,
        ciRuns: null,
        elapsedMs: 1250,
      },
    });
    expect(report.terminalUsageAvailability).toMatchObject({
      repairWaves: { available: false, source: 'platform-unavailable' },
      ciRuns: { available: false, source: 'platform-unavailable' },
      elapsedMs: { available: true },
    });
    expect(JSON.stringify(report)).not.toContain('SECRET');
    expect(JSON.stringify(report)).not.toContain('npm run check');
  });

  it('drops copied-parent cycles before the final current bootstrap input', () => {
    const records = [
      {
        type: 'session_meta',
        payload: {
          id: 'child',
          source: {
            subagent: { thread_spawn: { parent_thread_id: 'parent' } },
          },
        },
      },
      { type: 'session_meta', payload: { id: 'parent', source: 'desktop' } },
      tokenRecord(1000, 900, 100),
      {
        type: 'response_item',
        payload: { type: 'message', role: 'user', content: ['private prompt'] },
      },
      tokenRecord(40, 24, 6, 2),
    ];

    const report = analyzeSessionRecords(records);

    expect(report.inheritedContext).toBe(true);
    expect(report.parentSessionId).toBe('parent');
    expect(report.lineageIds).toEqual(['child', 'parent']);
    expect(report.usage.inputTokens).toBe(40);
    expect(report.deduplication.confidence).toBe('high');
  });

  it('does not reset isolation when a later current turn starts', () => {
    const records = [
      {
        type: 'session_meta',
        payload: {
          id: 'child',
          source: {
            subagent: { thread_spawn: { parent_thread_id: 'parent' } },
          },
        },
      },
      { type: 'session_meta', payload: { id: 'parent', source: 'desktop' } },
      tokenRecord(1000, 900, 100),
      { type: 'event_msg', payload: { type: 'task_started' } },
      {
        type: 'response_item',
        payload: { type: 'message', role: 'user', content: ['first turn'] },
      },
      tokenRecord(40, 24, 6),
      { type: 'event_msg', payload: { type: 'task_started' } },
      {
        type: 'response_item',
        payload: { type: 'message', role: 'user', content: ['second turn'] },
      },
      tokenRecord(30, 20, 4),
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

  it('counts only shell executions of the full check command', () => {
    const records = [
      { type: 'session_meta', payload: { id: 'session', source: 'desktop' } },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          call_id: 'nested-source',
          input: [
            'await tools.exec_command({cmd:"rg -n \\\"npm run check\\\" AGENTS.md"});',
            'await tools.exec_command({cmd:"npm run check:forbidden"});',
            'if (false) await tools.exec_command({cmd:"npm run check"});',
          ].join('\n'),
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'nested-source',
          output: [{ type: 'input_text', text: 'conditional branch not taken' }],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          call_id: 'replayed-log',
          input: 'await tools.exec_command({cmd:"sed -n 1,20p saved-check.log"});',
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'replayed-log',
          output: [
            {
              type: 'input_text',
              text: JSON.stringify({
                output:
                  '\n> fixture@0.0.0 check\n> node scripts/checks/machine-checks.mjs\n',
              }),
            },
          ],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'exec_command',
          call_id: 'wrapped-check',
          arguments: JSON.stringify({ cmd: "bash -lc 'npm run check'" }),
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'function_call_output',
          call_id: 'wrapped-check',
          output: JSON.stringify({
            output:
              '\n> fixture@0.0.0 check\n> node scripts/checks/machine-checks.mjs\n\n=== machine-check: lint ===\n',
          }),
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'request_user_input',
          arguments: JSON.stringify({ prompt: 'please run npm run check' }),
        },
      },
    ];

    const report = analyzeSessionRecords(records);
    expect(report.fullCheckInvocations).toBe(1);
    expect(report.fullCheckDetection).toMatchObject({
      strategy: 'call-scoped-observed-machine-check-start',
      confidence: 'high',
    });
  });

  it('carries a candidate only through its yielded exec cell', () => {
    const records = [
      { type: 'session_meta', payload: { id: 'session', source: 'desktop' } },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          call_id: 'outer-exec',
          input: 'await tools.exec_command({cmd:"npm run check"});',
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'outer-exec',
          output: [{ type: 'input_text', text: 'Script running with cell ID 77' }],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'wait',
          call_id: 'wait-cell',
          arguments: JSON.stringify({ cell_id: '77' }),
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'function_call_output',
          call_id: 'wait-cell',
          output: JSON.stringify({
            output:
              '\n> fixture@0.0.0 check\n> node scripts/checks/machine-checks.mjs\n',
          }),
        },
      },
    ];

    expect(analyzeSessionRecords(records).fullCheckInvocations).toBe(1);
  });

  it('returns directional deltas with an external quality gate', () => {
    const comparison = compareUsageReports(
      { usage: { inputTokens: 100, cachedInputTokens: 80, uncachedInputTokens: 20 }, modelCycles: 10 },
      { usage: { inputTokens: 75, cachedInputTokens: 60, uncachedInputTokens: 15 }, modelCycles: 8 },
    );
    expect(comparison.percentageDeltas.inputTokens).toBe(-25);
    expect(comparison.efficiencySignal).toBe('positive');
    expect(comparison.qualityGate).toBe('external');
  });

  it('marks elapsed time unavailable instead of inventing zero', () => {
    const report = analyzeSessionRecords([
      { type: 'session_meta', payload: { id: 'session', source: 'desktop' } },
      tokenRecord(4, 1, 1),
    ]);
    expect(report.terminalUsage.elapsedMs).toBeNull();
    expect(report.terminalUsageAvailability.elapsedMs).toMatchObject({
      available: false,
      source: 'platform-unavailable',
    });
  });

  it('locates a rollout only when the first metadata id exactly matches', () => {
    const root = mkdtempSync(join(tmpdir(), 'codex-usage-'));
    const nested = join(root, '2026', '07');
    mkdirSync(nested, { recursive: true });
    const id = '11111111-2222-4333-8444-555555555555';
    const path = join(nested, `rollout-${id}.jsonl`);
    writeFileSync(path, `${JSON.stringify({ type: 'session_meta', payload: { id } })}\n`);

    expect(findSessionFile(id, root)).toBe(path);
    expect(() => findSessionFile('not-a-uuid', root)).toThrow(/exact UUID/);
  });

  it('reads only a fixed receipt prefix even when a large sparse tail is present', () => {
    const root = mkdtempSync(join(tmpdir(), 'codex-usage-prefix-'));
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const path = join(root, `rollout-${id}.jsonl`);
    const prefix = [
      { type: 'session_meta', payload: { id, source: 'desktop' } },
      tokenRecord(100, 60, 10),
    ].map(JSON.stringify).join('\n') + '\n';
    writeFileSync(path, prefix);
    const expected = readSessionUsageReceipt(id, root);
    truncateSync(path, Buffer.byteLength(prefix) + 64 * 1024 * 1024);

    const fixed = readSessionUsageReceipt(id, root, Buffer.byteLength(prefix));
    expect(fixed).toMatchObject({
      byteLength: Buffer.byteLength(prefix),
      currentByteLength: Buffer.byteLength(prefix) + 64 * 1024 * 1024,
      prefixSha256: expected.prefixSha256,
      report: expected.report,
    });
  });

  it('rejects invalid lengths, early EOF, and partial JSONL records', () => {
    const root = mkdtempSync(join(tmpdir(), 'codex-usage-prefix-'));
    const id = 'ffffffff-1111-4222-8333-444444444444';
    const path = join(root, `rollout-${id}.jsonl`);
    const content = `${JSON.stringify({ type: 'session_meta', payload: { id, source: 'desktop' } })}\n`;
    writeFileSync(path, content);

    expect(() => readSessionUsageReceipt(id, root, 0)).toThrow(/Invalid session receipt byte length/);
    expect(() => readSessionUsageReceipt(id, root, Buffer.byteLength(content) + 1)).toThrow();
    expect(() => readSessionUsageReceipt(id, root, Buffer.byteLength(content) - 1)).toThrow(/does not end at a JSONL record/);
  });

  it('invalidates a cached fixed prefix when its bytes mutate', () => {
    const root = mkdtempSync(join(tmpdir(), 'codex-usage-prefix-'));
    const id = '12345678-1234-4234-8234-123456789abc';
    const path = join(root, `rollout-${id}.jsonl`);
    const original = [
      { type: 'session_meta', payload: { id, source: 'desktop' } },
      tokenRecord(100, 60, 10),
    ].map(JSON.stringify).join('\n') + '\n';
    const mutated = original.replace('"input_tokens":100', '"input_tokens":200');
    expect(Buffer.byteLength(mutated)).toBe(Buffer.byteLength(original));
    writeFileSync(path, original);
    const first = readSessionUsageReceipt(id, root, Buffer.byteLength(original));

    writeFileSync(path, mutated);
    const second = readSessionUsageReceipt(id, root, Buffer.byteLength(mutated));
    expect(second.prefixSha256).not.toBe(first.prefixSha256);
    expect(second.report.usage.inputTokens).toBe(200);
  });
});
