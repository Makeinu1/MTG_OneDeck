import type { CardDef } from '../types/card';
import type { CardInstance, GameState, PlayerId } from './types';
import { classifyAbilityShape, splitAbilityLines } from './grammar/index';
import { KEYWORD_DEFINITIONS, possessedKeywords } from './keywordGrammar';
import { parseClassLevelBars, classLevelBarKeywords } from './classGrammar';
import { isSolvedGatedLine, parseCaseSections } from './caseGrammar';

export type Keyword =
  | 'flying'
  | 'vigilance'
  | 'trample'
  | 'deathtouch'
  | 'lifelink'
  | 'menace'
  | 'first-strike'
  | 'double-strike'
  | 'reach'
  | 'haste'
  | 'hexproof'
  | 'indestructible'
  | 'defender'
  | 'ward';

export const STATUS_KEYWORDS: readonly Keyword[] = [
  'flying',
  'vigilance',
  'trample',
  'deathtouch',
  'lifelink',
  'menace',
  'first-strike',
  'double-strike',
  'reach',
  'haste',
  'hexproof',
  'indestructible',
  'defender',
  'ward',
];

const STATUS_KEYWORD_IDS = new Set<string>(STATUS_KEYWORDS);
const BASIC_LAND_TYPES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const;
const ATTACHMENT_TYPE_LINE_PATTERN = /\b(?:Aura|Equipment|Fortification)\b/i;
const TYPE_WORD_PATTERN = /^[A-Za-z][A-Za-z'-]*$/;

export function isKeyword(value: string): value is Keyword {
  return STATUS_KEYWORD_IDS.has(value);
}

/** CR 716.2d: a permanent without a level is treated as level 1. */
export function classLevelOf(state: GameState, cardId: string): number {
  return state.cards[cardId]?.classLevel ?? 1;
}

export function normalizeKeywords(values: readonly unknown[] | undefined): Keyword[] {
  if (!Array.isArray(values)) return [];

  const out: Keyword[] = [];
  const seen = new Set<Keyword>();
  for (const value of values) {
    if (typeof value !== 'string' || !isKeyword(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function currentFace(def: CardDef | undefined, card: CardInstance) {
  return def?.faces[card.faceIndex] ?? def?.faces[0];
}

function currentTypeLine(def: CardDef | undefined, card: CardInstance): string {
  const face = currentFace(def, card);
  return face?.typeLine ?? def?.typeLine ?? '';
}

function currentFaceIndex(def: CardDef | undefined, card: CardInstance): number {
  return def?.faces[card.faceIndex] ? card.faceIndex : 0;
}

function cardTexts(def: CardDef | undefined): string[] {
  if (!def?.faces) return [];
  return def.faces.flatMap((face) => (face.oracleText ? [face.oracleText] : []));
}

function splitRulesText(text: string): string[] {
  return text
    .split(/[.\n。]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

type AdditiveTypeEffect =
  | { kind: 'self'; additions: string[] }
  | { kind: 'attached'; additions: string[] };

function normalizeLayer4StaticLine(line: string): string {
  return line.replace(/[.。]/g, ' ').replace(/\s+/g, ' ').trim();
}

function canonicalTypeWord(word: string): string {
  return word
    .split('-')
    .map((part) =>
      part === '' ? part : `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`,
    )
    .join('-');
}

function parseTypeWordList(raw: string): string[] | null {
  const words = raw.split(',').map((part) => part.trim());
  if (words.length === 0 || words.some((word) => !TYPE_WORD_PATTERN.test(word))) {
    return null;
  }
  return words.map(canonicalTypeWord);
}

function parseLayer4AdditiveStaticLine(line: string): AdditiveTypeEffect | null {
  const normalized = normalizeLayer4StaticLine(line);
  if (
    /^this\s+[a-z][a-z' -]*?\s+is\s+every\s+basic\s+land\s+type\s+in\s+addition\s+to\s+its\s+other\s+types$/i.test(
      normalized,
    )
  ) {
    return { kind: 'self', additions: [...BASIC_LAND_TYPES] };
  }

  const selfNamed = normalized.match(
    /^this\s+[a-z][a-z' -]*?\s+is\s+(?:a|an)\s+(.+?)\s+in\s+addition\s+to\s+its\s+other\s+types$/i,
  );
  if (selfNamed?.[1]) {
    const additions = parseTypeWordList(selfNamed[1]);
    return additions ? { kind: 'self', additions } : null;
  }

  const selfBattlefieldNamed = normalized.match(
    /^as\s+long\s+as\s+this\s+[a-z][a-z' -]*?\s+is\s+on\s+the\s+battlefield,\s+it['’]s\s+(?:a|an)\s+(.+?)\s+in\s+addition\s+to\s+its\s+other\s+types$/i,
  );
  if (selfBattlefieldNamed?.[1]) {
    const additions = parseTypeWordList(selfBattlefieldNamed[1]);
    return additions ? { kind: 'self', additions } : null;
  }

  if (
    /^(?:enchanted|equipped|fortified)\s+[a-z][a-z' -]*?\s+is\s+every\s+basic\s+land\s+type\s+in\s+addition\s+to\s+its\s+other\s+types$/i.test(
      normalized,
    )
  ) {
    return { kind: 'attached', additions: [...BASIC_LAND_TYPES] };
  }

  const attachedNamed = normalized.match(
    /^(?:enchanted|equipped|fortified)\s+[a-z][a-z' -]*?\s+is\s+(?:a|an)\s+(.+?)\s+in\s+addition\s+to\s+its\s+other\s+types$/i,
  );
  if (attachedNamed?.[1]) {
    const additions = parseTypeWordList(attachedNamed[1]);
    return additions ? { kind: 'attached', additions } : null;
  }

  return null;
}

type AdditiveKeywordEffect =
  | { kind: 'self'; keywords: Keyword[] }
  | { kind: 'attached'; keywords: Keyword[] };

const KEYWORD_NAME_TO_ID = new Map<string, string>(
  KEYWORD_DEFINITIONS.map((definition) => [definition.name.toLowerCase(), definition.id]),
);

// CR 613.1f Layer 6, ability-adding half only (keyword counters / ability-removal / "can't
// have" are out of scope — see design-lock §34.32). Only the 14 STATUS_KEYWORDS are
// recognized; an unrecognized keyword word anywhere in the list fails the whole clause
// closed (no partial grant), matching parseTypeWordList's all-or-nothing discipline above.
function parseKeywordWordList(raw: string): Keyword[] | null {
  const words = raw
    .replace(/,?\s+and\s+/gi, ', ')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (words.length === 0) {
    return null;
  }
  const keywords: Keyword[] = [];
  for (const word of words) {
    const id = KEYWORD_NAME_TO_ID.get(word.toLowerCase());
    if (!id || !isKeyword(id)) {
      return null;
    }
    keywords.push(id);
  }
  return keywords;
}

function parseLayer6AdditiveKeywordLine(line: string): AdditiveKeywordEffect | null {
  const normalized = normalizeLayer4StaticLine(line);

  const selfNamed = normalized.match(/^this\s+[a-z][a-z' -]*?\s+has\s+(.+)$/i);
  if (selfNamed?.[1]) {
    const keywords = parseKeywordWordList(selfNamed[1]);
    return keywords ? { kind: 'self', keywords } : null;
  }

  const attachedNamed = normalized.match(
    /^(?:enchanted|equipped|fortified)\s+[a-z][a-z' -]*?\s+has\s+(.+)$/i,
  );
  if (attachedNamed?.[1]) {
    const keywords = parseKeywordWordList(attachedNamed[1]);
    return keywords ? { kind: 'attached', keywords } : null;
  }

  return null;
}

function staticAbilityLinesForCurrentFace(def: CardDef | undefined, card: CardInstance): string[] {
  if (!def) return [];
  const faceIndex = currentFaceIndex(def, card);
  const typeLine = currentTypeLine(def, card);
  // Tier-1 audit finding (HIGH): a static-ability paragraph can hold more than one
  // sentence (e.g. "This land is tapped. This land is a Mountain in addition to its
  // other types."). parseLayer4AdditiveStaticLine's ^...$ anchors are only meaningful
  // per-sentence — splitting here (not just at the paragraph level) keeps each
  // additive clause isolated so a neighboring sentence can't be swallowed into or
  // silently defeat its capture group.
  return splitAbilityLines(def)
    .filter((line) => line.faceIndex === faceIndex)
    // CR 719.3c / 702.169b: a "Solved —" line is "As long as this Case is
    // solved, [ability]". It never enters the generic Layer 4/6 static pool —
    // the solved half is granted exclusively by the Case extension in
    // effectiveKeywords, gated on the source card's own solved designation.
    // Off-battlefield sources never reach here.
    .filter((line) => !isSolvedGatedLine(line.text))
    .flatMap((line) => (classifyAbilityShape(line.text, typeLine) === 'static' ? splitRulesText(line.text) : []));
}

function typeLineHasWord(typeLine: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(typeLine);
}

function appendTypeWords(typeLine: string, additions: readonly string[]): string {
  const appended: string[] = [];
  const seen = new Set<string>();
  for (const addition of additions) {
    const key = addition.toLowerCase();
    if (seen.has(key) || typeLineHasWord(typeLine, addition)) {
      continue;
    }
    seen.add(key);
    appended.push(addition);
  }
  if (appended.length === 0) {
    return typeLine;
  }
  return [typeLine, ...appended].filter((part) => part !== '').join(' ');
}

function isAttachmentTypeLine(typeLine: string): boolean {
  return ATTACHMENT_TYPE_LINE_PATTERN.test(typeLine);
}

export interface FetchAbility {
  lifeCost: number;
  entersTapped: boolean;
  filter: 'basic' | { subtypes: string[] } | 'any-land';
  // 寓話の小道型: tapped で出た後、支配土地が N 枚以上なら untap する条件付きアンタップ句の閾値。
  untapIfControlLandsAtLeast?: number;
}

const FETCH_NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const FETCH_SUBTYPE_SPECS = [
  { english: 'Plains', pattern: /\bPlains\b/i },
  { english: 'Island', pattern: /\bIsland\b/i },
  { english: 'Swamp', pattern: /\bSwamp\b/i },
  { english: 'Mountain', pattern: /\bMountain\b/i },
  { english: 'Forest', pattern: /\bForest\b/i },
] as const;

// §11.1: a clause is a fetch clause only when a single clause carries all three
// markers AND the searched-for target is a land. Matching the whole-face joined
// text (the old behavior) false-positived on Urza's Saga chapter III, whose
// artifact search also contains all three markers.
const FETCH_TARGET_PATTERN = /search your library for ([^,]+?) cards?\b/i;

function isFetchTargetClause(clause: string): boolean {
  const target = clause.match(FETCH_TARGET_PATTERN)?.[1]?.toLowerCase();
  if (!target) {
    return false;
  }
  return /\bland\b/.test(target)
    || FETCH_SUBTYPE_SPECS.some((spec) => spec.pattern.test(target));
}

function isFetchClause(clause: string): boolean {
  return /search your library for/i.test(clause)
    && /onto the battlefield/i.test(clause)
    && /shuffle/i.test(clause)
    && isFetchTargetClause(clause);
}

function detectFetchClause(def: CardDef | undefined): string | null {
  for (const text of cardTexts(def)) {
    const clauses = splitRulesText(text);
    if (clauses.some(isFetchClause)) {
      // Return the whole face join: fetchLifeCost / fetchFilter /
      // fetchConditionalUntap scan the entire face (the Fabled Passage
      // conditional untap clause lives in a separate sentence).
      return clauses.join(' ');
    }
  }

  return null;
}

function fetchLifeCost(clause: string): number {
  const english = clause.match(/\bPay (\d+) life\b/i);
  if (english?.[1]) {
    return Number.parseInt(english[1], 10) || 0;
  }

  return 0;
}

function fetchFilter(clause: string): FetchAbility['filter'] {
  if (/\bbasic land\b/i.test(clause)) {
    return 'basic';
  }

  const subtypes = FETCH_SUBTYPE_SPECS.flatMap((spec) =>
    spec.pattern.test(clause) ? [spec.english] : []
  );
  if (subtypes.length > 0) {
    return { subtypes: Array.from(new Set(subtypes)) };
  }

  return 'any-land';
}

function fetchConditionalUntap(clause: string): number | undefined {
  // 寓話の小道: "…onto the battlefield tapped, then shuffle. Then if you control four or more lands, untap that land."
  const match = clause.match(/if you control (\w+) or more lands,\s*untap (?:that land|it)\b/i);
  if (!match?.[1]) {
    return undefined;
  }
  const word = match[1].toLowerCase();
  const value = /^\d+$/.test(word) ? Number.parseInt(word, 10) : FETCH_NUMBER_WORDS[word];
  return typeof value === 'number' && value > 0 ? value : undefined;
}

export function fetchAbility(def: CardDef | undefined): FetchAbility | null {
  const clause = detectFetchClause(def);
  if (!clause) {
    return null;
  }

  const entersTapped = /onto the battlefield tapped/i.test(clause);
  const untapIfControlLandsAtLeast = entersTapped ? fetchConditionalUntap(clause) : undefined;

  return {
    lifeCost: fetchLifeCost(clause),
    entersTapped,
    filter: fetchFilter(clause),
    ...(untapIfControlLandsAtLeast === undefined ? {} : { untapIfControlLandsAtLeast }),
  };
}

function countControlledLands(state: GameState, controllerId: PlayerId): number {
  return state.zones.battlefield.reduce((count, cardId) => {
    const card = state.cards[cardId];
    if (!card || (card.controllerId ?? 'P1') !== controllerId) {
      return count;
    }
    return effectiveTypeLine(state, cardId).includes('Land') ? count + 1 : count;
  }, 0);
}

// tapped で出すべきかの最終判定(盤面依存)。entersTapped=false は常に false。
// untapIfControlLandsAtLeast 有り時は「解決後の支配土地数(フェッチ土地自身を +1)」が閾値以上なら false(=untap)。
export function fetchEntersTapped(
  state: GameState,
  ability: FetchAbility,
  controllerId: PlayerId,
): boolean {
  if (!ability.entersTapped) {
    return false;
  }
  if (ability.untapIfControlLandsAtLeast === undefined) {
    return true;
  }
  const controlledAfterFetch = countControlledLands(state, controllerId) + 1;
  return controlledAfterFetch < ability.untapIfControlLandsAtLeast;
}

export function keywords(def: CardDef | undefined): Keyword[] {
  return possessedKeywords(def).filter((id): id is Keyword => isKeyword(id));
}

// Shared by effectiveTypeLine (Layer 4) and effectiveKeywords (Layer 6 additive half):
// yields each battlefield-only candidate static-ability sentence for cardId itself
// ('self') and for any Aura/Equipment/Fortification currently attachedTo cardId
// ('attached'). Pure iteration only — callers decide what to parse out of each line.
function forEachAdditiveStaticSourceLine(
  state: GameState,
  cardId: string,
  visit: (line: string, kind: 'self' | 'attached') => void,
): void {
  const card = state.cards[cardId];
  if (!card || card.zone !== 'battlefield') {
    return;
  }
  const def = state.defs[card.defId];
  for (const line of staticAbilityLinesForCurrentFace(def, card)) {
    visit(line, 'self');
  }

  for (const sourceId of state.zones.battlefield) {
    if (sourceId === cardId) {
      continue;
    }
    const source = state.cards[sourceId];
    if (!source || source.zone !== 'battlefield' || source.attachedTo !== cardId) {
      continue;
    }
    const sourceDef = state.defs[source.defId];
    if (!isAttachmentTypeLine(currentTypeLine(sourceDef, source))) {
      continue;
    }
    for (const line of staticAbilityLinesForCurrentFace(sourceDef, source)) {
      visit(line, 'attached');
    }
  }
}

export function effectiveKeywords(state: GameState, cardId: string): Keyword[] {
  const card = state.cards[cardId];
  if (!card) return [];
  const granted: Keyword[] = [];
  forEachAdditiveStaticSourceLine(state, cardId, (line, kind) => {
    const effect = parseLayer6AdditiveKeywordLine(line);
    if (effect?.kind === kind) {
      granted.push(...effect.keywords);
    }
  });
  // CR 716.2a static half: Class level bars grant keywords to the Class itself
  // when classLevel >= bar.level. Self-only; attached-object Class grants are
  // out of scope (no known cards do this).
  const def = state.defs[card.defId];
  if (card.zone === 'battlefield' && currentTypeLine(def, card).includes('Class')) {
    const face = currentFace(def, card);
    const bars = parseClassLevelBars(face?.oracleText);
    const level = classLevelOf(state, cardId);
    // classLevelBarKeywords already skips bars above `level`; no pre-filter needed.
    const barKeywords = classLevelBarKeywords(bars, level);
    for (const kw of barKeywords) {
      if (isKeyword(kw)) {
        granted.push(kw);
      }
    }
  }
  // CR 719.3c / 702.169b static half: a solved Case grants the abilities after
  // its "Solved —" prefixes ("As long as this Case is solved, [ability]").
  // The prefix is stripped and each sentence is fed through the same additive
  // keyword parser discipline as the pool above (self-only; STATUS keyword
  // vocabulary; all-or-nothing per sentence). Non-keyword static text inside
  // solved lines is honestly ignored (deferred), same as Class bars.
  if (card.zone === 'battlefield' && card.solved === true) {
    const face = currentFace(def, card);
    const { solvedAbilities } = parseCaseSections(face?.oracleText);
    for (const ability of solvedAbilities) {
      for (const rawSentence of ability.split('.')) {
        const sentence = rawSentence.trim();
        if (!sentence) continue;
        const effect = parseLayer6AdditiveKeywordLine(sentence);
        if (effect?.kind === 'self') {
          granted.push(...effect.keywords);
        }
      }
    }
  }
  return normalizeKeywords([
    ...keywords(state.defs[card.defId]),
    ...(card.manualKeywords ?? []),
    ...granted,
  ]);
}

export function effectiveTypeLine(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '';
  const def = state.defs[card.defId];
  const printedTypeLine = currentTypeLine(def, card).toString();
  if (card.zone !== 'battlefield') {
    return printedTypeLine;
  }

  const additions: string[] = [];
  forEachAdditiveStaticSourceLine(state, cardId, (line, kind) => {
    const effect = parseLayer4AdditiveStaticLine(line);
    if (effect?.kind === kind) {
      additions.push(...effect.additions);
    }
  });

  return appendTypeWords(printedTypeLine, additions);
}

// CR 614.1a ("instead" = replacement effect) / design-lock §34.35. Exact-phrase gate,
// verified byte-exact against the local Scryfall snapshot: Hades, Sorcerer of Eld
// (Emet-Selch back face) / Necrodominance / Festival of Embers use the "or token"
// form; Yawgmoth's Agenda uses the "a card" form. Matched per-sentence with full
// anchors (the Slice A multi-sentence lesson): no ability-shape gate is needed —
// the anchored sentence IS the gate, and shape classification of a multi-sentence
// paragraph could misroute an otherwise-exact match.
const GRAVEYARD_TO_EXILE_REPLACEMENT_PATTERN =
  /^if a card (?:or token )?would be put into your graveyard from anywhere, exile it instead$/i;

// "your graveyard" = the ability controller's graveyard; a card always goes to its
// OWNER's graveyard (CR 404.1), so the replacement applies when the moving card's
// owner is the source's controller. Battlefield-only, current face only (Hades is
// faceIndex 1 — the untransformed front face must not activate the replacement).
export function graveyardToExileReplacementActive(state: GameState, ownerId: PlayerId): boolean {
  for (const sourceId of state.zones.battlefield) {
    const source = state.cards[sourceId];
    if (!source || source.zone !== 'battlefield') continue;
    if ((source.controllerId ?? 'P1') !== ownerId) continue;
    const def = state.defs[source.defId];
    if (!def) continue;
    const faceIndex = currentFaceIndex(def, source);
    for (const line of splitAbilityLines(def)) {
      if (line.faceIndex !== faceIndex) continue;
      for (const sentence of splitRulesText(line.text)) {
        if (GRAVEYARD_TO_EXILE_REPLACEMENT_PATTERN.test(normalizeLayer4StaticLine(sentence))) {
          return true;
        }
      }
    }
  }
  return false;
}

export function hasVigilance(state: GameState, cardId: string): boolean {
  const card = state.cards[cardId];
  if (!card) return false;
  return effectiveKeywords(state, cardId).includes('vigilance');
}

export function landEntersTapped(def: CardDef | undefined): 'always' | 'never' | 'conditional' {
  let sawTappedClause = false;

  for (const text of cardTexts(def)) {
    for (const clause of splitRulesText(text)) {
      const hasEnglishTapped = /enters\b[\s\S]*\btapped\b/i.test(clause);
      if (!hasEnglishTapped) {
        continue;
      }

      sawTappedClause = true;

      const conditionalEnglish = /\bunless\b/i.test(clause) || /\bif\b/i.test(clause);
      if (conditionalEnglish) {
        return 'conditional';
      }
    }
  }

  return sawTappedClause ? 'always' : 'never';
}

export interface CyclingInfo {
  /** Cost string, e.g. "{2}" or "{1}{U}". */
  cost: string;
  /** The matched cycling keyword as printed, e.g. "cycling", "landcycling", "plainscycling". */
  keyword: string;
  /** True for [type]cycling variants (CR 702.29e); false for plain cycling (CR 702.29a). */
  isTypecycling: boolean;
}

/**
 * Detects the cycling ability's cost plus whether it is a [type]cycling variant.
 * Kept intentionally loose (matches typecycling too) for the UI gate — the effect
 * split (draw vs. tutor) is decided by callers via `isTypecycling`.
 */
export function cyclingInfo(def: CardDef | undefined): CyclingInfo | null {
  if (!def) return null;

  for (const text of cardTexts(def)) {
    const english = text.match(/\b([A-Za-z]*cycling)\b\s*((?:\{[^}]+\})+)/i);
    if (english?.[2]) {
      const keyword = english[1];
      return {
        cost: english[2],
        keyword,
        isTypecycling: keyword.toLowerCase() !== 'cycling',
      };
    }
  }

  return null;
}

export function cyclingCost(def: CardDef | undefined): string | null {
  return cyclingInfo(def)?.cost ?? null;
}

export function effectivePower(state: GameState, cardId: string): number {
  const card = state.cards[cardId];
  if (!card) return 0;
  const def = state.defs[card.defId];
  const face = currentFace(def, card);
  const basePower = Number.parseInt(face?.power ?? '', 10);
  const power = Number.isNaN(basePower) ? 0 : basePower;
  return power + (card.counters['+1/+1'] ?? 0) - (card.counters['-1/-1'] ?? 0);
}

export function isSummoningSick(state: GameState, cardId: string): boolean {
  const card = state.cards[cardId];
  if (!card || card.zone !== 'battlefield') return false;
  if (!effectiveTypeLine(state, cardId).includes('Creature')) return false;
  if (card.enteredTurn !== state.turn) return false;
  return !effectiveKeywords(state, cardId).includes('haste');
}
