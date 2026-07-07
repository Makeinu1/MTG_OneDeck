// Script A — static coverage census.
//
// For every resolvable card in each of the 4 MyDeck decks, runs the REAL
// compiler (parseAbilityIR -> compileAbilityIR) over every oracle ability
// line and buckets the resulting `decision` into auto | guided | manual.
// This measures actual playability independent of the (known-broken) demand
// meter in score.ts — it asks "does the engine already know how to resolve
// this line", not "does our blind-demand heuristic think it should".
//
// Deck loading (snapshot resolution, CardDef mapping, unresolved tracking)
// is copied from scripts/mydeck-scoring/score.ts's buildCardIndex/readDeckEntries
// so this script does not re-invent Scryfall snapshot resolution. score.ts
// itself is left untouched.
//
// Run: npx tsx scripts/mydeck-scoring/census.ts

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import process from 'node:process';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../../src/data/scryfall';
import {
  compileAbilityIR,
  type AutoDecision,
  type CompileContext,
} from '../../src/engine/grammar/compile';
import { splitAbilityLines } from '../../src/engine/grammar/index';
import { parseAbilityIR } from '../../src/engine/grammar/ir';
import type { CardDef, ManaColor } from '../../src/types/card';

const INPUT_SNAPSHOT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const OPTIONAL_FALLBACK_PATH = resolve(
  process.cwd(),
  'research/mydeck-scoring/scryfall-fallback.cards.json',
);
const OUTPUT_DIR = resolve(process.cwd(), 'research/mydeck-scoring/playability');
const CENSUS_JSON_PATH = resolve(OUTPUT_DIR, 'census.json');
const CENSUS_MD_PATH = resolve(OUTPUT_DIR, 'census.md');

const DECKS = [
  { id: 'Celes', path: resolve(process.cwd(), 'Mydeck/Celes.txt') },
  { id: 'Gogo', path: resolve(process.cwd(), 'Mydeck/Gogo.txt') },
  { id: 'Kefka', path: resolve(process.cwd(), 'Mydeck/Kefka.txt') },
  { id: 'Muldrotha', path: resolve(process.cwd(), 'Mydeck/Muldrotha.txt') },
] as const;

const COLORED_MANA: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G'];
const TOP_LIMIT = 30;

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

interface UnresolvedEntry extends DeckEntry {
  reason: string;
}

interface ResolvedEntry extends DeckEntry {
  def: CardDef;
  source: CardSource;
}

interface LineResult {
  faceIndex: number;
  lineIndex: number;
  shape: string;
  text: string;
  decision: AutoDecision;
  reasons: string[];
}

interface CardResult {
  deck: DeckId;
  card: string;
  inputName: string;
  quantity: number;
  isCommander: boolean;
  source: CardSource;
  lines: LineResult[];
  worstDecision: AutoDecision;
  autoLines: number;
  guidedLines: number;
  manualLines: number;
  manualReasons: string[];
}

interface DeckSummary {
  deck: DeckId;
  deckListEntries: number;
  resolvedEntries: number;
  unresolvedEntries: number;
  totalLines: number;
  autoLines: number;
  guidedLines: number;
  manualLines: number;
  autoCards: number;
  guidedCards: number;
  manualCards: number;
  unsupportedCards: string[]; // worstDecision === 'manual'
  needsClickCards: string[]; // worstDecision === 'guided'
}

interface CrossDeckGapRow {
  key: string; // card name OR reason pattern
  kind: 'card' | 'reason';
  decksAffected: DeckId[];
  occurrences: number;
}

interface CensusOutput {
  generatedAt: string;
  inputSnapshotPath: string;
  optionalFallbackPath: string;
  ctxNote: string;
  decks: DeckId[];
  deckSummaries: DeckSummary[];
  overall: DeckSummary;
  crossDeckUnsupported: CrossDeckGapRow[];
  crossDeckGuided: CrossDeckGapRow[];
  crossDeckManualReasons: CrossDeckGapRow[];
  unresolved: UnresolvedEntry[];
  cards: CardResult[];
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const index = await buildCardIndex();
  const entries = await readDeckEntries();

  const unresolved: UnresolvedEntry[] = [];
  const resolved: ResolvedEntry[] = [];
  for (const entry of entries) {
    const card = index.get(normalizeCardName(entry.inputName));
    if (!card) {
      unresolved.push({
        ...entry,
        reason:
          'Not found in local 2026-06-19 date>=2021-06-19 snapshot; Scryfall API fallback was unavailable in this sandbox.',
      });
      continue;
    }
    resolved.push({ ...entry, def: card.def, source: card.source });
  }

  const commanderIdentityByDeck = buildCommanderIdentities(resolved);
  const cards = resolved.map((entry) => scoreCard(entry, commanderIdentityByDeck.get(entry.deck) ?? []));

  const deckSummaries = DECKS.map((deck) =>
    buildDeckSummary(deck.id, entries, unresolved, cards),
  );
  const overall = buildDeckSummary('ALL' as DeckId, entries, unresolved, cards, true);

  const crossDeckUnsupported = buildCrossDeckCardGaps(cards, 'manual');
  const crossDeckGuided = buildCrossDeckCardGaps(cards, 'guided');
  const crossDeckManualReasons = buildCrossDeckReasonGaps(cards);

  const output: CensusOutput = {
    generatedAt,
    inputSnapshotPath: relative(process.cwd(), INPUT_SNAPSHOT_PATH),
    optionalFallbackPath: relative(process.cwd(), OPTIONAL_FALLBACK_PATH),
    ctxNote:
      'CompileContext per card: { sourceId: <instance-like id>, def, commanderColorIdentity: <deck commander colorIdentity intersected with WUBRG> }. ' +
      'No live GameState exists in this static census, so commanderColorIdentity is derived directly from the deck entry file\'s Commander card (line 2 of each Mydeck/<deck>.txt), ' +
      'matching commanderColorIdentityForState() in src/engine/commands.ts. allowLibrarySearchComposite/libraryShuffleOrder left at defaults (undefined).',
    decks: DECKS.map((d) => d.id),
    deckSummaries,
    overall,
    crossDeckUnsupported,
    crossDeckGuided,
    crossDeckManualReasons,
    unresolved,
    cards,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(CENSUS_JSON_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  await writeFile(CENSUS_MD_PATH, renderMarkdown(output), 'utf8');

  console.log(`Census written: ${relative(process.cwd(), OUTPUT_DIR)}`);
  console.log(
    `overall lines: auto=${overall.autoLines} guided=${overall.guidedLines} manual=${overall.manualLines} | cards: auto=${overall.autoCards} guided=${overall.guidedCards} manual=${overall.manualCards} | unresolved=${overall.unresolvedEntries}`,
  );
}

// ---------------------------------------------------------------------------
// Deck loading (copied minimal loader from score.ts — do not diverge without
// also checking score.ts; see file header note).
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

async function readDeckEntries(): Promise<DeckEntry[]> {
  const entries: DeckEntry[] = [];
  for (const deck of DECKS) {
    const source = await readFile(deck.path, 'utf8');
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
      entries.push({
        deck: deck.id,
        line: lineIndex + 1,
        quantity,
        inputName,
        isCommander: section === 'commander',
      });
    }
  }
  return entries;
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
// Compiler census
// ---------------------------------------------------------------------------

function buildCommanderIdentities(resolved: readonly ResolvedEntry[]): Map<DeckId, ManaColor[]> {
  const map = new Map<DeckId, ManaColor[]>();
  for (const entry of resolved) {
    if (!entry.isCommander) {
      continue;
    }
    const colors = new Set<ManaColor>();
    for (const color of entry.def.colorIdentity) {
      if ((COLORED_MANA as readonly string[]).includes(color)) {
        colors.add(color as ManaColor);
      }
    }
    const existing = map.get(entry.deck) ?? [];
    map.set(entry.deck, [...existing, ...COLORED_MANA.filter((c) => colors.has(c))]);
  }
  return map;
}

function scoreCard(entry: ResolvedEntry, commanderColorIdentity: readonly ManaColor[]): CardResult {
  const ctx: CompileContext = {
    sourceId: `census:${entry.deck}:${entry.def.scryfallId}`,
    def: entry.def,
    commanderColorIdentity,
  };

  const lines: LineResult[] = [];
  splitAbilityLines(entry.def).forEach((line, lineIndex) => {
    const typeLine = entry.def.faces[line.faceIndex]?.typeLine ?? entry.def.typeLine;
    const ir = parseAbilityIR(line.text, typeLine);
    const compiled = compileAbilityIR(ir, ctx);
    lines.push({
      faceIndex: line.faceIndex,
      lineIndex,
      shape: line.shape,
      text: normalizeWhitespace(line.text),
      decision: compiled.decision,
      reasons: compiled.reasons,
    });
  });

  const autoLines = lines.filter((l) => l.decision === 'auto').length;
  const guidedLines = lines.filter((l) => l.decision === 'guided').length;
  const manualLines = lines.filter((l) => l.decision === 'manual').length;
  const worstDecision = worstOf(lines.map((l) => l.decision));
  const manualReasons = unique(
    lines.filter((l) => l.decision === 'manual').flatMap((l) => l.reasons),
  );

  return {
    deck: entry.deck,
    card: entry.def.name,
    inputName: entry.inputName,
    quantity: entry.quantity,
    isCommander: entry.isCommander,
    source: entry.source,
    lines,
    worstDecision,
    autoLines,
    guidedLines,
    manualLines,
    manualReasons,
  };
}

function worstOf(decisions: readonly AutoDecision[]): AutoDecision {
  if (decisions.length === 0) {
    return 'auto';
  }
  if (decisions.includes('manual')) {
    return 'manual';
  }
  if (decisions.includes('guided')) {
    return 'guided';
  }
  return 'auto';
}

function buildDeckSummary(
  deck: DeckId,
  entries: readonly DeckEntry[],
  unresolved: readonly UnresolvedEntry[],
  cards: readonly CardResult[],
  isOverall = false,
): DeckSummary {
  const deckEntries = isOverall ? entries : entries.filter((e) => e.deck === deck);
  const deckUnresolved = isOverall ? unresolved : unresolved.filter((e) => e.deck === deck);
  const deckCards = isOverall ? cards : cards.filter((c) => c.deck === deck);

  const totalLines = deckCards.reduce((sum, c) => sum + c.lines.length, 0);
  const autoLines = deckCards.reduce((sum, c) => sum + c.autoLines, 0);
  const guidedLines = deckCards.reduce((sum, c) => sum + c.guidedLines, 0);
  const manualLines = deckCards.reduce((sum, c) => sum + c.manualLines, 0);

  return {
    deck,
    deckListEntries: deckEntries.length,
    resolvedEntries: deckCards.length,
    unresolvedEntries: deckUnresolved.length,
    totalLines,
    autoLines,
    guidedLines,
    manualLines,
    autoCards: deckCards.filter((c) => c.worstDecision === 'auto').length,
    guidedCards: deckCards.filter((c) => c.worstDecision === 'guided').length,
    manualCards: deckCards.filter((c) => c.worstDecision === 'manual').length,
    unsupportedCards: deckCards
      .filter((c) => c.worstDecision === 'manual')
      .map((c) => c.card)
      .sort((a, b) => a.localeCompare(b)),
    needsClickCards: deckCards
      .filter((c) => c.worstDecision === 'guided')
      .map((c) => c.card)
      .sort((a, b) => a.localeCompare(b)),
  };
}

function buildCrossDeckCardGaps(
  cards: readonly CardResult[],
  decision: 'manual' | 'guided',
): CrossDeckGapRow[] {
  const byCard = new Map<string, Set<DeckId>>();
  for (const card of cards) {
    if (card.worstDecision !== decision) {
      continue;
    }
    const decks = byCard.get(card.card) ?? new Set<DeckId>();
    decks.add(card.deck);
    byCard.set(card.card, decks);
  }
  return [...byCard.entries()]
    .filter(([, decks]) => decks.size > 1)
    .map(([key, decks]) => ({
      key,
      kind: 'card' as const,
      decksAffected: [...decks].sort((a, b) => a.localeCompare(b)),
      occurrences: decks.size,
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.key.localeCompare(b.key))
    .slice(0, TOP_LIMIT);
}

function buildCrossDeckReasonGaps(cards: readonly CardResult[]): CrossDeckGapRow[] {
  const byReason = new Map<string, Set<DeckId>>();
  for (const card of cards) {
    for (const reason of card.manualReasons) {
      const decks = byReason.get(reason) ?? new Set<DeckId>();
      decks.add(card.deck);
      byReason.set(reason, decks);
    }
  }
  return [...byReason.entries()]
    .filter(([, decks]) => decks.size > 1)
    .map(([key, decks]) => ({
      key,
      kind: 'reason' as const,
      decksAffected: [...decks].sort((a, b) => a.localeCompare(b)),
      occurrences: decks.size,
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.key.localeCompare(b.key))
    .slice(0, TOP_LIMIT);
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function renderMarkdown(output: CensusOutput): string {
  const lines: string[] = [];
  lines.push('# MyDeck Playability Census (static compiler coverage)');
  lines.push('');
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push('');
  lines.push('## Re-run');
  lines.push('');
  lines.push('`npx tsx scripts/mydeck-scoring/census.ts`');
  lines.push('');
  lines.push('## What this measures');
  lines.push('');
  lines.push(
    'Every resolved card\'s oracle ability lines are run through the REAL engine compiler ' +
      '(`parseAbilityIR` + `compileAbilityIR` from `src/engine/grammar/`), not a blind regex heuristic. ' +
      'Each line is bucketed by `compiled.decision`: `auto` (engine fully resolves it), ' +
      '`guided` (engine needs a player choice/target — a prompt), or `manual` (engine cannot resolve it at all).',
  );
  lines.push('');
  lines.push(output.ctxNote);
  lines.push('');
  lines.push(`- local snapshot: \`${output.inputSnapshotPath}\``);
  lines.push(`- optional fallback file: \`${output.optionalFallbackPath}\``);
  lines.push('');
  lines.push('## Per-deck summary');
  lines.push('');
  lines.push(renderDeckTable(output.deckSummaries, output.overall));
  lines.push('');
  lines.push('## Cross-deck recurring gaps');
  lines.push('');
  lines.push('### Unsupported cards (worst line = manual) recurring across >1 deck');
  lines.push('');
  lines.push(renderGapTable(output.crossDeckUnsupported));
  lines.push('');
  lines.push('### Needs-click cards (worst line = guided) recurring across >1 deck');
  lines.push('');
  lines.push(renderGapTable(output.crossDeckGuided));
  lines.push('');
  lines.push('### Manual-reason patterns recurring across >1 deck');
  lines.push('');
  lines.push(renderGapTable(output.crossDeckManualReasons));
  lines.push('');
  lines.push('## Unresolved (not found in snapshot)');
  lines.push('');
  lines.push(
    output.unresolved.length > 0
      ? output.unresolved
          .map((e) => `- ${e.deck}:${e.line} ${e.quantity} ${e.inputName}${e.isCommander ? ' (Commander)' : ''}`)
          .join('\n')
      : '- none',
  );
  lines.push('');
  for (const deck of output.decks) {
    lines.push(`## ${deck} — unsupported cards (UNSUPPORTED)`);
    lines.push('');
    const summary = output.deckSummaries.find((d) => d.deck === deck);
    lines.push(
      summary && summary.unsupportedCards.length > 0
        ? summary.unsupportedCards.map((c) => `- ${c}`).join('\n')
        : '- none',
    );
    lines.push('');
    lines.push(`## ${deck} — needs-click cards (NEEDS-CLICK)`);
    lines.push('');
    lines.push(
      summary && summary.needsClickCards.length > 0
        ? summary.needsClickCards.map((c) => `- ${c}`).join('\n')
        : '- none',
    );
    lines.push('');
  }
  return lines.join('\n');
}

function renderDeckTable(deckSummaries: readonly DeckSummary[], overall: DeckSummary): string {
  const rows = [...deckSummaries, overall].map((s) =>
    [
      s.deck,
      String(s.deckListEntries),
      String(s.resolvedEntries),
      String(s.unresolvedEntries),
      `${s.autoCards}`,
      `${s.guidedCards}`,
      `${s.manualCards}`,
      `${s.autoLines}/${s.totalLines}`,
      `${s.guidedLines}/${s.totalLines}`,
      `${s.manualLines}/${s.totalLines}`,
    ].join(' | '),
  );
  return [
    '| deck | entries | resolved | unresolved | auto cards | guided cards | manual cards | auto lines | guided lines | manual lines |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...rows.map((r) => `| ${r} |`),
  ].join('\n');
}

function renderGapTable(rows: readonly CrossDeckGapRow[]): string {
  if (rows.length === 0) {
    return '- none';
  }
  return [
    '| key | decks affected | occurrences |',
    '|---|---|---:|',
    ...rows.map((r) => `| \`${r.key}\` | ${r.decksAffected.join(', ')} | ${r.occurrences} |`),
  ].join('\n');
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items)].sort((a, b) => a.localeCompare(b));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
