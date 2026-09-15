from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {count}")
    file.write_text(text.replace(old, new, 1))


# Shared zone-transition seam: setup may run only after the physical transition is
# complete, but before the semantic trigger checkpoint observes the new state.
replace_once(
    "src/engine/cockpitTable.ts",
    """function move(\n  table: CockpitTable,\n  ids: string[],\n  to: ZoneId,\n  position: 'top' | 'bottom',\n  trace?: TableTriggerTrace,\n  meaning = 'move',\n  reason: import('./types').ZoneChangeReason = 'move',\n  enterAsToken = false,\n): void {\n""",
    """export function applyTableZoneTransition(\n  table: CockpitTable,\n  ids: string[],\n  to: ZoneId,\n  position: 'top' | 'bottom',\n  trace?: TableTriggerTrace,\n  meaning = 'move',\n  reason: import('./types').ZoneChangeReason = 'move',\n  enterAsToken = false,\n  beforeFinalCheckpoint?: (table: CockpitTable, ids: readonly string[]) => void,\n): void {\n""",
)
replace_once(
    "src/engine/cockpitTable.ts",
    """      card.manualKeywords = [];\n      delete card.attachedTo;\n      table.grants = table.grants.filter((grant) => grant.cardId !== id);\n""",
    """      card.manualKeywords = [];\n      delete card.attachedTo;\n      delete card.protectorId;\n      table.grants = table.grants.filter((grant) => grant.cardId !== id);\n""",
)
replace_once(
    "src/engine/cockpitTable.ts",
    """  checkpointTableTriggers(table, trace, meaning, reason);\n}\n\nexport function tableManaResources(table: CockpitTable, seatId: string): ManaResources {\n""",
    """  beforeFinalCheckpoint?.(table, ids);\n  checkpointTableTriggers(table, trace, meaning, reason);\n}\n\nfunction move(\n  table: CockpitTable,\n  ids: string[],\n  to: ZoneId,\n  position: 'top' | 'bottom',\n  trace?: TableTriggerTrace,\n  meaning = 'move',\n  reason: import('./types').ZoneChangeReason = 'move',\n  enterAsToken = false,\n): void {\n  applyTableZoneTransition(table, ids, to, position, trace, meaning, reason, enterAsToken);\n}\n\nexport function tableManaResources(table: CockpitTable, seatId: string): ManaResources {\n""",
)
replace_once(
    "src/engine/cockpitTable.ts",
    """function finishTableStack(\n  table: CockpitTable,\n  entry: TableStackEntry,\n  to: ZoneId,\n  trace?: TableTriggerTrace,\n  outcome: 'resolved' | 'removed' = 'resolved',\n): void {\n""",
    """export function finishTableStack(\n  table: CockpitTable,\n  entry: TableStackEntry,\n  to: ZoneId,\n  trace?: TableTriggerTrace,\n  outcome: 'resolved' | 'removed' = 'resolved',\n  beforeFinalCheckpoint?: (table: CockpitTable, ids: readonly string[]) => void,\n): void {\n""",
)
replace_once(
    "src/engine/cockpitTable.ts",
    """      move(table, [stackId], to, 'top', trace, 'resolve', 'resolve', entry.copied === true);\n""",
    """      applyTableZoneTransition(\n        table,\n        [stackId],\n        to,\n        'top',\n        trace,\n        'resolve',\n        'resolve',\n        entry.copied === true,\n        beforeFinalCheckpoint,\n      );\n""",
)

# R4 finite human-confirmed state transition.
replace_once(
    "src/engine/cockpitR4.ts",
    """  applyTableOperation,\n  manaColors,\n  tableCastPayment,\n  type CockpitTable,\n""",
    """  applyTableOperation,\n  applyTableZoneTransition,\n  manaColors,\n  tableCastPayment,\n  type CockpitTable,\n""",
)
replace_once(
    "src/engine/cockpitR4.ts",
    """  | {\n      type: 'special.turnFaceUp';\n      cardId: string;\n      faceIndex: number;\n    };\n""",
    """  | {\n      type: 'special.turnFaceUp';\n      cardId: string;\n      faceIndex: number;\n    }\n  | {\n      type: 'state.apply';\n      graveyardIds: string[];\n    };\n""",
)
state_apply = r'''function applyConfirmedStateActions(
  before: CockpitTable,
  operation: Extract<R4TableOperation, { type: 'state.apply' }>,
  context: ExpectedInteractionContext,
  commandId?: string,
): CockpitTable {
  requireR4(context.kind === 'unbound', 'STALE_INTERACTION_CONTEXT');
  requireExpectedInteractionContext(before, context);
  requireR4(!before.hold && !before.resolution, 'HOLDまたは処理中は実行できません。');
  requireR4(
    Array.isArray(operation.graveyardIds) &&
      operation.graveyardIds.length > 0 &&
      operation.graveyardIds.length <= 100 &&
      new Set(operation.graveyardIds).size === operation.graveyardIds.length,
    'INVALID_STATE_ACTION',
  );
  for (const id of operation.graveyardIds) {
    const card = before.cards[id];
    requireR4(card?.zone === 'battlefield' && !card.isToken, 'INVALID_STATE_ACTION');
  }

  const processId = commandId ?? `state:${before.turn}:${before.triggers?.sequence ?? 0}`;
  const trace = triggerTrace(before, processId, { kind: 'system', id: processId });
  const table = structuredClone(before);
  table.triggers ??= emptyTableTriggers(table.turn);
  if (table.phase === 'cleanup') table.cleanupReady = false;
  applyTableZoneTransition(
    table,
    operation.graveyardIds,
    'graveyard',
    'top',
    trace,
    'state.apply',
    'sba',
  );
  return table;
}

'''
replace_once(
    "src/engine/cockpitR4.ts",
    """function addManualTrigger(\n""",
    state_apply + "function addManualTrigger(\n",
)
replace_once(
    "src/engine/cockpitR4.ts",
    """  if (operation.type === 'trigger.manualAdd')\n    return addManualTrigger(table, operation, request.context);\n""",
    """  if (operation.type === 'state.apply')\n    return applyConfirmedStateActions(table, operation, request.context, commandId);\n  if (operation.type === 'trigger.manualAdd')\n    return addManualTrigger(table, operation, request.context);\n""",
)

# Server Formal authority. This is a system transition: operator may confirm public
# battlefield objects, but hidden identity revelation becomes a knowledge barrier.
replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """  | Extract<R4TableOperation, { type: 'trigger.manualAdd' }>\n  | R4CastOperation\n""",
    """  | Extract<R4TableOperation, { type: 'trigger.manualAdd' }>\n  | Extract<R4TableOperation, { type: 'state.apply' }>\n  | R4CastOperation\n""",
)
replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """    operation.type === 'trigger.manualAdd' ||\n    operation.type === 'activate' ||\n""",
    """    operation.type === 'trigger.manualAdd' ||\n    operation.type === 'state.apply' ||\n    operation.type === 'activate' ||\n""",
)
replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """  if (operation.type === 'trigger.manualAdd') {\n    const source = table.cards[operation.sourceId];\n""",
    """  if (operation.type === 'state.apply') {\n    return Boolean(\n      Array.isArray(operation.graveyardIds) &&\n        operation.graveyardIds.length > 0 &&\n        operation.graveyardIds.length <= 100 &&\n        new Set(operation.graveyardIds).size === operation.graveyardIds.length &&\n        operation.graveyardIds.every((id) => {\n          const card = table.cards[id];\n          return card?.zone === 'battlefield' && !card.isToken;\n        }),\n    );\n  }\n\n  if (operation.type === 'trigger.manualAdd') {\n    const source = table.cards[operation.sourceId];\n""",
)
replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """  if (operation.type === 'trigger.manualAdd') return false;\n  if (operation.type === 'activate') {\n""",
    """  if (operation.type === 'trigger.manualAdd') return false;\n  if (operation.type === 'state.apply')\n    return operation.graveyardIds.some((id) => Boolean(table.cards[id]?.faceDown));\n  if (operation.type === 'activate') {\n""",
)

# UI: selected public battlefield objects can be explicitly confirmed as a state action.
replace_once(
    "src/components/game/CockpitSelectionTools.tsx",
    """import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';\n""",
    """import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';\nimport type { R4TableOperation } from '../../engine/cockpitR4';\n""",
)
replace_once(
    "src/components/game/CockpitSelectionTools.tsx",
    """    operation: TableOperation,\n    context?: ExpectedInteractionContext,\n""",
    """    operation: TableOperation | R4TableOperation,\n    context?: ExpectedInteractionContext,\n""",
)
replace_once(
    "src/components/game/CockpitSelectionTools.tsx",
    """  const seat = table.seats.find((entry) => entry.id === seatId)!;\n""",
    """  const seat = table.seats.find((entry) => entry.id === seatId)!;\n  const stateActionReady =\n    selected.length > 0 &&\n    selected.every((id) => table.cards[id]?.zone === 'battlefield' && !table.cards[id].isToken);\n""",
)
replace_once(
    "src/components/game/CockpitSelectionTools.tsx",
    """  return (\n    <>\n      <details className=\"cockpit-session__tools\">\n""",
    """  return (\n    <>\n      <details className=\"cockpit-session__tools\">\n        <summary>状態起因処理</summary>\n        <p>致死、タフネス0、忠誠度0などを人が確認した後、選択した実カードを同時に墓地へ移します。該当性はOneDeckが自動裁定しません。</p>\n        <button\n          disabled={disabled || table.hold || Boolean(table.resolution) || !stateActionReady}\n          onClick={() =>\n            void send(\n              { type: 'state.apply', graveyardIds: [...selected] },\n              captureExpectedInteractionContext(table),\n            )\n          }\n        >\n          選択したカードを状態起因処理で墓地へ\n        </button>\n        {selected.some((id) => table.cards[id]?.isToken) && (\n          <p role=\"status\">トークンの消滅を含む状態起因処理は後続拡張です。</p>\n        )}\n      </details>\n      <details className=\"cockpit-session__tools\">\n""",
)

replace_once(
    "src/components/game/CockpitBattleTools.tsx",
    """            ダメージ第{combat.damageStep ?? 1}\n            段階。プレインズウォーカーは忠誠度、バトルは守備値を減らします。致死移動は手動です。\n""",
    """            ダメージ第{combat.damageStep ?? 1}\n            段階。プレインズウォーカーは忠誠度、バトルは守備値を減らします。致死などはカードを選択し「状態起因処理」で確定します。\n""",
)

Path("src/engine/__tests__/cockpitR4State.test.ts").write_text(r'''import { describe, expect, it } from 'vitest';

import { applyTableOperation, createCockpitTable } from '../cockpitTable';
import { applyR4TableOperation } from '../cockpitR4';
import { makeDeck } from './helpers';

function onBattlefield(count = 2) {
  let table = createCockpitTable(makeDeck(30), 31);
  const ids = table.seats[0].zones.hand.slice(0, count);
  table = applyTableOperation(table, {
    type: 'move',
    ids,
    to: 'battlefield',
    position: 'top',
  });
  return { table, ids };
}

describe('R4 human-confirmed state actions', () => {
  it('moves confirmed battlefield objects in one SBA checkpoint with system provenance', () => {
    const { table, ids } = onBattlefield(2);
    const next = applyR4TableOperation(
      table,
      {
        context: { kind: 'unbound' },
        operation: { type: 'state.apply', graveyardIds: ids },
      },
      'state-confirmed-1',
    );

    for (const id of ids) expect(next.cards[id].zone).toBe('graveyard');
    const events = next.triggers!.events.filter(
      (event) => event.type === 'zoneChange' && ids.includes(event.physicalCardId),
    );
    expect(events).toHaveLength(2);
    expect(new Set(events.map((event) => event.simultaneousGroupId))).toHaveLength(1);
    for (const event of events)
      expect(event).toMatchObject({
        type: 'zoneChange',
        reason: 'sba',
        process: { kind: 'system', id: 'state-confirmed-1' },
      });
  });

  it('rejects tokens and active Resolution instead of becoming a generic state batch', () => {
    const { table, ids } = onBattlefield(1);
    table.cards[ids[0]].isToken = true;
    expect(() =>
      applyR4TableOperation(table, {
        context: { kind: 'unbound' },
        operation: { type: 'state.apply', graveyardIds: ids },
      }),
    ).toThrow('INVALID_STATE_ACTION');

    table.cards[ids[0]].isToken = false;
    table.resolution = {
      id: 'A',
      kind: 'triggered',
      source: structuredClone(table.cards[ids[0]]),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text: 'Resolve A',
    };
    expect(() =>
      applyR4TableOperation(table, {
        context: { kind: 'unbound' },
        operation: { type: 'state.apply', graveyardIds: ids },
      }),
    ).toThrow('STALE_INTERACTION_CONTEXT');
  });
});
''')

Path("src/online/cloudflare/__tests__/cockpitR4StateSession.test.ts").write_text(r'''// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

import { makeDeck } from '../../../engine/__tests__/helpers';
import type { CockpitTable } from '../../../engine/cockpitTable';
import type { ZoneId } from '../../../engine/types';
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
      try {
        const result = callback();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function request(body: unknown): Request {
  return new Request('http://localhost/api/cockpit/r4-state-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type ErrorView = CockpitSessionView & { error?: string };

describe('R4 state.apply server boundary', () => {
  it('requires context and makes face-down state transitions a knowledge barrier', async () => {
    const storage = database();
    const token = '7'.repeat(64);
    let view = (await (
      await handleCockpitSession(
        request({ type: 'create', token, deck: makeDeck(30), seed: 13 }),
        storage,
        1000,
      )
    ).json()) as CockpitSessionView;
    let seq = 0;
    const commit = async (operation: Record<string, unknown>, context?: { kind: 'unbound' }) => {
      const response = await handleCockpitSession(
        request({
          type: 'commit',
          token,
          requestId: `state-${++seq}`,
          revision: view.revision,
          operation,
          ...(context ? { context } : {}),
        }),
        storage,
        2000 + seq,
      );
      const value = (await response.json()) as ErrorView;
      if (response.ok) view = value;
      return { response, value };
    };

    expect((await commit({ type: 'keep', seatId: 'P1' })).response.status).toBe(200);
    expect((await commit({ type: 'turn.ready' })).response.status).toBe(200);

    const row = storage.sql.exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1').toArray()[0];
    const record = JSON.parse(row.data) as { table: CockpitTable; knowledgeEpoch?: number };
    const cardId = record.table.seats[0].zones.hand[0];
    for (const seat of record.table.seats)
      for (const zone of Object.keys(seat.zones) as ZoneId[])
        seat.zones[zone] = seat.zones[zone].filter((id) => id !== cardId);
    const card = record.table.cards[cardId];
    card.zone = 'battlefield';
    card.zoneChangeCounter += 1;
    card.enteredTurn = record.table.turn;
    card.faceDown = true;
    record.table.seats[0].zones.battlefield.unshift(cardId);
    storage.sql.exec('UPDATE cockpit_session SET data = ? WHERE id = 1', JSON.stringify(record));

    const missing = await commit({ type: 'state.apply', graveyardIds: [cardId] });
    expect(missing.response.status).toBe(400);
    expect(missing.value.error).toBe('INVALID_REQUEST');

    const applied = await commit(
      { type: 'state.apply', graveyardIds: [cardId] },
      { kind: 'unbound' },
    );
    expect(applied.response.status).toBe(200);
    expect(applied.value.table.cards[cardId]).toMatchObject({ zone: 'graveyard', faceDown: false });
    expect(applied.value.canUndo).toBe(false);

    const persisted = JSON.parse(
      storage.sql.exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1').toArray()[0].data,
    ) as { knowledgeEpoch?: number };
    expect(persisted.knowledgeEpoch).toBe(1);
  });
});
''')

Path("src/components/game/CockpitSelectionTools.state.test.tsx").write_text(r'''import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitSelectionTools } from './CockpitSelectionTools';

it('commits selected battlefield cards through the explicit state.apply journey', async () => {
  let table = createCockpitTable(makeDeck(20), 41);
  const id = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [id],
    to: 'battlefield',
    position: 'top',
  });
  const host = document.createElement('div');
  const root = createRoot(host);
  const send = vi.fn(() => Promise.resolve(true));
  try {
    act(() =>
      root.render(
        <CockpitSelectionTools
          table={table}
          seatId="P1"
          selected={[id]}
          disabled={false}
          send={send}
          browseLibrary={vi.fn()}
        />,
      ),
    );
    const button = [...host.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === '選択したカードを状態起因処理で墓地へ',
    )!;
    expect(button.disabled).toBe(false);
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledWith(
      { type: 'state.apply', graveyardIds: [id] },
      { kind: 'unbound' },
    );
  } finally {
    act(() => root.unmount());
  }
});
''')
