/**
 * Corpus decision snapshot — shared, pure (no fs/zlib I/O) fingerprinting logic.
 *
 * Mirrors the enumeration pipeline in scripts/grammar-compile.ts
 * (mapScryfallCardToCardDef -> splitAbilityLines -> parseAbilityIR -> compileAbilityIR)
 * but instead of building a statistics report, it fingerprints the grammar
 * compiler's *decision* (auto/guided/manual) + emitted commands for every
 * effect line, so a future compiler change that alters existing behavior can
 * be detected mechanically by diffing two fingerprint sets.
 *
 * This module is imported by both scripts/decision-snapshot.ts (CLI, does the
 * fs/gzip I/O) and src/engine/grammar/__tests__/decisionSnapshot.test.ts (the
 * regression gate + the detectability demo), so the fingerprinting logic has a
 * single source of truth.
 */
import { createHash } from 'node:crypto';

import { splitAbilityLines } from '../../src/engine/grammar/index.ts';
import { parseAbilityIR } from '../../src/engine/grammar/ir.ts';
import { compileAbilityIR, type AutoDecision } from '../../src/engine/grammar/compile.ts';
import { mapScryfallCardToCardDef, type ScryfallCard } from '../../src/data/scryfall';
import type { CardDef } from '../../src/types/card';

// --- Well-known paths (relative to repo root) --------------------------------
// Single source of truth shared by scripts/decision-snapshot.ts (the CLI, which
// resolves these against process.cwd()) and the vitest gate
// (src/engine/grammar/__tests__/decisionSnapshot.test.ts), so the two never drift.

export const RAW_CORPUS_RELATIVE_PATH =
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json';
export const EXTRACT_RELATIVE_PATH = 'research/grammar-compile/corpus-extract.json.gz';
export const SNAPSHOT_RELATIVE_PATH = 'research/grammar-compile/decision-snapshot.json';

// --- Corpus extract shape ---------------------------------------------------
//
// Minimal projection of a Scryfall card containing EXACTLY the fields the
// enumeration pipeline above reads:
//   - mapScryfallCardToCardDef reads: id, oracle_id, name, lang, layout, cmc,
//     type_line, oracle_text, card_faces[].{name,type_line,oracle_text}
//   - splitAbilityLines / cardOracleTexts read: def.faces[].oracleText
//   - classifyAbilityShape / parseAbilityIR read: face typeLine (with a
//     def.typeLine fallback)
//   - compileAbilityIR's CompileContext reads: ctx.def.name only (self
//     sacrifice/exile subject-name matching)
// Fields such as mana_cost/power/toughness/loyalty/image_uris/keywords/
// produced_mana/color_identity/edhrec_rank are NOT read anywhere on this path
// and are intentionally omitted to keep the extract compact. The self
// validation step in `npm run snapshot:extract` proves this projection is
// lossless for fingerprinting purposes by recomputing fingerprints from raw
// and from the extract and diffing them.

export interface ExtractCardFace {
  name: string;
  typeLine?: string;
  oracleText?: string;
}

export interface ExtractCard {
  id: string;
  oracleId?: string;
  name: string;
  lang: string;
  layout: string;
  cmc: number;
  typeLine: string;
  oracleText?: string;
  faces?: ExtractCardFace[];
}

export function scryfallCardToExtractCard(card: ScryfallCard): ExtractCard {
  return {
    id: card.id,
    oracleId: card.oracle_id,
    name: card.name,
    lang: card.lang,
    layout: card.layout,
    cmc: card.cmc,
    typeLine: card.type_line,
    oracleText: card.oracle_text,
    faces: card.card_faces?.map((face) => ({
      name: face.name,
      typeLine: face.type_line,
      oracleText: face.oracle_text,
    })),
  };
}

export function extractCardToScryfallCard(extract: ExtractCard): ScryfallCard {
  return {
    id: extract.id,
    oracle_id: extract.oracleId,
    name: extract.name,
    lang: extract.lang,
    layout: extract.layout,
    cmc: extract.cmc,
    type_line: extract.typeLine,
    oracle_text: extract.oracleText,
    card_faces: extract.faces?.map((face) => ({
      name: face.name,
      type_line: face.typeLine,
      oracle_text: face.oracleText,
    })),
  };
}

// --- Fingerprint computation -------------------------------------------------

export type DecisionCode = 'a' | 'g' | 'm';

const DECISION_CODE: Record<AutoDecision, DecisionCode> = {
  auto: 'a',
  guided: 'g',
  manual: 'm',
};

export interface FingerprintEntry {
  /** "<cardName>#<faceIndex>#<lineIdx>" — lineIdx is the position of this line
   * within splitAbilityLines(def) output for this card (stable given corpus order). */
  k: string;
  d: DecisionCode;
  /** 8-hex hash of the canonical JSON of compiled.commands. */
  c: string;
  /** 8-hex hash of the canonical JSON of the sorted compiled.reasons. */
  r: string;
}

export interface MappingFailureInfo {
  index: number;
  cardName: string;
  reason: string;
}

export interface FingerprintResult {
  entries: FingerprintEntry[];
  mappingFailures: MappingFailureInfo[];
  cardCount: number;
}

const SOURCE_ID = 'decision-snapshot';

/**
 * Compute one FingerprintEntry per effect-bearing ability line (ir.effects.length > 0),
 * in corpus order, for a list of raw-ish (unknown-shaped) Scryfall card records.
 * Cards that fail to map to a CardDef are reported as mapping failures and skipped
 * (matching the behavior of scripts/grammar-compile.ts).
 */
export function computeFingerprints(cardsUnknown: readonly unknown[]): FingerprintResult {
  const entries: FingerprintEntry[] = [];
  const mappingFailures: MappingFailureInfo[] = [];
  // diffSnapshots keys a Map on `k`, so duplicate keys would silently shadow
  // entries. Names alone are not unique (the corpus contains same-name distinct
  // cards, e.g. Scavenger Hunt), so keys embed a Scryfall-id prefix, and this
  // guard turns any residual collision into a loud failure.
  const seenKeys = new Set<string>();

  cardsUnknown.forEach((raw, index) => {
    const fallbackName = readStringField(raw, 'name') ?? `(index ${index})`;
    if (!isRecord(raw)) {
      mappingFailures.push({ index, cardName: fallbackName, reason: 'Invalid Scryfall card shape' });
      return;
    }
    const card = raw as unknown as ScryfallCard;

    let def: CardDef;
    try {
      def = mapScryfallCardToCardDef(card);
    } catch (error: unknown) {
      mappingFailures.push({ index, cardName: fallbackName, reason: errorMessage(error) });
      return;
    }

    const cardName = def.name || fallbackName;
    const cardId8 = readStringField(raw, 'id')?.slice(0, 8) ?? 'no-id';

    let lineIdx = 0;
    for (const line of splitAbilityLines(def)) {
      const typeLine = def.faces[line.faceIndex]?.typeLine ?? def.typeLine;
      const ir = parseAbilityIR(line.text, typeLine);
      if (ir.effects.length > 0) {
        const compiled = compileAbilityIR(ir, { sourceId: SOURCE_ID, def });
        const key = `${cardName}#${cardId8}#${line.faceIndex}#${lineIdx}`;
        if (seenKeys.has(key)) {
          throw new Error(
            `Duplicate fingerprint key "${key}" (name + Scryfall-id prefix ` +
              'collision; fingerprint keys must be unique for diffSnapshots)',
          );
        }
        seenKeys.add(key);
        entries.push({
          k: key,
          d: DECISION_CODE[compiled.decision],
          c: hash8(canonicalStringify(compiled.commands)),
          r: hash8(canonicalStringify([...compiled.reasons].sort())),
        });
      }
      lineIdx += 1;
    }
  });

  return { entries, mappingFailures, cardCount: cardsUnknown.length };
}

/** Compare two fingerprint results (e.g. computed from raw vs. from the extract). */
export interface FingerprintComparison {
  ok: boolean;
  mismatches: string[];
}

export function compareFingerprintResults(
  a: FingerprintResult,
  b: FingerprintResult,
  maxMismatches = 20,
): FingerprintComparison {
  const mismatches: string[] = [];
  if (a.entries.length !== b.entries.length) {
    mismatches.push(`entry count differs: raw=${a.entries.length} extract=${b.entries.length}`);
  }
  const length = Math.min(a.entries.length, b.entries.length);
  for (let i = 0; i < length; i += 1) {
    const left = a.entries[i];
    const right = b.entries[i];
    if (left.k !== right.k || left.d !== right.d || left.c !== right.c || left.r !== right.r) {
      if (mismatches.length < maxMismatches) {
        mismatches.push(
          `[${i}] raw=${JSON.stringify(left)} extract=${JSON.stringify(right)}`,
        );
      }
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

// --- Snapshot (persisted, line-diffable) ------------------------------------

export interface SnapshotTotals {
  cards: number;
  effectLines: number;
  auto: number;
  guided: number;
  manual: number;
  /** Cards where ALL effect lines are auto/guided (fully automated). */
  completeCards: number;
  /** Cards with a mix of auto/guided AND manual lines (partially automated). */
  partialCards: number;
  /** Cards where ALL effect lines are manual. */
  manualOnlyCards: number;
}

export interface SnapshotHeader {
  corpusHash: string;
  totals: SnapshotTotals;
}

export interface Snapshot {
  header: SnapshotHeader;
  entries: FingerprintEntry[];
}

export function computeCorpusHash(extractCards: readonly ExtractCard[]): string {
  return createHash('sha256').update(JSON.stringify(extractCards)).digest('hex');
}

export function buildSnapshotFromFingerprints(
  fingerprintResult: FingerprintResult,
  corpusHash: string,
): Snapshot {
  const entries = fingerprintResult.entries;

  // Per-card completeness: group entries by card key (name#hash#face)
  const cardDecisions = new Map<string, { hasAutomated: boolean; hasManual: boolean }>();
  for (const entry of entries) {
    // key format: "CardName#hash#faceIndex#lineIndex" → card key = first 3 segments
    const parts = entry.k.split('#');
    const cardKey = parts.slice(0, 3).join('#');
    const record = cardDecisions.get(cardKey) ?? { hasAutomated: false, hasManual: false };
    if (entry.d === 'm') {
      record.hasManual = true;
    } else {
      record.hasAutomated = true;
    }
    cardDecisions.set(cardKey, record);
  }

  let completeCards = 0;
  let partialCards = 0;
  let manualOnlyCards = 0;
  for (const { hasAutomated, hasManual } of cardDecisions.values()) {
    if (hasAutomated && !hasManual) completeCards++;
    else if (hasAutomated && hasManual) partialCards++;
    else manualOnlyCards++;
  }

  const totals: SnapshotTotals = {
    cards: fingerprintResult.cardCount,
    effectLines: entries.length,
    auto: entries.filter((entry) => entry.d === 'a').length,
    guided: entries.filter((entry) => entry.d === 'g').length,
    manual: entries.filter((entry) => entry.d === 'm').length,
    completeCards,
    partialCards,
    manualOnlyCards,
  };
  return { header: { corpusHash, totals }, entries };
}

/** Serialize as line-delimited JSON: header on line 1, one entry per subsequent line. */
export function serializeSnapshot(snapshot: Snapshot): string {
  const lines = [JSON.stringify(snapshot.header), ...snapshot.entries.map((entry) => JSON.stringify(entry))];
  return `${lines.join('\n')}\n`;
}

export function parseSnapshot(text: string): Snapshot {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    throw new Error('decision-snapshot.json is empty');
  }
  const header = JSON.parse(lines[0]) as unknown as SnapshotHeader;
  const entries = lines.slice(1).map((line) => JSON.parse(line) as unknown as FingerprintEntry);
  return { header, entries };
}

// --- Transition diff ----------------------------------------------------

export type TransitionKind =
  | 'a→g'
  | 'a→m'
  | 'g→a'
  | 'g→m'
  | 'm→a'
  | 'm→g'
  | 'commandHashChanged'
  | 'added'
  | 'removed';

export const TRANSITION_KINDS: readonly TransitionKind[] = [
  'a→g',
  'a→m',
  'g→a',
  'g→m',
  'm→a',
  'm→g',
  'commandHashChanged',
  'added',
  'removed',
];

const DECISION_TRANSITION_KIND: Record<DecisionCode, Record<DecisionCode, TransitionKind | null>> = {
  a: { a: null, g: 'a→g', m: 'a→m' },
  g: { a: 'g→a', g: null, m: 'g→m' },
  m: { a: 'm→a', g: 'm→g', m: null },
};

export interface TransitionExample {
  key: string;
  before?: FingerprintEntry;
  after?: FingerprintEntry;
}

export type TransitionSummary = {
  totalOld: number;
  totalNew: number;
  counts: Record<TransitionKind, number>;
  examples: Record<TransitionKind, TransitionExample[]>;
};

const MAX_EXAMPLES_PER_KIND = 10;

export function diffSnapshots(
  oldEntries: readonly FingerprintEntry[] | undefined,
  newEntries: readonly FingerprintEntry[],
): TransitionSummary {
  const counts = emptyCounts();
  const examples = emptyExamples();

  const record = (kind: TransitionKind, example: TransitionExample): void => {
    counts[kind] += 1;
    if (examples[kind].length < MAX_EXAMPLES_PER_KIND) {
      examples[kind].push(example);
    }
  };

  const oldByKey = new Map((oldEntries ?? []).map((entry) => [entry.k, entry]));
  const newByKey = new Map(newEntries.map((entry) => [entry.k, entry]));

  for (const [key, oldEntry] of oldByKey) {
    const newEntry = newByKey.get(key);
    if (!newEntry) {
      record('removed', { key, before: oldEntry });
      continue;
    }
    if (oldEntry.d !== newEntry.d) {
      const kind = DECISION_TRANSITION_KIND[oldEntry.d][newEntry.d];
      if (kind) {
        record(kind, { key, before: oldEntry, after: newEntry });
      }
    } else if (oldEntry.c !== newEntry.c || oldEntry.r !== newEntry.r) {
      record('commandHashChanged', { key, before: oldEntry, after: newEntry });
    }
  }
  for (const [key, newEntry] of newByKey) {
    if (!oldByKey.has(key)) {
      record('added', { key, after: newEntry });
    }
  }

  return { totalOld: oldByKey.size, totalNew: newByKey.size, counts, examples };
}

export function hasAnyTransition(summary: TransitionSummary): boolean {
  return TRANSITION_KINDS.some((kind) => summary.counts[kind] > 0);
}

export function formatTransitionSummary(summary: TransitionSummary): string {
  const lines: string[] = [
    '=== decision snapshot transition summary ===',
    `previous entries: ${summary.totalOld} / new entries: ${summary.totalNew}`,
    ...TRANSITION_KINDS.map((kind) => `${kind}: ${summary.counts[kind]}`),
  ];
  for (const kind of TRANSITION_KINDS) {
    const items = summary.examples[kind];
    if (items.length === 0) {
      continue;
    }
    lines.push(`--- ${kind} examples (showing ${items.length} of ${summary.counts[kind]}) ---`);
    for (const item of items) {
      lines.push(`  ${item.key}: ${describeExampleEntry(item.before)} -> ${describeExampleEntry(item.after)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function describeExampleEntry(entry: FingerprintEntry | undefined): string {
  return entry ? `d=${entry.d} c=${entry.c} r=${entry.r}` : '(none)';
}

function emptyCounts(): Record<TransitionKind, number> {
  const counts = {} as Record<TransitionKind, number>;
  for (const kind of TRANSITION_KINDS) {
    counts[kind] = 0;
  }
  return counts;
}

function emptyExamples(): Record<TransitionKind, TransitionExample[]> {
  const examples = {} as Record<TransitionKind, TransitionExample[]>;
  for (const kind of TRANSITION_KINDS) {
    examples[kind] = [];
  }
  return examples;
}

// --- Small local helpers (deliberately duplicated from scripts/grammar-compile.ts,
// which does not export them) -------------------------------------------------

export function hash8(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of entries) {
      result[key] = sortKeysDeep(entryValue);
    }
    return result;
  }
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readStringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const field = value[key];
  return typeof field === 'string' ? field : undefined;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function extractRawCardsArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    throw new Error('Input JSON must be an array or an object with data/cards array.');
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  if (Array.isArray(payload.cards)) {
    return payload.cards;
  }
  throw new Error('Input JSON object must contain data[] or cards[].');
}
