import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import { makeDef } from './helpers';

function def(id: string, typeLine: string, cmc = 0): CardDef {
  return makeDef({
    scryfallId: id,
    name: id,
    typeLine,
    cmc,
    faces: [{ name: id, typeLine, ...(typeLine.includes('Creature') ? { power: '2', toughness: '2' } : {}) }],
  });
}

describe('CR 609 one-shot mass destroy', () => {
  it('treats card ids as an order-independent set and records one destroy group', () => {
    const creature = def('cr609-creature', 'Artifact Creature');
    let state = initGame([{ def: creature, isCommander: false }, { def: creature, isCommander: false }], 1);
    state = applyCommand(state, { type: 'moveCard', cardId: 'c1', to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: 'c2', to: 'battlefield', position: 'bottom' }).state;
    const result = applyCommand(state, {
      type: 'destroyPermanents', selector: { kind: 'cards', cardIds: ['c2', 'c1', 'c2'] },
    }).state;
    expect([result.cards.c1.zone, result.cards.c2.zone]).toEqual(['graveyard', 'graveyard']);
    const events = result.eventLog.filter((event) => event.type === 'zoneChange' && event.reason === 'destroy');
    expect(events).toHaveLength(2);
    expect(new Set(events.map((event) => event.simultaneousGroupId)).size).toBe(1);
  });

  it('keeps unsupported mass composites wholly manual', () => {
    const source = def('cr609-source', 'Sorcery');
    const compiled = compileAbilityIR(
      parseAbilityIR('Destroy each nonland permanent with mana value 2 or less. Add {B} for each permanent destroyed this way.', 'Sorcery'),
      { sourceId: 'source', def: source },
    );
    expect(compiled).toMatchObject({ decision: 'manual', commands: [], prompts: [] });
  });

  it('records token destruction separately from the later token-cease SBA', () => {
    let state = initGame([], 1);
    state = applyCommand(state, {
      type: 'createToken', name: 'cr609-token', typeLine: 'Creature', power: '1', toughness: '1', quantity: 1,
    }).state;
    const tokenId = state.zones.battlefield[0];
    state = applyCommand(state, {
      type: 'destroyPermanents', selector: { kind: 'cards', cardIds: [tokenId] },
    }).state;
    const destroy = state.eventLog.find((event) => event.type === 'zoneChange' && event.physicalCardId === tokenId && event.reason === 'destroy');
    const cease = state.eventLog.find((event) => event.type === 'zoneChange' && event.physicalCardId === tokenId && event.reason === 'token-cease');
    expect(destroy?.simultaneousGroupId).toBeTruthy();
    expect(cease?.simultaneousGroupId).toBeTruthy();
    expect(cease?.simultaneousGroupId).not.toBe(destroy?.simultaneousGroupId);
  });

  it('keeps a fully-auto companion in written order and rejects a guided companion', () => {
    const source = def('cr609-order-source', 'Sorcery');
    expect(compileAbilityIR(parseAbilityIR('Destroy all creatures. Draw a card.', 'Sorcery'), {
      sourceId: 'source', def: source,
    }).commands.map((command) => command.type)).toEqual(['destroyPermanents', 'draw']);
    expect(compileAbilityIR(parseAbilityIR('Draw a card. Destroy all creatures.', 'Sorcery'), {
      sourceId: 'source', def: source,
    }).commands.map((command) => command.type)).toEqual(['draw', 'destroyPermanents']);
    expect(compileAbilityIR(parseAbilityIR('Destroy all creatures. Exile target creature.', 'Sorcery'), {
      sourceId: 'source', def: source,
    })).toMatchObject({ decision: 'manual', commands: [], prompts: [] });
  });
});
