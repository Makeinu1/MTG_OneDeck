import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import process from 'node:process';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../../src/data/scryfall';
import { splitAbilityLines, type AbilityLine } from '../../src/engine/grammar/index.ts';
import type { CardDef } from '../../src/types/card';
import { classifyEventsForLine } from '../lib/eventClassify.ts';
import { classifyContinuousLayers } from '../lib/layerClassify.ts';
import { classifyTimingForLine } from '../lib/timingClassify.ts';
import { classifyZonesForLine, type OwnershipKind } from '../lib/zoneClassify.ts';

const INPUT_SNAPSHOT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const OPTIONAL_FALLBACK_PATH = resolve(
  process.cwd(),
  'research/mydeck-scoring/scryfall-fallback.cards.json',
);
const OUTPUT_DIR = resolve(process.cwd(), 'research/mydeck-scoring');
const SUMMARY_MD_PATH = resolve(OUTPUT_DIR, 'summary.md');
const REPORT_JSON_PATH = resolve(OUTPUT_DIR, 'report.json');
const GAPS_JSON_PATH = resolve(OUTPUT_DIR, 'gaps.json');
const PER_DECK_DIR = resolve(OUTPUT_DIR, 'per-deck');

const DECKS = [
  { id: 'Celes', path: resolve(process.cwd(), 'Mydeck/Celes.txt') },
  { id: 'Gogo', path: resolve(process.cwd(), 'Mydeck/Gogo.txt') },
  { id: 'Kefka', path: resolve(process.cwd(), 'Mydeck/Kefka.txt') },
  { id: 'Muldrotha', path: resolve(process.cwd(), 'Mydeck/Muldrotha.txt') },
] as const;

const MODEL_IGNORED_TAGS = new Set<string>(['event:other']);
const EXAMPLE_LIMIT = 12;
const TOP_LIMIT = 20;

type DeckId = (typeof DECKS)[number]['id'];
type CoverageStatus = 'complete' | 'partial' | 'gap';
type GapCategory = 'substrate不足' | 'catalog未写' | 'scope境界(既知defer)' | '曖昧' | 'unresolved';
type CardSource = 'local-snapshot' | 'local-fallback';

interface DeckEntry {
  deck: DeckId;
  line: number;
  quantity: number;
  inputName: string;
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

interface Demand {
  id: string;
  readWrite: string;
  evidence: string;
}

interface ClauseScore {
  deck: DeckId;
  card: string;
  inputName: string;
  quantity: number;
  source: CardSource;
  faceIndex: number;
  clauseIndex: number;
  shape: string;
  clause: string;
  status: CoverageStatus;
  demands: string[];
  demandReadWrite: string[];
  modelTags: string[];
  coveredDemands: string[];
  missingDemands: string[];
  candidateCategories: GapCategory[];
  primaryCandidateCategory?: GapCategory;
}

interface GapRow {
  deck: DeckId;
  card: string;
  inputName: string;
  quantity: number;
  source: CardSource;
  faceIndex: number;
  clauseIndex: number;
  shape: string;
  clauseExcerpt: string;
  requiredReadWrite: string[];
  modelTags: string[];
  catalogJudgement: CoverageStatus;
  missingReadWrite: string[];
  candidateCategories: GapCategory[];
  primaryCandidateCategory: GapCategory;
}

interface DeckMetrics {
  deck: DeckId | 'ALL';
  deckListEntries: number;
  deckQuantity: number;
  resolvedEntries: number;
  unresolvedEntries: number;
  scoredClauses: number;
  completeClauses: number;
  partialClauses: number;
  gapClauses: number;
  completeRate: number;
  partialRate: number;
  gapRate: number;
  demandCount: number;
  coveredDemandCount: number;
  demandCoverageRate: number;
}

interface ScoreOutput {
  generatedAt: string;
  inputSnapshotPath: string;
  optionalFallbackPath: string;
  decks: DeckId[];
  metrics: DeckMetrics[];
  categoryCounts: Record<GapCategory, number>;
  missingDemandCounts: Record<string, number>;
  unresolved: UnresolvedEntry[];
  gaps: GapRow[];
  clauses: ClauseScore[];
}

interface ScryfallSnapshot {
  cards?: unknown[];
  data?: unknown[];
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

  const clauses = scoreClauses(resolved);
  const gaps = buildGapRows(clauses);
  const metrics = buildAllMetrics(entries, resolved, unresolved, clauses);
  const output: ScoreOutput = {
    generatedAt,
    inputSnapshotPath: relative(process.cwd(), INPUT_SNAPSHOT_PATH),
    optionalFallbackPath: relative(process.cwd(), OPTIONAL_FALLBACK_PATH),
    decks: DECKS.map((deck) => deck.id),
    metrics,
    categoryCounts: countCategories(gaps),
    missingDemandCounts: countMissingDemands(gaps),
    unresolved,
    gaps,
    clauses,
  };

  await mkdir(PER_DECK_DIR, { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  await writeFile(GAPS_JSON_PATH, `${JSON.stringify(gaps, null, 2)}\n`, 'utf8');
  await writeFile(SUMMARY_MD_PATH, renderSummary(output), 'utf8');
  for (const deck of DECKS) {
    await writeFile(
      resolve(PER_DECK_DIR, `${deck.id}.md`),
      renderDeckSummary(deck.id, output),
      'utf8',
    );
  }

  const overall = metrics.find((metric) => metric.deck === 'ALL');
  if (!overall) {
    throw new Error('Internal error: missing overall metrics.');
  }
  console.log(`MyDeck scoring written: ${relative(process.cwd(), OUTPUT_DIR)}`);
  console.log(
    `clauses=${overall.scoredClauses} complete=${overall.completeClauses} partial=${overall.partialClauses} gap=${overall.gapClauses} demandCoverage=${formatPercent(overall.demandCoverageRate)} unresolved=${overall.unresolvedEntries}`,
  );
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
    for (const [lineIndex, line] of source.split(/\r?\n/u).entries()) {
      const match = /^\s*(\d+)\s+(.+?)\s*$/u.exec(line);
      if (!match) {
        continue;
      }
      const quantity = Number.parseInt(match[1] ?? '0', 10);
      const inputName = match[2]?.trim();
      if (!inputName || !Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }
      entries.push({ deck: deck.id, line: lineIndex + 1, quantity, inputName });
    }
  }
  return entries;
}

function scoreClauses(entries: readonly ResolvedEntry[]): ClauseScore[] {
  const clauses: ClauseScore[] = [];
  let clauseIndex = 0;
  for (const entry of entries) {
    for (const line of splitAbilityLines(entry.def)) {
      const demands = blindDemandsForLine(line);
      if (demands.length === 0) {
        continue;
      }
      clauseIndex += 1;
      const modelTags = modelTagsForLine(line, entry.def);
      const coverage = compareDemands(demands, modelTags);
      clauses.push({
        deck: entry.deck,
        card: entry.def.name,
        inputName: entry.inputName,
        quantity: entry.quantity,
        source: entry.source,
        faceIndex: line.faceIndex,
        clauseIndex,
        shape: line.shape,
        clause: normalizeWhitespace(line.text),
        status: coverage.status,
        demands: demands.map((demand) => demand.id),
        demandReadWrite: demands.map(formatDemand),
        modelTags,
        coveredDemands: coverage.covered,
        missingDemands: coverage.missing,
        candidateCategories: coverage.categories,
        primaryCandidateCategory: coverage.categories[0],
      });
    }
  }
  return clauses;
}

function blindDemandsForLine(line: AbilityLine): Demand[] {
  const demands = new Map<string, Demand>();
  const text = normalizeWhitespace(line.text);
  const lower = text.toLowerCase();
  const withoutReminder = stripParenthetical(text);
  const withoutQuoted = stripQuoted(withoutReminder);
  const rulesText = normalizeWhitespace(withoutQuoted);
  const beforeColon = text.includes(':') ? text.slice(0, text.indexOf(':')) : '';

  if (line.shape === 'keyword') {
    addDemand(demands, 'printed:ability', 'read/write printed ability keyword', text);
  }
  if (line.shape === 'activated') {
    addDemand(demands, 'cost:activation', 'read activation cost and write stack/ability payment', text);
  }
  if (line.shape === 'replacement') {
    addDemand(demands, 'replacement', 'read would-event and write replacement result', text);
  }
  if (line.shape === 'delayed-triggered' || /\bthe next (?:end step|upkeep|turn)\b/iu.test(text)) {
    addDemand(demands, 'delayed-trigger', 'read future juncture and write delayed trigger subscription', text);
  }

  addLayerDemands(demands, rulesText);
  addTriggerDemands(demands, rulesText, line.shape);
  addZoneAndPlayerDemands(demands, rulesText);
  addTimingDemands(demands, rulesText);
  addEffectDemands(demands, rulesText, beforeColon, lower);

  return [...demands.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function addLayerDemands(demands: Map<string, Demand>, text: string): void {
  if (/\b(?:create|creates|created)\b[^.]*\btokens?\b[^.]*\bcopy of\b/iu.test(text)) {
    addDemand(demands, 'copy:one-shot', 'write token/copy object characteristics', text);
  } else if (/\bcopy of\b/iu.test(text)) {
    addDemand(demands, 'layer:L1a', 'read source copy values; write copyable values', text);
  }
  if (/\bface down\b/iu.test(text)) {
    addDemand(demands, 'layer:L1b', 'write face-down base characteristics', text);
  }
  if (/\bgain(?:s|ed|ing)? control of\b|\bexchange control of\b|\byou control (?:enchanted|equipped|target)\b/iu.test(text)) {
    addDemand(demands, 'layer:L2', 'read/write controller', text);
    addDemand(demands, 'ownership:controller', 'read/write controller identity', text);
  }
  if (/\b(?:change the text|text\b[^.]*\bbecomes?|replace all instances)\b/iu.test(text)) {
    addDemand(demands, 'layer:L3', 'read/write rules text', text);
  }
  if (
    /\b(?:is|are|becomes?|become|isn't|are not|is not)\b[^.]*\b(?:artifact|battle|creature|enchantment|instant|kindred|land|planeswalker|sorcery|Aura|Equipment|Vehicle|Saga|Role|Mountain|Forest|Island|Plains|Swamp|Treasure|Clue|Food)\b/iu.test(
      text,
    ) ||
    /\bin addition to (?:its|their) other types\b/iu.test(text)
  ) {
    addDemand(demands, 'layer:L4', 'read/write card types, subtypes, or supertypes', text);
  }
  if (/\b(?:is|are|becomes?|become)\b[^.]*\b(?:white|blue|black|red|green|colorless|all colors)\b/iu.test(text)) {
    addDemand(demands, 'layer:L5', 'read/write colors', text);
  }
  if (
    /\b(?:have|has|gain|gains|lose|loses|lost|losing)\b[^.]*\b(?:abilit(?:y|ies)|flying|haste|vigilance|trample|lifelink|deathtouch|menace|hexproof|indestructible|first strike|double strike|ward|reach|flash)\b/iu.test(
      text,
    ) ||
    /\bcan't have or gain\b/iu.test(text) ||
    /\bkeyword counters?\b/iu.test(text)
  ) {
    addDemand(demands, 'layer:L6', 'read/write ability and keyword set', text);
  }
  if (/\b(?:power|toughness)\b[^.]*\bequal to\b/iu.test(text)) {
    addDemand(demands, 'layer:L7a', 'read dynamic count; write characteristic-defining power/toughness', text);
    addDemand(demands, 'cda', 'read all-zone static definition; write characteristic definition', text);
  }
  if (/\bbase power and toughness\b|\bbecomes?\s+(?:a|an)?\s*[+-]?(?:\d+|X|\*)\/[+-]?(?:\d+|X|\*)\b/iu.test(text)) {
    addDemand(demands, 'layer:L7b', 'write base power/toughness setting', text);
  }
  if (/\bgets?\s+[+-](?:\d+|X|\*)\/[+-]?(?:\d+|X|\*)\b|[+-](?:\d+|X)\/[+-]?(?:\d+|X)\s+counters?\b|\bdouble(?:s|d)?\s+(?:the\s+)?power and toughness\b/iu.test(text)) {
    addDemand(demands, 'layer:L7c', 'read/write power/toughness modifiers or +1/+1 counters', text);
  }
  if (/\bswitch\b[^.]*\bpower and toughness\b/iu.test(text)) {
    addDemand(demands, 'layer:L7d', 'read/write switched power/toughness', text);
  }
}

function addTriggerDemands(
  demands: Map<string, Demand>,
  text: string,
  shape: AbilityLine['shape'],
): void {
  const isTrigger = shape === 'triggered' || shape === 'delayed-triggered' || /^(?:When|Whenever|At)\b/iu.test(text);
  if (!isTrigger) {
    return;
  }
  if (/\benters?\b|onto the battlefield/iu.test(text)) {
    addDemand(demands, 'event:enters', 'read battlefield entry event; write trigger subscription', text);
  }
  if (/\bdies\b|\bdie\b/iu.test(text)) {
    addDemand(demands, 'event:dies', 'read battlefield-to-graveyard creature event', text);
  }
  if (/\bleaves? the battlefield\b/iu.test(text)) {
    addDemand(demands, 'event:leaves', 'read leaves-the-battlefield event', text);
  }
  if (/\b(?:is|are) (?:put|exiled|returned)|\bmills?\b/iu.test(text)) {
    addDemand(demands, 'event:zone', 'read non-ETB zone movement event', text);
  }
  if (/\bcasts?\b[^.]*\bspells?\b/iu.test(text)) {
    addDemand(demands, 'event:cast', 'read cast event', text);
  }
  if (/\battacks?\b|\bis attacked\b/iu.test(text)) {
    addDemand(demands, 'event:attacks', 'read attack declaration event', text);
  }
  if (/\bblocks?\b|\bbecomes blocked\b/iu.test(text)) {
    addDemand(demands, 'event:blocks', 'read block event', text);
  }
  if (/\bdeals?\b[^.]*\bdamage\b|\bis dealt\b[^.]*\bdamage\b/iu.test(text)) {
    addDemand(demands, 'event:damage', 'read damage event', text);
  }
  if (/\bdraws?\b[^.]*\bcards?\b/iu.test(text)) {
    addDemand(demands, 'event:draw', 'read draw event', text);
  }
  if (/\bdiscards?\b/iu.test(text)) {
    addDemand(demands, 'event:discard', 'read discard event', text);
  }
  if (/\bsacrifices?\b/iu.test(text)) {
    addDemand(demands, 'event:sacrifice', 'read sacrifice event', text);
  }
  if (/\bbecomes? tapped\b|\bbecomes? untapped\b/iu.test(text)) {
    addDemand(demands, 'event:tap', 'read tapped-state transition event', text);
  }
  if (/\bcounters?\b[^.]*\b(?:put|placed)\b|\b(?:put|placed)\b[^.]*\bcounters?\b/iu.test(text)) {
    addDemand(demands, 'event:counter', 'read counter placement event', text);
  }
  if (/\bgains?\b[^.]*\blife\b|\bloses?\b[^.]*\blife\b/iu.test(text)) {
    addDemand(demands, 'event:life', 'read life total change event', text);
  }
  if (/\bat the beginning of\b/iu.test(text)) {
    addDemand(demands, 'event:phase', 'read phase/step juncture event', text);
  }
  if (/,\s*if\b/iu.test(text)) {
    addDemand(demands, 'event:intervening-if', 'read trigger-time and resolution-time condition', text);
  }
  if ([...demands.keys()].filter((id) => id.startsWith('event:')).length === 0) {
    addDemand(demands, 'event:other', 'read trigger condition outside current event vocabulary', text);
  }
}

function addZoneAndPlayerDemands(demands: Map<string, Demand>, text: string): void {
  if (/\blibrar(?:y|ies)\b|\bsearch\b|\bshuffle\b|\bscry\b|\bsurveil\b|\bmill\b|\bdraw\b/iu.test(text)) {
    addDemand(demands, 'zone:library', 'read/write library zone', text);
  }
  if (/\bhands?\b|\bdraw\b|\bdiscard\b|\breturn\b[^.]*\bto\b[^.]*\bhand\b/iu.test(text)) {
    addDemand(demands, 'zone:hand', 'read/write hand zone', text);
  }
  if (/\bgraveyards?\b|\bdies\b|\bdie\b|\bdestroy\b|\bdiscard\b|\bmill\b|\bsacrifice\b/iu.test(text)) {
    addDemand(demands, 'zone:graveyard', 'read/write graveyard zone', text);
  }
  if (/\bbattlefields?\b|\benters?\b|\bonto the battlefield\b|\bdestroy\b|\bsacrifice\b|\bcreate\b[^.]*\btokens?\b|\btarget permanent\b/iu.test(text)) {
    addDemand(demands, 'zone:battlefield', 'read/write battlefield zone', text);
  }
  if (/\bexil(?:e|es|ed|ing)\b/iu.test(text)) {
    addDemand(demands, 'zone:exile', 'read/write exile zone', text);
  }
  if (/\bcommand zone\b/iu.test(text)) {
    addDemand(demands, 'zone:command', 'read/write command zone', text);
  }
  if (/\b(?:the )?stack\b|\bcounter(?:s|ed|ing)?\b[^.]*\btarget\b[^.]*\bspells?\b/iu.test(text)) {
    addDemand(demands, 'zone:stack', 'read/write stack zone', text);
  }
  if (
    /\b(?:opponent|opponents|each player|target player|that player|each other player)\b[^.]*\b(?:their|his or her|that player's|opponent's|opponents')\s+(?:hand|graveyard|library)\b/iu.test(
      text,
    ) ||
    /\b(?:target player|each player|each opponent|an opponent|opponents)\b[^.]*\b(?:draws?|discards?)\b/iu.test(text)
  ) {
    addDemand(demands, 'zone-cross', 'read/write non-you player zone', text);
  }
  if (/\byou\b|\byour\b|\byours\b/iu.test(text) || /^(?:draw|discard|search|create)\b/iu.test(text)) {
    addDemand(demands, 'player-scope:you', 'read/write self player scope', text);
  }
  if (/\btarget (?:player|opponent)\b/iu.test(text)) {
    addDemand(demands, 'player-scope:target-player', 'read/write target player scope', text);
  }
  if (/\b(?:an|each|target) opponent\b|\bopponents\b|\beach of your opponents\b/iu.test(text)) {
    addDemand(demands, 'player-scope:each-opponent', 'read/write opponent player scope', text);
  }
  if (/\b(?:each|a|each other) player\b/iu.test(text)) {
    addDemand(demands, 'player-scope:each-player', 'read/write all-player scope', text);
  }
  if (/\bowners?\b|owner['’]s|owners['’]|\bowns?\b|\bowned\b/iu.test(text)) {
    addDemand(demands, 'ownership:owner', 'read owner identity', text);
    addDemand(demands, 'player-scope:owner', 'read owner player scope', text);
  }
  if (/\bcontrol(?:s|led|ling)?\b|\bcontrollers?\b/iu.test(text)) {
    addDemand(demands, 'ownership:controller', 'read/write controller identity', text);
  }
  if (/\b(?:its|their) controller\b|\bcontrollers?\b/iu.test(text)) {
    addDemand(demands, 'player-scope:controller', 'read controller player scope', text);
  }
}

function addTimingDemands(demands: Map<string, Demand>, text: string): void {
  const timingTags: readonly [RegExp, string, string][] = [
    [/\buntap step\b/iu, 'timing:untap', 'read untap step juncture'],
    [/\bupkeep\b/iu, 'timing:upkeep', 'read upkeep juncture'],
    [/\bdraw step\b/iu, 'timing:draw', 'read draw step juncture'],
    [/\b(?:first|precombat) main phase\b/iu, 'timing:main-precombat', 'read precombat main phase'],
    [/\b(?:second|postcombat) main phase\b/iu, 'timing:main-postcombat', 'read postcombat main phase'],
    [/\bbeginning of combat\b|\beach combat\b|\bthat combat\b/iu, 'timing:begin-combat', 'read beginning of combat step'],
    [/\bdeclare attackers step\b/iu, 'timing:declare-attackers', 'read declare attackers step'],
    [/\bdeclare blockers step\b/iu, 'timing:declare-blockers', 'read declare blockers step'],
    [/\bend of combat step\b/iu, 'timing:end-combat', 'read end of combat step'],
    [/\bend step\b/iu, 'timing:end-step', 'read end step'],
    [/\bcleanup step\b/iu, 'timing:cleanup', 'read cleanup step'],
  ];
  for (const [probe, id, readWrite] of timingTags) {
    if (probe.test(text)) {
      addDemand(demands, id, readWrite, text);
    }
  }
  if (/\bflash\b|\bas though\b[^.]*\bhad flash\b|\bany time you could cast an instant\b/iu.test(text)) {
    addDemand(demands, 'cast-timing:flash', 'read/write instant-speed cast timing permission', text);
  }
  if (/\bonly as a sorcery\b|\bany time you could cast a sorcery\b|\bonly during your main phase\b/iu.test(text)) {
    addDemand(demands, 'cast-timing:sorcery-speed', 'read sorcery-speed timing window', text);
  }
  if (/\bonly during combat\b|\bduring combat on your turn\b/iu.test(text)) {
    addDemand(demands, 'cast-timing:combat-only', 'read combat-only timing window', text);
  }
  if (/\bonly during your turn\b|\bduring combat on your turn\b/iu.test(text)) {
    addDemand(demands, 'cast-timing:your-turn-only', 'read active-player turn timing window', text);
  }
  if (/\bonce each turn\b|\bonly once (?:each|per) turn\b/iu.test(text)) {
    addDemand(demands, 'cast-timing:once-per-turn', 'read/write per-turn activation counter', text);
  }
  if (/\beach opponent can cast\b[^.]*\bonly any time\b/iu.test(text)) {
    addDemand(demands, 'cast-timing:imposed-on-others', 'read/write timing restriction imposed on opponents', text);
  }
}

function addEffectDemands(
  demands: Map<string, Demand>,
  text: string,
  beforeColon: string,
  lower: string,
): void {
  if (/\btarget\b/iu.test(text)) {
    addDemand(demands, 'target:object-or-player', 'read/write target binding', text);
  }
  if (/\bchoose (?:one|two|three|four|one or more|up to|a|an)\b|(?:^|\s)•/iu.test(text)) {
    addDemand(demands, 'choice:mode-or-value', 'read/write player choice or modal branch', text);
  }
  if (/\badd(?:s|ed)?\b(?=[^.]*?(?:\{[WUBRGC]\}|\bmana\b))/iu.test(text)) {
    addDemand(demands, 'mana:write', 'write mana pool', text);
  }
  if (/\{T\}|tap (?:this|an|another|target)|\btapped\b/iu.test(beforeColon)) {
    addDemand(demands, 'cost:tap', 'read/write tapped state as a cost', text);
  }
  if (/\b(?:sacrifice|discard|pay|exile)\b/iu.test(beforeColon)) {
    addDemand(demands, 'cost:nonmana', 'read/write non-mana cost payment', text);
  }
  if (/\bcreate(?:s|d)?\b[^.]*\btokens?\b/iu.test(text)) {
    addDemand(demands, 'token:create', 'write token object and battlefield membership', text);
  }
  if (/\bdraw(?:s|n|ing)?\b[^.]*\bcards?\b|\bdraw a card\b/iu.test(text)) {
    addDemand(demands, 'action:draw', 'move card from library to hand and emit draw event', text);
  }
  if (/\bdiscard(?:s|ed|ing)?\b/iu.test(text)) {
    addDemand(demands, 'action:discard', 'move card from hand to graveyard and emit discard event', text);
  }
  if (/\bdestroy(?:s|ed|ing)?\b/iu.test(text)) {
    addDemand(demands, 'action:destroy', 'move permanent from battlefield to owner graveyard', text);
  }
  if (/\bexil(?:e|es|ed|ing)\b/iu.test(text)) {
    addDemand(demands, 'action:exile', 'move object to exile', text);
  }
  if (/\breturn(?:s|ed|ing)?\b/iu.test(text)) {
    addDemand(demands, 'action:return', 'move object to referenced zone', text);
  }
  if (/\bsacrifice(?:s|d|ing)?\b/iu.test(text)) {
    addDemand(demands, 'action:sacrifice', 'move sacrificed permanent to owner graveyard', text);
  }
  if (/\bcounter(?:s|ed|ing)?\b[^.]*\btarget\b[^.]*\bspells?\b/iu.test(text)) {
    addDemand(demands, 'action:counter-spell', 'move spell off stack to graveyard/countered result', text);
  }
  if (/\bsearch(?:es|ed|ing)?\b/iu.test(text)) {
    addDemand(demands, 'action:search', 'read library search and write selected card movement', text);
  }
  if (/\breveal(?:s|ed|ing)?\b/iu.test(text)) {
    addDemand(demands, 'action:reveal', 'write public information reveal state', text);
  }
  if (/\bshuffle(?:s|d|ing)?\b/iu.test(text)) {
    addDemand(demands, 'action:shuffle', 'write randomized library order', text);
  }
  if (/\bscry(?:s|ed|ing)?\b/iu.test(text)) {
    addDemand(demands, 'action:scry', 'read/write top-library selection and order', text);
  }
  if (/\bsurveil(?:s|ed|ing)?\b/iu.test(text)) {
    addDemand(demands, 'action:surveil', 'read/write top-library and graveyard movement choice', text);
  }
  if (/\bmill(?:s|ed|ing)?\b/iu.test(text)) {
    addDemand(demands, 'action:mill', 'move cards from library to graveyard', text);
  }
  if (/\bdeals?\b[^.]*\bdamage\b|\bdamage to\b/iu.test(text)) {
    addDemand(demands, 'damage:write', 'write damage event, marked damage, or player life loss', text);
  }
  if (/\bgain(?:s|ed|ing)?\b[^.]*\blife\b|\blose(?:s|t|ing)?\b[^.]*\blife\b/iu.test(text)) {
    addDemand(demands, 'life:write', 'write player life total', text);
  }
  if (/\bput\b[^.]*\bcounters?\b|\bcounters?\b[^.]*\b(?:put|placed|move|remove|double)\b/iu.test(text)) {
    addDemand(demands, 'counter:write', 'read/write counters on players or objects', text);
  }
  if (/\bloyalty counter\b/iu.test(text)) {
    addDemand(demands, 'counter:loyalty', 'read/write loyalty counters', text);
  }
  if (/\b(?:tap|taps|tapped|tapping)\b/iu.test(text) && !lower.includes('becomes tapped')) {
    addDemand(demands, 'tap-state:write', 'read/write tapped state', text);
  }
  if (/\buntap(?:s|ped|ping)?\b/iu.test(text) && !lower.includes('becomes untapped')) {
    addDemand(demands, 'tap-state:write', 'read/write tapped state', text);
  }
  if (/\battach(?:es|ed|ing)?\b|\bequip\b|\benchant\b/iu.test(text)) {
    addDemand(demands, 'attachment:write', 'read/write attachment relationship', text);
  }
  if (/\btransform(?:s|ed|ing)?\b/iu.test(text)) {
    addDemand(demands, 'transform:write', 'write face/transformed state', text);
  }
  if (/\bextra (?:turn|combat phase|phase)\b/iu.test(text)) {
    addDemand(demands, 'turn:extra', 'write extra turn/phase schedule', text);
  }
  if (/\b(?:win|wins|lose|loses) the game\b|\bcan't lose the game\b|\bcan't win the game\b/iu.test(text)) {
    addDemand(demands, 'win-lose:write', 'read/write game result restriction or result', text);
  }
  if (/\bprevent\b[^.]*\bdamage\b/iu.test(text)) {
    addDemand(demands, 'prevention', 'read damage event and write prevention replacement', text);
  }
  if (/\bwould\b[^.]*\binstead\b/iu.test(text)) {
    addDemand(demands, 'replacement', 'read would-event and write replacement result', text);
  }
  if (/\bthat (?:card|creature|permanent|spell|token)\b|\bthe exiled card\b|\bthe sacrificed\b/iu.test(text)) {
    addDemand(demands, 'object-identity:lki', 'read prior object identity or last-known information', text);
  }
  if (/\b(?:cast|play)\b[^.]*\bfrom (?:your |an opponent's |a )?(?:graveyard|exile|library)\b/iu.test(text)) {
    addDemand(demands, 'cast-permission:from-zone', 'read non-hand zone and write permission to cast/play', text);
  }
}

function modelTagsForLine(line: AbilityLine, def: CardDef): string[] {
  const tags = new Set<string>();
  if (line.shape === 'keyword') {
    tags.add('printed:ability');
  }
  for (const tag of classifyContinuousLayers(line, def)) {
    tags.add(`layer:${tag.layer}`);
    if (tag.cda) {
      tags.add('cda');
    }
  }
  for (const tag of classifyEventsForLine(line, def)) {
    tags.add(`event:${tag.family}`);
    tags.add(`event-observer:${tag.observer}`);
    if (tag.interveningIf) {
      tags.add('event:intervening-if');
    }
  }
  const zoneSummary = classifyZonesForLine(line);
  for (const zone of zoneSummary.zones) {
    tags.add(`zone:${zone}`);
  }
  if (zoneSummary.crossPlayer) {
    tags.add('zone-cross');
  }
  addOwnershipTags(tags, zoneSummary.ownership);
  for (const scope of zoneSummary.playerScopes) {
    tags.add(`player-scope:${scope}`);
  }
  const timingSummary = classifyTimingForLine(line);
  for (const step of timingSummary.junctures) {
    tags.add(`timing:${step}`);
  }
  for (const scope of timingSummary.junctureScope) {
    tags.add(`timing-scope:${scope}`);
  }
  for (const timing of timingSummary.castTiming) {
    if (timing !== 'none') {
      tags.add(`cast-timing:${timing}`);
    }
  }
  return [...tags].sort();
}

function addOwnershipTags(tags: Set<string>, ownership: OwnershipKind): void {
  if (ownership === 'owner' || ownership === 'both') {
    tags.add('ownership:owner');
  }
  if (ownership === 'controller' || ownership === 'both') {
    tags.add('ownership:controller');
  }
}

// KNOWN GAP (see research/cr-grounding/planned-sequence-batch4.draft.md item 3):
// modelTags only comes from event/zone/layer/timing classifiers, so cost:*/action:*/
// mana:*/tap-state:*/damage:*/life:*/counter:*/target:*/token:* demands are always
// reported missing regardless of whether src/engine/grammar/compile.ts already
// implements them (e.g. Sol Ring/Signets flagged as gaps despite full support).
// Do not treat those categories' "missing" counts as accurate until fixed.
function compareDemands(
  demands: readonly Demand[],
  modelTags: readonly string[],
): { status: CoverageStatus; covered: string[]; missing: string[]; categories: GapCategory[] } {
  const modelTagSet = new Set(modelTags.filter((tag) => !MODEL_IGNORED_TAGS.has(tag)));
  const covered: string[] = [];
  const missing: string[] = [];
  for (const demand of demands) {
    if (modelTagSet.has(demand.id)) {
      covered.push(demand.id);
    } else {
      missing.push(demand.id);
    }
  }
  const categories = unique(missing.map(categoryForDemand));
  const status =
    missing.length === 0 ? 'complete' : covered.length > 0 ? 'partial' : 'gap';
  return { status, covered, missing, categories };
}

function categoryForDemand(demandId: string): GapCategory {
  if (
    demandId === 'replacement' ||
    demandId === 'prevention' ||
    demandId === 'delayed-trigger' ||
    demandId === 'object-identity:lki' ||
    demandId === 'copy:one-shot' ||
    demandId === 'cast-permission:from-zone' ||
    demandId === 'cast-timing:imposed-on-others'
  ) {
    return 'scope境界(既知defer)';
  }
  if (
    demandId === 'event:other' ||
    demandId.endsWith(':unknown') ||
    demandId.startsWith('ambiguous:')
  ) {
    return '曖昧';
  }
  if (
    demandId.startsWith('layer:') ||
    demandId === 'cda' ||
    demandId.startsWith('event:') ||
    demandId.startsWith('zone:') ||
    demandId === 'zone-cross' ||
    demandId.startsWith('ownership:') ||
    demandId.startsWith('player-scope:') ||
    demandId.startsWith('timing:') ||
    demandId.startsWith('cast-timing:')
  ) {
    return 'catalog未写';
  }
  if (
    demandId.startsWith('action:') ||
    demandId.startsWith('counter:') ||
    demandId.startsWith('life:') ||
    demandId.startsWith('tap-state:')
  ) {
    return 'catalog未写';
  }
  return 'substrate不足';
}

function buildGapRows(clauses: readonly ClauseScore[]): GapRow[] {
  return clauses
    .filter((clause) => clause.status !== 'complete')
    .map((clause) => ({
      deck: clause.deck,
      card: clause.card,
      inputName: clause.inputName,
      quantity: clause.quantity,
      source: clause.source,
      faceIndex: clause.faceIndex,
      clauseIndex: clause.clauseIndex,
      shape: clause.shape,
      clauseExcerpt: excerpt(clause.clause),
      requiredReadWrite: clause.demandReadWrite,
      modelTags: clause.modelTags,
      catalogJudgement: clause.status,
      missingReadWrite: clause.missingDemands,
      candidateCategories: clause.candidateCategories,
      primaryCandidateCategory: clause.primaryCandidateCategory ?? '曖昧',
    }));
}

function buildAllMetrics(
  entries: readonly DeckEntry[],
  resolved: readonly ResolvedEntry[],
  unresolved: readonly UnresolvedEntry[],
  clauses: readonly ClauseScore[],
): DeckMetrics[] {
  const perDeck = DECKS.map((deck) =>
    buildMetrics(deck.id, entries, resolved, unresolved, clauses),
  );
  return [buildMetrics('ALL', entries, resolved, unresolved, clauses), ...perDeck];
}

function buildMetrics(
  deck: DeckId | 'ALL',
  entries: readonly DeckEntry[],
  resolved: readonly ResolvedEntry[],
  unresolved: readonly UnresolvedEntry[],
  clauses: readonly ClauseScore[],
): DeckMetrics {
  const entryFilter = (entry: DeckEntry): boolean => deck === 'ALL' || entry.deck === deck;
  const clauseFilter = (clause: ClauseScore): boolean => deck === 'ALL' || clause.deck === deck;
  const selectedEntries = entries.filter(entryFilter);
  const selectedClauses = clauses.filter(clauseFilter);
  const completeClauses = selectedClauses.filter((clause) => clause.status === 'complete').length;
  const partialClauses = selectedClauses.filter((clause) => clause.status === 'partial').length;
  const gapClauses = selectedClauses.filter((clause) => clause.status === 'gap').length;
  const demandCount = selectedClauses.reduce((sum, clause) => sum + clause.demands.length, 0);
  const coveredDemandCount = selectedClauses.reduce(
    (sum, clause) => sum + clause.coveredDemands.length,
    0,
  );
  return {
    deck,
    deckListEntries: selectedEntries.length,
    deckQuantity: selectedEntries.reduce((sum, entry) => sum + entry.quantity, 0),
    resolvedEntries: resolved.filter(entryFilter).length,
    unresolvedEntries: unresolved.filter(entryFilter).length,
    scoredClauses: selectedClauses.length,
    completeClauses,
    partialClauses,
    gapClauses,
    completeRate: rate(completeClauses, selectedClauses.length),
    partialRate: rate(partialClauses, selectedClauses.length),
    gapRate: rate(gapClauses, selectedClauses.length),
    demandCount,
    coveredDemandCount,
    demandCoverageRate: rate(coveredDemandCount, demandCount),
  };
}

function countCategories(gaps: readonly GapRow[]): Record<GapCategory, number> {
  const counts = emptyCategoryCounts();
  for (const gap of gaps) {
    counts[gap.primaryCandidateCategory] += 1;
  }
  return counts;
}

function countMissingDemands(gaps: readonly GapRow[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const gap of gaps) {
    for (const demand of gap.missingReadWrite) {
      counts.set(demand, (counts.get(demand) ?? 0) + 1);
    }
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function renderSummary(output: ScoreOutput): string {
  const overall = requiredMetric(output, 'ALL');
  const topCategories = sortedObjectEntries(output.categoryCounts)
    .filter(([, count]) => count > 0)
    .slice(0, TOP_LIMIT);
  const topDemands = sortedObjectEntries(output.missingDemandCounts).slice(0, TOP_LIMIT);
  const unresolvedLines = output.unresolved.map(
    (entry) => `- ${entry.deck}:${entry.line} ${entry.quantity} ${entry.inputName} — ${entry.reason}`,
  );

  return [
    '# MyDeck 設計採点サマリ',
    '',
    `Generated: ${output.generatedAt}`,
    '',
    '## 再実行',
    '',
    '`npx tsx scripts/mydeck-scoring/score.ts`',
    '',
    '## 入力と前提',
    '',
    `- local snapshot: \`${output.inputSnapshotPath}\``,
    `- optional fallback file: \`${output.optionalFallbackPath}\` (存在すれば snapshot 後に読む)`,
    '- oracleText は英語 Scryfall データのみを使用。printedText は使わない。',
    '- 盲列挙はこのスクリプト内の demand probe、モデル照合は既存 layer/event/zone/timing classifier を使用。',
    '',
    '## KPI',
    '',
    renderMetricsTable(output.metrics),
    '',
    `Overall demand coverage: **${formatPercent(overall.demandCoverageRate)}** (${overall.coveredDemandCount}/${overall.demandCount})`,
    `Unresolved entries: **${overall.unresolvedEntries}**`,
    '',
    '## ギャップ候補カテゴリ',
    '',
    renderCountTable(['candidate category', 'gap rows'], topCategories),
    '',
    '## Missing read/write top',
    '',
    renderCountTable(['missing demand', 'occurrences'], topDemands),
    '',
    '## Unresolved',
    '',
    unresolvedLines.length > 0 ? unresolvedLines.join('\n') : '- none',
    '',
    '## 代表ギャップ',
    '',
    renderGapExamples(output.gaps.slice(0, EXAMPLE_LIMIT)),
    '',
    '## 注意',
    '',
    '低被覆は失敗判定ではない。未写像の分布を Slice3/4 以後の下面入力として使うための M0 採点である。',
    '',
  ].join('\n');
}

function renderDeckSummary(deck: DeckId, output: ScoreOutput): string {
  const metric = requiredMetric(output, deck);
  const deckGaps = output.gaps.filter((gap) => gap.deck === deck);
  const deckUnresolved = output.unresolved.filter((entry) => entry.deck === deck);
  const categories = countCategories(deckGaps);
  const demands = countMissingDemands(deckGaps);
  return [
    `# ${deck} MyDeck 採点`,
    '',
    '## KPI',
    '',
    renderMetricsTable([metric]),
    '',
    `Demand coverage: **${formatPercent(metric.demandCoverageRate)}** (${metric.coveredDemandCount}/${metric.demandCount})`,
    '',
    '## ギャップ候補カテゴリ top',
    '',
    renderCountTable(
      ['candidate category', 'gap rows'],
      sortedObjectEntries(categories).filter(([, count]) => count > 0).slice(0, TOP_LIMIT),
    ),
    '',
    '## Missing read/write top',
    '',
    renderCountTable(['missing demand', 'occurrences'], sortedObjectEntries(demands).slice(0, TOP_LIMIT)),
    '',
    '## 代表ギャップ',
    '',
    renderGapExamples(deckGaps.slice(0, EXAMPLE_LIMIT)),
    '',
    '## Unresolved',
    '',
    deckUnresolved.length > 0
      ? deckUnresolved
          .map((entry) => `- line ${entry.line}: ${entry.quantity} ${entry.inputName} — ${entry.reason}`)
          .join('\n')
      : '- none',
    '',
  ].join('\n');
}

function renderMetricsTable(metrics: readonly DeckMetrics[]): string {
  const rows = metrics.map((metric) =>
    [
      metric.deck,
      String(metric.deckListEntries),
      String(metric.resolvedEntries),
      String(metric.unresolvedEntries),
      String(metric.scoredClauses),
      `${metric.completeClauses} (${formatPercent(metric.completeRate)})`,
      `${metric.partialClauses} (${formatPercent(metric.partialRate)})`,
      `${metric.gapClauses} (${formatPercent(metric.gapRate)})`,
      formatPercent(metric.demandCoverageRate),
    ].join(' | '),
  );
  return [
    '| deck | entries | resolved | unresolved | scored clauses | complete | partial | gap | demand coverage |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...rows.map((row) => `| ${row} |`),
  ].join('\n');
}

function renderCountTable(headers: readonly [string, string], rows: readonly [string, number][]): string {
  if (rows.length === 0) {
    return '- none';
  }
  return [
    `| ${headers[0]} | ${headers[1]} |`,
    '|---|---:|',
    ...rows.map(([label, count]) => `| \`${label}\` | ${count} |`),
  ].join('\n');
}

function renderGapExamples(gaps: readonly GapRow[]): string {
  if (gaps.length === 0) {
    return '- none';
  }
  return gaps
    .map(
      (gap) =>
        `- ${gap.deck} / ${gap.card}: ${gap.catalogJudgement} / ${gap.primaryCandidateCategory} / missing ${gap.missingReadWrite.map((item) => `\`${item}\``).join(', ')} — "${gap.clauseExcerpt}"`,
    )
    .join('\n');
}

function requiredMetric(output: ScoreOutput, deck: DeckId | 'ALL'): DeckMetrics {
  const metric = output.metrics.find((item) => item.deck === deck);
  if (!metric) {
    throw new Error(`Missing metric for ${deck}`);
  }
  return metric;
}

function formatDemand(demand: Demand): string {
  return `${demand.id}: ${demand.readWrite}`;
}

function addDemand(
  demands: Map<string, Demand>,
  id: string,
  readWrite: string,
  evidence: string,
): void {
  if (!demands.has(id)) {
    demands.set(id, { id, readWrite, evidence: excerpt(evidence) });
  }
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

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

function stripParenthetical(text: string): string {
  return text.replace(/\([^)]*\)/gu, ' ');
}

function stripQuoted(text: string): string {
  return text.replace(/"[^"]*"/gu, ' ').replace(/“[^”]*”/gu, ' ');
}

function excerpt(text: string): string {
  const normalized = normalizeWhitespace(text);
  return normalized.length <= 220 ? normalized : `${normalized.slice(0, 217)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function unique<T extends string>(items: readonly T[]): T[] {
  return [...new Set(items)].sort();
}

function emptyCategoryCounts(): Record<GapCategory, number> {
  return {
    substrate不足: 0,
    catalog未写: 0,
    'scope境界(既知defer)': 0,
    曖昧: 0,
    unresolved: 0,
  };
}

function sortedObjectEntries<T extends string>(record: Record<T, number>): [T, number][] {
  return Object.entries(record).sort((a, b) => {
    const countDelta = (b[1] as number) - (a[1] as number);
    return countDelta === 0 ? a[0].localeCompare(b[0]) : countDelta;
  }) as [T, number][];
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
