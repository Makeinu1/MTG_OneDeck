import type { CardDef } from '../types/card';
import type { CardInstance, GameState } from './types';

function currentFace(def: CardDef | undefined, card: CardInstance) {
  return def?.faces[card.faceIndex] ?? def?.faces[0];
}

function currentTypeLine(def: CardDef | undefined, card: CardInstance): string {
  const face = currentFace(def, card);
  return face?.typeLine ?? def?.typeLine ?? '';
}

function hasHaste(def: CardDef | undefined): boolean {
  if (!def) return false;
  return def.faces.some((face) => {
    const oracleText = face.oracleText ?? '';
    const printedText = face.printedText ?? '';
    return /\bhaste\b/i.test(oracleText) || /\bhaste\b/i.test(printedText) || oracleText.includes('速攻') || printedText.includes('速攻');
  });
}

export function isSummoningSick(state: GameState, cardId: string): boolean {
  const card = state.cards[cardId];
  if (!card || card.zone !== 'battlefield') return false;
  const def = state.defs[card.defId];
  if (!currentTypeLine(def, card).includes('Creature')) return false;
  if (card.enteredTurn !== state.turn) return false;
  return !hasHaste(def);
}
