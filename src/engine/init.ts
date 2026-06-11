import type { CardDef } from '../types/card';
import { createRng, shuffledOrder } from './random';
import type {
  CardInstance,
  CommanderInfo,
  GameState,
  LogEntry,
  ManaPool,
  ZoneId,
} from './types';

export interface InitDeckCard {
  def: CardDef;
  isCommander: boolean;
}

function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function emptyZones(): Record<ZoneId, string[]> {
  return {
    library: [],
    hand: [],
    battlefield: [],
    graveyard: [],
    exile: [],
    command: [],
  };
}

/**
 * Build the initial GameState for a deck.
 * - Commanders go to the command zone; everything else is shuffled into library.
 * - turn=1, phase='main1', life=40, no opening hand (store dispatches draw 7).
 * - quantity expansion is the caller's (store's) responsibility.
 */
export function initGame(deck: InitDeckCard[], seed: number): GameState {
  const defs: Record<string, CardDef> = {};
  const cards: Record<string, CardInstance> = {};
  const zones = emptyZones();
  const commanders: CommanderInfo[] = [];

  const libraryIds: string[] = [];

  deck.forEach((entry, index) => {
    const id = `c${index + 1}`;
    defs[entry.def.scryfallId] = entry.def;

    const instance: CardInstance = {
      id,
      defId: entry.def.scryfallId,
      zone: entry.isCommander ? 'command' : 'library',
      tapped: false,
      faceIndex: 0,
      faceDown: false,
      counters: {},
      isToken: false,
      isCommander: entry.isCommander,
    };
    cards[id] = instance;

    if (entry.isCommander) {
      zones.command.push(id);
      commanders.push({ cardId: id, castCount: 0 });
    } else {
      libraryIds.push(id);
    }
  });

  const rng = createRng(seed);
  zones.library = shuffledOrder(libraryIds, rng);

  const log: LogEntry[] = [
    {
      seq: 0,
      turn: 1,
      phase: 'main1',
      message: 'ゲームを開始しました。',
    },
  ];

  return {
    defs,
    cards,
    zones,
    commanders,
    turn: 1,
    phase: 'main1',
    life: 40,
    poison: 0,
    energy: 0,
    experience: 0,
    commanderDamage: {},
    manaPool: emptyManaPool(),
    mulliganCount: 0,
    log,
  };
}
