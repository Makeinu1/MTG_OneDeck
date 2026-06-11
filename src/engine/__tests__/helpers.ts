import type { CardDef } from '../../types/card';
import type { InitDeckCard } from '../init';

export function makeDef(overrides: Partial<CardDef> & { scryfallId: string }): CardDef {
  const typeLine = overrides.typeLine ?? 'Creature';
  return {
    oracleId: overrides.scryfallId,
    name: overrides.scryfallId,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine,
    faces: [{ name: overrides.scryfallId, typeLine }],
    ...overrides,
  };
}

/**
 * Build a deck of `count` vanilla creatures plus optional commanders.
 * Ids are deterministic: card defs are 'card-1'..'card-N', commanders
 * 'cmd-1'..'cmd-M' appended after, so instance ids are c1..c(N) then commanders.
 */
export function makeDeck(
  mainCount: number,
  commanderDefs: CardDef[] = []
): InitDeckCard[] {
  const deck: InitDeckCard[] = [];
  for (let i = 1; i <= mainCount; i++) {
    deck.push({ def: makeDef({ scryfallId: `card-${i}` }), isCommander: false });
  }
  for (const def of commanderDefs) {
    deck.push({ def, isCommander: true });
  }
  return deck;
}
