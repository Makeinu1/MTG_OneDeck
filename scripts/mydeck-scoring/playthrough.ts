// Script B — headless play-through.
//
// Drives each of the 4 MyDeck decks through ~10 turns using a simple
// DETERMINISTIC seeded heuristic (draw -> play a land -> cast affordable
// spells cheapest-first -> resolve the stack). The point is not to play
// well — it is to exercise the real resolution machinery (applyCommand /
// compileAbilityIR / resolveStackTop) turn after turn and dump the board
// state so a human can eyeball it for wrong automations.
//
// Engine entry points used directly (no React store):
//   - initGame(deck, seed)                         src/engine/init.ts
//   - applyCommand(state, cmd)                      src/engine/commands.ts
//   - parseAbilityIR / compileAbilityIR              src/engine/grammar/*
//   - guidedPlanForStackTop(state)                   src/engine/commands.ts (to detect pendingGuided-equivalent)
//   - planAutoTap / solvePayment / parseManaCost      src/engine/autotap.ts, src/engine/mana.ts (reused, not reimplemented)
//
// The engine path (not useGameStore) was chosen because it is pure/headless
// and does not require React/Zustand wiring; guidedPlanForStackTop already
// exposes the same "would this need a prompt" information the store would
// surface via pendingGuided.
//
// Run: npx tsx --loader ./scripts/mydeck-scoring/dir-import-loader.mjs scripts/mydeck-scoring/playthrough.ts
//
// NOTE on the extra --loader flag: plain `npx tsx scripts/mydeck-scoring/playthrough.ts`
// crashes with ERR_UNSUPPORTED_DIR_IMPORT because this script imports
// src/engine/commands.ts, which imports src/engine/status.ts, which contains
// a directory import (`from './grammar'`, resolving to grammar/index.ts) that
// the project's own node_modules/tsx-local-loader.mjs does not retry with an
// "/index.ts" suffix (it only retries file extensions). This is a
// pre-existing environment gap, not something introduced here — the repo's
// own `npm run golden-replay` (scripts/golden-replay.ts) hits the identical
// crash on this Node version for the same transitive-import reason. See
// scripts/mydeck-scoring/dir-import-loader.mjs for the full explanation and
// the final report's "blockers" section. census.ts does not need this flag
// because it never imports src/engine/commands.ts / status.ts.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import process from 'node:process';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../../src/data/scryfall';
import { planAutoTap } from '../../src/engine/autotap';
import {
  applyCommand,
  EngineError,
  guidedPlanForStackTop,
  type ApplyResult,
  type GameCommand,
} from '../../src/engine/commands';
import { initGame, type InitDeckCard } from '../../src/engine/init';
import { parseManaCost } from '../../src/engine/mana';
import type {
  CardInstance,
  GameState,
  ManaPool,
  Phase,
  ZoneId,
} from '../../src/engine/types';
import { PHASE_ORDER } from '../../src/engine/types';
import type { CardDef } from '../../src/types/card';

const INPUT_SNAPSHOT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const OPTIONAL_FALLBACK_PATH = resolve(
  process.cwd(),
  'research/mydeck-scoring/scryfall-fallback.cards.json',
);
const OUTPUT_DIR = resolve(process.cwd(), 'research/mydeck-scoring/playability');
const SUMMARY_MD_PATH = resolve(OUTPUT_DIR, 'playthrough-summary.md');

const DECKS = [
  { id: 'Celes', path: resolve(process.cwd(), 'Mydeck/Celes.txt') },
  { id: 'Gogo', path: resolve(process.cwd(), 'Mydeck/Gogo.txt') },
  { id: 'Kefka', path: resolve(process.cwd(), 'Mydeck/Kefka.txt') },
  { id: 'Muldrotha', path: resolve(process.cwd(), 'Mydeck/Muldrotha.txt') },
] as const;

const SEED = 1;
const OPENING_HAND_SIZE = 7;
const TURNS_TO_PLAY = 10;
const MAX_STACK_RESOLVE_STEPS = 200; // guard against any unforeseen infinite loop

type DeckId = (typeof DECKS)[number]['id'];
type CardSource = 'local-snapshot' | 'local-fallback';

interface DeckEntry {
  deck: DeckId;
  line: number;
  quantity: number;
  inputName: string;
  isCommander: boolean;
}

interface IndexedCard {
  def: CardDef;
  source: CardSource;
}

interface ResolvedEntry extends DeckEntry {
  def: CardDef;
  source: CardSource;
}

// ---------------------------------------------------------------------------
// Turn log types
// ---------------------------------------------------------------------------

interface CastAttemptRecord {
  cardId: string;
  cardName: string;
  outcome: 'cast' | 'not-auto-castable';
  reasonIfSkipped?: string;
  guidedPromptsSeen?: number;
}

interface TurnRecord {
  turn: number;
  cardsDrawn: string[];
  landPlayed: string | null;
  spellsCast: CastAttemptRecord[];
  spellsSkipped: CastAttemptRecord[];
  pendingGuidedPrompts: number;
  warnings: string[];
  errors: string[];
  boardStateAfterTurn: BoardStateDump;
}

interface BoardStateDump {
  turn: number;
  phase: Phase;
  life: number;
  poison: number;
  energy: number;
  experience: number;
  manaPool: ManaPool;
  zoneCounts: Record<ZoneId, number>;
  battlefield: BoardCardDump[];
  hand: string[];
  stackSize: number;
  commandersInPlay: string[];
}

interface BoardCardDump {
  id: string;
  name: string;
  tapped: boolean;
  counters: Record<string, number>;
  isCommander: boolean;
  isToken: boolean;
  damageMarked: number;
}

interface PlaythroughResult {
  deck: DeckId;
  generatedAt: string;
  seed: number;
  turnsRequested: number;
  turnsCompleted: number;
  resolvedEntries: number;
  unresolvedEntries: number;
  crashed: boolean;
  crashMessage?: string;
  totalCardsDrawn: number;
  totalSpellsCast: number;
  totalInterventions: number; // sum of pendingGuidedPrompts across all turns
  totalWarnings: number;
  turns: TurnRecord[];
  finalBoardState: BoardStateDump;
}

interface PlaythroughSummaryRow {
  deck: DeckId;
  turnsCompleted: number;
  totalSpellsCast: number;
  totalInterventions: number;
  totalWarnings: number;
  crashed: boolean;
  crashMessage?: string;
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const index = await buildCardIndex();

  const summaryRows: PlaythroughSummaryRow[] = [];
  for (const deck of DECKS) {
    const entries = await readDeckEntries(deck.id, deck.path);
    const { resolved, unresolvedCount } = resolveEntries(entries, index);
    const result = runPlaythrough(deck.id, resolved, unresolvedCount);

    const outPath = resolve(OUTPUT_DIR, `playthrough-${deck.id}.json`);
    await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

    summaryRows.push({
      deck: deck.id,
      turnsCompleted: result.turnsCompleted,
      totalSpellsCast: result.totalSpellsCast,
      totalInterventions: result.totalInterventions,
      totalWarnings: result.totalWarnings,
      crashed: result.crashed,
      crashMessage: result.crashMessage,
    });

    console.log(
      `${deck.id}: turns=${result.turnsCompleted}/${TURNS_TO_PLAY} cast=${result.totalSpellsCast} interventions=${result.totalInterventions} warnings=${result.totalWarnings} crashed=${result.crashed}`,
    );
  }

  await writeFile(SUMMARY_MD_PATH, renderSummaryMarkdown(summaryRows), 'utf8');
  console.log(`Playthrough summary written: ${relative(process.cwd(), SUMMARY_MD_PATH)}`);
}

// ---------------------------------------------------------------------------
// Deck loading (same minimal loader as census.ts / score.ts; see census.ts
// header note — do not diverge without checking both).
// ---------------------------------------------------------------------------

interface ScryfallSnapshot {
  cards?: unknown[];
  data?: unknown[];
}

async function buildCardIndex(): Promise<Map<string, IndexedCard>> {
  const index = new Map<string, IndexedCard>();
  await addCardsFromFile(index, INPUT_SNAPSHOT_PATH, 'local-snapshot', true);
  await addCardsFromFile(index, OPTIONAL_FALLBACK_PATH, 'local-fallback', false);
  return index;
}

async function addCardsFromFile(
  index: Map<string, IndexedCard>,
  path: string,
  source: CardSource,
  required: boolean,
): Promise<void> {
  let payload: unknown;
  try {
    payload = await readJson(path);
  } catch (error: unknown) {
    if (required) {
      throw error;
    }
    return;
  }

  for (const rawCard of extractRawCards(payload)) {
    if (!isRecord(rawCard)) {
      continue;
    }
    let def: CardDef;
    try {
      def = mapScryfallCardToCardDef(rawCard as unknown as ScryfallCard);
    } catch {
      continue;
    }
    addCardIndexKey(index, def.name, { def, source });
    for (const part of def.name.split(' // ')) {
      addCardIndexKey(index, part, { def, source });
    }
    for (const face of def.faces) {
      addCardIndexKey(index, face.name, { def, source });
    }
  }
}

function addCardIndexKey(index: Map<string, IndexedCard>, name: string, card: IndexedCard): void {
  const key = normalizeCardName(name);
  if (!index.has(key)) {
    index.set(key, card);
  }
}

async function readDeckEntries(deck: DeckId, path: string): Promise<DeckEntry[]> {
  const entries: DeckEntry[] = [];
  const source = await readFile(path, 'utf8');
  let section: 'commander' | 'deck' | 'unknown' = 'unknown';
  for (const [lineIndex, rawLine] of source.split(/\r?\n/u).entries()) {
    const trimmed = rawLine.trim();
    if (trimmed === 'Commander') {
      section = 'commander';
      continue;
    }
    if (trimmed === 'Deck') {
      section = 'deck';
      continue;
    }
    const match = /^\s*(\d+)\s+(.+?)\s*$/u.exec(rawLine);
    if (!match) {
      continue;
    }
    const quantity = Number.parseInt(match[1] ?? '0', 10);
    const inputName = match[2]?.trim();
    if (!inputName || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }
    entries.push({ deck, line: lineIndex + 1, quantity, inputName, isCommander: section === 'commander' });
  }
  return entries;
}

function resolveEntries(
  entries: readonly DeckEntry[],
  index: Map<string, IndexedCard>,
): { resolved: ResolvedEntry[]; unresolvedCount: number } {
  const resolved: ResolvedEntry[] = [];
  let unresolvedCount = 0;
  for (const entry of entries) {
    const card = index.get(normalizeCardName(entry.inputName));
    if (!card) {
      unresolvedCount += 1;
      continue;
    }
    resolved.push({ ...entry, def: card.def, source: card.source });
  }
  return { resolved, unresolvedCount };
}

function extractRawCards(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    throw new Error('Input JSON must be an array or contain data[]/cards[].');
  }
  const snapshot = payload as ScryfallSnapshot;
  if (Array.isArray(snapshot.data)) {
    return snapshot.data;
  }
  if (Array.isArray(snapshot.cards)) {
    return snapshot.cards;
  }
  throw new Error('Input JSON object must contain data[] or cards[].');
}

async function readJson(path: string): Promise<unknown> {
  const source = await readFile(path, 'utf8');
  return JSON.parse(source) as unknown;
}

function normalizeCardName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/[’‘`]/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ---------------------------------------------------------------------------
// Play-through driver
// ---------------------------------------------------------------------------

function runPlaythrough(
  deck: DeckId,
  resolved: readonly ResolvedEntry[],
  unresolvedCount: number,
): PlaythroughResult {
  const generatedAt = new Date().toISOString();
  const deckCards: InitDeckCard[] = expandDeckEntries(resolved);

  let state = initGame(deckCards, SEED);
  const turns: TurnRecord[] = [];
  let totalCardsDrawn = 0;
  let totalSpellsCast = 0;
  let totalInterventions = 0;
  let totalWarnings = 0;
  let crashed = false;
  let crashMessage: string | undefined;

  try {
    // Opening hand: initGame leaves everyone at 0 cards in hand (turn-1
    // untap, no draw yet). Deal the opening 7 before turn loop begins.
    const opening = safeApply(state, { type: 'draw', count: OPENING_HAND_SIZE });
    state = opening.state;
    totalWarnings += opening.warnings.length;

    for (let turnNumber = 1; turnNumber <= TURNS_TO_PLAY; turnNumber += 1) {
      const turnRecord = playOneTurn(state, turnNumber);
      state = turnRecord.nextState;
      turns.push(turnRecord.record);
      totalCardsDrawn += turnRecord.record.cardsDrawn.length;
      totalSpellsCast += turnRecord.record.spellsCast.length;
      totalInterventions += turnRecord.record.pendingGuidedPrompts;
      totalWarnings += turnRecord.record.warnings.length;
    }
  } catch (error: unknown) {
    crashed = true;
    crashMessage = error instanceof Error ? error.message : String(error);
  }

  return {
    deck,
    generatedAt,
    seed: SEED,
    turnsRequested: TURNS_TO_PLAY,
    turnsCompleted: turns.length,
    resolvedEntries: resolved.length,
    unresolvedEntries: unresolvedCount,
    crashed,
    crashMessage,
    totalCardsDrawn,
    totalSpellsCast,
    totalInterventions,
    totalWarnings,
    turns,
    finalBoardState: dumpBoardState(state),
  };
}

function expandDeckEntries(resolved: readonly ResolvedEntry[]): InitDeckCard[] {
  const deck: InitDeckCard[] = [];
  for (const entry of resolved) {
    for (let i = 0; i < entry.quantity; i += 1) {
      deck.push({ def: entry.def, isCommander: entry.isCommander });
    }
  }
  return deck;
}

/**
 * applyCommand throws EngineError/Error for illegal commands. Every call site
 * in this script goes through safeApply so one bad card/line cannot abort the
 * whole run — the caller decides whether to log-and-continue or use the
 * returned unchanged state.
 */
function safeApply(
  state: GameState,
  cmd: GameCommand,
): { state: GameState; warnings: string[]; error?: string } {
  try {
    const result: ApplyResult = applyCommand(state, cmd);
    return { state: result.state, warnings: result.warnings };
  } catch (error: unknown) {
    const message =
      error instanceof EngineError || error instanceof Error ? error.message : String(error);
    return { state, warnings: [], error: message };
  }
}

function playOneTurn(
  startState: GameState,
  turnNumber: number,
): { nextState: GameState; record: TurnRecord } {
  let state = startState;
  const cardsDrawn: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const spellsCast: CastAttemptRecord[] = [];
  const spellsSkipped: CastAttemptRecord[] = [];
  let landPlayed: string | null = null;
  let pendingGuidedPrompts = 0;

  // Advance from wherever we currently sit to 'untap' of a fresh turn, unless
  // we are already there (turn 1 starts at untap). nextTurn as a single
  // command mirrors the store's turn-end action and also resets
  // landsPlayedThisTurn/spellsCastThisTurn/manaPool.
  if (!(turnNumber === 1 && state.phase === 'untap' && state.turn === 1)) {
    const advanced = safeApply(state, { type: 'nextTurn' });
    state = advanced.state;
    warnings.push(...advanced.warnings);
    if (advanced.error) errors.push(`nextTurn: ${advanced.error}`);
  }

  const handBeforeDraw = new Set(state.zones.hand);

  for (const phase of PHASE_ORDER) {
    if (state.phase !== phase) {
      const stepped = safeApply(state, { type: 'nextPhase' });
      state = stepped.state;
      warnings.push(...stepped.warnings);
      if (stepped.error) errors.push(`nextPhase(${phase}): ${stepped.error}`);
    }

    if (phase === 'draw') {
      // Turn 1's draw step already happened via enterPhase's implicit draw
      // when nextPhase moved us into 'draw' (engine auto-draws on phase
      // entry unless drawnHandled). Snapshot the hand right here — before
      // main1 has a chance to play/cast the drawn card away — so the
      // drawn-card diff below cannot miss a card that gets used the same
      // turn it was drawn.
      cardsDrawn.push(...newHandCardNames(handBeforeDraw, state));
    }

    if (phase === 'main1') {
      const mainResult = playMainPhase(state);
      state = mainResult.state;
      landPlayed = mainResult.landPlayed;
      spellsCast.push(...mainResult.spellsCast);
      spellsSkipped.push(...mainResult.spellsSkipped);
      warnings.push(...mainResult.warnings);
      errors.push(...mainResult.errors);
      pendingGuidedPrompts += mainResult.pendingGuidedPrompts;
    }
  }

  return {
    nextState: state,
    record: {
      turn: turnNumber,
      cardsDrawn,
      landPlayed,
      spellsCast,
      spellsSkipped,
      pendingGuidedPrompts,
      warnings,
      errors,
      boardStateAfterTurn: dumpBoardState(state),
    },
  };
}

/**
 * Best-effort: the engine's log entries mention draw counts but not card
 * names (private zone). We instead diff hand membership right after the
 * draw step resolves (before main1 can play the drawn card away), which is
 * a superset of "drawn" (also catches cards returned to hand by other
 * effects between turn start and the draw step, though none of this
 * heuristic's own actions do that) but is the closest observable proxy
 * without reaching into private zone internals beyond what the engine
 * already exposes.
 */
function newHandCardNames(handBefore: ReadonlySet<string>, after: GameState): string[] {
  const drawn: string[] = [];
  for (const cardId of after.zones.hand) {
    if (!handBefore.has(cardId)) {
      drawn.push(cardNameFor(after, cardId));
    }
  }
  return drawn;
}

interface MainPhaseResult {
  state: GameState;
  landPlayed: string | null;
  spellsCast: CastAttemptRecord[];
  spellsSkipped: CastAttemptRecord[];
  warnings: string[];
  errors: string[];
  pendingGuidedPrompts: number;
}

function playMainPhase(startState: GameState): MainPhaseResult {
  let state = startState;
  const warnings: string[] = [];
  const errors: string[] = [];
  const spellsCast: CastAttemptRecord[] = [];
  const spellsSkipped: CastAttemptRecord[] = [];
  let landPlayed: string | null = null;
  let pendingGuidedPrompts = 0;

  // 1) Play the first untapped land-typed card in hand, if lands remain for
  // this turn.
  if (state.landsPlayedThisTurn < 1) {
    const landId = firstLandInHand(state);
    if (landId) {
      const played = safeApply(state, { type: 'playLand', cardId: landId, forced: false });
      if (played.error) {
        errors.push(`playLand(${cardNameFor(state, landId)}): ${played.error}`);
      } else {
        landPlayed = cardNameFor(state, landId);
        state = played.state;
        warnings.push(...played.warnings);
      }
    }
  }

  // 2) Cast affordable spells cheapest-first from hand (and the commander
  // from the command zone, treated like any other castable source ranked by
  // cost). Loop until no more spells are castable or hand candidates are
  // exhausted, resolving the stack after every successful cast so triggered
  // guided prompts are visible per-cast rather than batched.
  let progressed = true;
  const attemptedThisTurn = new Set<string>();
  while (progressed) {
    progressed = false;
    const candidates = castableCandidatesCheapestFirst(state).filter(
      (candidate) => !attemptedThisTurn.has(candidate.cardId),
    );

    for (const candidate of candidates) {
      attemptedThisTurn.add(candidate.cardId);
      const attempt = attemptCast(state, candidate);
      if (attempt.outcome === 'not-auto-castable') {
        spellsSkipped.push(attempt.record);
        continue;
      }

      spellsCast.push(attempt.record);
      state = attempt.state;
      warnings.push(...attempt.warnings);
      errors.push(...attempt.errors);

      const resolved = resolveStackFully(state);
      state = resolved.state;
      warnings.push(...resolved.warnings);
      errors.push(...resolved.errors);
      pendingGuidedPrompts += resolved.guidedPromptsEncountered;

      progressed = true;
      break; // re-scan candidates from the new state (mana pool cleared per resolve, board changed)
    }
  }

  return { state, landPlayed, spellsCast, spellsSkipped, warnings, errors, pendingGuidedPrompts };
}

function firstLandInHand(state: GameState): string | null {
  for (const cardId of state.zones.hand) {
    if (isLandCard(state, cardId)) {
      return cardId;
    }
  }
  return null;
}

function isLandCard(state: GameState, cardId: string): boolean {
  const card = state.cards[cardId];
  if (!card) return false;
  const def = state.defs[card.defId];
  if (!def) return false;
  const face = def.faces[card.faceIndex] ?? def.faces[0];
  const typeLine = face?.typeLine ?? def.typeLine;
  return typeLine.includes('Land');
}

interface CastCandidate {
  cardId: string;
  cardName: string;
  cmc: number;
  fromCommand: boolean;
}

function castableCandidatesCheapestFirst(state: GameState): CastCandidate[] {
  const candidates: CastCandidate[] = [];

  for (const cardId of state.zones.hand) {
    const card = state.cards[cardId];
    const def = card ? state.defs[card.defId] : undefined;
    if (!card || !def) continue;
    const face = def.faces[card.faceIndex] ?? def.faces[0];
    const typeLine = face?.typeLine ?? def.typeLine;
    if (typeLine.includes('Land')) continue;
    candidates.push({ cardId, cardName: def.name, cmc: def.cmc, fromCommand: false });
  }

  for (const commander of state.commanders) {
    const card = state.cards[commander.cardId];
    if (!card || card.zone !== 'command') continue;
    const def = state.defs[card.defId];
    if (!def) continue;
    candidates.push({ cardId: commander.cardId, cardName: def.name, cmc: def.cmc, fromCommand: true });
  }

  return candidates.sort((a, b) => a.cmc - b.cmc || a.cardName.localeCompare(b.cardName));
}

interface CastAttemptOutcome {
  outcome: 'cast' | 'not-auto-castable';
  record: CastAttemptRecord;
  state: GameState;
  warnings: string[];
  errors: string[];
}

/**
 * Compute available mana from untapped lands via the real autotap solver
 * (planAutoTap/solvePayment — reused, not reimplemented), build a payment
 * that covers the spell's mana cost, and cast it via castToStack (so the
 * real stack + compiler + resolveStackTop pipeline runs). Spells that can't
 * be paid for are recorded as "not-auto-castable" and left untouched.
 */
function attemptCast(state: GameState, candidate: CastCandidate): CastAttemptOutcome {
  const card = state.cards[candidate.cardId];
  const def = card ? state.defs[card.defId] : undefined;
  if (!card || !def) {
    return {
      outcome: 'not-auto-castable',
      record: { cardId: candidate.cardId, cardName: candidate.cardName, outcome: 'not-auto-castable', reasonIfSkipped: 'missing card/def' },
      state,
      warnings: [],
      errors: [],
    };
  }

  const face = def.faces[card.faceIndex] ?? def.faces[0];
  const cost = parseManaCost(face?.manaCost ?? '');
  if (cost.x > 0) {
    // X spells: heuristic does not choose an X value; treat as not-auto-castable
    // rather than guessing (documented judgment call — see report).
    return skip(candidate, 'variable-X cost: heuristic does not choose X');
  }

  const directPlan = planAutoTap(state, cost, 0);
  if (!directPlan.ok) {
    return skip(candidate, `insufficient mana (shortfall ${directPlan.shortfall})`);
  }

  const tapCommands: GameCommand[] = directPlan.taps.map((tap) => ({
    type: 'setTapped' as const,
    cardId: tap.cardId,
    tapped: true,
  }));
  const addManaCommands: GameCommand[] = directPlan.taps.map((tap) => ({
    type: 'addMana' as const,
    color: tap.color,
    amount: 1,
  }));

  let working = state;
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const cmd of [...tapCommands, ...addManaCommands]) {
    const applied = safeApply(working, cmd);
    working = applied.state;
    warnings.push(...applied.warnings);
    if (applied.error) errors.push(`${cmd.type}(${candidate.cardName}): ${applied.error}`);
  }

  const castCmd: GameCommand = candidate.fromCommand
    ? { type: 'castCommander', cardId: candidate.cardId, payment: directPlan.payment, forced: false }
    : { type: 'castToStack', cardId: candidate.cardId, payment: directPlan.payment, forced: false };

  const castResult = safeApply(working, castCmd);
  if (castResult.error) {
    // Cast failed outright (e.g. commander not in command zone, illegal
    // target zone) — treat as not-auto-castable and leave mana/taps as-is
    // (already recorded in errors for visibility).
    errors.push(`cast(${candidate.cardName}): ${castResult.error}`);
    return skip(candidate, `cast command failed: ${castResult.error}`, working, warnings, errors);
  }
  working = castResult.state;
  warnings.push(...castResult.warnings);

  return {
    outcome: 'cast',
    record: { cardId: candidate.cardId, cardName: candidate.cardName, outcome: 'cast' },
    state: working,
    warnings,
    errors,
  };
}

function skip(
  candidate: CastCandidate,
  reason: string,
  state?: GameState,
  warnings: string[] = [],
  errors: string[] = [],
): CastAttemptOutcome {
  return {
    outcome: 'not-auto-castable',
    record: {
      cardId: candidate.cardId,
      cardName: candidate.cardName,
      outcome: 'not-auto-castable',
      reasonIfSkipped: reason,
    },
    state: state ?? ({} as GameState), // never read when outcome is not-auto-castable and state param omitted; caller always passes real state when it applies
    warnings,
    errors,
  };
}

interface ResolveStackResult {
  state: GameState;
  warnings: string[];
  errors: string[];
  guidedPromptsEncountered: number;
}

/**
 * Loop resolveStackTop until the stack is empty. Detects guided prompts
 * (equivalent of the store's pendingGuided) via guidedPlanForStackTop before
 * each resolve — resolveStackTop itself silently skips non-auto lines
 * (verified in src/engine/commands.ts applyCompiledEffectsForStackItem), so
 * this script does not need to answer the prompt to make progress; it just
 * counts it as an intervention point and continues (matching the "not
 * playing well, just exercising the machinery" goal).
 */
function resolveStackFully(state: GameState): ResolveStackResult {
  let working = state;
  const warnings: string[] = [];
  const errors: string[] = [];
  let guidedPromptsEncountered = 0;
  let steps = 0;

  while (working.zones.stack.length > 0 && steps < MAX_STACK_RESOLVE_STEPS) {
    steps += 1;
    const plan = guidedPlanForStackTop(working);
    if (plan && plan.prompts.length > 0) {
      guidedPromptsEncountered += 1;
    }
    const resolved = safeApply(working, { type: 'resolveStackTop' });
    working = resolved.state;
    warnings.push(...resolved.warnings);
    if (resolved.error) {
      errors.push(`resolveStackTop: ${resolved.error}`);
      // If resolving keeps failing we must not spin forever; bail after
      // recording the error once more this call has exhausted the guard.
      break;
    }
  }

  return { state: working, warnings, errors, guidedPromptsEncountered };
}

// ---------------------------------------------------------------------------
// Board state dump
// ---------------------------------------------------------------------------

function dumpBoardState(state: GameState): BoardStateDump {
  const zoneCounts = {} as Record<ZoneId, number>;
  for (const [zone, ids] of Object.entries(state.zones) as [ZoneId, string[]][]) {
    zoneCounts[zone] = ids.length;
  }

  const battlefield = state.zones.battlefield.map((cardId) => dumpCard(state, cardId));
  const hand = state.zones.hand.map((cardId) => cardNameFor(state, cardId));
  const commandersInPlay = state.zones.battlefield.filter((cardId) => state.cards[cardId]?.isCommander).map((cardId) => cardNameFor(state, cardId));

  return {
    turn: state.turn,
    phase: state.phase,
    life: state.life,
    poison: state.poison,
    energy: state.energy,
    experience: state.experience,
    manaPool: state.manaPool,
    zoneCounts,
    battlefield,
    hand,
    stackSize: state.zones.stack.length,
    commandersInPlay,
  };
}

function dumpCard(state: GameState, cardId: string): BoardCardDump {
  const card: CardInstance | undefined = state.cards[cardId];
  return {
    id: cardId,
    name: cardNameFor(state, cardId),
    tapped: card?.tapped ?? false,
    counters: card?.counters ?? {},
    isCommander: card?.isCommander ?? false,
    isToken: card?.isToken ?? false,
    damageMarked: card?.damageMarked ?? 0,
  };
}

function cardNameFor(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return cardId;
  const def = state.defs[card.defId];
  return def?.name ?? cardId;
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function renderSummaryMarkdown(rows: readonly PlaythroughSummaryRow[]): string {
  const lines: string[] = [];
  lines.push('# MyDeck Playability Play-through Summary');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Re-run');
  lines.push('');
  lines.push(
    '`npx tsx --loader ./scripts/mydeck-scoring/dir-import-loader.mjs scripts/mydeck-scoring/playthrough.ts`',
  );
  lines.push('');
  lines.push(
    '(the extra `--loader` flag works around a pre-existing tsx/Node directory-import gap — ' +
      'see scripts/mydeck-scoring/dir-import-loader.mjs header and the final report\'s "blockers" section; ' +
      '`npm run golden-replay` hits the same crash today for the same reason)',
  );
  lines.push('');
  lines.push('## Method');
  lines.push('');
  lines.push(
    `Deterministic seeded heuristic (seed=${SEED}), ${TURNS_TO_PLAY} turns per deck. Per turn: advance through all phases (draw on the draw step), ` +
      'play the first untapped land in hand in main1, then repeatedly cast the cheapest affordable non-land card (hand first, commander from command zone included) ' +
      'using the real autotap solver (`planAutoTap`/`solvePayment`) to build payment, cast via `castToStack`/`castCommander`, then fully resolve the stack ' +
      'via `resolveStackTop` before considering the next cast. Not an attempt to play well — the goal is to exercise real resolution machinery turn after turn.',
  );
  lines.push('');
  lines.push('## Per-deck results');
  lines.push('');
  lines.push(renderSummaryTable(rows));
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push(
    '- "interventions" = number of stack-resolve steps where `guidedPlanForStackTop` reported at least one prompt (i.e. the line needed a target/choice the heuristic did not supply). ' +
      'The line itself is silently skipped by the engine (not crashed) — see per-deck JSON `turns[].pendingGuidedPrompts` and `boardStateAfterTurn` for eyeballing wrong automations.',
  );
  lines.push(
    '- Full turn-by-turn logs and board-state snapshots are in `research/mydeck-scoring/playability/playthrough-<deck>.json`.',
  );
  lines.push('');
  return lines.join('\n');
}

function renderSummaryTable(rows: readonly PlaythroughSummaryRow[]): string {
  const body = rows.map((r) =>
    [
      r.deck,
      `${r.turnsCompleted}/${TURNS_TO_PLAY}`,
      String(r.totalSpellsCast),
      String(r.totalInterventions),
      String(r.totalWarnings),
      r.crashed ? `YES (${r.crashMessage ?? 'unknown'})` : 'no',
    ].join(' | '),
  );
  return [
    '| deck | turns completed | spells cast | interventions | warnings | crashed |',
    '|---|---|---:|---:|---:|---|',
    ...body.map((r) => `| ${r} |`),
  ].join('\n');
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
