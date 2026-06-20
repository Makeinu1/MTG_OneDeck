import type { CardDef } from '../types/card';
import type { CardInstance, GameState } from './types';
import { possessedKeywords } from './keywordGrammar';

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

const STATUS_KEYWORDS: readonly Keyword[] = [
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

function currentFace(def: CardDef | undefined, card: CardInstance) {
  return def?.faces[card.faceIndex] ?? def?.faces[0];
}

function currentTypeLine(def: CardDef | undefined, card: CardInstance): string {
  const face = currentFace(def, card);
  return face?.typeLine ?? def?.typeLine ?? '';
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

export interface FetchAbility {
  lifeCost: number;
  entersTapped: boolean;
  filter: 'basic' | { subtypes: string[] } | 'any-land';
}

const FETCH_SUBTYPE_SPECS = [
  { english: 'Plains', pattern: /\bPlains\b/i },
  { english: 'Island', pattern: /\bIsland\b/i },
  { english: 'Swamp', pattern: /\bSwamp\b/i },
  { english: 'Mountain', pattern: /\bMountain\b/i },
  { english: 'Forest', pattern: /\bForest\b/i },
] as const;

function detectFetchClause(def: CardDef | undefined): string | null {
  for (const text of cardTexts(def)) {
    const clauses = splitRulesText(text);
    const haystack = clauses.join(' ');
    const hasEnglishFetch =
      /Search your library for/i.test(haystack) &&
      /onto the battlefield/i.test(haystack) &&
      /shuffle/i.test(haystack);
    if (hasEnglishFetch) {
      return haystack;
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

export function fetchAbility(def: CardDef | undefined): FetchAbility | null {
  const clause = detectFetchClause(def);
  if (!clause) {
    return null;
  }

  return {
    lifeCost: fetchLifeCost(clause),
    entersTapped: /onto the battlefield tapped/i.test(clause),
    filter: fetchFilter(clause),
  };
}

export function keywords(def: CardDef | undefined): Keyword[] {
  return possessedKeywords(def).filter((id): id is Keyword => STATUS_KEYWORD_IDS.has(id));
}

export function hasVigilance(state: GameState, cardId: string): boolean {
  const card = state.cards[cardId];
  if (!card) return false;
  return keywords(state.defs[card.defId]).includes('vigilance');
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

export function cyclingCost(def: CardDef | undefined): string | null {
  if (!def) return null;

  for (const text of cardTexts(def)) {
    const english = text.match(/\b(?:[A-Za-z]+)?cycling\b\s*((?:\{[^}]+\})+)/i);
    if (english?.[1]) {
      return english[1];
    }
  }

  return null;
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
  const def = state.defs[card.defId];
  if (!currentTypeLine(def, card).includes('Creature')) return false;
  if (card.enteredTurn !== state.turn) return false;
  return !keywords(def).includes('haste');
}
