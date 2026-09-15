from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing anchor in {path}: {old[:120]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'non-unique anchor in {path}: {old[:120]!r} count={text.count(old)}')
    write(path, text.replace(old, new, 1))


def replace_all(path: str, old: str, new: str, minimum: int = 1) -> None:
    text = read(path)
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f'missing repeated anchor in {path}: {old[:120]!r}')
    write(path, text.replace(old, new))


# ---------------------------------------------------------------------------
# src/engine/types.ts — durable semantic process provenance.
# ---------------------------------------------------------------------------
p = 'src/engine/types.ts'
replace_once(
    p,
    "export type EventCause =\n  | { type: 'command'; commandType: string }\n  | { type: 'system'; ruleRef: string }\n  | { type: 'event'; eventId: string; eventType: KnownEventKind };",
    "export type EventProcessRef =\n  | { kind: 'resolution'; id: string; role: 'effect' | 'lifecycle' }\n  | {\n      kind: 'action';\n      id: string;\n      actionType: 'cast' | 'activate' | 'mana' | 'other-formal';\n      role: 'action' | 'cost';\n      parentResolutionId?: string;\n    }\n  | { kind: 'system'; id: string };\n\nexport type EventCause =\n  | { type: 'command'; commandType: string }\n  | { type: 'system'; ruleRef: string }\n  | { type: 'event'; eventId: string; eventType: KnownEventKind };",
)
replace_once(p, "  causeCommandId?: string;\n  reason: ZoneChangeReason;", "  causeCommandId?: string;\n  process?: EventProcessRef;\n  reason: ZoneChangeReason;")
replace_once(p, "  causeCommandId?: string;\n  causeEventId?: string;", "  causeCommandId?: string;\n  process?: EventProcessRef;\n  causeEventId?: string;")
replace_once(p, "  attackers: ObjectSnapshot[];\n  battlefield: ObjectSnapshot[];\n  simultaneousGroupId?: never;", "  attackers: ObjectSnapshot[];\n  battlefield: ObjectSnapshot[];\n  process?: EventProcessRef;\n  simultaneousGroupId?: never;")
replace_once(p, "  causeCommandId?: string;\n  target: EventTargetRef;", "  causeCommandId?: string;\n  process?: EventProcessRef;\n  target: EventTargetRef;")
replace_once(p, "  advisory: true;\n  physicalCardId?: never;", "  advisory: true;\n  process?: EventProcessRef;\n  physicalCardId?: never;")
replace_once(p, "  completedDungeonDefId?: string; // set when 309.5b completes the old dungeon\n  // Fields unused by venture events", "  completedDungeonDefId?: string; // set when 309.5b completes the old dungeon\n  process?: EventProcessRef;\n  // Fields unused by venture events")
replace_once(p, "export interface AbilityTriggeredEvent {\n  type: 'abilityTriggered';\n  eventId: string;\n  sequence: number;", "export interface AbilityTriggeredEvent {\n  type: 'abilityTriggered';\n  eventId: string;\n  sequence: number;\n  process?: EventProcessRef;")
replace_once(p, "export interface ActivatedManaAbilityEvent {\n  type: 'activatedManaAbility';\n  eventId: string;\n  sequence: number;", "export interface ActivatedManaAbilityEvent {\n  type: 'activatedManaAbility';\n  eventId: string;\n  sequence: number;\n  process?: EventProcessRef;")
replace_once(p, "export interface ManaAddedEvent {\n  type: 'manaAdded';\n  eventId: string;\n  sequence: number;", "export interface ManaAddedEvent {\n  type: 'manaAdded';\n  eventId: string;\n  sequence: number;\n  process?: EventProcessRef;")
replace_once(p, "  resolutionText?: string;\n}", "  resolutionText?: string;\n  /** R3.1: durable causal origin after the source Stack entry/event ring is gone. */\n  originProcess?: EventProcessRef;\n}")

# ---------------------------------------------------------------------------
# src/engine/cockpitTriggers.ts — attach process to semantic events/candidates.
# ---------------------------------------------------------------------------
p = 'src/engine/cockpitTriggers.ts'
replace_once(p, "  type DamageEvent,\n  type ObjectSnapshot,", "  type DamageEvent,\n  type EventProcessRef,\n  type ObjectSnapshot,")
replace_once(
    p,
    "export interface TableTriggerTrace {\n  id: string;\n  last: CockpitTable;\n  index: number;\n  damage?: Pick<DamageEvent, 'source' | 'target' | 'amount' | 'combatDamage'>[];\n}\nexport function triggerTrace(before: CockpitTable, id: string): TableTriggerTrace {\n  return { id, last: structuredClone(before), index: 0 };\n}",
    "export interface TableTriggerTrace {\n  id: string;\n  last: CockpitTable;\n  index: number;\n  process?: EventProcessRef;\n  damage?: Pick<DamageEvent, 'source' | 'target' | 'amount' | 'combatDamage'>[];\n}\nexport function triggerTrace(\n  before: CockpitTable,\n  id: string,\n  process?: EventProcessRef,\n): TableTriggerTrace {\n  return { id, last: structuredClone(before), index: 0, process };\n}",
)
replace_once(p, "    simultaneousGroupId: group,\n    causeCommandId: trace.id,", "    simultaneousGroupId: group,\n    causeCommandId: trace.id,\n    process: trace.process,")
replace_once(p, "      attackingPlayerId: table.activeSeatId,\n      attackers:", "      attackingPlayerId: table.activeSeatId,\n      process: trace.process,\n      attackers:")
replace_once(
    p,
    "      status: 'pending',\n      requiresManualRuling: review,\n    });",
    "      status: 'pending',\n      requiresManualRuling: review,\n      originProcess:\n        pending.originProcess ??\n        events.find((event) => event.eventId === pending.eventId)?.process ??\n        trace.process,\n    });",
)
replace_once(
    p,
    "export function readyTableTriggers(table: CockpitTable): TableTrigger[] {",
    "export function blockingPublicTableTriggers(table: CockpitTable): TableTrigger[] {\n  if (table.resolution) return [];\n  return (table.triggers?.candidates ?? []).filter(\n    (candidate) =>\n      candidate.status === 'pending' &&\n      !candidate.source.faceDown &&\n      !['hand', 'library'].includes(candidate.source.zone),\n  );\n}\n\nexport function readyTableTriggers(table: CockpitTable): TableTrigger[] {",
)

# ---------------------------------------------------------------------------
# src/engine/cockpitTable.ts — identity-bound resolution, finite zone meaning,
# process propagation, public Trigger blocker.
# ---------------------------------------------------------------------------
p = 'src/engine/cockpitTable.ts'
replace_once(p, "  emptyTableTriggers,\n  nextTriggerController,\n  readyTableTriggers,", "  blockingPublicTableTriggers,\n  emptyTableTriggers,\n  nextTriggerController,\n  readyTableTriggers,")
replace_once(p, "  LinkedExileRecord,\n  ManaPool,", "  EventProcessRef,\n  LinkedExileRecord,\n  ManaPool,")
replace_once(
    p,
    "export interface TableTokenCharacteristics {\n  name: string;",
    "export type ExpectedInteractionContext =\n  | { kind: 'resolution'; entryId: string }\n  | { kind: 'unbound' };\nexport type ManualZoneMeaning = 'move' | 'discard' | 'mill' | 'sacrifice' | 'destroy';\nexport function tableExpectedContext(table: CockpitTable): ExpectedInteractionContext {\n  return table.resolution\n    ? { kind: 'resolution', entryId: table.resolution.id }\n    : { kind: 'unbound' };\n}\n\nexport interface TableTokenCharacteristics {\n  name: string;",
)
replace_once(p, "  | { type: 'move'; ids: string[]; to: ZoneId; position: 'top' | 'bottom' }", "  | {\n      type: 'move';\n      ids: string[];\n      to: ZoneId;\n      position: 'top' | 'bottom';\n      reason?: ManualZoneMeaning;\n    }")
replace_once(p, "  | { type: 'resolve.begin' }\n  | { type: 'resolve.end'; to: ZoneId }", "  | { type: 'resolve.begin'; entryId?: string }\n  | { type: 'resolve.end'; entryId?: string; to: ZoneId }")
replace_once(
    p,
    "export function applyTableOperation(\n  before: CockpitTable,\n  operation: TableOperation,\n  operationId?: string,\n  inheritedTrace?: TableTriggerTrace,\n): CockpitTable {\n  const trace =\n    inheritedTrace ??\n    triggerTrace(before, operationId ?? `local-${(before.triggers?.sequence ?? 0) + 1}`);",
    "export function applyTableOperation(\n  before: CockpitTable,\n  operation: TableOperation,\n  operationId?: string,\n  inheritedTrace?: TableTriggerTrace,\n  process?: EventProcessRef,\n): CockpitTable {\n  const trace =\n    inheritedTrace ??\n    triggerTrace(\n      before,\n      operationId ?? `local-${(before.triggers?.sequence ?? 0) + 1}`,\n      process ??\n        (before.resolution\n          ? { kind: 'resolution', id: before.resolution.id, role: 'effect' }\n          : undefined),\n    );\n  if (\n    !trace.process &&\n    (operation.type === 'resolve.finish' || operation.type === 'resolve.fetch')\n  )\n    trace.process = { kind: 'resolution', id: operation.entryId, role: 'lifecycle' };",
)
replace_once(p, "    !table.resolution\n  )\n    requireTable(!readyTableTriggers(table).length, '未処理の誘発を確認してください。');", "    !table.resolution\n  )\n    requireTable(\n      !blockingPublicTableTriggers(table).length,\n      '未処理の公開誘発を確認してください。',\n    );")
replace_once(
    p,
    "    case 'move':\n      requireTable(operation.to !== 'stack', 'Stackへは唱える・能力登録から進んでください。');\n      move(table, operation.ids, operation.to, operation.position, trace);",
    "    case 'move': {\n      requireTable(operation.to !== 'stack', 'Stackへは唱える・能力登録から進んでください。');\n      const reason = operation.reason ?? 'move';\n      requireTable(\n        ['move', 'discard', 'mill', 'sacrifice', 'destroy'].includes(reason),\n        '移動の意味を確認してください。',\n      );\n      if (reason !== 'move') {\n        const expectedSource =\n          reason === 'discard'\n            ? 'hand'\n            : reason === 'mill'\n              ? 'library'\n              : 'battlefield';\n        requireTable(\n          operation.ids.every((id) => cardOf(table, id).zone === expectedSource),\n          '移動の意味と元の領域が一致しません。',\n        );\n      }\n      move(table, operation.ids, operation.to, operation.position, trace, reason, reason);",
)
replace_once(p, "      break;\n    case 'tap':", "      break;\n    }\n    case 'tap':")
replace_once(
    p,
    "    case 'resolve.begin':\n      requireTable(\n        table.resolution === null && table.stack.length > 0,\n        '処理するStackがありません。',\n      );\n      table.resolution = structuredClone(table.stack[0]);\n      break;\n    case 'resolve.end': {\n      requireTable(table.resolution, '処理中ではありません。');\n      finishTableStack(table, table.resolution, operation.to, trace);\n      break;\n    }",
    "    case 'resolve.begin': {\n      const entry = table.stack[0];\n      requireTable(\n        !table.hold &&\n          table.resolution === null &&\n          entry &&\n          (!operation.entryId || operation.entryId === entry.id),\n        '解決するStackが変わりました。',\n      );\n      table.resolution = structuredClone(entry);\n      break;\n    }\n    case 'resolve.end': {\n      requireTable(\n        table.resolution && (!operation.entryId || operation.entryId === table.resolution.id),\n        '処理中のStackが変わりました。',\n      );\n      trace.process = { kind: 'resolution', id: table.resolution.id, role: 'lifecycle' };\n      finishTableStack(table, table.resolution, operation.to, trace);\n      break;\n    }",
)

# ---------------------------------------------------------------------------
# src/online/browser/cockpitClient.ts — send expected interaction context.
# ---------------------------------------------------------------------------
p = 'src/online/browser/cockpitClient.ts'
replace_once(p, "import type { TableOperation } from '../../engine/cockpitTable';", "import type { ExpectedInteractionContext, TableOperation } from '../../engine/cockpitTable';")
replace_once(
    p,
    "  async commit(operation: TableOperation | { type: 'undo' } | { type: 'redo' }): Promise<void> {\n    await this.submit(operation, false);\n  }\n  private async submit(\n    operation: TableOperation | { type: 'undo' } | { type: 'redo' } | CockpitControl,\n    control: boolean,\n  ): Promise<void> {",
    "  async commit(\n    operation: TableOperation | { type: 'undo' } | { type: 'redo' },\n    context?: ExpectedInteractionContext,\n  ): Promise<void> {\n    await this.submit(operation, false, context);\n  }\n  private async submit(\n    operation: TableOperation | { type: 'undo' } | { type: 'redo' } | CockpitControl,\n    control: boolean,\n    context?: ExpectedInteractionContext,\n  ): Promise<void> {",
)
replace_once(p, "      ...(control ? { control: operation } : { operation }),", "      ...(control ? { control: operation } : { operation, ...(context ? { context } : {}) }),")
replace_once(p, "        digest: await inputDigest(operation),", "        digest: await inputDigest(control ? operation : { operation, context }),")

# ---------------------------------------------------------------------------
# src/online/cloudflare/cockpitSession.ts — validate expected context, derive
# process, and add multiplayer knowledge barriers for Undo.
# ---------------------------------------------------------------------------
p = 'src/online/cloudflare/cockpitSession.ts'
replace_once(p, "  type CockpitTable,\n  type TableOperation,", "  type CockpitTable,\n  type ExpectedInteractionContext,\n  type TableOperation,")
replace_once(p, "import type { InitDeckCard } from '../../engine/init';", "import type { InitDeckCard } from '../../engine/init';\nimport type { EventProcessRef } from '../../engine/types';")
replace_once(
    p,
    "  undo: CockpitTable[];\n  redo: CockpitTable[];\n}",
    "  undo: CockpitTable[];\n  redo: CockpitTable[];\n  /** Human knowledge cannot be undone by restoring an older board snapshot. */\n  knowledgeEpoch?: number;\n  undoKnowledgeEpochs?: number[];\n}",
)
replace_once(
    p,
    "      operation: TableOperation | { type: 'undo' } | { type: 'redo' };\n    }",
    "      operation: TableOperation | { type: 'undo' } | { type: 'redo' };\n      context?: ExpectedInteractionContext;\n    }",
)
replace_once(
    p,
    "function view(\n  record: SessionRecord,",
    "function historyEpoch(record: SessionRecord): number {\n  return record.knowledgeEpoch ?? 0;\n}\nfunction clearHistory(record: SessionRecord): void {\n  record.undo = [];\n  record.redo = [];\n  record.undoKnowledgeEpochs = [];\n}\nfunction privateKnowledgeBarrier(\n  before: CockpitTable,\n  after: CockpitTable,\n  operation: TableOperation,\n): boolean {\n  if (['shuffle', 'randomDiscard', 'mulligan', 'resolve.fetch'].includes(operation.type)) return true;\n  return Object.values(after.cards).some(\n    (card) => before.cards[card.id]?.zone === 'library' && card.zone === 'hand',\n  );\n}\nfunction view(\n  record: SessionRecord,",
)
replace_once(
    p,
    "      sameHistoryBoundary(record.table, record.undo.at(-1), Boolean(record.multiplayer)),",
    "      sameHistoryBoundary(record.table, record.undo.at(-1), Boolean(record.multiplayer)) &&\n      (!record.multiplayer ||\n        (record.undoKnowledgeEpochs?.at(-1) ?? historyEpoch(record)) === historyEpoch(record)),",
)
replace_once(
    p,
    "  const record = JSON.parse(row.data) as SessionRecord;\n  for (const table of [record.table, ...record.undo, ...record.redo]) backfillCockpitTable(table);\n  return record;",
    "  const record = JSON.parse(row.data) as SessionRecord;\n  record.knowledgeEpoch ??= 0;\n  record.undoKnowledgeEpochs ??= record.undo.map(() => record.knowledgeEpoch!);\n  while (record.undoKnowledgeEpochs.length < record.undo.length)\n    record.undoKnowledgeEpochs.push(record.knowledgeEpoch);\n  if (record.undoKnowledgeEpochs.length > record.undo.length)\n    record.undoKnowledgeEpochs.length = record.undo.length;\n  for (const table of [record.table, ...record.undo, ...record.redo]) backfillCockpitTable(table);\n  return record;",
)
replace_all(p, "            undo: [],\n            redo: [],", "            undo: [],\n            redo: [],\n            knowledgeEpoch: 0,\n            undoKnowledgeEpochs: [],", minimum=2)
replace_once(
    p,
    "        const encodedOperation = JSON.stringify(\n          body.type === 'commit' ? body.operation : body.control,\n        );",
    "        const encodedOperation = JSON.stringify(\n          body.type === 'commit'\n            ? { operation: body.operation, context: body.context }\n            : body.control,\n        );",
)
replace_all(p, "                record.undo = [];\n                record.redo = [];", "                clearHistory(record);", minimum=2)
replace_once(
    p,
    "                multi.members[actor].peek = control.zone\n                  ? {",
    "                if (control.zone) record.knowledgeEpoch = historyEpoch(record) + 1;\n                multi.members[actor].peek = control.zone\n                  ? {",
)
replace_once(
    p,
    "            if (body.operation.type === 'undo') {\n              const previous = record.undo.pop();\n              if (!previous || !sameHistoryBoundary(before, previous, Boolean(record.multiplayer)))",
    "            if (body.operation.type === 'undo') {\n              const previous = record.undo.at(-1);\n              const previousEpoch = record.undoKnowledgeEpochs?.at(-1) ?? historyEpoch(record);\n              if (\n                !previous ||\n                !sameHistoryBoundary(before, previous, Boolean(record.multiplayer)) ||\n                (Boolean(record.multiplayer) && previousEpoch !== historyEpoch(record))\n              )",
)
replace_once(p, "                return response({ error: 'NO_UNDO' }, 409);\n              record.redo.push(before);\n              record.table = previous;", "                return response({ error: 'NO_UNDO' }, 409);\n              record.undo.pop();\n              record.undoKnowledgeEpochs?.pop();\n              record.redo.push(before);\n              record.table = previous;")
replace_once(
    p,
    "            } else {\n              record.table = applyTableOperation(before, body.operation, body.requestId);\n              const operation = body.operation;",
    "            } else {\n              const operation = body.operation;\n              if (body.context) {\n                if (body.context.kind === 'resolution') {\n                  if (before.resolution?.id !== body.context.entryId)\n                    return response({ error: 'STALE_INTERACTION_CONTEXT' }, 409);\n                } else if (before.resolution) {\n                  return response({ error: 'STALE_INTERACTION_CONTEXT' }, 409);\n                }\n              }\n              let process: EventProcessRef | undefined;\n              if (body.context?.kind === 'resolution')\n                process = {\n                  kind: 'resolution',\n                  id: body.context.entryId,\n                  role: operation.type === 'resolve.end' ? 'lifecycle' : 'effect',\n                };\n              else if (operation.type === 'resolve.finish' || operation.type === 'resolve.fetch')\n                process = { kind: 'resolution', id: operation.entryId, role: 'lifecycle' };\n              record.table = applyTableOperation(\n                before,\n                operation,\n                body.requestId,\n                undefined,\n                process,\n              );",
)
replace_once(
    p,
    "                record.undo.push(before);\n              }\n              record.redo = [];",
    "                record.undo.push(before);\n                (record.undoKnowledgeEpochs ??= []).push(historyEpoch(record));\n              }\n              if (record.multiplayer && privateKnowledgeBarrier(before, record.table, operation))\n                record.knowledgeEpoch = historyEpoch(record) + 1;\n              record.redo = [];",
)
replace_once(
    p,
    "    if (error instanceof Error && error.message === 'SESSION_SIZE_LIMIT')\n      return response({ error: 'SESSION_SIZE_LIMIT' }, 422);",
    "    if (error instanceof Error && error.message === 'SESSION_SIZE_LIMIT')\n      return response({ error: 'SESSION_SIZE_LIMIT' }, 422);\n    if (error instanceof Error && error.message === 'STALE_INTERACTION_CONTEXT')\n      return response({ error: 'STALE_INTERACTION_CONTEXT' }, 409);",
)

# ---------------------------------------------------------------------------
# src/components/game/CockpitSessionScreen.tsx — gesture/draft context capture.
# ---------------------------------------------------------------------------
p = 'src/components/game/CockpitSessionScreen.tsx'
replace_once(p, "  tableZones,\n  type CockpitTable,", "  tableZones,\n  tableExpectedContext,\n  type CockpitTable,\n  type ExpectedInteractionContext,")
replace_once(
    p,
    "    paymentPlan: GameCommand[];\n    error: string;\n  } | null>(null);",
    "    paymentPlan: GameCommand[];\n    error: string;\n    context: ExpectedInteractionContext;\n  } | null>(null);",
)
replace_once(p, "  const [abilityChoice, setAbilityChoice] = useState<string | undefined>();", "  const [abilityChoice, setAbilityChoice] = useState<string | undefined>();\n  const [abilityContext, setAbilityContext] = useState<ExpectedInteractionContext>({ kind: 'unbound' });")
replace_once(
    p,
    "  async function send(operation: TableOperation | { type: 'undo' } | { type: 'redo' }) {",
    "  async function send(\n    operation: TableOperation | { type: 'undo' } | { type: 'redo' },\n    expectedContext?: ExpectedInteractionContext,\n  ) {",
)
replace_once(
    p,
    "      await clientRef.current?.commit(operation);",
    "      const context =\n        operation.type === 'undo' || operation.type === 'redo'\n          ? undefined\n          : expectedContext ?? (before ? tableExpectedContext(before) : undefined);\n      await clientRef.current?.commit(operation, context);",
)
replace_once(
    p,
    "      error,\n    });",
    "      error,\n      context:\n        cast?.cardId === cardId ? cast.context : tableExpectedContext(table),\n    });",
)
replace_once(
    p,
    "        activate={(id, choice) => {\n          setAbilityChoice(choice);",
    "        activate={(id, choice) => {\n          setAbilityContext(tableExpectedContext(table));\n          setAbilityChoice(choice);",
)
replace_once(
    p,
    "            send={async (operation) => {\n              const saved = await send(operation);",
    "            send={async (operation) => {\n              const saved = await send(operation, abilityContext);",
)
replace_once(
    p,
    "                  }).then((saved) => {\n                    if (saved) setCast(null);",
    "                  }, cast.context).then((saved) => {\n                    if (saved) setCast(null);",
)
# Explicit discard meaning in the card detail action whose UI literally says 捨てる.
replace_once(
    p,
    "                        position: 'top',\n                      }).then((saved) => {",
    "                        position: 'top',\n                        ...(target === 'graveyard' && detailCard.zone === 'hand'\n                          ? { reason: 'discard' as const }\n                          : {}),\n                      }).then((saved) => {",
)

# ---------------------------------------------------------------------------
# src/components/game/CockpitSelectionTools.tsx — async context capture + mill meaning.
# ---------------------------------------------------------------------------
p = 'src/components/game/CockpitSelectionTools.tsx'
replace_once(p, "import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';", "import {\n  tableExpectedContext,\n  type CockpitTable,\n  type ExpectedInteractionContext,\n  type TableOperation,\n} from '../../engine/cockpitTable';")
replace_once(p, "  send: (operation: TableOperation) => Promise<boolean>;", "  send: (\n    operation: TableOperation,\n    context?: ExpectedInteractionContext,\n  ) => Promise<boolean>;")
replace_once(p, "    rows: { id: string; to: 'top' | 'bottom' | 'graveyard' }[];\n  } | null>(null);", "    rows: { id: string; to: 'top' | 'bottom' | 'graveyard' }[];\n    context: ExpectedInteractionContext;\n  } | null>(null);")
replace_once(
    p,
    "  function openArrange(source: CockpitTable, kind: '占術' | '諜報', peekOwned = false): boolean {",
    "  function openArrange(\n    source: CockpitTable,\n    kind: '占術' | '諜報',\n    peekOwned = false,\n    context = tableExpectedContext(table),\n  ): boolean {",
)
replace_once(p, "      peekOwned,\n    });", "      peekOwned,\n      context,\n    });")
replace_once(p, "  async function startArrange(kind: '占術' | '諜報'): Promise<void> {\n    if (!libraryAccess", "  async function startArrange(kind: '占術' | '諜報'): Promise<void> {\n    const context = tableExpectedContext(table);\n    if (!libraryAccess")
replace_once(p, "      openArrange(table, kind);", "      openArrange(table, kind, false, context);")
replace_once(p, "    if (!openArrange(next, kind, true)) await libraryAccess.release();", "    if (!openArrange(next, kind, true, context)) await libraryAccess.release();")
replace_once(p, "  async function mill(): Promise<void> {\n    let source = table;", "  async function mill(): Promise<void> {\n    const context = tableExpectedContext(table);\n    let source = table;")
replace_once(p, "    await send({ type: 'move', ids, to: 'graveyard', position: 'top' });", "    await send({ type: 'move', ids, to: 'graveyard', position: 'top', reason: 'mill' }, context);")
replace_once(
    p,
    "                graveyard: arrange.rows\n                  .filter((row) => row.to === 'graveyard')\n                  .map((row) => row.id),\n              }).then((saved) => {",
    "                graveyard: arrange.rows\n                  .filter((row) => row.to === 'graveyard')\n                  .map((row) => row.id),\n              }, arrange.context).then((saved) => {",
)

# ---------------------------------------------------------------------------
# src/components/game/CockpitTableSurface.tsx — Manual Resolution anchor and
# identity-bound lifecycle controls.
# ---------------------------------------------------------------------------
p = 'src/components/game/CockpitTableSurface.tsx'
replace_once(p, "  const permanent =\n    top?.kind === 'spell' &&", "  const permanent =\n    top?.kind === 'spell' &&")
replace_once(
    p,
    "  const resolveLabel = resolution\n    ? '効果の処理に戻る'\n    : fetchable\n      ? '解決して土地を探す'\n      : permanent\n        ? '解決して戦場に出す'\n        : '効果を処理する';",
    "  const lifecycleOnlyPermanent = Boolean(permanent && !top?.text.trim());\n  const resolutionPermanent =\n    resolution?.kind === 'spell' &&\n    /Creature|Artifact|Enchantment|Planeswalker|Battle/.test(\n      table.defs[resolution.source.defId]?.faces[resolution.source.faceIndex]?.typeLine ?? '',\n    );\n  const defaultResolutionDestination: ZoneId = resolutionPermanent ? 'battlefield' : 'graveyard';\n  const resolveLabel = resolution\n    ? '効果の処理に戻る'\n    : fetchable\n      ? '解決して土地を探す'\n      : lifecycleOnlyPermanent\n        ? '解決して戦場に出す'\n        : '効果を処理する';",
)
replace_once(p, "    if (!manual && permanent) {", "    if (!manual && lifecycleOnlyPermanent) {")
replace_once(p, "    setDestination(permanent ? 'battlefield' : 'graveyard');\n    void send({ type: 'resolve.begin' }).then((saved) => {", "    setDestination(permanent ? 'battlefield' : 'graveyard');\n    void send({ type: 'resolve.begin', entryId: top.id }).then((saved) => {")
replace_once(
    p,
    "        {typeof children === 'function' ? children(openZone, work) : children}",
    "        {resolution && (\n          <section className=\"table-stack-source\" aria-live=\"polite\">\n            <strong>解決中 — 《{sourceName}》</strong>\n            <p style={{ whiteSpace: 'pre-wrap' }}>\n              {resolution.kind === 'spell'\n                ? (table.defs[resolution.source.defId]?.faces[resolution.source.faceIndex]\n                    ?.printedText ?? resolution.text)\n                : resolution.text}\n            </p>\n            {resolution.targets.length > 0 && (\n              <p>対象: {resolution.targets.map((id) => (table.cards[id] ? `《${name(id)}》` : name(id))).join('、')}</p>\n            )}\n            <button\n              data-testid=\"resolution-finish\"\n              disabled={disabled}\n              onClick={() =>\n                void send({\n                  type: 'resolve.end',\n                  entryId: resolution.id,\n                  to: defaultResolutionDestination,\n                }).then((saved) => {\n                  if (saved) setWork(false);\n                })\n              }\n            >\n              処理完了\n            </button>\n            <button onClick={() => setStack(true)}>Stackを見る</button>\n          </section>\n        )}\n        {typeof children === 'function' ? children(openZone, work) : children}",
)
replace_once(
    p,
    "            {table.stack.map((entry, index) => (\n              <li key={entry.id} className={index === 0 ? 'is-next' : ''}>",
    "            {table.stack.map((entry, index) => {\n              const resolving = resolution?.id === entry.id;\n              return (\n              <li key={entry.id} className={resolving || index === 0 ? 'is-next' : ''}>",
)
replace_once(
    p,
    "                    {index === 0 ? (resolution ? '解決中' : '次に解決') : `${index + 1}番目`} ·{' '}",
    "                    {resolving ? '解決中' : index === 0 ? '解決待ち' : `${index + 1}番目`} ·{' '}",
)
replace_once(p, "              </li>\n            ))}", "              </li>\n              );\n            })}")
replace_once(
    p,
    "              <label>\n                処理後の行き先{' '}\n                <select",
    "              <details>\n                <summary>終了方法…</summary>\n              <label>\n                例外的な行き先{' '}\n                <select",
)
replace_once(
    p,
    "              </label>\n              <button\n                disabled={disabled}\n                onClick={() =>\n                  void send({ type: 'resolve.end', to: destination }).then((saved) => {\n                    if (saved) setStack(false);\n                  })\n                }\n              >\n                解決を終える\n              </button>",
    "              </label>\n              <button\n                disabled={disabled}\n                onClick={() =>\n                  void send({\n                    type: 'resolve.end',\n                    entryId: resolution.id,\n                    to: destination,\n                  }).then((saved) => {\n                    if (saved) setStack(false);\n                  })\n                }\n              >\n                この行き先で処理完了\n              </button>\n              </details>\n              <button\n                disabled={disabled}\n                onClick={() =>\n                  void send({\n                    type: 'resolve.end',\n                    entryId: resolution.id,\n                    to: defaultResolutionDestination,\n                  }).then((saved) => {\n                    if (saved) setStack(false);\n                  })\n                }\n              >\n                処理完了\n              </button>",
)

# ---------------------------------------------------------------------------
# Targeted engine test for the new contract.
# ---------------------------------------------------------------------------
Path('src/engine/__tests__/cockpitR31.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../cockpitTable';
import type { EventProcessRef } from '../types';
import { makeDeck } from './helpers';

function stackFixture() {
  const table = createCockpitTable(makeDeck(30), 1);
  const id = table.seats[0].zones.hand[0];
  const card = table.cards[id];
  table.seats[0].zones.hand = table.seats[0].zones.hand.filter((item) => item !== id);
  table.seats[0].zones.stack.unshift(id);
  card.zone = 'stack';
  card.zoneChangeCounter += 1;
  const entry = {
    id: 'A',
    kind: 'spell' as const,
    source: structuredClone(card),
    stackCardId: id,
    controllerId: card.controllerId,
    targets: [],
    paid: [],
    text: 'Draw a card.',
  };
  table.stack.unshift(entry);
  return { table, entry };
}

describe('R3.1 Manual Resolution identity and semantic provenance', () => {
  it('binds begin/end to one Stack entry and rejects stale identity', () => {
    const { table } = stackFixture();
    expect(() => applyTableOperation(table, { type: 'resolve.begin', entryId: 'stale' })).toThrow();
    const resolving = applyTableOperation(table, { type: 'resolve.begin', entryId: 'A' });
    expect(resolving.resolution?.id).toBe('A');
    expect(() =>
      applyTableOperation(resolving, { type: 'resolve.end', entryId: 'stale', to: 'graveyard' }),
    ).toThrow();
    const done = applyTableOperation(resolving, {
      type: 'resolve.end',
      entryId: 'A',
      to: 'graveyard',
    });
    expect(done.resolution).toBeNull();
    expect(done.stack).toHaveLength(0);
  });

  it('preserves explicit zone meaning and Resolution process on generated events', () => {
    const { table } = stackFixture();
    const resolving = applyTableOperation(table, { type: 'resolve.begin', entryId: 'A' });
    const discardId = resolving.seats[0].zones.hand[0];
    const process: EventProcessRef = { kind: 'resolution', id: 'A', role: 'effect' };
    const next = applyTableOperation(
      resolving,
      { type: 'move', ids: [discardId], to: 'graveyard', position: 'top', reason: 'discard' },
      'r31-discard',
      undefined,
      process,
    );
    const event = next.triggers?.events.find(
      (item) => item.type === 'zoneChange' && item.physicalCardId === discardId,
    );
    expect(event).toMatchObject({ type: 'zoneChange', reason: 'discard', process });
    expect(() =>
      applyTableOperation(resolving, {
        type: 'move',
        ids: [discardId],
        to: 'graveyard',
        position: 'top',
        reason: 'sacrifice',
      }),
    ).toThrow();
  });
});
''', encoding='utf-8')

print('R3.1 source patch applied')
