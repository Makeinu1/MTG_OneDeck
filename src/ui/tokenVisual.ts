import treasureUrl from '../assets/onedeck/token-treasure.svg';
import clueUrl from '../assets/onedeck/token-clue.svg';
import foodUrl from '../assets/onedeck/token-food.svg';
import bloodUrl from '../assets/onedeck/token-blood.svg';
import genericUrl from '../assets/onedeck/token-generic.svg';
import type { CardDef } from '../types/card';

export interface TokenVisual {
  key: 'treasure' | 'clue' | 'food' | 'blood' | 'generic';
  imageUrl: string;
  label: string;
}

const BUILTIN_TOKEN_VISUALS: Record<NonNullable<CardDef['tokenKind']>, TokenVisual> = {
  treasure: { key: 'treasure', imageUrl: treasureUrl, label: '宝物トークン' },
  clue: { key: 'clue', imageUrl: clueUrl, label: '手掛かりトークン' },
  food: { key: 'food', imageUrl: foodUrl, label: '食物トークン' },
  blood: { key: 'blood', imageUrl: bloodUrl, label: '血トークン' },
};

/** UI-only token art resolution. It never mutates CardDef or game state. */
export function tokenVisualFor(def: CardDef | undefined): TokenVisual {
  return tokenVisualForKind(def?.tokenKind);
}

export function tokenVisualForKind(kind: CardDef['tokenKind']): TokenVisual {
  return kind
    ? BUILTIN_TOKEN_VISUALS[kind]
    : { key: 'generic', imageUrl: genericUrl, label: 'トークン' };
}
