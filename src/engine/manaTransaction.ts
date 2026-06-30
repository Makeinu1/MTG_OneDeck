import type { ManaColor } from '../types/card';
import { applyCommands } from './batch';
import { compileAbilityIR } from './grammar/compile';
import { splitAbilityLines } from './grammar/index';
import { parseAbilityIR } from './grammar/ir';
import type { GameCommand } from './commands';
import type {
  ActivatedManaAbilityEvent,
  CardInstance,
  GameState,
  ManaAddedEvent,
  ManaPool,
  ObjectSnapshot,
  PendingManaTrigger,
} from './types';
import { objectIdOf } from './types';

export type ManaAbilityTransactionEvent = ActivatedManaAbilityEvent | ManaAddedEvent;

export interface ManaAbilityTransactionInput {
  sourceId: string;
  abilityLineIndex?: number;
  commands: readonly GameCommand[];
  iterationCap?: number;
}

export type ManaAbilityTransactionLogEntry =
  | {
      kind: 'resolved-triggered-mana-ability';
      ruleRef: '605.1b';
      triggerEventId: string;
      sourceId: string;
      abilityLineIndex?: number;
      manaEvents: ManaAddedEvent[];
    }
  | {
      kind: 'manual-no-stack';
      ruleRef: '605.1b';
      triggerEventId: string;
      sourceId: string;
      abilityLineIndex?: number;
      reason: string;
    }
  | {
      kind: 'iteration-cap';
      ruleRef: '605.4a';
      iterationCap: number;
      remainingQueueSize: number;
    };

export interface ManaAbilityTransactionResult {
  state: GameState;
  warnings: string[];
  manaEvents: ManaAddedEvent[];
  log: ManaAbilityTransactionLogEntry[];
}

type TriggeredManaAbilityPlan =
  | { decision: 'auto'; commands: GameCommand[] }
  | { decision: 'manual'; reason: string };

const DEFAULT_ITERATION_CAP = 256;
const MANA_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

const NUMBER_WORDS = new Map<string, number>([
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
]);

export function resolveManaAbilityTransaction(
  state: GameState,
  input: ManaAbilityTransactionInput,
): ManaAbilityTransactionResult {
  const iterationCap = input.iterationCap ?? DEFAULT_ITERATION_CAP;
  const sourceSnapshot = snapshotOfCurrentCard(state, input.sourceId);
  const controllerId = sourceSnapshot?.controllerId ?? sourceSnapshot?.ownerId ?? 'P1';
  let nextSequence = nextTransactionEventSequence(state);
  const activatedEvent = sourceSnapshot
    ? activatedManaAbilityEvent(
        nextSequence++,
        sourceSnapshot,
        controllerId,
        input.abilityLineIndex,
        'activated',
      )
    : null;

  const applied = applyCommands(state, input.commands);
  let workingState = applied.state;
  const warnings = applied.warnings.slice();
  const manaEvents: ManaAddedEvent[] = [];
  const log: ManaAbilityTransactionLogEntry[] = [];
  const eventsById = new Map<string, ManaAbilityTransactionEvent>();

  if (activatedEvent) {
    eventsById.set(activatedEvent.eventId, activatedEvent);
  }

  const resolvedEvent = sourceSnapshot
    ? activatedManaAbilityEvent(
        nextSequence++,
        sourceSnapshot,
        controllerId,
        input.abilityLineIndex,
        'resolved',
      )
    : null;
  if (resolvedEvent) {
    eventsById.set(resolvedEvent.eventId, resolvedEvent);
  }

  const initialCauseEventId = resolvedEvent?.eventId ?? activatedEvent?.eventId;
  const initialManaEvents = collectManaAddedEventsFromCommands(
    state,
    input.commands,
    initialCauseEventId,
    sourceSnapshot ?? null,
    nextSequence,
  );
  nextSequence += initialManaEvents.length;
  for (const event of initialManaEvents) {
    manaEvents.push(event);
    eventsById.set(event.eventId, event);
  }

  const initialEvents = [
    ...(activatedEvent ? [activatedEvent] : []),
    ...(resolvedEvent ? [resolvedEvent] : []),
    ...initialManaEvents,
  ];
  const queue = collectTriggeredManaAbilities(workingState, initialEvents);

  let iterations = 0;
  while (queue.length > 0) {
    if (iterations >= iterationCap) {
      const warning =
        'CR 605.4a の誘発型マナ能力 transaction が上限に達しました。盤面を確認してください。';
      warnings.push(warning);
      log.push({
        kind: 'iteration-cap',
        ruleRef: '605.4a',
        iterationCap,
        remainingQueueSize: queue.length,
      });
      break;
    }

    const pending = queue.shift();
    if (!pending) {
      continue;
    }
    iterations += 1;

    const triggerEvent = eventsById.get(pending.triggerEventId);
    const plan = triggeredManaAbilityPlan(workingState, pending, triggerEvent);
    if (plan.decision === 'manual') {
      warnings.push(
        `${pending.label}は CR 605.1b の誘発型マナ能力です。スタックには置かず、手動で解決してください。`
      );
      log.push({
        kind: 'manual-no-stack',
        ruleRef: '605.1b',
        triggerEventId: pending.triggerEventId,
        sourceId: pending.sourceId,
        ...(pending.abilityLineIndex === undefined
          ? {}
          : { abilityLineIndex: pending.abilityLineIndex }),
        reason: plan.reason,
      });
      continue;
    }

    const beforeTriggeredResolution = workingState;
    const resolved = applyCommands(beforeTriggeredResolution, plan.commands);
    workingState = resolved.state;
    warnings.push(...resolved.warnings);

    const newManaEvents = collectManaAddedEventsFromCommands(
      beforeTriggeredResolution,
      plan.commands,
      pending.triggerEventId,
      pending.sourceSnapshot,
      nextSequence,
    );
    nextSequence += newManaEvents.length;
    for (const event of newManaEvents) {
      manaEvents.push(event);
      eventsById.set(event.eventId, event);
    }
    log.push({
      kind: 'resolved-triggered-mana-ability',
      ruleRef: '605.1b',
      triggerEventId: pending.triggerEventId,
      sourceId: pending.sourceId,
      ...(pending.abilityLineIndex === undefined
        ? {}
        : { abilityLineIndex: pending.abilityLineIndex }),
      manaEvents: newManaEvents,
    });
    queue.push(...collectTriggeredManaAbilities(workingState, newManaEvents));
  }

  return { state: workingState, warnings, manaEvents, log };
}

export function collectTriggeredManaAbilities(
  state: GameState,
  events: readonly ManaAbilityTransactionEvent[],
): PendingManaTrigger[] {
  const pending: PendingManaTrigger[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    for (const cardId of state.zones.battlefield) {
      const snapshot = snapshotOfCurrentCard(state, cardId);
      if (!snapshot) {
        continue;
      }
      const def = state.defs[snapshot.defId];
      if (!def) {
        continue;
      }
      for (const { line, index } of splitAbilityLines(def).map((line, index) => ({
        line,
        index,
      }))) {
        const typeLine = def.faces[line.faceIndex]?.typeLine ?? def.typeLine;
        const ir = parseAbilityIR(line.text, typeLine);
        if (!isTriggeredManaAbilityForEvent(ir, event)) {
          continue;
        }
        const key = `${event.eventId}:${snapshot.objectId}:${index}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        pending.push({
          kind: 'triggered-mana-ability',
          ruleRef: '605.1b',
          triggerEventId: event.eventId,
          sourceId: snapshot.physicalCardId,
          sourceObjectId: snapshot.objectId,
          sourceSnapshot: snapshot,
          controllerId: snapshot.controllerId ?? snapshot.ownerId,
          abilityLineIndex: index,
          label: `誘発型マナ能力: ${cardLabelFromSnapshot(state, snapshot)}`,
        });
      }
    }
  }

  return pending;
}

export function triggeredManaAbilityPlan(
  state: GameState,
  pending: PendingManaTrigger,
  triggerEvent?: ManaAbilityTransactionEvent,
): TriggeredManaAbilityPlan {
  if (pending.abilityLineIndex === undefined) {
    return { decision: 'manual', reason: 'missing-ability-line-index' };
  }

  const def = state.defs[pending.sourceSnapshot.defId];
  const line = def ? splitAbilityLines(def)[pending.abilityLineIndex] : undefined;
  if (!def || !line) {
    return { decision: 'manual', reason: 'missing-source-definition' };
  }

  const typeLine = def.faces[line.faceIndex]?.typeLine ?? def.typeLine;
  const ir = parseAbilityIR(line.text, typeLine);
  const compiled = compileAbilityIR(ir, {
    sourceId: pending.sourceId,
    def,
  });
  const autoManaCommands = compiled.commands.filter(
    (command): command is Extract<GameCommand, { type: 'addMana' }> =>
      command.type === 'addMana',
  );
  if (compiled.decision === 'auto' && autoManaCommands.length > 0) {
    return { decision: 'auto', commands: compiled.commands };
  }

  const contextualCommands = contextualManaCommands(ir, triggerEvent);
  if (contextualCommands.length > 0) {
    return { decision: 'auto', commands: contextualCommands };
  }

  return {
    decision: 'manual',
    reason: compiled.decision === 'manual' ? compiled.reasons.join(',') : 'unsupported',
  };
}

function isTriggeredManaAbilityForEvent(
  ir: ReturnType<typeof parseAbilityIR>,
  event: ManaAbilityTransactionEvent,
): boolean {
  if (ir.shape !== 'triggered' && ir.shape !== 'delayed-triggered') {
    return false;
  }
  if (ir.constructs.includes('construct.target')) {
    return false;
  }
  if (!ir.effects.some((effect) => effect.atom === 'effect.add-mana')) {
    return false;
  }
  if (!ir.trigger) {
    return false;
  }
  return isManaRelatedTriggerCondition(ir.trigger.raw, event);
}

function isManaRelatedTriggerCondition(
  triggerRaw: string,
  event: ManaAbilityTransactionEvent,
): boolean {
  if (event.type === 'activatedManaAbility') {
    // SCOPE BOUNDARY (defer to C-GRAMMAR): detecting which real cards trigger from
    // the activation/resolution of a mana ability (CR 605.1b first clause) requires
    // IR-grade trigger-source classification, not raw-text regex. A heuristic here
    // double-fires (the substrate emits distinct 'activated' and 'resolved' events,
    // both matching the same stage-agnostic pattern) and false-matches activation-
    // worded cards on the manaAdded branch. The substrate emits the events (contract
    // surface) but defers real-card matching to the C-GRAMMAR observer. The live,
    // tested 605.1b path in this milestone is mana-being-added (below), exercised by
    // golden case cr-triggered-mana-ability-no-stack.
    return false;
  }

  if (/\b(?:add|adds|added)\b[^.]*\bmana\b/i.test(triggerRaw)) {
    return true;
  }
  if (/\bmana\b[^.]*\b(?:add|adds|added)\b/i.test(triggerRaw)) {
    return true;
  }
  if (/\btaps?\b[^.]*\bland\b[^.]*\bfor mana\b/i.test(triggerRaw)) {
    return isLandSnapshot(event.sourceSnapshot);
  }
  if (/\bland\b[^.]*\btaps?\b[^.]*\bfor mana\b/i.test(triggerRaw)) {
    return isLandSnapshot(event.sourceSnapshot);
  }
  return false;
}

function contextualManaCommands(
  ir: ReturnType<typeof parseAbilityIR>,
  triggerEvent?: ManaAbilityTransactionEvent,
): GameCommand[] {
  const manaEffect = ir.effects.find((effect) => effect.atom === 'effect.add-mana');
  if (!manaEffect || !triggerEvent || triggerEvent.type !== 'manaAdded') {
    return [];
  }
  if (!/\b(?:type|color)\b[^.]*\bproduced\b/i.test(manaEffect.raw)) {
    return [];
  }

  const produced = positiveManaEntries(triggerEvent.amount);
  if (produced.length !== 1) {
    return [];
  }
  const [color] = produced[0];
  const amount = manaAmountFromText(manaEffect.raw) ?? 1;
  return [{ type: 'addMana', color, amount }];
}

function collectManaAddedEventsFromCommands(
  stateBeforeCommands: GameState,
  commands: readonly GameCommand[],
  causeEventId: string | undefined,
  fallbackSourceSnapshot: ObjectSnapshot | null,
  startSequence: number,
): ManaAddedEvent[] {
  const events: ManaAddedEvent[] = [];
  let tappedSourceSnapshot: ObjectSnapshot | null = null;
  let nextSequence = startSequence;

  for (const command of commands) {
    if (command.type === 'setTapped' && command.tapped) {
      tappedSourceSnapshot =
        snapshotOfCurrentCard(stateBeforeCommands, command.cardId) ?? tappedSourceSnapshot;
      continue;
    }

    if (command.type !== 'addMana') {
      continue;
    }

    const amount = Math.max(0, command.amount);
    if (amount === 0) {
      tappedSourceSnapshot = null;
      continue;
    }

    const sourceSnapshot = tappedSourceSnapshot ?? fallbackSourceSnapshot ?? undefined;
    const sequence = nextSequence++;
    events.push({
      type: 'manaAdded',
      eventId: `mana-${sequence}`,
      sequence,
      playerId: sourceSnapshot?.controllerId ?? sourceSnapshot?.ownerId ?? 'P1',
      ...(sourceSnapshot
        ? {
            sourceObjectId: sourceSnapshot.objectId,
            sourceSnapshot,
          }
        : {}),
      amount: singleManaPool(command.color, amount),
      ...(causeEventId === undefined ? {} : { causeEventId }),
    });
    tappedSourceSnapshot = null;
  }

  return events;
}

function activatedManaAbilityEvent(
  sequence: number,
  sourceSnapshot: ObjectSnapshot,
  controllerId: ObjectSnapshot['ownerId'],
  abilityLineIndex: number | undefined,
  stage: ActivatedManaAbilityEvent['stage'],
): ActivatedManaAbilityEvent {
  return {
    type: 'activatedManaAbility',
    eventId: `mana-${sequence}`,
    sequence,
    sourceObjectId: sourceSnapshot.objectId,
    sourceSnapshot,
    controllerId,
    ...(abilityLineIndex === undefined ? {} : { abilityLineIndex }),
    stage,
  };
}

function nextTransactionEventSequence(state: GameState): number {
  const eventLog = Array.isArray(state.eventLog) ? state.eventLog : [];
  return eventLog.reduce((max, event) => Math.max(max, event.sequence), -1) + 1;
}

function snapshotOfCurrentCard(
  state: GameState,
  cardId: string,
): ObjectSnapshot | undefined {
  const card = state.cards[cardId];
  if (!card) {
    return undefined;
  }
  return snapshotOfCard(state, card);
}

function snapshotOfCard(state: GameState, card: CardInstance): ObjectSnapshot {
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  const ownerId = card.ownerId ?? 'P1';
  const controllerId = card.controllerId ?? ownerId;
  return {
    physicalCardId: card.id,
    objectId: objectIdOf(card),
    defId: card.defId,
    zone: card.zone,
    ownerId,
    controllerId,
    isToken: card.isToken,
    isCommander: card.isCommander,
    faceIndex: card.faceIndex,
    tapped: card.tapped,
    counters: { ...card.counters },
    typeLine: (face?.typeLine ?? def?.typeLine ?? '').toString(),
    power: face?.power,
    toughness: face?.toughness,
  };
}

function cardLabelFromSnapshot(state: GameState, snapshot: ObjectSnapshot): string {
  const def = state.defs[snapshot.defId];
  const face = def?.faces[snapshot.faceIndex] ?? def?.faces[0];
  const name =
    face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明なカード';
  return `《${name}》`;
}

function isLandSnapshot(snapshot: ObjectSnapshot | undefined): boolean {
  return snapshot !== undefined && /\bLand\b/i.test(snapshot.typeLine);
}

function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function singleManaPool(color: ManaColor, amount: number): ManaPool {
  return {
    ...emptyManaPool(),
    [color]: amount,
  };
}

function positiveManaEntries(pool: ManaPool): Array<[ManaColor, number]> {
  return MANA_COLORS.flatMap((color) => (pool[color] > 0 ? [[color, pool[color]]] : []));
}

function manaAmountFromText(raw: string): number | null {
  const match =
    /\badd(?:s|ed)?\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+mana\b/i.exec(
      raw,
    );
  if (!match) {
    return null;
  }
  const normalized = match[1].toLowerCase();
  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }
  return NUMBER_WORDS.get(normalized) ?? null;
}
