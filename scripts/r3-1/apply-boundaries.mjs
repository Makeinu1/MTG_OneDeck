import fs from 'node:fs';

function patch(path, changes) {
  let text = fs.readFileSync(path, 'utf8');
  for (const [from, to] of changes) {
    if (!text.includes(from)) throw new Error(`missing patch anchor in ${path}: ${from.slice(0, 140)}`);
    text = text.replace(from, to);
  }
  fs.writeFileSync(path, text);
}

patch('src/engine/cockpitTriggers.ts', [
  [
`export function readyTableTriggers(table: CockpitTable): TableTrigger[] {
  return table.resolution
    ? []
    : (table.triggers?.candidates ?? []).filter(
        (c) => c.status === 'pending' && !c.requiresManualRuling,
      );
}
export function nextTriggerController(table: CockpitTable): string | undefined {
  const pending = readyTableTriggers(table);`,
`export function readyTableTriggers(table: CockpitTable): TableTrigger[] {
  return table.resolution
    ? []
    : (table.triggers?.candidates ?? []).filter(
        (c) => c.status === 'pending' && !c.requiresManualRuling,
      );
}

/**
 * Progression blocker, distinct from automation readiness. Public manual-ruling
 * candidates must still stop the table after the current resolution finishes.
 * Hidden/private candidates never become an invisible global blocker here.
 */
export function blockingPublicTableTriggers(table: CockpitTable): TableTrigger[] {
  if (table.resolution) return [];
  return (table.triggers?.candidates ?? []).filter(
    (candidate) =>
      candidate.status === 'pending' &&
      !candidate.source.faceDown &&
      !['hand', 'library'].includes(candidate.source.zone),
  );
}
export function nextTriggerController(table: CockpitTable): string | undefined {
  const pending = blockingPublicTableTriggers(table);`,
  ],
]);

patch('src/engine/cockpitTable.ts', [
  [
`  nextTriggerController,
  readyTableTriggers,
  triggerTrace,`,
`  nextTriggerController,
  blockingPublicTableTriggers,
  triggerTrace,`,
  ],
  [
`readyTableTriggers(table)`,
`blockingPublicTableTriggers(table)`,
  ],
  [
`readyTableTriggers(next)`,
`blockingPublicTableTriggers(next)`,
  ],
]);

// Replace remaining identical progression references after the first exact anchors.
{
  const path = 'src/engine/cockpitTable.ts';
  let text = fs.readFileSync(path, 'utf8');
  text = text.replaceAll('readyTableTriggers(table)', 'blockingPublicTableTriggers(table)');
  text = text.replaceAll('readyTableTriggers(next)', 'blockingPublicTableTriggers(next)');
  fs.writeFileSync(path, text);
}

patch('src/components/game/CockpitTableSurface.tsx', [
  [
`import { readyTableTriggers } from '../../engine/cockpitTriggers';`,
`import { blockingPublicTableTriggers } from '../../engine/cockpitTriggers';`,
  ],
  [
`  const triggersReady = readyTableTriggers(table).length > 0;`,
`  const triggersReady = blockingPublicTableTriggers(table).length > 0;`,
  ],
]);

patch('src/online/cloudflare/cockpitSession.ts', [
  [
`  undo: CockpitTable[];
  redo: CockpitTable[];
}`,
`  undo: CockpitTable[];
  redo: CockpitTable[];
  /** Monotonic trust boundary; contains no private card data. */
  knowledgeEpoch?: number;
  undoKnowledgeEpochs?: number[];
  redoKnowledgeEpochs?: number[];
}`,
  ],
  [
`function view(
  record: SessionRecord,`,
`function ensureKnowledgeHistory(record: SessionRecord): void {
  record.knowledgeEpoch ??= 0;
  record.undoKnowledgeEpochs ??= [];
  record.redoKnowledgeEpochs ??= [];
  while (record.undoKnowledgeEpochs.length < record.undo.length)
    record.undoKnowledgeEpochs.push(record.knowledgeEpoch);
  while (record.redoKnowledgeEpochs.length < record.redo.length)
    record.redoKnowledgeEpochs.push(record.knowledgeEpoch);
  record.undoKnowledgeEpochs.length = record.undo.length;
  record.redoKnowledgeEpochs.length = record.redo.length;
}
function pushUndoSnapshot(record: SessionRecord, table: CockpitTable, epoch = record.knowledgeEpoch ?? 0): void {
  ensureKnowledgeHistory(record);
  record.undo.push(table);
  record.undoKnowledgeEpochs!.push(epoch);
}
function pushRedoSnapshot(record: SessionRecord, table: CockpitTable, epoch = record.knowledgeEpoch ?? 0): void {
  ensureKnowledgeHistory(record);
  record.redo.push(table);
  record.redoKnowledgeEpochs!.push(epoch);
}
function knowledgeSafeUndo(record: SessionRecord): boolean {
  ensureKnowledgeHistory(record);
  return (
    !record.multiplayer ||
    record.undoKnowledgeEpochs!.at(-1) === (record.knowledgeEpoch ?? 0)
  );
}
function operationCreatesKnowledgeBarrier(
  table: CockpitTable,
  operation: TableOperation | R31TableOperation,
): boolean {
  switch (operation.type) {
    case 'draw':
    case 'shuffle':
    case 'randomDiscard':
    case 'mulligan':
    case 'arrange':
    case 'resolve.fetch':
    case 'shortcut':
    case 'turn.ready':
      return true;
    case 'phase':
      return table.phase === 'upkeep';
    case 'visibility':
      return operation.ids.some((id) => ['hand', 'library'].includes(table.cards[id]?.zone ?? ''));
    case 'move':
      return operation.ids.some((id) => ['hand', 'library'].includes(table.cards[id]?.zone ?? ''));
    case 'cast':
      return (
        table.cards[operation.cardId]?.zone === 'hand' ||
        operation.paymentPlan.some(
          (command) =>
            command.type === 'discard' ||
            (command.type === 'moveCard' &&
              ['hand', 'library'].includes(table.cards[command.cardId]?.zone ?? '')),
        )
      );
    case 'activate':
      return operation.paymentPlan.some(
        (command) =>
          command.type === 'discard' ||
          (command.type === 'moveCard' &&
            ['hand', 'library'].includes(table.cards[command.cardId]?.zone ?? '')),
      );
    case 'cleanup':
      return operation.discardIds.length > 0;
    default:
      return false;
  }
}
function view(
  record: SessionRecord,`,
  ],
  [
`): CockpitSessionView {
  // Multiplayer replies contain only the authenticated seat's audience projection.`,
`): CockpitSessionView {
  ensureKnowledgeHistory(record);
  // Multiplayer replies contain only the authenticated seat's audience projection.`,
  ],
  [
`      sameHistoryBoundary(record.table, record.undo.at(-1), Boolean(record.multiplayer)),`,
`      knowledgeSafeUndo(record) &&
      sameHistoryBoundary(record.table, record.undo.at(-1), Boolean(record.multiplayer)),`,
  ],
  [
`  const record = JSON.parse(row.data) as SessionRecord;
  for (const table of [record.table, ...record.undo, ...record.redo]) backfillCockpitTable(table);
  return record;`,
`  const record = JSON.parse(row.data) as SessionRecord;
  for (const table of [record.table, ...record.undo, ...record.redo]) backfillCockpitTable(table);
  ensureKnowledgeHistory(record);
  return record;`,
  ],
  [
`                multi.members[actor].peek = control.zone
                  ? {`,
`                if (control.zone) record.knowledgeEpoch = (record.knowledgeEpoch ?? 0) + 1;
                multi.members[actor].peek = control.zone
                  ? {`,
  ],
  [
`            if (body.operation.type === 'undo') {
              const previous = record.undo.pop();
              if (!previous || !sameHistoryBoundary(before, previous, Boolean(record.multiplayer)))
                return response({ error: 'NO_UNDO' }, 409);
              record.redo.push(before);
              record.table = previous;
            } else if (body.operation.type === 'redo') {
              const next = record.redo.pop();
              if (!next || !sameHistoryBoundary(before, next, Boolean(record.multiplayer)))
                return response({ error: 'NO_REDO' }, 409);
              record.undo.push(before);
              record.table = next;
            } else {`,
`            if (body.operation.type === 'undo') {
              ensureKnowledgeHistory(record);
              const previous = record.undo.at(-1);
              const previousEpoch = record.undoKnowledgeEpochs!.at(-1);
              if (
                !previous ||
                (record.multiplayer && previousEpoch !== (record.knowledgeEpoch ?? 0)) ||
                !sameHistoryBoundary(before, previous, Boolean(record.multiplayer))
              )
                return response({ error: 'NO_UNDO' }, 409);
              record.undo.pop();
              record.undoKnowledgeEpochs!.pop();
              pushRedoSnapshot(record, before);
              record.table = previous;
            } else if (body.operation.type === 'redo') {
              ensureKnowledgeHistory(record);
              const next = record.redo.at(-1);
              if (!next || !sameHistoryBoundary(before, next, Boolean(record.multiplayer)))
                return response({ error: 'NO_REDO' }, 409);
              record.redo.pop();
              record.redoKnowledgeEpochs!.pop();
              pushUndoSnapshot(record, before);
              record.table = next;
            } else {`,
  ],
  [
`              record.table = body.context
                ? applyR31TableOperation(`,
`              const knowledgeEpochBefore = record.knowledgeEpoch ?? 0;
              const crossesKnowledgeBarrier = Boolean(
                record.multiplayer && operationCreatesKnowledgeBarrier(before, body.operation),
              );
              record.table = body.context
                ? applyR31TableOperation(`,
  ],
  [
`              const operation = body.operation;
              if (`,
`              const operation = body.operation;
              if (crossesKnowledgeBarrier)
                record.knowledgeEpoch = knowledgeEpochBefore + 1;
              if (`,
  ],
  [
`                  record.undo.shift();
                }
                record.undo.push(before);
              }
              record.redo = [];`,
`                  record.undo.shift();
                  record.undoKnowledgeEpochs?.shift();
                }
                pushUndoSnapshot(record, before, knowledgeEpochBefore);
              }
              record.redo = [];
              record.redoKnowledgeEpochs = [];`,
  ],
]);

patch('src/online/cloudflare/__tests__/cockpitSession.test.ts', [
  [
`    expect(
      (await room.change(1, { type: 'return' }, true)).value.table.seats[0].zones.hand,
    ).toHaveLength(0);
    expect((await room.change(0, { type: 'undo' })).value.multiplayer!.counts.P2.hand).toBe(7);`,
`    expect(
      (await room.change(1, { type: 'return' }, true)).value.table.seats[0].zones.hand,
    ).toHaveLength(0);
    const unsafeUndo = await room.change(0, { type: 'undo' });
    expect(unsafeUndo.status).toBe(409);
    expect(unsafeUndo.value.error).toBe('NO_UNDO');
    expect((await room.call(0, { type: 'read' })).value.multiplayer!.counts.P2.hand).toBe(8);`,
  ],
]);

console.log('R3.1 trigger and knowledge boundaries patch applied');
