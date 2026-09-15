from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {count}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/engine/cockpitTriggers.ts",
    """export type TriggerOperation =\n  | { type: 'trigger.place'; candidateId: string; id: string; targets: string[]; text?: string }\n  | { type: 'trigger.link'; candidateId: string; entryId: string }\n  | { type: 'trigger.dismiss'; candidateId: string; reason: string };\n""",
    """export type TriggerOperation =\n  | { type: 'trigger.manualAdd'; id: string; sourceId: string; text: string }\n  | { type: 'trigger.place'; candidateId: string; id: string; targets: string[]; text?: string }\n  | { type: 'trigger.link'; candidateId: string; entryId: string }\n  | { type: 'trigger.dismiss'; candidateId: string; reason: string };\n""",
)

replace_once(
    "src/engine/cockpitR4.ts",
    """  checkpointTableTriggers,\n  emptyTableTriggers,\n  triggerTrace,\n  type TableTriggerTrace,\n""",
    """  checkpointTableTriggers,\n  emptyTableTriggers,\n  tableObjectSnapshot,\n  triggerTrace,\n  type TableTriggerTrace,\n""",
)

manual_trigger_function = r'''function addManualTrigger(
  before: CockpitTable,
  operation: Extract<R4TableOperation, { type: 'trigger.manualAdd' }>,
  context: ExpectedInteractionContext,
): CockpitTable {
  requireExpectedInteractionContext(before, context);
  requireR4(!before.hold, 'HOLD中は誘発を追加できません。');
  requireR4(
    typeof operation.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(operation.id),
    'INVALID_MANUAL_TRIGGER',
  );
  requireR4(
    typeof operation.text === 'string' &&
      operation.text.trim().length > 0 &&
      operation.text.length <= 5000,
    'INVALID_MANUAL_TRIGGER',
  );
  const source = before.cards[operation.sourceId];
  requireR4(
    source &&
      !source.faceDown &&
      !['hand', 'library'].includes(source.zone) &&
      usableSeat(before, source.controllerId),
    'INVALID_MANUAL_TRIGGER_SOURCE',
  );

  const table = structuredClone(before);
  table.triggers ??= emptyTableTriggers(table.turn);
  requireR4(
    !table.triggers.candidates.some((candidate) => candidate.pendingTriggerId === operation.id),
    'INVALID_MANUAL_TRIGGER',
  );
  const liveSource = table.cards[source.id];
  const def = table.defs[liveSource.defId];
  const eventId = `manual-trigger:${operation.id}`;
  table.triggers.candidates.push({
    pendingTriggerId: operation.id,
    eventId,
    simultaneousGroupId: eventId,
    triggerId: 'manual',
    sourceId: liveSource.id,
    sourceObjectId: `${liveSource.id}:${liveSource.zoneChangeCounter}`,
    sourceSnapshot: tableObjectSnapshot(table, liveSource),
    controllerId: liveSource.controllerId,
    label: `手動誘発：${def?.printedName ?? def?.name ?? 'カード'}`,
    stackPlacementBucket: 'ordinary',
    ...(context.kind === 'resolution'
      ? { originProcess: { kind: 'resolution' as const, id: context.entryId } }
      : {}),
    resolutionText: operation.text.trim(),
    source: structuredClone(liveSource),
    text: operation.text.trim(),
    status: 'pending',
    requiresManualRuling: true,
  });
  return table;
}

'''
replace_once(
    "src/engine/cockpitR4.ts",
    "export function isR4CastOperation(operation: R4TableOperation): operation is R4CastOperation {\n",
    manual_trigger_function
    + "export function isR4CastOperation(operation: R4TableOperation): operation is R4CastOperation {\n",
)
replace_once(
    "src/engine/cockpitR4.ts",
    """  const operation = request.operation;\n  if (isR4CastOperation(operation)) return castR4(table, operation, request.context, commandId);\n""",
    """  const operation = request.operation;\n  if (operation.type === 'trigger.manualAdd')\n    return addManualTrigger(table, operation, request.context);\n  if (isR4CastOperation(operation)) return castR4(table, operation, request.context, commandId);\n""",
)

replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """  | Extract<R4TableOperation, { type: 'special.turnFaceUp' }>\n  | R4CastOperation\n  | R4ActivateOperation;\n""",
    """  | Extract<R4TableOperation, { type: 'special.turnFaceUp' }>\n  | Extract<R4TableOperation, { type: 'trigger.manualAdd' }>\n  | R4CastOperation\n  | R4ActivateOperation;\n""",
)
replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """    operation.type === 'special.turnFaceUp' ||\n    operation.type === 'activate' ||\n""",
    """    operation.type === 'special.turnFaceUp' ||\n    operation.type === 'trigger.manualAdd' ||\n    operation.type === 'activate' ||\n""",
)
replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """  if (operation.type === 'activate') {\n    const source = table.cards[operation.sourceId];\n""",
    """  if (operation.type === 'trigger.manualAdd') {\n    const source = table.cards[operation.sourceId];\n    return Boolean(\n      source &&\n        !source.faceDown &&\n        !['hand', 'library'].includes(source.zone) &&\n        table.seats.some((seat) => seat.id === source.controllerId && !seat.eliminated) &&\n        actorCanReadCard(table, multi, actor, source.id),\n    );\n  }\n\n  if (operation.type === 'activate') {\n    const source = table.cards[operation.sourceId];\n""",
)
replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """  if (operation.type === 'playLand') return isPrivateSource(table, operation.cardId);\n  if (operation.type === 'special.turnFaceUp') return Boolean(table.cards[operation.cardId]?.faceDown);\n  if (operation.type === 'activate') {\n""",
    """  if (operation.type === 'playLand') return isPrivateSource(table, operation.cardId);\n  if (operation.type === 'special.turnFaceUp') return Boolean(table.cards[operation.cardId]?.faceDown);\n  if (operation.type === 'trigger.manualAdd') return false;\n  if (operation.type === 'activate') {\n""",
)

replace_once(
    "src/components/game/CockpitAbilityTools.tsx",
    """  const choice = choices.find((item) => item.key === key);\n  const useManual = key !== 'triggered' && (manual || choice?.manual || key === 'manual');\n""",
    """  const choice = choices.find((item) => item.key === key);\n  const useManual = key !== 'triggered' && (manual || choice?.manual || key === 'manual');\n  const addingManualTrigger = key === 'triggered' && !candidate && !linkedCandidate;\n""",
)
replace_once(
    "src/components/game/CockpitAbilityTools.tsx",
    """      <button\n        onClick={() => {\n          setTargets([...selected]);\n          setProposal(null);\n        }}\n      >\n        盤面の選択を対象にする\n      </button>\n""",
    """      {addingManualTrigger && (\n        <p>対象は誘発候補を追加した後、スタックへ載せるときに確定します。</p>\n      )}\n      <button\n        disabled={addingManualTrigger}\n        onClick={() => {\n          setTargets([...selected]);\n          setProposal(null);\n        }}\n      >\n        盤面の選択を対象にする\n      </button>\n""",
)
replace_once(
    "src/components/game/CockpitAbilityTools.tsx",
    """            type=\"checkbox\"\n            checked={targets.includes(entry.id)}\n            onChange={(event) => {\n""",
    """            type=\"checkbox\"\n            checked={targets.includes(entry.id)}\n            disabled={addingManualTrigger}\n            onChange={(event) => {\n""",
)
replace_once(
    "src/components/game/CockpitAbilityTools.tsx",
    """            type=\"checkbox\"\n            checked={targetSeats.includes(seat.id)}\n            onChange={() => {\n""",
    """            type=\"checkbox\"\n            checked={targetSeats.includes(seat.id)}\n            disabled={addingManualTrigger}\n            onChange={() => {\n""",
)
replace_once(
    "src/components/game/CockpitAbilityTools.tsx",
    """        {key === 'triggered' ? '誘発・対象・順番を確認した' : '対象と起動条件を確認した'}\n""",
    """        {addingManualTrigger\n          ? '誘発内容を確認した'\n          : key === 'triggered'\n            ? '誘発・対象・順番を確認した'\n            : '対象と起動条件を確認した'}\n""",
)
replace_once(
    "src/components/game/CockpitAbilityTools.tsx",
    """                linkedCandidate && key === 'triggered'\n                  ? {\n                      type: 'trigger.place',\n                      candidateId: linkedCandidate.pendingTriggerId,\n                      id: crypto.randomUUID(),\n                      targets: shownProposal.targets,\n                      text: shownProposal.text,\n                    }\n                  : { ...shownProposal, id: crypto.randomUUID() },\n""",
    """                linkedCandidate && key === 'triggered'\n                  ? {\n                      type: 'trigger.place',\n                      candidateId: linkedCandidate.pendingTriggerId,\n                      id: crypto.randomUUID(),\n                      targets: shownProposal.targets,\n                      text: shownProposal.text,\n                    }\n                  : key === 'triggered'\n                    ? {\n                        type: 'trigger.manualAdd',\n                        id: crypto.randomUUID(),\n                        sourceId,\n                        text: shownProposal.text,\n                      }\n                    : { ...shownProposal, id: crypto.randomUUID() },\n""",
)
replace_once(
    "src/components/game/CockpitAbilityTools.tsx",
    """            {key === 'triggered' ? 'スタックに登録' : 'コストを支払って起動する'}\n""",
    """            {key === 'triggered'\n              ? linkedCandidate\n                ? 'スタックに登録'\n                : '誘発候補として追加'\n              : 'コストを支払って起動する'}\n""",
)

Path("src/engine/__tests__/cockpitR4ManualTrigger.test.ts").write_text(r'''import { describe, expect, it } from 'vitest';

import { createCockpitTable } from '../cockpitTable';
import { applyR4TableOperation } from '../cockpitR4';
import { makeDeck } from './helpers';

function resolvingTable() {
  const table = createCockpitTable(makeDeck(30), 7);
  const resolutionSourceId = table.seats[0].zones.hand[0];
  const manualSourceId = table.seats[0].zones.hand[1];
  const manualSource = table.cards[manualSourceId];
  table.seats[0].zones.hand = table.seats[0].zones.hand.filter((id) => id !== manualSourceId);
  manualSource.zone = 'battlefield';
  manualSource.zoneChangeCounter += 1;
  manualSource.enteredTurn = table.turn;
  table.seats[0].zones.battlefield.unshift(manualSourceId);
  table.stack = [
    {
      id: 'A',
      kind: 'triggered',
      source: structuredClone(table.cards[resolutionSourceId]),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text: 'Resolve A',
    },
  ];
  return { table, manualSourceId };
}

describe('R4 manual Trigger lifecycle', () => {
  it('adds a public manual trigger as Pending without stealing the current Resolution', () => {
    const { table, manualSourceId } = resolvingTable();
    const resolving = applyR4TableOperation(table, {
      context: { kind: 'unbound' },
      operation: { type: 'resolve.begin', entryId: 'A' },
    });
    const pending = applyR4TableOperation(resolving, {
      context: { kind: 'resolution', entryId: 'A' },
      operation: {
        type: 'trigger.manualAdd',
        id: 'manual-trigger-1',
        sourceId: manualSourceId,
        text: 'When this event occurs, draw a card.',
      },
    });

    expect(pending.resolution?.id).toBe('A');
    expect(pending.stack.map((entry) => entry.id)).toEqual(['A']);
    expect(pending.triggers?.candidates).toContainEqual(
      expect.objectContaining({
        pendingTriggerId: 'manual-trigger-1',
        triggerId: 'manual',
        sourceId: manualSourceId,
        controllerId: 'P1',
        status: 'pending',
        requiresManualRuling: true,
        originProcess: { kind: 'resolution', id: 'A' },
      }),
    );

    const finished = applyR4TableOperation(pending, {
      context: { kind: 'resolution', entryId: 'A' },
      operation: { type: 'resolve.end', entryId: 'A', to: 'graveyard' },
    });
    const placed = applyR4TableOperation(finished, {
      context: { kind: 'unbound' },
      operation: {
        type: 'trigger.place',
        candidateId: 'manual-trigger-1',
        id: 'manual-stack-1',
        targets: [],
      },
    });
    expect(placed.stack[0]).toMatchObject({
      id: 'manual-stack-1',
      kind: 'triggered',
      controllerId: 'P1',
    });
  });

  it('rejects hidden-source manual trigger creation', () => {
    const table = createCockpitTable(makeDeck(30), 8);
    const hiddenId = table.seats[0].zones.hand[0];
    expect(() =>
      applyR4TableOperation(table, {
        context: { kind: 'unbound' },
        operation: {
          type: 'trigger.manualAdd',
          id: 'manual-hidden',
          sourceId: hiddenId,
          text: 'Hidden trigger',
        },
      }),
    ).toThrow('INVALID_MANUAL_TRIGGER_SOURCE');
  });
});
''')

Path("src/components/game/CockpitAbilityTools.manualTrigger.test.tsx").write_text(r'''import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitAbilityTools } from './CockpitAbilityTools';

it('creates a Pending manual trigger instead of placing a synthetic activate entry directly on Stack', async () => {
  let table = createCockpitTable(makeDeck(20), 77);
  const sourceId = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId],
    to: 'battlefield',
    position: 'top',
  });
  const host = document.createElement('div');
  const root = createRoot(host);
  const send = vi.fn(() => Promise.resolve(true));
  try {
    act(() =>
      root.render(
        <CockpitAbilityTools
          table={table}
          sourceId={sourceId}
          selected={[]}
          disabled={false}
          send={send}
          expanded
        />,
      ),
    );
    const abilitySelect = host.querySelector('select')!;
    await act(async () => {
      abilitySelect.value = 'triggered';
      abilitySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const textarea = host.querySelector('textarea')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    await act(async () => {
      setValue.call(textarea, 'When this happens, draw a card.');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const confirmation = [...host.querySelectorAll('label')].find((label) =>
      label.textContent?.includes('誘発内容を確認した'),
    )?.querySelector('input') as HTMLInputElement;
    expect(confirmation).toBeTruthy();
    await act(async () => confirmation.click());
    const review = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '登録内容を確認',
    )!;
    await act(async () => review.click());
    const add = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '誘発候補として追加',
    )!;
    await act(async () => {
      add.click();
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'trigger.manualAdd',
        sourceId,
        text: 'When this happens, draw a card.',
      }),
    );
    expect(send.mock.calls[0][0]).not.toHaveProperty('choice', 'triggered');
  } finally {
    act(() => root.unmount());
  }
});
''')

Path("src/online/cloudflare/__tests__/cockpitR4ManualTriggerSession.test.ts").write_text(r'''// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

import { makeDeck } from '../../../engine/__tests__/helpers';
import type { CockpitTable } from '../../../engine/cockpitTable';
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
  return new Request('http://localhost/api/cockpit/r4-manual-trigger-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type SessionErrorView = CockpitSessionView & { error?: string };
type StoredRecord = { table: CockpitTable };

function loadRecord(storage: OnlineCloudflareSqlStorage): StoredRecord {
  const row = storage.sql
    .exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1')
    .toArray()[0];
  return JSON.parse(row.data) as StoredRecord;
}

function saveRecord(storage: OnlineCloudflareSqlStorage, record: StoredRecord): void {
  storage.sql.exec('UPDATE cockpit_session SET data = ? WHERE id = 1', JSON.stringify(record));
}

describe('R4 manual Trigger server boundary', () => {
  it('requires context, rejects hidden sources, and persists a public Pending candidate before Stack placement', async () => {
    const storage = database();
    const credentials = [
      { token: '7'.repeat(64), connectionId: 'connection-r4-trigger-1' },
      { token: '8'.repeat(64), connectionId: 'connection-r4-trigger-2' },
    ];
    let revision = 0;
    let now = 12000;
    const call = async (index: number, body: Record<string, unknown>) => {
      const response = await handleCockpitSession(
        request({ ...credentials[index], ...body }),
        storage,
        now++,
      );
      const value = (await response.json()) as SessionErrorView;
      if (response.ok) revision = value.revision;
      return { status: response.status, value };
    };
    const commit = async (
      index: number,
      operation: Record<string, unknown>,
      context?: { kind: 'unbound' },
    ) =>
      call(index, {
        type: 'commit',
        requestId: crypto.randomUUID(),
        revision,
        operation,
        ...(context ? { context } : {}),
      });
    const control = async (index: number, value: Record<string, unknown>) =>
      call(index, {
        type: 'control',
        requestId: crypto.randomUUID(),
        revision,
        control: value,
      });

    const created = await call(0, { type: 'create', seats: 2, seed: 19, deck: makeDeck(30) });
    expect(created.status).toBe(200);
    const invitation = created.value.multiplayer!.invitation!;
    expect((await call(1, { type: 'join', invitation, deck: makeDeck(30) })).status).toBe(200);
    expect((await commit(0, { type: 'keep', seatId: 'P1' })).status).toBe(200);
    expect((await commit(1, { type: 'keep', seatId: 'P2' })).status).toBe(200);
    expect((await control(0, { type: 'start' })).status).toBe(200);

    const record = loadRecord(storage);
    const seat = record.table.seats.find((entry) => entry.id === 'P1')!;
    const hiddenId = seat.zones.hand[0];
    const sourceId = seat.zones.hand[1];
    seat.zones.hand = seat.zones.hand.filter((id) => id !== sourceId);
    const source = record.table.cards[sourceId];
    source.zone = 'battlefield';
    source.zoneChangeCounter += 1;
    source.enteredTurn = record.table.turn;
    seat.zones.battlefield.unshift(sourceId);
    saveRecord(storage, record);

    const operation = {
      type: 'trigger.manualAdd',
      id: 'manual-trigger-server-1',
      sourceId,
      text: 'When this happens, draw a card.',
    };
    const missingContext = await commit(0, operation);
    expect(missingContext.status).toBe(400);
    expect(missingContext.value.error).toBe('INVALID_REQUEST');

    const hidden = await commit(
      0,
      { ...operation, id: 'manual-trigger-hidden', sourceId: hiddenId },
      { kind: 'unbound' },
    );
    expect(hidden.status).toBe(403);
    expect(hidden.value.error).toBe('NOT_AUTHORIZED');

    const added = await commit(0, operation, { kind: 'unbound' });
    expect(added.status).toBe(200);
    expect(added.value.table.stack).toHaveLength(0);
    expect(added.value.table.triggers?.candidates).toContainEqual(
      expect.objectContaining({
        pendingTriggerId: 'manual-trigger-server-1',
        triggerId: 'manual',
        sourceId,
        status: 'pending',
      }),
    );

    const placed = await commit(
      0,
      {
        type: 'trigger.place',
        candidateId: 'manual-trigger-server-1',
        id: 'manual-trigger-stack-1',
        targets: [],
      },
      { kind: 'unbound' },
    );
    expect(placed.status).toBe(200);
    expect(placed.value.table.stack[0]).toMatchObject({
      id: 'manual-trigger-stack-1',
      kind: 'triggered',
      controllerId: 'P1',
    });
  });
});
''')
