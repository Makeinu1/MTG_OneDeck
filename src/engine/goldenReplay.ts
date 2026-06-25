import type { CardDef } from '../types/card';
import { applyCommand, type GameCommand } from './commands';
import { initGame, type InitDeckCard } from './init';
import { detectTriggerCandidates } from './triggers';
import type {
  CardInstance,
  GameState,
  ManaPool,
  Phase,
  ZoneId,
} from './types';

const ZONE_IDS: readonly ZoneId[] = [
  'library',
  'hand',
  'battlefield',
  'graveyard',
  'exile',
  'command',
  'stack',
];

const COMMAND_TYPES = new Set<GameCommand['type']>([
  'moveCard',
  'setTapped',
  'setFace',
  'setFaceDown',
  'setManualKeywords',
  'setEffectsAuto',
  'setCardEffectsAuto',
  'addCounters',
  'attach',
  'adjustLife',
  'adjustPlayerCounter',
  'adjustCommanderDamage',
  'adjustOpponentLife',
  'addMana',
  'adjustMana',
  'payMana',
  'clearManaPool',
  'draw',
  'mill',
  'shuffle',
  'untapAll',
  'discard',
  'putOnBottom',
  'playLand',
  'arrangeTop',
  'crackTreasure',
  'castSpell',
  'castCommander',
  'castToStack',
  'addAbilityToStack',
  'resolveStackTop',
  'removeStackItem',
  'copyStackItem',
  'copyPermanent',
  'createToken',
  'nextPhase',
  'nextTurn',
  'mulligan',
]);

export interface GoldenInitialCard {
  def: CardDef;
  isCommander?: boolean;
  zone?: ZoneId;
  tapped?: boolean;
  counters?: Record<string, number>;
  effectsAuto?: boolean;
}

export interface GoldenInitialState {
  seed: number;
  cards: GoldenInitialCard[];
  turn?: number;
  phase?: Phase;
  life?: number;
  poison?: number;
  energy?: number;
  experience?: number;
  opponentLife?: Record<string, number>;
  manaPool?: ManaPool;
  landsPlayedThisTurn?: number;
  spellsCastThisTurn?: number;
  drawnThisTurn?: number;
  effectsAuto?: boolean;
}

export type GoldenUnverifiableKind = 'scope-boundary' | 'runtime-gap';

export interface GoldenUnverifiable {
  kind: GoldenUnverifiableKind;
  reason: string;
  ref: string;
}

export interface GoldenReplayCase {
  name: string;
  sourceDeck: string;
  initialState: GoldenInitialState;
  commands: GameCommand[];
  autoResolveStack?: boolean;
  expectedEvents?: ExpectedReplayEvent[];
  expectedTriggerCandidates?: ExpectedTriggerCandidate[];
  expectedFinalState: Record<string, unknown>;
  unverifiable?: GoldenUnverifiable[];
  notes?: string[];
}

export type ReplayEventType =
  | 'zone-change'
  | 'draw'
  | 'spell-cast'
  | 'phase-change'
  | 'turn-change'
  | 'life-change'
  | 'player-counter-change'
  | 'card-counter-change'
  | 'tap-change'
  | 'stack-item-added'
  | 'stack-item-resolved'
  | 'token-created';

export interface ReplayEvent {
  step: number;
  type: ReplayEventType;
  cardId?: string;
  cardName?: string;
  from?: string;
  to?: string;
  count?: number;
  value?: number | string | boolean;
  counterType?: string;
}

export interface ExpectedReplayEvent extends Partial<Omit<ReplayEvent, 'type'>> {
  type: ReplayEventType;
}

export interface ReplayTriggerCandidate {
  step: number;
  sourceId: string;
  triggerId: string;
  label: string;
  abilityLineIndex?: number;
}

export interface ExpectedTriggerCandidate
  extends Partial<Omit<ReplayTriggerCandidate, 'triggerId'>> {
  triggerId: string;
}

export interface GoldenReplayDiff {
  section: 'events' | 'triggerCandidates' | 'finalState' | 'execution';
  path: string;
  expected: unknown;
  actual: unknown;
}

export interface GoldenReplayResult {
  caseName: string;
  sourceDeck: string;
  pass: boolean;
  events: ReplayEvent[];
  triggerCandidates: ReplayTriggerCandidate[];
  finalState: GameState;
  diffs: GoldenReplayDiff[];
  unverifiable: GoldenUnverifiable[];
}

export interface GoldenReplayClassification {
  verified: boolean;
  pureScopeBoundary: boolean;
  runtimeGap: boolean;
}

export function parseGoldenReplayCase(value: unknown, source: string): GoldenReplayCase {
  if (!isRecord(value)) {
    throw new Error(`${source}: case must be an object`);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'limitations')) {
    throw new Error(`${source}.limitations: legacy key is not allowed`);
  }
  const name = requireString(value.name, `${source}.name`);
  const sourceDeck = requireString(value.sourceDeck, `${source}.sourceDeck`);
  const initialState = parseInitialState(value.initialState, `${source}.initialState`);
  if (!Array.isArray(value.commands)) {
    throw new Error(`${source}.commands: expected an array`);
  }
  const commands = value.commands.map((command, index) =>
    parseGameCommand(command, `${source}.commands[${index}]`),
  );
  if (!isRecord(value.expectedFinalState)) {
    throw new Error(`${source}.expectedFinalState: expected an object`);
  }
  const unverifiable = parseOptionalUnverifiableArray(
    value.unverifiable,
    `${source}.unverifiable`,
  );
  if (new Set(unverifiable?.map((entry) => entry.kind)).size > 1) {
    throw new Error(
      `${source}.unverifiable: scope-boundary and runtime-gap must not be mixed`,
    );
  }

  return {
    name,
    sourceDeck,
    initialState,
    commands,
    autoResolveStack:
      typeof value.autoResolveStack === 'boolean' ? value.autoResolveStack : undefined,
    expectedEvents: parseOptionalRecordArray<ExpectedReplayEvent>(
      value.expectedEvents,
      `${source}.expectedEvents`,
    ),
    expectedTriggerCandidates: parseOptionalRecordArray<ExpectedTriggerCandidate>(
      value.expectedTriggerCandidates,
      `${source}.expectedTriggerCandidates`,
    ),
    expectedFinalState: value.expectedFinalState,
    unverifiable,
    notes: parseOptionalStringArray(value.notes, `${source}.notes`),
  };
}

export function classifyGoldenReplay(
  unverifiable: readonly GoldenUnverifiable[] | undefined,
): GoldenReplayClassification {
  const entries = unverifiable ?? [];
  return {
    verified: entries.length === 0,
    pureScopeBoundary:
      entries.length > 0 && entries.every((entry) => entry.kind === 'scope-boundary'),
    runtimeGap: entries.some((entry) => entry.kind === 'runtime-gap'),
  };
}

export function replayGoldenCase(testCase: GoldenReplayCase): GoldenReplayResult {
  const events: ReplayEvent[] = [];
  const triggerCandidates: ReplayTriggerCandidate[] = [];
  const diffs: GoldenReplayDiff[] = [];
  let state: GameState;

  try {
    state = buildInitialState(testCase.initialState);
    let step = 0;
    for (const command of testCase.commands) {
      step += 1;
      state = applyMeasuredCommand(state, command, step, events, triggerCandidates);
    }

    if (testCase.autoResolveStack !== false) {
      while (state.zones.stack.length > 0) {
        step += 1;
        state = applyMeasuredCommand(
          state,
          { type: 'resolveStackTop' },
          step,
          events,
          triggerCandidates,
        );
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const fallback = initGame([], 0);
    return {
      caseName: testCase.name,
      sourceDeck: testCase.sourceDeck,
      pass: false,
      events,
      triggerCandidates,
      finalState: fallback,
      diffs: [
        {
          section: 'execution',
          path: '$',
          expected: 'successful replay',
          actual: message,
        },
      ],
      unverifiable: testCase.unverifiable ?? [],
    };
  }

  if (testCase.expectedEvents) {
    collectPartialDiffs(
      testCase.expectedEvents,
      events,
      '$',
      'events',
      diffs,
    );
  }
  if (testCase.expectedTriggerCandidates) {
    collectPartialDiffs(
      testCase.expectedTriggerCandidates,
      triggerCandidates,
      '$',
      'triggerCandidates',
      diffs,
    );
  }
  collectPartialDiffs(
    testCase.expectedFinalState,
    finalStateView(state),
    '$',
    'finalState',
    diffs,
  );

  return {
    caseName: testCase.name,
    sourceDeck: testCase.sourceDeck,
    pass: diffs.length === 0,
    events,
    triggerCandidates,
    finalState: state,
    diffs,
    unverifiable: testCase.unverifiable ?? [],
  };
}

export function formatGoldenReplayDiffs(diffs: readonly GoldenReplayDiff[]): string {
  if (diffs.length === 0) {
    return 'no differences';
  }
  return diffs
    .slice()
    .sort((a, b) => {
      const sectionOrder = a.section.localeCompare(b.section);
      return sectionOrder !== 0 ? sectionOrder : a.path.localeCompare(b.path);
    })
    .map(
      (diff) =>
        `[${diff.section}] ${diff.path}: expected=${stableStringify(diff.expected)} actual=${stableStringify(diff.actual)}`,
    )
    .join('\n');
}

function parseInitialState(value: unknown, path: string): GoldenInitialState {
  if (!isRecord(value)) {
    throw new Error(`${path}: expected an object`);
  }
  if (!Number.isInteger(value.seed)) {
    throw new Error(`${path}.seed: expected an integer`);
  }
  if (!Array.isArray(value.cards) || value.cards.length === 0) {
    throw new Error(`${path}.cards: expected a non-empty array`);
  }

  const cards = value.cards.map((card, index) =>
    parseInitialCard(card, `${path}.cards[${index}]`),
  );
  const initial: GoldenInitialState = {
    seed: value.seed as number,
    cards,
  };
  copyOptionalInteger(value, initial, 'turn');
  if (isPhase(value.phase)) initial.phase = value.phase;
  copyOptionalNumber(value, initial, 'life');
  copyOptionalNumber(value, initial, 'poison');
  copyOptionalNumber(value, initial, 'energy');
  copyOptionalNumber(value, initial, 'experience');
  if (isNumberRecord(value.opponentLife)) initial.opponentLife = value.opponentLife;
  if (isManaPool(value.manaPool)) initial.manaPool = value.manaPool;
  copyOptionalInteger(value, initial, 'landsPlayedThisTurn');
  copyOptionalInteger(value, initial, 'spellsCastThisTurn');
  copyOptionalInteger(value, initial, 'drawnThisTurn');
  if (typeof value.effectsAuto === 'boolean') initial.effectsAuto = value.effectsAuto;
  return initial;
}

function parseInitialCard(value: unknown, path: string): GoldenInitialCard {
  if (!isRecord(value) || !isCardDef(value.def)) {
    throw new Error(`${path}.def: invalid CardDef`);
  }
  if (value.zone !== undefined && !isZoneId(value.zone)) {
    throw new Error(`${path}.zone: invalid zone`);
  }
  return {
    def: value.def,
    isCommander: value.isCommander === true,
    zone: value.zone,
    tapped: typeof value.tapped === 'boolean' ? value.tapped : undefined,
    counters: isNumberRecord(value.counters) ? value.counters : undefined,
    effectsAuto:
      typeof value.effectsAuto === 'boolean' ? value.effectsAuto : undefined,
  };
}

function parseGameCommand(value: unknown, path: string): GameCommand {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new Error(`${path}: command must be an object with a type`);
  }
  if (!COMMAND_TYPES.has(value.type as GameCommand['type'])) {
    throw new Error(`${path}.type: unknown command ${value.type}`);
  }
  return value as unknown as GameCommand;
}

function buildInitialState(initial: GoldenInitialState): GameState {
  const deck: InitDeckCard[] = initial.cards.map((card) => ({
    def: card.def,
    isCommander: card.isCommander ?? false,
  }));
  let state = initGame(deck, initial.seed);

  for (const [index, descriptor] of initial.cards.entries()) {
    const cardId = `c${index + 1}`;
    const current = state.cards[cardId];
    if (!current) {
      throw new Error(`initial card instance missing: ${cardId}`);
    }
    const targetZone = descriptor.zone ?? (descriptor.isCommander ? 'command' : 'library');
    if (current.zone !== targetZone) {
      state = applyCommand(state, {
        type: 'moveCard',
        cardId,
        to: targetZone,
        position: 'bottom',
      }).state;
    }
    if (descriptor.tapped !== undefined && state.cards[cardId]?.tapped !== descriptor.tapped) {
      state = applyCommand(state, {
        type: 'setTapped',
        cardId,
        tapped: descriptor.tapped,
      }).state;
    }
    for (const [counterType, value] of Object.entries(descriptor.counters ?? {})) {
      if (value > 0) {
        state = applyCommand(state, {
          type: 'addCounters',
          cardId,
          counterType,
          delta: value,
        }).state;
      }
    }
    if (descriptor.effectsAuto !== undefined) {
      state = applyCommand(state, {
        type: 'setCardEffectsAuto',
        cardId,
        value: descriptor.effectsAuto,
      }).state;
    }
  }

  return {
    ...state,
    turn: initial.turn ?? state.turn,
    phase: initial.phase ?? state.phase,
    life: initial.life ?? state.life,
    poison: initial.poison ?? state.poison,
    energy: initial.energy ?? state.energy,
    experience: initial.experience ?? state.experience,
    opponentLife: initial.opponentLife ?? state.opponentLife,
    manaPool: initial.manaPool ?? state.manaPool,
    landsPlayedThisTurn: initial.landsPlayedThisTurn ?? state.landsPlayedThisTurn,
    spellsCastThisTurn: initial.spellsCastThisTurn ?? state.spellsCastThisTurn,
    drawnThisTurn: initial.drawnThisTurn ?? state.drawnThisTurn,
    effectsAuto: initial.effectsAuto ?? state.effectsAuto,
  };
}

function applyMeasuredCommand(
  state: GameState,
  command: GameCommand,
  step: number,
  events: ReplayEvent[],
  triggerCandidates: ReplayTriggerCandidate[],
): GameState {
  const result = applyCommand(state, command);
  events.push(...detectReplayEvents(state, result.state, step));
  const detected = detectTriggerCandidates(state, result.state);
  if (detected) {
    triggerCandidates.push(
      ...detected.map((candidate) => ({
        step,
        sourceId: candidate.sourceId,
        triggerId: candidate.triggerId,
        label: candidate.label,
        ...(candidate.abilityLineIndex === undefined
          ? {}
          : { abilityLineIndex: candidate.abilityLineIndex }),
      })),
    );
  }
  return result.state;
}

function detectReplayEvents(
  prev: GameState,
  next: GameState,
  step: number,
): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  const cardIds = [...new Set([...Object.keys(prev.cards), ...Object.keys(next.cards)])].sort();

  for (const cardId of cardIds) {
    const before = prev.cards[cardId];
    const after = next.cards[cardId];
    if (!before && after) {
      if (after.isAbility && after.zone === 'stack') {
        events.push(cardEvent(step, 'stack-item-added', next, after));
      } else if (after.isToken) {
        events.push(cardEvent(step, 'token-created', next, after));
      }
      continue;
    }
    if (before && !after) {
      if (before.isAbility) {
        events.push(cardEvent(step, 'stack-item-resolved', prev, before));
      } else {
        events.push({
          ...cardEvent(step, 'zone-change', prev, before),
          from: before.zone,
          to: 'ceased',
        });
      }
      continue;
    }
    if (!before || !after) continue;

    if (before.zone !== after.zone) {
      events.push({
        ...cardEvent(step, 'zone-change', next, after),
        from: before.zone,
        to: after.zone,
      });
    }
    if (before.tapped !== after.tapped) {
      events.push({
        ...cardEvent(step, 'tap-change', next, after),
        value: after.tapped,
      });
    }
    const counterTypes = [
      ...new Set([...Object.keys(before.counters), ...Object.keys(after.counters)]),
    ].sort();
    for (const counterType of counterTypes) {
      const beforeValue = before.counters[counterType] ?? 0;
      const afterValue = after.counters[counterType] ?? 0;
      if (beforeValue !== afterValue) {
        events.push({
          ...cardEvent(step, 'card-counter-change', next, after),
          counterType,
          value: afterValue,
        });
      }
    }
  }

  const drawn = next.drawnThisTurn - prev.drawnThisTurn;
  if (drawn > 0) {
    events.push({ step, type: 'draw', count: drawn });
  }
  const cast = next.spellsCastThisTurn - prev.spellsCastThisTurn;
  if (cast > 0) {
    events.push({ step, type: 'spell-cast', count: cast });
  }
  if (prev.phase !== next.phase) {
    events.push({ step, type: 'phase-change', from: prev.phase, to: next.phase });
  }
  if (prev.turn !== next.turn) {
    events.push({ step, type: 'turn-change', value: next.turn });
  }
  if (prev.life !== next.life) {
    events.push({ step, type: 'life-change', value: next.life });
  }
  for (const key of ['poison', 'energy', 'experience'] as const) {
    if (prev[key] !== next[key]) {
      events.push({
        step,
        type: 'player-counter-change',
        counterType: key,
        value: next[key],
      });
    }
  }

  return events.sort(compareReplayEvents);
}

function cardEvent(
  step: number,
  type: ReplayEventType,
  state: GameState,
  card: CardInstance,
): ReplayEvent {
  return {
    step,
    type,
    cardId: card.id,
    cardName: cardName(state, card),
  };
}

function cardName(state: GameState, card: CardInstance): string {
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return face?.name ?? def?.name ?? card.defId;
}

function compareReplayEvents(a: ReplayEvent, b: ReplayEvent): number {
  const typeOrder = a.type.localeCompare(b.type);
  if (typeOrder !== 0) return typeOrder;
  const cardOrder = (a.cardId ?? '').localeCompare(b.cardId ?? '');
  if (cardOrder !== 0) return cardOrder;
  return (a.counterType ?? '').localeCompare(b.counterType ?? '');
}

function finalStateView(state: GameState): Record<string, unknown> {
  return {
    ...state,
    zoneCounts: Object.fromEntries(
      ZONE_IDS.map((zone) => [zone, state.zones[zone].length]),
    ),
    stackDepth: state.zones.stack.length,
  };
}

function collectPartialDiffs(
  expected: unknown,
  actual: unknown,
  path: string,
  section: GoldenReplayDiff['section'],
  diffs: GoldenReplayDiff[],
): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      diffs.push({ section, path, expected, actual });
      return;
    }
    if (expected.length !== actual.length) {
      diffs.push({
        section,
        path: `${path}.length`,
        expected: expected.length,
        actual: actual.length,
      });
    }
    const comparedLength = Math.min(expected.length, actual.length);
    for (let index = 0; index < comparedLength; index += 1) {
      collectPartialDiffs(expected[index], actual[index], `${path}[${index}]`, section, diffs);
    }
    return;
  }

  if (isRecord(expected)) {
    if (!isRecord(actual)) {
      diffs.push({ section, path, expected, actual });
      return;
    }
    for (const key of Object.keys(expected).sort()) {
      collectPartialDiffs(expected[key], actual[key], `${path}.${key}`, section, diffs);
    }
    return;
  }

  if (!Object.is(expected, actual)) {
    diffs.push({ section, path, expected, actual });
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortJsonValue(value[key])]),
    );
  }
  return value;
}

function parseOptionalRecordArray<T>(
  value: unknown,
  path: string,
): T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => !isRecord(entry))) {
    throw new Error(`${path}: expected an array of objects`);
  }
  return value as T[];
}

function parseOptionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)
  ) {
    throw new Error(`${path}: expected an array of strings`);
  }
  return value as string[];
}

function parseOptionalUnverifiableArray(
  value: unknown,
  path: string,
): GoldenUnverifiable[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`${path}: expected an array`);
  }
  return value.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isRecord(entry)) {
      throw new Error(`${entryPath}: expected an object`);
    }
    if (entry.kind !== 'scope-boundary' && entry.kind !== 'runtime-gap') {
      throw new Error(`${entryPath}.kind: expected scope-boundary or runtime-gap`);
    }
    return {
      kind: entry.kind,
      reason: requireTrimmedString(entry.reason, `${entryPath}.reason`),
      ref: requireTrimmedString(entry.ref, `${entryPath}.ref`),
    };
  });
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path}: expected a non-empty string`);
  }
  return value;
}

function requireTrimmedString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path}: expected a non-empty string`);
  }
  return value;
}

function isZoneId(value: unknown): value is ZoneId {
  return typeof value === 'string' && ZONE_IDS.includes(value as ZoneId);
}

function isPhase(value: unknown): value is Phase {
  return (
    value === 'untap' ||
    value === 'upkeep' ||
    value === 'draw' ||
    value === 'main1' ||
    value === 'combat' ||
    value === 'main2' ||
    value === 'end'
  );
}

function isManaPool(value: unknown): value is ManaPool {
  return (
    isRecord(value) &&
    ['W', 'U', 'B', 'R', 'G', 'C'].every(
      (color) => typeof value[color] === 'number' && Number.isFinite(value[color]),
    )
  );
}

function isCardDef(value: unknown): value is CardDef {
  return (
    isRecord(value) &&
    typeof value.scryfallId === 'string' &&
    typeof value.oracleId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.typeLine === 'string' &&
    Array.isArray(value.faces)
  );
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => typeof entry === 'number' && Number.isFinite(entry),
    )
  );
}

function copyOptionalNumber<
  K extends 'life' | 'poison' | 'energy' | 'experience',
>(
  source: Record<string, unknown>,
  target: GoldenInitialState,
  key: K,
): void {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    target[key] = value;
  }
}

function copyOptionalInteger<
  K extends
    | 'turn'
    | 'landsPlayedThisTurn'
    | 'spellsCastThisTurn'
    | 'drawnThisTurn',
>(
  source: Record<string, unknown>,
  target: GoldenInitialState,
  key: K,
): void {
  const value = source[key];
  if (typeof value === 'number' && Number.isInteger(value)) {
    target[key] = value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
