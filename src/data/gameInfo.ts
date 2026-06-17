import { parseManaCost, type Pip } from '../engine/mana';
import type { GameState } from '../engine/types';

export type DevotionColor = 'W' | 'U' | 'B' | 'R' | 'G';

export interface GameInfo {
  storm: number;
  landsThisTurn: number;
  drawsThisTurn: number;
  devotion: Record<DevotionColor, number>;
}

function emptyDevotion(): Record<DevotionColor, number> {
  return { W: 0, U: 0, B: 0, R: 0, G: 0 };
}

function addDevotion(devotion: Record<DevotionColor, number>, pip: Pip): void {
  switch (pip.kind) {
    case 'color':
      devotion[pip.color] += 1;
      break;
    case 'hybrid':
      for (const option of pip.options) {
        if (option !== 'C') {
          devotion[option] += 1;
        }
      }
      break;
    case 'monoHybrid':
    case 'phyrexian':
      devotion[pip.color] += 1;
      break;
    case 'colorless':
    case 'snow':
      break;
  }
}

export function computeGameInfo(state: GameState): GameInfo {
  const devotion = emptyDevotion();

  for (const cardId of state.zones.battlefield) {
    const card = state.cards[cardId];
    if (!card || card.faceDown || card.isAbility || card.isCopy) {
      continue;
    }

    const def = state.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    const manaCost = face?.manaCost;
    if (!manaCost) {
      continue;
    }

    const parsed = parseManaCost(manaCost);
    for (const pip of parsed.pips) {
      addDevotion(devotion, pip);
    }
  }

  return {
    storm: state.spellsCastThisTurn,
    landsThisTurn: state.landsPlayedThisTurn,
    drawsThisTurn: state.drawnThisTurn,
    devotion,
  };
}
