import type { CardDef } from '../types/card';
import type { CardInstance, GameState } from './types';

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

interface KeywordSpec {
  keyword: Keyword;
  patterns: readonly RegExp[];
}

const KEYWORD_SPECS: readonly KeywordSpec[] = [
  { keyword: 'flying', patterns: [/\bflying\b/i, /飛行/] },
  { keyword: 'vigilance', patterns: [/\bvigilance\b/i, /警戒/] },
  { keyword: 'trample', patterns: [/\btrample\b/i, /トランプル/] },
  { keyword: 'deathtouch', patterns: [/\bdeathtouch\b/i, /接死/] },
  { keyword: 'lifelink', patterns: [/\blifelink\b/i, /絆魂/] },
  { keyword: 'menace', patterns: [/\bmenace\b/i, /威迫/] },
  { keyword: 'first-strike', patterns: [/\bfirst strike\b/i, /先制攻撃/] },
  { keyword: 'double-strike', patterns: [/\bdouble strike\b/i, /二段攻撃/] },
  { keyword: 'reach', patterns: [/\breach\b/i, /到達/] },
  { keyword: 'haste', patterns: [/\bhaste\b/i, /速攻/] },
  { keyword: 'hexproof', patterns: [/\bhexproof\b/i, /呪禁/] },
  { keyword: 'indestructible', patterns: [/\bindestructible\b/i, /破壊不能/] },
  { keyword: 'defender', patterns: [/\bdefender\b/i, /防衛/] },
  { keyword: 'ward', patterns: [/\bward\b/i, /護法/] },
];

function currentFace(def: CardDef | undefined, card: CardInstance) {
  return def?.faces[card.faceIndex] ?? def?.faces[0];
}

function currentTypeLine(def: CardDef | undefined, card: CardInstance): string {
  const face = currentFace(def, card);
  return face?.typeLine ?? def?.typeLine ?? '';
}

function cardTexts(def: CardDef | undefined): string[] {
  if (!def) return [];
  return def.faces.flatMap((face) => [face.oracleText ?? '', face.printedText ?? '']);
}

function splitRulesText(text: string): string[] {
  return text
    .split(/[.\n。]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

export function keywords(def: CardDef | undefined): Keyword[] {
  if (!def) return [];
  const texts = cardTexts(def);

  return KEYWORD_SPECS.filter((spec) =>
    texts.some((text) => spec.patterns.some((pattern) => pattern.test(text)))
  ).map((spec) => spec.keyword);
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
      const hasJapaneseTapped = /タップ状態で戦場に出る/.test(clause);
      if (!hasEnglishTapped && !hasJapaneseTapped) {
        continue;
      }

      sawTappedClause = true;

      const conditionalEnglish = /\bunless\b/i.test(clause) || /\bif\b/i.test(clause);
      const conditionalJapanese = /でないかぎり|なら/.test(clause);
      if (conditionalEnglish || conditionalJapanese) {
        return 'conditional';
      }
    }
  }

  return sawTappedClause ? 'always' : 'never';
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
