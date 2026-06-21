import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { classifyCardRules, compareRuleTagIds } from '../src/data/ruleClassifier';
import {
  mapScryfallCardToCardDef,
  type ScryfallCard,
} from '../src/data/scryfall';
import {
  KEYWORD_DEFINITIONS,
  possessedKeywords,
  type KeywordDefinition,
} from '../src/engine/keywordGrammar';
import type { CardDef } from '../src/types/card';

const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const REPORT_MD_PATH = resolve(process.cwd(), 'research/classifier-accuracy/report.md');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/classifier-accuracy/report.json');
const TOP_CASE_LIMIT = 20;

const NOTE =
  'この数値は未調整(Scryfall keywords は候補集合であり絶対正解でない)。';

const EVERGREEN_KEYWORD_IDS = new Set([
  'deathtouch',
  'defender',
  'double-strike',
  'enchant',
  'equip',
  'first-strike',
  'flash',
  'flying',
  'haste',
  'hexproof',
  'indestructible',
  'lifelink',
  'menace',
  'protection',
  'reach',
  'trample',
  'vigilance',
  'ward',
]);

const TYPE_BUCKETS = [
  { id: 'creature', label: 'Creature', pattern: /\bCreature\b/ },
  { id: 'land', label: 'Land', pattern: /\bLand\b/ },
  { id: 'artifact', label: 'Artifact', pattern: /\bArtifact\b/ },
  { id: 'enchantment', label: 'Enchantment', pattern: /\bEnchantment\b/ },
  { id: 'instant', label: 'Instant', pattern: /\bInstant\b/ },
  { id: 'sorcery', label: 'Sorcery', pattern: /\bSorcery\b/ },
  { id: 'planeswalker', label: 'Planeswalker', pattern: /\bPlaneswalker\b/ },
  { id: 'battle', label: 'Battle', pattern: /\bBattle\b/ },
] as const;

interface CountItem {
  id: string;
  label: string;
  count: number;
}

interface KeywordSummaryItem {
  id: string;
  label: string;
  classifierCount: number;
  scryfallCount: number;
  fpCandidateCount: number;
  fnCandidateCount: number;
}

interface KeywordCase {
  kind: 'classifier-only' | 'scryfall-only';
  keywordId: string;
  label: string;
  cardName: string;
  oracleId: string;
  scryfallId: string;
  oracleSnippet: string;
  classifierKeywords: string[];
  scryfallKeywords: string[];
  rawScryfallKeywords: string[];
}

interface TriggerFamilySummaryItem {
  familyId: string;
  tagId: string;
  label: string;
  classifierCount: number;
  probeCount: number;
  fpCandidateCount: number;
  fnCandidateCount: number;
}

interface TriggerFamilyProbe {
  familyId: string;
  tagId: string;
  label: string;
  probe: RegExp;
}

interface TriggerFamilyProbeCase {
  kind: 'classifier-only' | 'probe-only';
  familyId: string;
  tagId: string;
  label: string;
  cardName: string;
  oracleId: string;
  scryfallId: string;
  oracleSnippet: string;
  classifierRuleTags: string[];
}

interface MappingFailure {
  index: number;
  cardName: string;
  reason: string;
}

interface ManaSummary {
  producedManaCardCount: number;
  classifierManaTagCardCount: number;
  producedManaColorCounts: CountItem[];
  classifierManaTagCounts: CountItem[];
}

interface TypeSummaryItem {
  id: string;
  label: string;
  count: number;
}

interface Totals {
  rawCards: number;
  mappedCards: number;
  mappingFailures: number;
  keywordFpCandidates: number;
  keywordFnCandidates: number;
  triggerFamilyFpCandidates: number;
  triggerFamilyFnCandidates: number;
}

const TRIGGER_FAMILY_PROBES: readonly TriggerFamilyProbe[] = [
  {
    familyId: 'end-step',
    tagId: 'trigger.end-step',
    label: 'エンドステップ開始時の誘発',
    probe: /\bend step\b/i,
  },
  {
    familyId: 'draw',
    tagId: 'trigger.draw',
    label: 'カードを引いたときの誘発',
    probe: /\bdraws?\b.*\bcards?\b/i,
  },
  {
    familyId: 'sacrifice',
    tagId: 'trigger.sacrifice',
    label: '生け贄に捧げたときの誘発',
    probe: /\bsacrifices?\b/i,
  },
  {
    familyId: 'combat-damage',
    tagId: 'trigger.combat-damage',
    label: '戦闘ダメージを与えたときの誘発',
    probe: /\bcombat damage\b/i,
  },
];

const keywordDefinitionsById = new Map(
  KEYWORD_DEFINITIONS.map((definition) => [definition.id, definition]),
);
const keywordOrderIndex = new Map(
  KEYWORD_DEFINITIONS.map((definition, index) => [definition.id, index]),
);
const keywordLookup = buildKeywordLookup(KEYWORD_DEFINITIONS);

async function main(): Promise<void> {
  const payload = await readJson(INPUT_PATH);
  const rawCards = extractRawCards(payload);

  const ruleTagCounts = new Map<string, number>();
  const ruleTagLabels = new Map<string, string>();
  const classifierKeywordCounts = new Map<string, number>();
  const scryfallKeywordCounts = new Map<string, number>();
  const keywordFpCounts = new Map<string, number>();
  const keywordFnCounts = new Map<string, number>();
  const keywordCases: KeywordCase[] = [];
  const triggerFamilyClassifierCounts = new Map<string, number>();
  const triggerFamilyProbeCounts = new Map<string, number>();
  const triggerFamilyFpCounts = new Map<string, number>();
  const triggerFamilyFnCounts = new Map<string, number>();
  const triggerFamilyProbeCases: TriggerFamilyProbeCase[] = [];
  const mappingFailures: MappingFailure[] = [];
  const producedManaColorCounts = new Map<string, number>();
  const classifierManaTagCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();

  let mappedCards = 0;
  let producedManaCardCount = 0;
  let classifierManaTagCardCount = 0;

  for (const [index, rawCard] of rawCards.entries()) {
    const fallbackName = readStringField(rawCard, 'name') ?? `(index ${index})`;
    const scryfallCard = coerceScryfallCard(rawCard);
    if (!scryfallCard) {
      mappingFailures.push({
        index,
        cardName: fallbackName,
        reason: 'Invalid Scryfall card shape',
      });
      continue;
    }

    let def: CardDef;
    try {
      def = mapScryfallCardToCardDef(scryfallCard);
    } catch (error: unknown) {
      mappingFailures.push({
        index,
        cardName: fallbackName,
        reason: errorMessage(error),
      });
      continue;
    }

    mappedCards += 1;

    const ruleTags = classifyCardRules(def);
    const ruleTagIds = uniqueSorted(
      ruleTags.map((tag) => tag.id),
      compareRuleTagIds,
    );
    const ruleTagSet = new Set(ruleTagIds);
    for (const tag of ruleTags) {
      increment(ruleTagCounts, tag.id);
      ruleTagLabels.set(tag.id, tag.label);
    }

    const manaTagIds = uniqueSorted(
      ruleTags.filter(isManaRelatedTag).map((tag) => tag.id),
      compareRuleTagIds,
    );
    if (manaTagIds.length > 0) {
      classifierManaTagCardCount += 1;
      for (const tagId of manaTagIds) {
        increment(classifierManaTagCounts, tagId);
      }
    }

    const producedMana = def.producedMana ?? [];
    if (producedMana.length > 0) {
      producedManaCardCount += 1;
      for (const color of producedMana) {
        increment(producedManaColorCounts, color);
      }
    }

    for (const bucket of TYPE_BUCKETS) {
      if (bucket.pattern.test(safeString(def.typeLine, ''))) {
        increment(typeCounts, bucket.id);
      }
    }

    const classifierKeywordIds = uniqueSorted(
      possessedKeywords(def).filter((keywordId) => EVERGREEN_KEYWORD_IDS.has(keywordId)),
      compareKeywordIds,
    );
    const scryfallKeywordIds = scryfallEvergreenKeywordIds(scryfallCard);
    for (const keywordId of classifierKeywordIds) {
      increment(classifierKeywordCounts, keywordId);
    }
    for (const keywordId of scryfallKeywordIds) {
      increment(scryfallKeywordCounts, keywordId);
    }

    const classifierKeywordSet = new Set(classifierKeywordIds);
    const scryfallKeywordSet = new Set(scryfallKeywordIds);
    const rawScryfallKeywords = stringArray(scryfallCard.keywords);
    const oracleSnippetText = oracleSnippet(def);
    const oracleProbeText = oracleFullText(def);
    const cardName = safeString(def.name, fallbackName);
    const oracleId = safeString(def.oracleId, safeString(scryfallCard.id, fallbackName));
    const scryfallId = safeString(def.scryfallId, safeString(scryfallCard.id, fallbackName));

    for (const family of TRIGGER_FAMILY_PROBES) {
      const hasClassifierTag = ruleTagSet.has(family.tagId);
      const hasProbeMatch = family.probe.test(oracleProbeText);
      if (hasClassifierTag) {
        increment(triggerFamilyClassifierCounts, family.tagId);
      }
      if (hasProbeMatch) {
        increment(triggerFamilyProbeCounts, family.tagId);
      }
      if (hasProbeMatch && !hasClassifierTag) {
        increment(triggerFamilyFnCounts, family.tagId);
        triggerFamilyProbeCases.push({
          kind: 'probe-only',
          familyId: family.familyId,
          tagId: family.tagId,
          label: family.label,
          cardName,
          oracleId,
          scryfallId,
          oracleSnippet: oracleSnippetText,
          classifierRuleTags: ruleTagIds,
        });
      }
      if (hasClassifierTag && !hasProbeMatch) {
        increment(triggerFamilyFpCounts, family.tagId);
        triggerFamilyProbeCases.push({
          kind: 'classifier-only',
          familyId: family.familyId,
          tagId: family.tagId,
          label: family.label,
          cardName,
          oracleId,
          scryfallId,
          oracleSnippet: oracleSnippetText,
          classifierRuleTags: ruleTagIds,
        });
      }
    }

    for (const keywordId of classifierKeywordIds) {
      if (scryfallKeywordSet.has(keywordId)) {
        continue;
      }
      increment(keywordFpCounts, keywordId);
      keywordCases.push({
        kind: 'classifier-only',
        keywordId,
        label: keywordLabel(keywordId),
        cardName,
        oracleId,
        scryfallId,
        oracleSnippet: oracleSnippetText,
        classifierKeywords: classifierKeywordIds,
        scryfallKeywords: scryfallKeywordIds,
        rawScryfallKeywords,
      });
    }

    for (const keywordId of scryfallKeywordIds) {
      if (classifierKeywordSet.has(keywordId)) {
        continue;
      }
      increment(keywordFnCounts, keywordId);
      keywordCases.push({
        kind: 'scryfall-only',
        keywordId,
        label: keywordLabel(keywordId),
        cardName,
        oracleId,
        scryfallId,
        oracleSnippet: oracleSnippetText,
        classifierKeywords: classifierKeywordIds,
        scryfallKeywords: scryfallKeywordIds,
        rawScryfallKeywords,
      });
    }
  }

  const keywordSummary = buildKeywordSummary(
    classifierKeywordCounts,
    scryfallKeywordCounts,
    keywordFpCounts,
    keywordFnCounts,
  );
  const tagCounts = buildRuleTagCounts(ruleTagCounts, ruleTagLabels);
  const manaSummary: ManaSummary = {
    producedManaCardCount,
    classifierManaTagCardCount,
    producedManaColorCounts: buildCountItems(
      producedManaColorCounts,
      (id) => id,
      (a, b) => a.id.localeCompare(b.id),
    ),
    classifierManaTagCounts: buildCountItems(
      classifierManaTagCounts,
      (id) => ruleTagLabels.get(id) ?? id,
      (a, b) => compareRuleTagIds(a.id, b.id),
    ),
  };
  const typeSummary = buildTypeSummary(typeCounts);
  const keywordFpCases = rankKeywordCases(
    keywordCases.filter((item) => item.kind === 'classifier-only'),
    keywordFpCounts,
  );
  const keywordFnCases = rankKeywordCases(
    keywordCases.filter((item) => item.kind === 'scryfall-only'),
    keywordFnCounts,
  );
  const triggerFamilySummary = buildTriggerFamilySummary(
    triggerFamilyClassifierCounts,
    triggerFamilyProbeCounts,
    triggerFamilyFpCounts,
    triggerFamilyFnCounts,
  );
  const triggerFamilyFpCases = rankTriggerFamilyCases(
    triggerFamilyProbeCases.filter((item) => item.kind === 'classifier-only'),
    triggerFamilyFpCounts,
  );
  const triggerFamilyFnCases = rankTriggerFamilyCases(
    triggerFamilyProbeCases.filter((item) => item.kind === 'probe-only'),
    triggerFamilyFnCounts,
  );
  const totals: Totals = {
    rawCards: rawCards.length,
    mappedCards,
    mappingFailures: mappingFailures.length,
    keywordFpCandidates: keywordFpCases.length,
    keywordFnCandidates: keywordFnCases.length,
    triggerFamilyFpCandidates: triggerFamilyFpCases.length,
    triggerFamilyFnCandidates: triggerFamilyFnCases.length,
  };

  const reportJson = {
    note: NOTE,
    generatedAt: new Date().toISOString(),
    inputPath: relative(process.cwd(), INPUT_PATH),
    totals,
    ruleTagCounts: tagCounts,
    keywordSummary,
    manaSummary,
    typeSummary,
    triggerFamilySummary,
    mappingFailures,
    keywordMismatches: keywordCases,
    triggerFamilyProbeCases,
  };

  await mkdir(dirname(REPORT_MD_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(reportJson, null, 2)}\n`, 'utf8');
  await writeFile(
    REPORT_MD_PATH,
    renderMarkdownReport({
      totals,
      tagCounts,
      keywordSummary,
      manaSummary,
      typeSummary,
      mappingFailures,
      keywordFpCases,
      keywordFnCases,
      triggerFamilySummary,
      triggerFamilyFpCases,
      triggerFamilyFnCases,
    }),
    'utf8',
  );

  console.log(`Classifier accuracy report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw mismatch details written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `cards=${totals.rawCards} mapped=${totals.mappedCards} mappingFailures=${totals.mappingFailures} keywordFP=${totals.keywordFpCandidates} keywordFN=${totals.keywordFnCandidates}`,
  );
}

async function readJson(path: string): Promise<unknown> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error: unknown) {
    throw new Error(`Input file not found or unreadable: ${path}\n${errorMessage(error)}`, {
      cause: error,
    });
  }
  return JSON.parse(source) as unknown;
}

function extractRawCards(payload: unknown): unknown[] {
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

function coerceScryfallCard(value: unknown): ScryfallCard | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return value as ScryfallCard;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const field = value[key];
  return typeof field === 'string' ? field : undefined;
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function buildKeywordLookup(definitions: readonly KeywordDefinition[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const definition of definitions) {
    lookup.set(normalizeKeywordName(definition.name), definition.id);
    for (const alias of definition.aliases ?? []) {
      lookup.set(normalizeKeywordName(alias), definition.id);
    }
  }
  return lookup;
}

function scryfallEvergreenKeywordIds(card: ScryfallCard): string[] {
  const keywordIds: string[] = [];
  for (const keyword of stringArray(card.keywords)) {
    const keywordId = keywordLookup.get(normalizeKeywordName(keyword));
    if (keywordId && EVERGREEN_KEYWORD_IDS.has(keywordId)) {
      keywordIds.push(keywordId);
    }
  }
  return uniqueSorted(keywordIds, compareKeywordIds);
}

function normalizeKeywordName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ');
}

function keywordLabel(keywordId: string): string {
  return keywordDefinitionsById.get(keywordId)?.label ?? keywordId;
}

function compareKeywordIds(a: string, b: string): number {
  const aIndex = keywordOrderIndex.get(a) ?? Number.MAX_SAFE_INTEGER;
  const bIndex = keywordOrderIndex.get(b) ?? Number.MAX_SAFE_INTEGER;
  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }
  return a.localeCompare(b);
}

function increment(counts: Map<string, number>, id: string): void {
  counts.set(id, (counts.get(id) ?? 0) + 1);
}

function uniqueSorted(
  values: Iterable<string>,
  compare: (a: string, b: string) => number,
): string[] {
  return [...new Set(values)].sort(compare);
}

function isManaRelatedTag(tag: { id: string; label: string; matchedText: string }): boolean {
  const text = `${tag.id} ${tag.label} ${tag.matchedText}`;
  return /\bmana\b|マナ/i.test(text);
}

function oracleSnippet(def: CardDef): string {
  const text = def.faces
    .flatMap((face) => (face.oracleText ? [face.oracleText] : []))
    .join(' / ');
  return snippet(text, 180);
}

function oracleFullText(def: CardDef): string {
  return def.faces
    .flatMap((face) => (face.oracleText ? [face.oracleText] : []))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function snippet(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return '(oracle textなし)';
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function buildKeywordSummary(
  classifierKeywordCounts: Map<string, number>,
  scryfallKeywordCounts: Map<string, number>,
  keywordFpCounts: Map<string, number>,
  keywordFnCounts: Map<string, number>,
): KeywordSummaryItem[] {
  return [...EVERGREEN_KEYWORD_IDS]
    .sort(compareKeywordIds)
    .map((keywordId) => ({
      id: keywordId,
      label: keywordLabel(keywordId),
      classifierCount: classifierKeywordCounts.get(keywordId) ?? 0,
      scryfallCount: scryfallKeywordCounts.get(keywordId) ?? 0,
      fpCandidateCount: keywordFpCounts.get(keywordId) ?? 0,
      fnCandidateCount: keywordFnCounts.get(keywordId) ?? 0,
    }));
}

function buildRuleTagCounts(
  ruleTagCounts: Map<string, number>,
  ruleTagLabels: Map<string, string>,
): CountItem[] {
  return buildCountItems(
    ruleTagCounts,
    (id) => ruleTagLabels.get(id) ?? id,
    (a, b) => compareRuleTagIds(a.id, b.id),
  );
}

function buildTriggerFamilySummary(
  classifierCounts: Map<string, number>,
  probeCounts: Map<string, number>,
  fpCounts: Map<string, number>,
  fnCounts: Map<string, number>,
): TriggerFamilySummaryItem[] {
  return TRIGGER_FAMILY_PROBES.map((family) => ({
    familyId: family.familyId,
    tagId: family.tagId,
    label: family.label,
    classifierCount: classifierCounts.get(family.tagId) ?? 0,
    probeCount: probeCounts.get(family.tagId) ?? 0,
    fpCandidateCount: fpCounts.get(family.tagId) ?? 0,
    fnCandidateCount: fnCounts.get(family.tagId) ?? 0,
  }));
}

function buildCountItems(
  counts: Map<string, number>,
  labelForId: (id: string) => string,
  compare: (a: CountItem, b: CountItem) => number,
): CountItem[] {
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: labelForId(id), count }))
    .sort(compare);
}

function buildTypeSummary(typeCounts: Map<string, number>): TypeSummaryItem[] {
  return TYPE_BUCKETS.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    count: typeCounts.get(bucket.id) ?? 0,
  }));
}

function rankKeywordCases(
  cases: KeywordCase[],
  counts: Map<string, number>,
): KeywordCase[] {
  return [...cases].sort((a, b) => {
    const countDiff = (counts.get(b.keywordId) ?? 0) - (counts.get(a.keywordId) ?? 0);
    if (countDiff !== 0) {
      return countDiff;
    }
    const keywordDiff = compareKeywordIds(a.keywordId, b.keywordId);
    if (keywordDiff !== 0) {
      return keywordDiff;
    }
    return a.cardName.localeCompare(b.cardName);
  });
}

function rankTriggerFamilyCases(
  cases: TriggerFamilyProbeCase[],
  counts: Map<string, number>,
): TriggerFamilyProbeCase[] {
  return [...cases].sort((a, b) => {
    const familyDiff = compareTriggerFamilyTagIds(a.tagId, b.tagId);
    if (familyDiff !== 0) {
      return familyDiff;
    }
    const countDiff = (counts.get(b.tagId) ?? 0) - (counts.get(a.tagId) ?? 0);
    if (countDiff !== 0) {
      return countDiff;
    }
    return a.cardName.localeCompare(b.cardName);
  });
}

function compareTriggerFamilyTagIds(a: string, b: string): number {
  const aIndex = TRIGGER_FAMILY_PROBES.findIndex((family) => family.tagId === a);
  const bIndex = TRIGGER_FAMILY_PROBES.findIndex((family) => family.tagId === b);
  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }
  return a.localeCompare(b);
}

function renderMarkdownReport(input: {
  totals: Totals;
  tagCounts: CountItem[];
  keywordSummary: KeywordSummaryItem[];
  manaSummary: ManaSummary;
  typeSummary: TypeSummaryItem[];
  mappingFailures: MappingFailure[];
  keywordFpCases: KeywordCase[];
  keywordFnCases: KeywordCase[];
  triggerFamilySummary: TriggerFamilySummaryItem[];
  triggerFamilyFpCases: TriggerFamilyProbeCase[];
  triggerFamilyFnCases: TriggerFamilyProbeCase[];
}): string {
  const lines: string[] = [
    '# 分類精度ハーネス A0 レポート',
    '',
    `**${NOTE}**`,
    '',
    `- 生成日時: ${new Date().toISOString()}`,
    `- 入力: ${relative(process.cwd(), INPUT_PATH)}`,
    `- 総 raw カード数: ${input.totals.rawCards}`,
    `- CardDef 写像成功: ${input.totals.mappedCards}`,
    `- CardDef 写像失敗: ${input.totals.mappingFailures}`,
    `- キーワード FP候補(分類器のみ): ${input.totals.keywordFpCandidates}`,
    `- キーワード FN候補(Scryfall のみ): ${input.totals.keywordFnCandidates}`,
    `- 誘発ファミリー FP候補(タグ有り/probe疑わしい): ${input.totals.triggerFamilyFpCandidates}`,
    `- 誘発ファミリー FN候補(probe一致/タグ無し): ${input.totals.triggerFamilyFnCandidates}`,
    '',
    '## ルールタグ別件数',
    '',
    ...renderCountTable(input.tagCounts),
    '',
    '## キーワード別件数(常磐木のみ)',
    '',
    '| keyword | label | classifier | Scryfall候補 | FP候補 | FN候補 |',
    '|---|---:|---:|---:|---:|---:|',
    ...input.keywordSummary.map(
      (item) =>
        `| ${cell(item.id)} | ${cell(item.label)} | ${item.classifierCount} | ${item.scryfallCount} | ${item.fpCandidateCount} | ${item.fnCandidateCount} |`,
    ),
    '',
    '## マナ能力照合(参考)',
    '',
    `- Scryfall produced_mana あり: ${input.manaSummary.producedManaCardCount}`,
    `- 分類器マナ関連タグあり: ${input.manaSummary.classifierManaTagCardCount}`,
    '- 現分類器に専用のマナ能力タグがない場合、この節は件数のみ。',
    '',
    '### produced_mana 色別件数',
    '',
    ...renderCountTable(input.manaSummary.producedManaColorCounts),
    '',
    '### 分類器マナ関連タグ件数',
    '',
    ...renderCountTable(input.manaSummary.classifierManaTagCounts),
    '',
    '## 型由来サマリ(参考)',
    '',
    ...renderCountTable(input.typeSummary),
    '',
    '## キーワード FP候補 上位20(分類器のみ)',
    '',
    ...renderKeywordCases(input.keywordFpCases),
    '',
    '## キーワード FN候補 上位20(Scryfall のみ)',
    '',
    ...renderKeywordCases(input.keywordFnCases),
    '',
    '## 誘発ファミリー候補(裁定対象)',
    '',
    `**${NOTE} 誘発probeは判定ではなく、人間が見るための広網候補リスト。**`,
    '',
    '| family | tag | label | classifier | probe | FP候補 | FN候補 |',
    '|---|---|---:|---:|---:|---:|---:|',
    ...input.triggerFamilySummary.map(
      (item) =>
        `| ${cell(item.familyId)} | ${cell(item.tagId)} | ${cell(item.label)} | ${item.classifierCount} | ${item.probeCount} | ${item.fpCandidateCount} | ${item.fnCandidateCount} |`,
    ),
    '',
    '### FN候補 上位20/ファミリー(probe一致・タグ無し)',
    '',
    ...renderTriggerFamilyCases(input.triggerFamilyFnCases),
    '### FP候補 上位20/ファミリー(タグ有り・probe疑わしい)',
    '',
    ...renderTriggerFamilyCases(input.triggerFamilyFpCases),
    '## 写像失敗 上位20',
    '',
    ...renderMappingFailures(input.mappingFailures),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderCountTable(items: readonly CountItem[] | readonly TypeSummaryItem[]): string[] {
  if (items.length === 0) {
    return ['- なし'];
  }
  return [
    '| id | label | count |',
    '|---|---:|---:|',
    ...items.map((item) => `| ${cell(item.id)} | ${cell(item.label)} | ${item.count} |`),
  ];
}

function renderKeywordCases(cases: readonly KeywordCase[]): string[] {
  if (cases.length === 0) {
    return ['- なし'];
  }
  return cases.slice(0, TOP_CASE_LIMIT).map((item) => {
    const side = item.kind === 'classifier-only' ? '分類器のみ' : 'Scryfallのみ';
    return `- ${cell(item.label)}(${cell(item.keywordId)} / ${side}) 《${cell(item.cardName)}》: ${cell(item.oracleSnippet)}`;
  });
}

function renderTriggerFamilyCases(cases: readonly TriggerFamilyProbeCase[]): string[] {
  const lines: string[] = [];
  for (const family of TRIGGER_FAMILY_PROBES) {
    const familyCases = cases
      .filter((item) => item.tagId === family.tagId)
      .slice(0, TOP_CASE_LIMIT);
    lines.push(`#### ${cell(family.label)} (${cell(family.tagId)})`, '');
    if (familyCases.length === 0) {
      lines.push('- なし', '');
      continue;
    }
    lines.push(
      ...familyCases.map((item) => {
        const side =
          item.kind === 'classifier-only' ? 'タグ有り/probe疑わしい' : 'probe一致/タグ無し';
        return `- 未調整 / ${side} 《${cell(item.cardName)}》: ${cell(item.oracleSnippet)}`;
      }),
      '',
    );
  }
  return lines;
}

function renderMappingFailures(failures: readonly MappingFailure[]): string[] {
  if (failures.length === 0) {
    return ['- なし'];
  }
  return failures
    .slice(0, TOP_CASE_LIMIT)
    .map((item) => `- #${item.index} 《${cell(item.cardName)}》: ${cell(item.reason)}`);
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
