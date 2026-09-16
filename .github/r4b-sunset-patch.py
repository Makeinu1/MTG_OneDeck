from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, got {count}")
    return text.replace(old, new, 1)


# Client: every gameplay/history commit is protocol v2. There is no context-less legacy fallback.
p = Path("src/online/browser/cockpitClient.ts")
text = p.read_text()
start = text.index("const R4B_CONTEXTUAL_FORMAL_TYPES")
end = text.index("interface CheckpointSchema", start)
text = text[:start] + text[end:]
start = text.index("  async commit(\n")
end = text.index("  async commitV2(\n", start)
new_commit = """  async commit(
    operation:
      | TableOperation
      | R4TableOperation
      | R4bOperation
      | { type: 'undo' }
      | { type: 'redo' },
    context?: ExpectedInteractionContext,
  ): Promise<void> {
    if (operation.type === 'undo' || operation.type === 'redo') {
      await this.submit(operation, false, undefined, { protocolVersion: R4B_PROTOCOL_VERSION });
      return;
    }
    if (!context)
      throw new CockpitConnectionError(
        'この操作には開始時のContextが必要です。画面を更新して操作をやり直してください。',
        'R4B_CONTEXT_REQUIRED',
      );
    const r4bOperation = operation as R4bOperation;
    const gate = classifyR4bOperation(r4bOperation);
    if (gate.kind === 'retired')
      throw new CockpitConnectionError(
        'この旧操作経路は廃止されました。Manual Event、Correction、またはFormal操作を選んでください。',
        `R4B_OPERATION_RETIRED:${gate.replacement}`,
      );
    if (gate.kind === 'repair') {
      await this.commitV2(r4bOperation, context, {
        kind: 'correction',
        groupId: crypto.randomUUID(),
      });
      return;
    }
    if (gate.kind === 'formal') {
      if (gate.family === 'stack-effect' && context.kind !== 'resolution')
        throw new CockpitConnectionError(
          'このStack操作は現在のResolution中だけ利用できます。',
          'R4B_STACK_EFFECT_REQUIRES_RESOLUTION',
        );
      await this.commitV2(r4bOperation, context);
      return;
    }
    if (gate.kind === 'effect') {
      if (context.kind === 'resolution') {
        await this.commitV2(r4bOperation, context);
        return;
      }
      if (gate.manualEventCapable) {
        await this.commitV2(r4bOperation, context, { kind: 'manual-event' });
        return;
      }
      throw new CockpitConnectionError(
        'この操作は解決処理中だけ利用できます。通常盤面ではManual EventまたはCorrectionを選んでください。',
        'R4B_RESOLUTION_REQUIRED',
      );
    }
    throw new CockpitConnectionError(
      'この操作はControl経路から実行してください。',
      'R4B_META_REQUIRES_CONTROL',
    );
  }
"""
text = text[:start] + new_commit + text[end:]
p.write_text(text)

# Gate: persistent visibility is Resolution-only. Reveal remains a dedicated deferred event.
p = Path("src/engine/cockpitR4b.ts")
text = p.read_text()
text = replace_once(
    text,
    """    case 'visibility':
      return {
        kind: 'retired',
        replacement: 'formal publication / repair.visibility / dedicated reveal',
      };
""",
    """    case 'visibility':
      return { kind: 'effect', manualEventCapable: false };
""",
    "visibility classifier",
)
p.write_text(text)

# Server strict sunset: receipt lookup stays first, then protocol v2 is mandatory.
p = Path("src/online/cloudflare/cockpitSession.ts")
text = p.read_text()
text = replace_once(
    text,
    """import {
  authorizeR4FormalOperation,
  isR4FormalOperation,
  r4OperationCreatesKnowledgeBarrier,
  r4OperationRequiresContext,
} from './cockpitR4Authority';
""",
    "",
    "legacy R4 authority import",
)
text = replace_once(
    text,
    "import { applyR4TableOperation, type R4TableOperation } from '../../engine/cockpitR4';\n",
    "",
    "legacy R4 apply import",
)
start = text.index("function operationCreatesKnowledgeBarrier(\n")
end = text.index("function view(\n", start)
text = text[:start] + text[end:]
old_gate = """          if (
            body.type === 'commit' &&
            body.protocolVersion !== undefined &&
            body.protocolVersion !== R4B_PROTOCOL_VERSION
          )
            return response({ error: 'CLIENT_UPDATE_REQUIRED' }, 409);
"""
text = replace_once(
    text,
    old_gate,
    """          if (body.type === 'commit' && body.protocolVersion !== R4B_PROTOCOL_VERSION)
            return response({ error: 'CLIENT_UPDATE_REQUIRED' }, 409);
""",
    "strict protocol gate",
)
start = text.index("            const useR4bV2 =\n")
end = text.index("            if (body.operation.type === 'undo') {", start)
new_prepare = """            const isHistoryOperation =
              body.operation.type === 'undo' || body.operation.type === 'redo';
            let preparedR4b: PreparedR4bCommit | undefined;

            if (!isHistoryOperation) {
              if (!body.context) return response({ error: 'INVALID_REQUEST' }, 400);
              try {
                preparedR4b = prepareR4bCommit(
                  before,
                  record.multiplayer,
                  actor,
                  {
                    protocolVersion: R4B_PROTOCOL_VERSION,
                    operation: body.operation as R4bOperation,
                    context: body.context,
                    ...(body.declaredCause ? { declaredCause: body.declaredCause } : {}),
                  } satisfies R4bCommitEnvelope,
                  body.requestId,
                  now,
                );
              } catch (error) {
                const mapped = r4bFailure(error);
                if (mapped) return mapped;
                throw error;
              }
            } else if (record.multiplayer) {
              const authorized = authorizeCockpitOperation(
                before,
                record.multiplayer,
                actor,
                body.operation as { type: 'undo' } | { type: 'redo' },
                now,
              );
              if (!authorized) return response({ error: 'NOT_AUTHORIZED' }, 403);
            }

"""
text = text[:start] + new_prepare + text[end:]
start = text.index("              const knowledgeEpochBefore = record.knowledgeEpoch ?? 0;")
end = text.index("              const operation = body.operation;", start)
new_apply = """              const knowledgeEpochBefore = record.knowledgeEpoch ?? 0;
              if (!preparedR4b) return response({ error: 'INVALID_REQUEST' }, 400);
              const crossesKnowledgeBarrier = Boolean(
                record.multiplayer && preparedR4b.crossesKnowledgeBarrier,
              );
              try {
                record.table = applyPreparedR4bCommit(before, preparedR4b, body.requestId);
              } catch (error) {
                const mapped = r4bFailure(error);
                if (mapped) return mapped;
                throw error;
              }
              record.recentActions = appendR4bSemanticAction(
                record.recentActions,
                semanticActionForR4bCommit(before, preparedR4b, actor, record.revision + 1),
              );
"""
text = text[:start] + new_apply + text[end:]
p.write_text(text)

# R4b authority/knowledge for persistent visibility.
p = Path("src/online/cloudflare/cockpitR4bSession.ts")
text = p.read_text()
fstart = text.index("function authorizeEffectObjects(")
fend = text.index("function baseMultiplayerAuthority(", fstart)
section = text[fstart:fend]
section = replace_once(
    section,
    """    case 'face':
      return actorCanReadCard(table, multi, actor, operation.cardId) &&
        actorCanReadFace(table, actor, operation.cardId);
    default:
""",
    """    case 'face':
      return actorCanReadCard(table, multi, actor, operation.cardId) &&
        actorCanReadFace(table, actor, operation.cardId);
    case 'visibility':
      return operation.ids.every((id) => actorCanReadCard(table, multi, actor, id));
    default:
""",
    "visibility authority",
)
text = text[:fstart] + section + text[fend:]
fstart = text.index("function operationCreatesKnowledgeBarrier(")
fend = text.index("export function prepareR4bCommit(", fstart)
section = text[fstart:fend]
section = replace_once(
    section,
    """    case 'move':
      return operation.ids.some((id) => ['hand', 'library'].includes(table.cards[id]?.zone ?? ''));
""",
    """    case 'visibility':
      return operation.ids.some((id) => {
        const card = table.cards[id];
        if (!card) return false;
        const before = new Set(table.visibility[id] ?? []);
        const addsAudience = operation.seatIds.some((seatId) => !before.has(seatId));
        return addsAudience && (['hand', 'library'].includes(card.zone) || card.faceDown);
      });
    case 'move':
      return operation.ids.some((id) => ['hand', 'library'].includes(table.cards[id]?.zone ?? ''));
""",
    "visibility knowledge barrier",
)
text = text[:fstart] + section + text[fend:]
p.write_text(text)

# Card tools: remove correction-only retired edit controls.
p = Path("src/components/game/CockpitCardTools.tsx")
text = p.read_text()
text = replace_once(
    text,
    """      {card.isToken && (
        <CockpitTokenEditor table={table} cardId={cardId} disabled={disabled} send={send} />
      )}
""",
    "",
    "token editor call",
)
block_start = text.index("          <button\n            disabled={disabled || !(table.commanderCasts[cardId] ?? 0)}")
block_end = text.index(
    "          <p>移動先は領域操作で明示してください。統率領域へ自動では置き換えません。</p>",
    block_start,
)
text = (
    text[:block_start]
    + "          <p>唱えた回数の訂正は「盤面訂正（Correction）」から行います。</p>\n"
    + text[block_end:]
)
token_editor = text.find("\nfunction CockpitTokenEditor({")
if token_editor == -1:
    raise SystemExit("token editor definition not found")
text = text[:token_editor].rstrip() + "\n"
p.write_text(text)

# Commander command-zone journey uses dedicated Formal operation and object identity.
p = Path("src/components/game/CockpitSessionScreen.tsx")
text = p.read_text()
text = replace_once(
    text,
    "import type { ZoneId } from '../../engine/types';\n",
    "import { objectIdOf, type ZoneId } from '../../engine/types';\n",
    "objectId import",
)
anchor = "  const selectionActions = (\n"
helper = """  function zoneMoveOperation(
    ids: string[],
    target: ZoneId,
    position: 'top' | 'bottom',
  ): R4bOperation {
    if (target === 'command' && ids.length === 1) {
      const card = table.cards[ids[0]];
      if (card?.isCommander)
        return {
          type: 'commander.moveToCommand',
          cardId: card.id,
          objectId: objectIdOf(card),
        };
    }
    return { type: 'move', ids, to: target, position };
  }
  const mixedCommanderCommandMove =
    to === 'command' &&
    selected.some((id) => table.cards[id]?.isCommander) &&
    !(selected.length === 1 && table.cards[selected[0]]?.isCommander);
"""
text = replace_once(text, anchor, helper + anchor, "zone move helper")
text = replace_once(
    text,
    """        disabled={disabled || !selected.length}
        onClick={() => void send({ type: 'move', ids: selected, to, position })}
""",
    """        disabled={disabled || !selected.length || mixedCommanderCommandMove}
        onClick={() => void send(zoneMoveOperation(selected, to, position))}
""",
    "selection commander move",
)
text = replace_once(
    text,
    """                      void send({
                        type: 'move',
                        ids: [detailCard.id],
                        to: target,
                        position: 'top',
                      }).then((saved) => {
""",
    """                      void send(zoneMoveOperation([detailCard.id], target, 'top')).then((saved) => {
""",
    "detail commander move",
)
p.write_text(text)

# Engine expectation for visibility.
p = Path("src/engine/__tests__/cockpitR4b.test.ts")
text = p.read_text()
text = replace_once(
    text,
    """    expect(classifyR4bOperation({ type: 'visibility', ids: ['c1'], seatIds: ['P1'] }))
      .toMatchObject({ kind: 'retired' });
""",
    """    expect(classifyR4bOperation({ type: 'visibility', ids: ['c1'], seatIds: ['P1'] }))
      .toEqual({ kind: 'effect', manualEventCapable: false });
""",
    "visibility classification test",
)
p.write_text(text)

# Shared R4b setup/history requests are v2.
p = Path("src/online/cloudflare/__tests__/cockpitR4bSession.test.ts")
text = p.read_text()
text = replace_once(
    text,
    """    const legacyCommit = async (index: number, operation: Record<string, unknown>) =>
      call(index, {
        type: 'commit',
        requestId: crypto.randomUUID(),
        revision,
        operation,
      });
""",
    """    const v2Commit = async (
      index: number,
      operation: Record<string, unknown>,
      context?: { kind: 'unbound' } | { kind: 'resolution'; entryId: string },
    ) =>
      call(index, {
        type: 'commit',
        protocolVersion: 2,
        requestId: crypto.randomUUID(),
        revision,
        operation,
        ...(context ? { context } : {}),
      });
""",
    "R4b shared commit helper",
)
text = text.replace(
    "legacyCommit(0, { type: 'keep', seatId: 'P1' })",
    "v2Commit(0, { type: 'keep', seatId: 'P1' }, { kind: 'unbound' })",
)
text = text.replace(
    "legacyCommit(1, { type: 'keep', seatId: 'P2' })",
    "v2Commit(1, { type: 'keep', seatId: 'P2' }, { kind: 'unbound' })",
)
text = text.replace("legacyCommit(0, { type: 'undo' })", "v2Commit(0, { type: 'undo' })")
p.write_text(text)

# Carry forward existing R4 formal server regressions under protocol v2.
p = Path("src/online/cloudflare/__tests__/cockpitR4Session.test.ts")
text = p.read_text()
text = replace_once(
    text,
    "        type: 'commit',\n        requestId: crypto.randomUUID(),\n",
    "        type: 'commit',\n        protocolVersion: 2,\n        requestId: crypto.randomUUID(),\n",
    "R4 session protocol helper",
)
text = text.replace(
    "commit(0, { type: 'keep', seatId: 'P1' })",
    "commit(0, { type: 'keep', seatId: 'P1' }, { kind: 'unbound' })",
)
text = text.replace(
    "commit(1, { type: 'keep', seatId: 'P2' })",
    "commit(1, { type: 'keep', seatId: 'P2' }, { kind: 'unbound' })",
)
p.write_text(text)

p = Path("src/online/cloudflare/__tests__/cockpitR4FormalSession.test.ts")
text = p.read_text()
text = replace_once(
    text,
    "      type: 'commit',\n      requestId: crypto.randomUUID(),\n",
    "      type: 'commit',\n      protocolVersion: 2,\n      requestId: crypto.randomUUID(),\n",
    "R4 formal protocol helper",
)
p.write_text(text)

# Old client compatibility assertion becomes strict fail-closed expectation.
p = Path("src/online/browser/__tests__/cockpitClientR4b.test.ts")
text = p.read_text()
start = text.index("it('keeps context-less raw effect commits compatible")
end = text.index("it('treats v2 gate/update responses", start)
replacement = """it('rejects context-less gameplay commits instead of falling back to legacy protocol', async () => {
  connectState();
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      requests.push(body);
      return Promise.resolve(
        Response.json({
          table: { seats: [] },
          revision: 0,
          receipt: 'committed',
          canUndo: false,
          canRedo: false,
          expiresAt: 0,
        }),
      );
    }),
  );
  const client = new CockpitClient(vi.fn());
  clients.push(client);
  await client.reconnect();
  await expect(client.commit({ type: 'draw', seatId: 'P1', count: 1 })).rejects.toThrow('Context');
  expect(requests.filter((body) => body.type === 'commit')).toHaveLength(0);
});

"""
text = text[:start] + replacement + text[end:]
p.write_text(text)

# Strict server sunset tests.
Path("src/online/cloudflare/__tests__/cockpitR4bSunset.test.ts").write_text(r"""// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { makeDeck } from '../../../engine/__tests__/helpers';
import { handleCockpitSession, type CockpitSessionView } from '../cockpitSession';
import type { OnlineCloudflareSqlStorage } from '../types';
function database(): OnlineCloudflareSqlStorage {
  const db = new DatabaseSync(':memory:');
  return {
    sql: {
      exec(query, ...bindings) {
        const statement = db.prepare(query);
        const args = bindings as (string | number | null)[];
        if (/^SELECT/.test(query)) return { toArray: () => statement.all(...args) as never[] };
        statement.run(...args);
        return { toArray: () => [] };
      },
    },
    transactionSync(callback) {
      db.exec('BEGIN');
      try { const result = callback(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}
function request(body: unknown): Request {
  return new Request('http://localhost/api/cockpit/r4b-sunset-test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}
type View = CockpitSessionView & { error?: string };
describe('R4b strict protocol sunset', () => {
  it('rejects new missing/old protocol commits but accepts protocol v2', async () => {
    const storage = database();
    const token = '7'.repeat(64);
    let now = 1;
    const call = async (body: Record<string, unknown>) => {
      const response = await handleCockpitSession(request({ token, ...body }), storage, now++);
      return { status: response.status, value: (await response.json()) as View };
    };
    const created = await call({ type: 'create', seed: 7, deck: makeDeck(20) });
    const base = {
      type: 'commit', requestId: crypto.randomUUID(), revision: created.value.revision,
      context: { kind: 'unbound' }, operation: { type: 'keep', seatId: 'P1' },
    };
    const missing = await call(base);
    expect(missing.status).toBe(409);
    expect(missing.value.error).toBe('CLIENT_UPDATE_REQUIRED');
    const old = await call({ ...base, requestId: crypto.randomUUID(), protocolVersion: 1 });
    expect(old.status).toBe(409);
    expect(old.value.error).toBe('CLIENT_UPDATE_REQUIRED');
    const current = await call({ ...base, requestId: crypto.randomUUID(), protocolVersion: 2 });
    expect(current.status).toBe(200);
  });
  it('reconciles an already-committed legacy receipt before applying the sunset gate', async () => {
    const storage = database();
    const token = '8'.repeat(64);
    let now = 100;
    const call = async (body: Record<string, unknown>) => {
      const response = await handleCockpitSession(request({ token, ...body }), storage, now++);
      return { status: response.status, value: (await response.json()) as View };
    };
    const created = await call({ type: 'create', seed: 8, deck: makeDeck(20) });
    const row = storage.sql.exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1').toArray()[0];
    const persisted = JSON.parse(row.data) as { generation: string };
    const requestId = crypto.randomUUID();
    const operation = { type: 'life', seatIds: ['P1'], delta: -1 };
    const context = { kind: 'unbound' };
    storage.sql.exec(
      'INSERT INTO cockpit_receipts (id, operation) VALUES (?, ?)',
      `${persisted.generation}:${requestId}`,
      JSON.stringify({ operation, context }),
    );
    const beforeLife = created.value.table.seats[0].life;
    const replay = await call({ type: 'commit', requestId, revision: 999, operation, context });
    expect(replay.status).toBe(200);
    expect(replay.value.receipt).toBe('committed');
    expect(replay.value.table.seats[0].life).toBe(beforeLife);
    expect(replay.value.revision).toBe(created.value.revision);
  });
});
""")

# Client Formal families + history protocol tests.
Path("src/online/browser/__tests__/cockpitClientR4bSunset.test.ts").write_text(r"""import { afterEach, expect, it, vi } from 'vitest';
import { CockpitClient } from '../cockpitClient';
const key = 'mtg-onedeck:cockpit-connection-v1';
const clients: CockpitClient[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.dispose());
  vi.unstubAllGlobals();
  localStorage.removeItem(key);
});
function connectState() {
  localStorage.setItem(key, JSON.stringify({
    id: crypto.randomUUID(), token: 'a'.repeat(64), connectionId: crypto.randomUUID(), pending: null,
  }));
}
function stubRequests(requests: Record<string, unknown>[]) {
  let revision = 0;
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    requests.push(body);
    if (body.type === 'commit') revision += 1;
    return Promise.resolve(Response.json({
      table: { seats: [] }, revision, receipt: 'committed', canUndo: true, canRedo: true,
      expiresAt: 0, recentActions: [],
    }));
  }));
}
it('routes every representative Formal family through protocol v2', async () => {
  connectState();
  const requests: Record<string, unknown>[] = [];
  stubRequests(requests);
  const client = new CockpitClient(vi.fn());
  clients.push(client);
  await client.reconnect();
  const operations = [
    { type: 'phase' as const },
    { type: 'resolve.begin' as const },
    { type: 'trigger.dismiss' as const, candidateId: 'candidate-1' },
    { type: 'battle.end' as const },
    { type: 'cleanup' as const, damageIds: [], grantIds: [], modifierIds: [], discardIds: [], seatId: 'P1' },
    { type: 'state.apply' as const, graveyardIds: [] },
    { type: 'end' as const },
    { type: 'commander.moveToCommand' as const, cardId: 'c1', objectId: 'c1:0' },
  ];
  for (const operation of operations) await client.commit(operation, { kind: 'unbound' });
  const commits = requests.filter((body) => body.type === 'commit');
  expect(commits).toHaveLength(operations.length);
  for (const commit of commits)
    expect(commit).toMatchObject({ protocolVersion: 2, context: { kind: 'unbound' } });
});
it('sends undo and redo through protocol v2 without inventing a gameplay Context', async () => {
  connectState();
  const requests: Record<string, unknown>[] = [];
  stubRequests(requests);
  const client = new CockpitClient(vi.fn());
  clients.push(client);
  await client.reconnect();
  await client.commit({ type: 'undo' });
  await client.commit({ type: 'redo' });
  const commits = requests.filter((body) => body.type === 'commit');
  expect(commits).toHaveLength(2);
  for (const commit of commits) {
    expect(commit).toMatchObject({ protocolVersion: 2 });
    expect(commit).not.toHaveProperty('context');
  }
});
it('fails a stack-effect Formal operation closed outside Resolution', async () => {
  connectState();
  const requests: Record<string, unknown>[] = [];
  stubRequests(requests);
  const client = new CockpitClient(vi.fn());
  clients.push(client);
  await client.reconnect();
  await expect(client.commit(
    { type: 'stack.remove', entryId: 'A', to: 'graveyard' }, { kind: 'unbound' },
  )).rejects.toThrow('Resolution');
  expect(requests.filter((body) => body.type === 'commit')).toHaveLength(0);
});
""")

Path("src/components/game/CockpitFormalJourney.r4b.test.ts").write_text(r"""import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const read = (path: string) => readFileSync(path, 'utf8');
it('keeps retired editors out and routes Commander-to-command through its Formal operation', () => {
  const screen = read('src/components/game/CockpitSessionScreen.tsx');
  const cardTools = read('src/components/game/CockpitCardTools.tsx');
  expect(screen).toContain("type: 'commander.moveToCommand'");
  expect(screen).toContain('objectId: objectIdOf(card)');
  expect(screen).toContain('mixedCommanderCommandMove');
  expect(cardTools).not.toContain("type: 'commanderCount'");
  expect(cardTools).not.toContain("type: 'token.edit'");
  expect(cardTools).toContain("type: 'visibility'");
});
""")
