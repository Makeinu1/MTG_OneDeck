from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {count}")
    file.write_text(text.replace(old, new, 1))


# R4 operation type: keep the legacy resolve.end surface, but allow a finite
# battlefield-entry setup only on the R4 branch.
replace_once(
    "src/engine/cockpitR4.ts",
    """  applyR31TableOperation,\n  requireExpectedInteractionContext,\n  type ExpectedInteractionContext,\n  type R31TableOperation,\n""",
    """  applyR31TableOperation,\n  defaultResolutionDestination,\n  requireExpectedInteractionContext,\n  resolutionProcess,\n  type ExpectedInteractionContext,\n  type R31TableOperation,\n""",
)
replace_once(
    "src/engine/cockpitR4.ts",
    """  applyTableOperation,\n  applyTableZoneTransition,\n  manaColors,\n  tableCastPayment,\n  type CockpitTable,\n""",
    """  applyTableOperation,\n  applyTableZoneTransition,\n  finishTableStack,\n  manaColors,\n  tableCastPayment,\n  type CockpitTable,\n""",
)
replace_once(
    "src/engine/cockpitR4.ts",
    """type R31CastOperation = Extract<R31TableOperation, { type: 'cast' }>;\n\nexport type R4CastOperation = Omit<R31CastOperation, 'type'> & {\n""",
    """type R31CastOperation = Extract<R31TableOperation, { type: 'cast' }>;\ntype R31ResolveEndOperation = Extract<R31TableOperation, { type: 'resolve.end' }>;\ntype R4InheritedOperation = Exclude<R31TableOperation, R31ResolveEndOperation>;\n\nexport type R4ResolveEndOperation = R31ResolveEndOperation & {\n  entrySetup?: PermanentEntrySetup;\n};\n\nexport type R4CastOperation = Omit<R31CastOperation, 'type'> & {\n""",
)
replace_once(
    "src/engine/cockpitR4.ts",
    """export type R4TableOperation =\n  | R31TableOperation\n  | R4CastOperation\n""",
    """export type R4TableOperation =\n  | R4InheritedOperation\n  | R4ResolveEndOperation\n  | R4CastOperation\n""",
)

# Reuse one finite setup applier for playLand and resolving permanents.
entry_applier = r'''export function applyPermanentEntrySetup(
  table: CockpitTable,
  cardId: string,
  setup: PermanentEntrySetup | undefined,
): void {
  if (!setup) return;
  validatePermanentEntrySetup(table, cardId, setup);
  const card = table.cards[cardId];
  requireR4(card?.zone === 'battlefield', 'INVALID_ENTRY_SETUP');
  if (setup.controllerId !== undefined) card.controllerId = setup.controllerId;
  if (setup.tapped !== undefined) card.tapped = setup.tapped;
  if (setup.counters !== undefined)
    card.counters = Object.fromEntries(
      Object.entries(setup.counters).filter(([, count]) => count > 0),
    );
  if (setup.attachmentTargetId !== undefined) card.attachedTo = setup.attachmentTargetId;
  if (setup.protectorId !== undefined) card.protectorId = setup.protectorId;
}

'''
replace_once(
    "src/engine/cockpitR4.ts",
    """function validateCounterRemoval(\n""",
    entry_applier + "function validateCounterRemoval(\n",
)

old_playland_transition = r'''  const table = structuredClone(before);
  table.triggers ??= emptyTableTriggers(table.turn);
  checkpointTableTriggers(table, trace, 'change');

  const next = table.cards[operation.cardId];
  for (const seat of table.seats)
    for (const zone of Object.keys(seat.zones) as (keyof typeof seat.zones)[])
      seat.zones[zone] = seat.zones[zone].filter((id) => id !== next.id);

  next.zoneChangeCounter += 1;
  next.counters = {};
  next.damageMarked = 0;
  next.hasDeathtouchDamage = false;
  next.tapped = false;
  next.faceDown = false;
  next.manualKeywords = [];
  delete next.attachedTo;
  delete next.protectorId;
  table.grants = table.grants.filter((grant) => grant.cardId !== next.id);
  table.modifiers = table.modifiers.filter((modifier) => modifier.cardId !== next.id);
  delete table.visibility[next.id];
  for (const other of Object.values(table.cards))
    if (other.attachedTo === next.id) delete other.attachedTo;
  next.controllerId = next.ownerId;
  next.enteredTurn = table.turn;
  next.zone = 'battlefield';
  table.seats.find((seat) => seat.id === next.ownerId)!.zones.battlefield.unshift(next.id);

  const setup = operation.entrySetup;
  if (setup?.controllerId !== undefined) next.controllerId = setup.controllerId;
  if (setup?.tapped !== undefined) next.tapped = setup.tapped;
  if (setup?.counters !== undefined)
    next.counters = Object.fromEntries(
      Object.entries(setup.counters).filter(([, count]) => count > 0),
    );
  if (setup?.attachmentTargetId !== undefined) next.attachedTo = setup.attachmentTargetId;
  if (setup?.protectorId !== undefined) next.protectorId = setup.protectorId;

  checkpointTableTriggers(table, trace, 'playLand', 'move');
  return table;
'''
new_playland_transition = r'''  const table = structuredClone(before);
  table.triggers ??= emptyTableTriggers(table.turn);
  applyTableZoneTransition(
    table,
    [operation.cardId],
    'battlefield',
    'top',
    trace,
    'playLand',
    'move',
    false,
    (next) => applyPermanentEntrySetup(next, operation.cardId, operation.entrySetup),
  );
  return table;
'''
replace_once("src/engine/cockpitR4.ts", old_playland_transition, new_playland_transition)

resolve_entry = r'''function resolvePermanentWithEntrySetup(
  before: CockpitTable,
  operation: R4ResolveEndOperation,
  context: ExpectedInteractionContext,
  commandId?: string,
): CockpitTable {
  requireR4(operation.entrySetup !== undefined, 'INVALID_ENTRY_SETUP');
  requireR4(
    context.kind === 'resolution' && context.entryId === operation.entryId,
    'STALE_INTERACTION_CONTEXT',
  );
  requireExpectedInteractionContext(before, context);
  const entry = before.resolution;
  requireR4(entry?.id === operation.entryId && entry.kind === 'spell', 'STALE_INTERACTION_CONTEXT');
  requireR4(operation.to === 'battlefield', 'INVALID_ENTRY_SETUP');
  requireR4(defaultResolutionDestination(before, entry) === 'battlefield', 'INVALID_ENTRY_SETUP');
  const cardId = entry.stackCardId ?? entry.source.id;
  requireR4(before.cards[cardId]?.zone === 'stack', 'INVALID_ENTRY_SETUP');
  validatePermanentEntrySetup(before, cardId, operation.entrySetup);

  const process = resolutionProcess(operation.entryId, 'lifecycle');
  const trace = triggerTrace(before, commandId ?? `resolve:${operation.entryId}`, process);
  const table = structuredClone(before);
  table.triggers ??= emptyTableTriggers(table.turn);
  const liveEntry = table.resolution;
  requireR4(liveEntry?.id === operation.entryId, 'STALE_INTERACTION_CONTEXT');
  finishTableStack(
    table,
    liveEntry,
    'battlefield',
    trace,
    'resolved',
    (next, ids) => {
      requireR4(ids.length === 1 && ids[0] === cardId, 'INVALID_ENTRY_SETUP');
      applyPermanentEntrySetup(next, cardId, operation.entrySetup);
    },
  );
  return table;
}

'''
replace_once(
    "src/engine/cockpitR4.ts",
    """function playLand(\n""",
    resolve_entry + "function playLand(\n",
)
replace_once(
    "src/engine/cockpitR4.ts",
    """  const operation = request.operation;\n  if (operation.type === 'state.apply')\n""",
    """  const operation = request.operation;\n  if (operation.type === 'resolve.end' && operation.entrySetup !== undefined)\n    return resolvePermanentWithEntrySetup(table, operation, request.context, commandId);\n  if (operation.type === 'state.apply')\n""",
)

# Fix the same atomicity defect in the legacy finite fetch helper: ETB must observe
# the requested tapped state, not an intermediate untapped permanent.
replace_once(
    "src/engine/cockpitTable.ts",
    """          move(table, [target.id], 'battlefield', 'top', trace);\n          table.cards[target.id].tapped = operation.tapped;\n""",
    """          applyTableZoneTransition(\n            table,\n            [target.id],\n            'battlefield',\n            'top',\n            trace,\n            'move',\n            'move',\n            false,\n            (next) => {\n              next.cards[target.id].tapped = operation.tapped;\n            },\n          );\n""",
)

# Server: only resolve.end requests carrying entrySetup become an R4 Formal operation.
replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """  | Extract<R4TableOperation, { type: 'state.apply' }>\n  | R4CastOperation\n""",
    """  | Extract<R4TableOperation, { type: 'state.apply' }>\n  | Extract<R4TableOperation, { type: 'resolve.end' }>\n  | R4CastOperation\n""",
)
replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """    operation.type === 'state.apply' ||\n    operation.type === 'activate' ||\n""",
    """    operation.type === 'state.apply' ||\n    (operation.type === 'resolve.end' && operation.entrySetup !== undefined) ||\n    operation.type === 'activate' ||\n""",
)
replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """  if (operation.type === 'state.apply') {\n""",
    """  if (operation.type === 'resolve.end') {\n    const entry = table.resolution;\n    const cardId = entry?.stackCardId ?? entry?.source.id;\n    return Boolean(\n      operation.entrySetup !== undefined &&\n        entry?.id === operation.entryId &&\n        entry.kind === 'spell' &&\n        operation.to === 'battlefield' &&\n        cardId &&\n        table.cards[cardId]?.zone === 'stack',\n    );\n  }\n\n  if (operation.type === 'state.apply') {\n""",
)
replace_once(
    "src/online/cloudflare/cockpitR4Authority.ts",
    """  if (operation.type === 'state.apply')\n    return operation.graveyardIds.some((id) => Boolean(table.cards[id]?.faceDown));\n""",
    """  if (operation.type === 'state.apply')\n    return operation.graveyardIds.some((id) => Boolean(table.cards[id]?.faceDown));\n  if (operation.type === 'resolve.end') return false;\n""",
)

# Finite UI editor. It intentionally produces no arbitrary operation list.
Path("src/components/game/CockpitPermanentEntrySetup.tsx").write_text(r'''import type { CockpitTable } from '../../engine/cockpitTable';
import type { PermanentEntrySetup } from '../../engine/cockpitR4';

export interface PermanentEntrySetupDraft {
  tapped: boolean;
  counterName: string;
  counterCount: number;
  controllerId: string;
  attachmentTargetId: string;
  protectorId: string;
}

export const emptyPermanentEntrySetupDraft = (): PermanentEntrySetupDraft => ({
  tapped: false,
  counterName: '+1/+1',
  counterCount: 0,
  controllerId: '',
  attachmentTargetId: '',
  protectorId: '',
});

export function permanentEntrySetupFromDraft(
  draft: PermanentEntrySetupDraft,
): PermanentEntrySetup | undefined {
  const count = Number.isSafeInteger(draft.counterCount) && draft.counterCount > 0
    ? draft.counterCount
    : 0;
  const setup: PermanentEntrySetup = {
    ...(draft.tapped ? { tapped: true } : {}),
    ...(count && draft.counterName.trim()
      ? { counters: { [draft.counterName.trim()]: count } }
      : {}),
    ...(draft.controllerId ? { controllerId: draft.controllerId } : {}),
    ...(draft.attachmentTargetId ? { attachmentTargetId: draft.attachmentTargetId } : {}),
    ...(draft.protectorId ? { protectorId: draft.protectorId } : {}),
  };
  return Object.keys(setup).length ? setup : undefined;
}

export function CockpitPermanentEntrySetup({
  table,
  cardId,
  value,
  onChange,
}: {
  table: CockpitTable;
  cardId: string;
  value: PermanentEntrySetupDraft;
  onChange: (value: PermanentEntrySetupDraft) => void;
}) {
  const card = table.cards[cardId];
  const face = table.defs[card?.defId]?.faces[card?.faceIndex ?? 0];
  const typeLine = face?.typeLine ?? '';
  const battlefield = Object.values(table.cards).filter(
    (candidate) => candidate.zone === 'battlefield' && candidate.id !== cardId,
  );
  const name = (id: string) => {
    const candidate = table.cards[id];
    const def = candidate && table.defs[candidate.defId];
    return def?.printedName ?? def?.name ?? id;
  };
  return (
    <details className="cockpit-session__tools" data-testid="permanent-entry-setup">
      <summary>戦場に出る状態</summary>
      <p>戦場に出る瞬間の有限な状態だけを指定します。カード本文の一般裁定は行いません。</p>
      <label>
        <input
          type="checkbox"
          checked={value.tapped}
          onChange={(event) => onChange({ ...value, tapped: event.target.checked })}
        />
        タップ状態で戦場に出す
      </label>
      <label>
        カウンター名
        <input
          aria-label="戦場に出るカウンター名"
          value={value.counterName}
          maxLength={100}
          onChange={(event) => onChange({ ...value, counterName: event.target.value })}
        />
      </label>
      <label>
        個数
        <input
          aria-label="戦場に出るカウンター数"
          type="number"
          min="0"
          max="100000"
          value={value.counterCount}
          onChange={(event) =>
            onChange({
              ...value,
              counterCount: Math.max(0, Math.trunc(Number(event.target.value) || 0)),
            })
          }
        />
      </label>
      <label>
        コントローラー
        <select
          aria-label="戦場に出るコントローラー"
          value={value.controllerId}
          onChange={(event) => onChange({ ...value, controllerId: event.target.value })}
        >
          <option value="">通常どおり</option>
          {table.seats.filter((seat) => !seat.eliminated).map((seat) => (
            <option key={seat.id} value={seat.id}>{seat.label}</option>
          ))}
        </select>
      </label>
      {/\bAura\b/.test(typeLine) && (
        <label>
          付けた状態で出す
          <select
            aria-label="戦場に出るオーラの付与先"
            value={value.attachmentTargetId}
            onChange={(event) => onChange({ ...value, attachmentTargetId: event.target.value })}
          >
            <option value="">指定なし</option>
            {battlefield.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>《{name(candidate.id)}》</option>
            ))}
          </select>
        </label>
      )}
      {/\bBattle\b/.test(typeLine) && (
        <label>
          守備プレイヤー
          <select
            aria-label="戦場に出るバトルの守備プレイヤー"
            value={value.protectorId}
            onChange={(event) => onChange({ ...value, protectorId: event.target.value })}
          >
            <option value="">指定なし</option>
            {table.seats.filter((seat) => !seat.eliminated).map((seat) => (
              <option key={seat.id} value={seat.id}>{seat.label}</option>
            ))}
          </select>
        </label>
      )}
    </details>
  );
}
''')

# TableSurface: keep entry draft keyed by exact Resolution identity and send that context.
replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """  canLifecycleResolveWithoutManual,\n  defaultResolutionDestination,\n  type R31TableOperation,\n""",
    """  canLifecycleResolveWithoutManual,\n  defaultResolutionDestination,\n  type ExpectedInteractionContext,\n  type R31TableOperation,\n""",
)
replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """import type { R4TableOperation } from '../../engine/cockpitR4';\n""",
    """import type { R4TableOperation } from '../../engine/cockpitR4';\nimport {\n  CockpitPermanentEntrySetup,\n  emptyPermanentEntrySetupDraft,\n  permanentEntrySetupFromDraft,\n  type PermanentEntrySetupDraft,\n} from './CockpitPermanentEntrySetup';\n""",
)
replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """  send: (\n    op: TableOperation | R31TableOperation | R4TableOperation | { type: 'undo' } | { type: 'redo' },\n  ) => Promise<boolean>;\n""",
    """  send: (\n    op: TableOperation | R31TableOperation | R4TableOperation | { type: 'undo' } | { type: 'redo' },\n    expectedContext?: ExpectedInteractionContext,\n  ) => Promise<boolean>;\n""",
)
replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """  const [destination, setDestination] = useState<ZoneId>('graveyard');\n""",
    """  const [destination, setDestination] = useState<ZoneId>('graveyard');\n  const [entrySetupState, setEntrySetupState] = useState<{\n    entryId: string | null;\n    draft: PermanentEntrySetupDraft;\n  }>({ entryId: null, draft: emptyPermanentEntrySetupDraft() });\n""",
)
replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """  const resolution = table.resolution;\n  const zoneLibraryAccess =\n""",
    """  const resolution = table.resolution;\n  const entrySetupCardId =\n    resolution?.kind === 'spell' && defaultResolutionDestination(table, resolution) === 'battlefield'\n      ? (resolution.stackCardId ?? resolution.source.id)\n      : null;\n  const entrySetupDraft =\n    entrySetupState.entryId === (resolution?.id ?? null)\n      ? entrySetupState.draft\n      : emptyPermanentEntrySetupDraft();\n  const updateEntrySetup = (draft: PermanentEntrySetupDraft) =>\n    setEntrySetupState({ entryId: resolution?.id ?? null, draft });\n  const zoneLibraryAccess =\n""",
)
replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """          {resolution ? (\n            <>\n              <button\n""",
    """          {resolution ? (\n            <>\n              {entrySetupCardId && table.cards[entrySetupCardId]?.zone === 'stack' && (\n                <CockpitPermanentEntrySetup\n                  table={table}\n                  cardId={entrySetupCardId}\n                  value={entrySetupDraft}\n                  onChange={updateEntrySetup}\n                />\n              )}\n              <button\n""",
)
old_primary = r'''              <button
                disabled={disabled}
                onClick={() =>
                  table.resolution &&
                  void send({
                    type: 'resolve.end',
                    entryId: table.resolution.id,
                    to: defaultResolutionDestination(table, table.resolution),
                  }).then((saved) => {
                    if (saved) setStack(false);
                  })
                }
              >
                処理完了
              </button>
'''
new_primary = r'''              <button
                disabled={disabled}
                onClick={() => {
                  const active = table.resolution;
                  if (!active) return;
                  const entrySetup =
                    entrySetupCardId && entrySetupState.entryId === active.id
                      ? permanentEntrySetupFromDraft(entrySetupDraft)
                      : undefined;
                  void send(
                    {
                      type: 'resolve.end',
                      entryId: active.id,
                      to: defaultResolutionDestination(table, active),
                      ...(entrySetup ? { entrySetup } : {}),
                    },
                    { kind: 'resolution', entryId: active.id },
                  ).then((saved) => {
                    if (saved) setStack(false);
                  });
                }}
              >
                処理完了
              </button>
'''
replace_once("src/components/game/CockpitTableSurface.tsx", old_primary, new_primary)
old_exceptional = r'''                <button
                  disabled={disabled}
                  onClick={() =>
                    table.resolution &&
                    void send({
                      type: 'resolve.end',
                      entryId: table.resolution.id,
                      to: destination,
                    }).then((saved) => {
                      if (saved) setStack(false);
                    })
                  }
                >
                  指定した領域で処理完了
                </button>
'''
new_exceptional = r'''                <button
                  disabled={disabled}
                  onClick={() => {
                    const active = table.resolution;
                    if (!active) return;
                    const entrySetup =
                      destination === 'battlefield' &&
                      entrySetupCardId &&
                      entrySetupState.entryId === active.id
                        ? permanentEntrySetupFromDraft(entrySetupDraft)
                        : undefined;
                    void send(
                      {
                        type: 'resolve.end',
                        entryId: active.id,
                        to: destination,
                        ...(entrySetup ? { entrySetup } : {}),
                      },
                      { kind: 'resolution', entryId: active.id },
                    ).then((saved) => {
                      if (saved) setStack(false);
                    });
                  }}
                >
                  指定した領域で処理完了
                </button>
'''
replace_once("src/components/game/CockpitTableSurface.tsx", old_exceptional, new_exceptional)

# Engine regression: resolution entry setup and resolve.fetch both checkpoint final state.
Path("src/engine/__tests__/cockpitR4Entry.test.ts").write_text(r'''import { describe, expect, it } from 'vitest';

import { applyTableOperation, createCockpitTable } from '../cockpitTable';
import { applyR31TableOperation } from '../cockpitR31';
import { applyR4TableOperation } from '../cockpitR4';
import { makeDeck } from './helpers';

function resolvingPermanent() {
  let table = createCockpitTable(makeDeck(30), 51);
  const cardId = table.seats[0].zones.hand[0];
  const def = table.defs[table.cards[cardId].defId];
  def.faces[0].typeLine = 'Creature';
  def.faces[0].oracleText = `When ${def.name} enters the battlefield, draw a card.`;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [cardId],
    to: 'stack',
    position: 'top',
  });
  const entry = {
    id: 'permanent-entry',
    kind: 'spell' as const,
    source: structuredClone(table.cards[cardId]),
    controllerId: 'P1',
    targets: [],
    paid: [],
    text: def.faces[0].oracleText,
    stackCardId: cardId,
  };
  table.stack = [entry];
  table.resolution = structuredClone(entry);
  return { table, cardId };
}

describe('R4 resolution PermanentEntrySetup', () => {
  it('applies finite entry state before ETB is checkpointed', () => {
    const { table, cardId } = resolvingPermanent();
    const next = applyR4TableOperation(
      table,
      {
        context: { kind: 'resolution', entryId: 'permanent-entry' },
        operation: {
          type: 'resolve.end',
          entryId: 'permanent-entry',
          to: 'battlefield',
          entrySetup: { tapped: true, counters: { charge: 2 } },
        },
      },
      'resolve-permanent-entry',
    );

    expect(next.cards[cardId]).toMatchObject({
      zone: 'battlefield',
      tapped: true,
      counters: { charge: 2 },
    });
    expect(next.resolution).toBeNull();
    expect(next.stack).toHaveLength(0);
    const event = next.triggers?.events.find(
      (candidate) =>
        candidate.type === 'zoneChange' &&
        candidate.physicalCardId === cardId &&
        candidate.toZone === 'battlefield',
    );
    expect(event).toMatchObject({
      reason: 'resolve',
      after: { tapped: true, counters: { charge: 2 } },
      process: { kind: 'resolution', id: 'permanent-entry', role: 'lifecycle' },
    });
    expect(next.triggers?.candidates).toContainEqual(
      expect.objectContaining({
        sourceId: cardId,
        status: 'pending',
        source: expect.objectContaining({ tapped: true, counters: { charge: 2 } }),
      }),
    );
  });

  it('rejects entry setup when the resolution destination is not the battlefield', () => {
    const { table } = resolvingPermanent();
    expect(() =>
      applyR4TableOperation(table, {
        context: { kind: 'resolution', entryId: 'permanent-entry' },
        operation: {
          type: 'resolve.end',
          entryId: 'permanent-entry',
          to: 'graveyard',
          entrySetup: { tapped: true },
        },
      }),
    ).toThrow('INVALID_ENTRY_SETUP');
  });

  it('makes resolve.fetch ETB observe the requested tapped state atomically', () => {
    const table = createCockpitTable(makeDeck(30), 52);
    const sourceId = table.seats[0].zones.hand[0];
    const targetId = table.seats[0].zones.library[0];
    const targetDef = table.defs[table.cards[targetId].defId];
    targetDef.faces[0].typeLine = 'Basic Land — Forest';
    const sourceDef = table.defs[table.cards[sourceId].defId];
    sourceDef.faces[0].typeLine = 'Land';
    const text = 'Search your library for a land card, put it onto the battlefield tapped, then shuffle.';
    const entry = {
      id: 'fetch-entry',
      kind: 'activated' as const,
      source: structuredClone(table.cards[sourceId]),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text,
    };
    table.stack = [entry];

    const next = applyR31TableOperation(
      table,
      {
        context: { kind: 'unbound' },
        operation: {
          type: 'resolve.fetch',
          entryId: 'fetch-entry',
          cardId: targetId,
          tapped: true,
          seed: 1,
        },
      },
      'fetch-entry-resolution',
    );
    expect(next.cards[targetId]).toMatchObject({ zone: 'battlefield', tapped: true });
    const event = next.triggers?.events.find(
      (candidate) =>
        candidate.type === 'zoneChange' &&
        candidate.physicalCardId === targetId &&
        candidate.toZone === 'battlefield',
    );
    expect(event).toMatchObject({ after: { tapped: true } });
  });
});
''')

Path("src/online/cloudflare/__tests__/cockpitR4EntrySession.test.ts").write_text(r'''// @vitest-environment node
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
  return new Request('http://localhost/api/cockpit/r4-entry-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type ErrorView = CockpitSessionView & { error?: string };

describe('R4 resolution entry setup server boundary', () => {
  it('requires the exact Resolution context and commits setup atomically', async () => {
    const storage = database();
    const token = '9'.repeat(64);
    let view = (await (
      await handleCockpitSession(
        request({ type: 'create', token, deck: makeDeck(30), seed: 61 }),
        storage,
        1000,
      )
    ).json()) as CockpitSessionView;
    const row = storage.sql.exec<{ data: string }>('SELECT data FROM cockpit_session WHERE id = 1').toArray()[0];
    const record = JSON.parse(row.data) as { table: CockpitTable };
    const cardId = record.table.seats[0].zones.hand[0];
    const card = record.table.cards[cardId];
    record.table.defs[card.defId].faces[0].typeLine = 'Creature';
    for (const seat of record.table.seats)
      for (const zone of Object.keys(seat.zones) as ZoneId[])
        seat.zones[zone] = seat.zones[zone].filter((id) => id !== cardId);
    card.zone = 'stack';
    card.zoneChangeCounter += 1;
    record.table.seats[0].zones.stack.unshift(cardId);
    const entry = {
      id: 'entry-resolution-1',
      kind: 'spell' as const,
      source: structuredClone(card),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text: 'Manual permanent resolution.',
      stackCardId: cardId,
    };
    record.table.stack = [entry];
    record.table.resolution = structuredClone(entry);
    storage.sql.exec('UPDATE cockpit_session SET data = ? WHERE id = 1', JSON.stringify(record));

    const operation = {
      type: 'resolve.end',
      entryId: entry.id,
      to: 'battlefield',
      entrySetup: { tapped: true, counters: { charge: 2 } },
    };
    const commit = async (context?: { kind: 'resolution'; entryId: string }) => {
      const response = await handleCockpitSession(
        request({
          type: 'commit',
          token,
          requestId: crypto.randomUUID(),
          revision: view.revision,
          operation,
          ...(context ? { context } : {}),
        }),
        storage,
        2000,
      );
      const value = (await response.json()) as ErrorView;
      if (response.ok) view = value;
      return { response, value };
    };

    const missing = await commit();
    expect(missing.response.status).toBe(400);
    expect(missing.value.error).toBe('INVALID_REQUEST');
    const saved = await commit({ kind: 'resolution', entryId: entry.id });
    expect(saved.response.status).toBe(200);
    expect(saved.value.table.cards[cardId]).toMatchObject({
      zone: 'battlefield',
      tapped: true,
      counters: { charge: 2 },
    });
    expect(saved.value.table.resolution).toBeNull();
  });
});
''')

Path("src/components/game/CockpitPermanentEntrySetup.test.tsx").write_text(r'''import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';

import { createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import {
  CockpitPermanentEntrySetup,
  emptyPermanentEntrySetupDraft,
  permanentEntrySetupFromDraft,
} from './CockpitPermanentEntrySetup';

it('builds only the finite entry setup selected by the user', () => {
  const table = createCockpitTable(makeDeck(20), 71);
  const cardId = table.seats[0].zones.hand[0];
  const host = document.createElement('div');
  const root = createRoot(host);
  let value = emptyPermanentEntrySetupDraft();
  const render = () =>
    root.render(
      <CockpitPermanentEntrySetup
        table={table}
        cardId={cardId}
        value={value}
        onChange={(next) => {
          value = next;
          render();
        }}
      />,
    );
  try {
    act(render);
    act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    const count = host.querySelector<HTMLInputElement>('[aria-label="戦場に出るカウンター数"]')!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(count, '2');
      count.dispatchEvent(new Event('input', { bubbles: true }));
      count.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(permanentEntrySetupFromDraft(value)).toEqual({
      tapped: true,
      counters: { '+1/+1': 2 },
    });
  } finally {
    act(() => root.unmount());
  }
});
''')

Path("src/components/game/CockpitTableSurface.entrySetup.test.tsx").write_text(r'''import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import type { CockpitSessionView } from '../../online/browser/cockpitClient';
import { CockpitTableSurface } from './CockpitTableSurface';

it('binds PermanentEntrySetup to the exact resolving entry', async () => {
  let table = createCockpitTable(makeDeck(30), 72);
  table.seats[0].kept = true;
  const cardId = table.seats[0].zones.hand[0];
  const def = table.defs[table.cards[cardId].defId];
  def.faces[0].typeLine = 'Creature';
  def.faces[0].oracleText = 'Manual permanent text.';
  table = applyTableOperation(table, {
    type: 'move',
    ids: [cardId],
    to: 'stack',
    position: 'top',
  });
  const entry = {
    id: 'ui-entry-setup',
    kind: 'spell' as const,
    source: structuredClone(table.cards[cardId]),
    controllerId: 'P1',
    targets: [],
    paid: [],
    text: 'Manual permanent text.',
    stackCardId: cardId,
  };
  table.stack = [entry];
  table.resolution = structuredClone(entry);
  const view: CockpitSessionView = {
    table,
    revision: 1,
    expiresAt: 0,
    canUndo: false,
    canRedo: false,
    receipt: null,
  };
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.fn<React.ComponentProps<typeof CockpitTableSurface>['send']>(() => Promise.resolve(true));
  try {
    act(() =>
      root.render(
        <CockpitTableSurface
          view={view}
          disabled={false}
          pending={false}
          selected={[]}
          select={vi.fn()}
          inspect={vi.fn()}
          cast={vi.fn()}
          send={send}
          openMenu={vi.fn()}
          seatId="P1"
          chooseSeat={vi.fn()}
          peek={vi.fn()}
        >
          {null}
        </CockpitTableSurface>,
      ),
    );
    const stackButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('解決中'),
    )!;
    act(() => stackButton.click());
    const tapped = host.querySelector<HTMLInputElement>(
      '[data-testid="permanent-entry-setup"] input[type="checkbox"]',
    )!;
    act(() => tapped.click());
    const finish = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === '処理完了',
    )!;
    await act(async () => {
      finish.click();
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledWith(
      {
        type: 'resolve.end',
        entryId: 'ui-entry-setup',
        to: 'battlefield',
        entrySetup: { tapped: true },
      },
      { kind: 'resolution', entryId: 'ui-entry-setup' },
    );
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
''')
