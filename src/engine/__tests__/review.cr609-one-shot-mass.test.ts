// REVIEWER-OWNED acceptance contract for cr-609-one-shot-mass.
// Implementers must not edit this file; fix implementation when it fails.
// CR grounding: 608.2c/f/h, 609.1/609.3, 701.8a-b, 702.12b, 704.5f/g/h.
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand, type GameCommand } from '../commands';
import { buildGuidedCommands, compileAbilityIR, type EffectPrompt } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import { playerIdForLifeLabel, type GameState, type PlayerId } from '../types';
import { makeDef } from './helpers';

function def(id: string, typeLine: string, cmc = 0, oracleText = ''): CardDef {
  return makeDef({
    scryfallId: id,
    name: id,
    typeLine,
    cmc,
    faces: [{ name: id, typeLine, oracleText, ...(typeLine.includes('Creature') ? { power: '2', toughness: '2' } : {}) }],
  });
}

function compile(text: string, announcedX?: number) {
  const source = def('cr609-compile-source', 'Sorcery', 3, text);
  return compileAbilityIR(parseAbilityIR(text, 'Sorcery'), {
    sourceId: 'source',
    controllerId: 'P1',
    def: source,
    ...(announcedX === undefined ? {} : { announcedX }),
  });
}

function moveToBattlefield(state: GameState, cardId: string): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'bottom' }).state;
}

function createDummy(
  state: GameState,
  cardId: string,
  playerId: PlayerId,
  typeLine: string,
  keywords: string[] = [],
): GameState {
  return applyCommand(state, {
    type: 'createScenarioDummy',
    cardId,
    defId: `${cardId}-def`,
    playerId,
    name: cardId,
    typeLine,
    power: typeLine.includes('Creature') ? '2' : undefined,
    toughness: typeLine.includes('Creature') ? '2' : undefined,
    tapped: false,
    counters: {},
    keywords,
    isToken: false,
  }).state;
}

function destroyEvents(state: GameState, ids: readonly string[]) {
  return state.eventLog
    .filter((event) => event.type === 'zoneChange' && ids.includes(event.physicalCardId) && event.reason === 'destroy')
    .map((event) => ({
      id: event.physicalCardId ?? '',
      to: event.toZone,
      replacement: event.replacementApplied,
      group: event.simultaneousGroupId,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

describe('CR609 one-shot mass destroy reviewer pins', () => {
  it('compiles the exact plain mass shape to one battlefield-filter command', () => {
    expect(compile('Destroy all creatures.')).toMatchObject({
      decision: 'auto',
      prompts: [],
      commands: [{
        type: 'destroyPermanents',
        selector: { kind: 'battlefield-filter', typesAnyOf: ['creature'] },
      }],
    });
  });

  it('keeps written order when every companion clause is already fully automatic', () => {
    expect(compile('Destroy all creatures. Draw a card.')).toMatchObject({
      decision: 'auto',
      prompts: [],
      commands: [
        {
          type: 'destroyPermanents',
          selector: { kind: 'battlefield-filter', typesAnyOf: ['creature'] },
        },
        { type: 'draw', count: 1 },
      ],
    });
    expect(compile('Draw a card. Destroy all creatures.')).toMatchObject({
      decision: 'auto',
      commands: [
        { type: 'draw', count: 1 },
        {
          type: 'destroyPermanents',
          selector: { kind: 'battlefield-filter', typesAnyOf: ['creature'] },
        },
      ],
    });
  });

  it('rejects conditional draw companions instead of applying their supported-looking subset', () => {
    for (const oracleText of [
      'Each player who controls a creature with power 4 or greater draws a card. Then destroy all creatures.',
      'Players who control a multicolored creature draw a card. Then destroy all creatures.',
    ]) {
      expect(compile(oracleText)).toMatchObject({
        decision: 'manual',
        commands: [],
      });
    }
  });

  it('Ruinous Ultimatum uses controller complement across four players and ignores hexproof', () => {
    let state = initGame([], 1);
    state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Amy', delta: 0 }).state;
    state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Bob', delta: 0 }).state;
    const amy = playerIdForLifeLabel('Amy');
    const bob = playerIdForLifeLabel('Bob');
    state = createDummy(state, 'mine', 'P1', 'Creature');
    state = createDummy(state, 'opp-a', 'OPPONENT_A', 'Artifact');
    state = createDummy(state, 'opp-amy', amy, 'Creature', ['hexproof']);
    state = createDummy(state, 'opp-bob-land', bob, 'Land Creature');
    state = createDummy(state, 'opp-bob-indestructible', bob, 'Enchantment', ['indestructible']);

    const compiled = compile('Destroy all nonland permanents your opponents control.');
    expect(compiled).toMatchObject({
      decision: 'auto',
      commands: [{
        type: 'destroyPermanents',
        selector: {
          kind: 'battlefield-filter',
          excludedTypesAnyOf: ['land'],
          controller: { kind: 'is-not', playerId: 'P1' },
        },
      }],
    });
    for (const command of compiled.commands) state = applyCommand(state, command).state;

    expect(state.cards.mine.zone).toBe('battlefield');
    expect(state.cards['opp-a'].zone).toBe('graveyard');
    expect(state.cards['opp-amy'].zone).toBe('graveyard');
    expect(state.cards['opp-bob-land'].zone).toBe('battlefield');
    expect(state.cards['opp-bob-indestructible'].zone).toBe('battlefield');
    const events = destroyEvents(state, ['opp-a', 'opp-amy']);
    expect(new Set(events.map((event) => event.group)).size).toBe(1);
    expect(events[0]?.group).toBeTruthy();
  });

  it('binds saved X including zero and does not duplicate a multi-type permanent', () => {
    expect(compile('Destroy each artifact, creature, and enchantment with mana value X or less.', 0)).toMatchObject({
      decision: 'auto',
      commands: [{
        type: 'destroyPermanents',
        selector: {
          kind: 'battlefield-filter',
          typesAnyOf: ['artifact', 'creature', 'enchantment'],
          maxManaValue: 0,
        },
      }],
    });
    const x3 = compile('Destroy each artifact, creature, and enchantment with mana value X or less.', 3);
    expect(x3.commands[0]).toMatchObject({ selector: { maxManaValue: 3 } });

    const multi = def('cr609-multi', 'Artifact Creature', 2);
    const expensive = def('cr609-expensive', 'Enchantment', 4);
    let state = initGame([{ def: multi, isCommander: false }, { def: expensive, isCommander: false }], 1);
    state = moveToBattlefield(state, 'c1');
    state = moveToBattlefield(state, 'c2');
    state = applyCommand(state, x3.commands[0]).state;
    expect(state.cards.c1.zone).toBe('graveyard');
    expect(state.cards.c2.zone).toBe('battlefield');
    expect(destroyEvents(state, ['c1']).length).toBe(1);
  });

  it('freezes graveyard replacement applicability before destroying its own source', () => {
    const replacement = def(
      'cr609-replacement-source',
      'Enchantment',
      4,
      'If a card would be put into your graveyard from anywhere, exile it instead.',
    );
    const victim = def('cr609-replacement-victim', 'Creature', 2);
    let state = initGame([{ def: replacement, isCommander: false }, { def: victim, isCommander: false }], 1);
    state = moveToBattlefield(state, 'c1');
    state = moveToBattlefield(state, 'c2');

    const forward: GameCommand = {
      type: 'destroyPermanents',
      selector: { kind: 'cards', cardIds: ['c1', 'c2'] },
    };
    const reverse: GameCommand = {
      type: 'destroyPermanents',
      selector: { kind: 'cards', cardIds: ['c2', 'c1'] },
    };
    const a = applyCommand(state, forward).state;
    const b = applyCommand(state, reverse).state;

    expect([a.cards.c1.zone, a.cards.c2.zone]).toEqual(['exile', 'exile']);
    expect([b.cards.c1.zone, b.cards.c2.zone]).toEqual(['exile', 'exile']);
    expect(destroyEvents(a, ['c1', 'c2'])).toEqual(destroyEvents(b, ['c1', 'c2']));
  });

  it('freezes effective indestructible when the attached granting source is destroyed too', () => {
    const creature = def('cr609-keyword-victim', 'Creature', 2);
    const aura = def(
      'cr609-keyword-source',
      'Enchantment — Aura',
      2,
      'Enchanted creature has indestructible.',
    );
    let state = initGame([{ def: creature, isCommander: false }, { def: aura, isCommander: false }], 1);
    state = moveToBattlefield(state, 'c1');
    state = moveToBattlefield(state, 'c2');
    state = applyCommand(state, { type: 'attach', cardId: 'c2', to: 'c1' }).state;
    state = applyCommand(state, {
      type: 'destroyPermanents', selector: { kind: 'cards', cardIds: ['c2', 'c1'] },
    }).state;
    expect(state.cards.c2.zone).toBe('graveyard');
    expect(state.cards.c1.zone).toBe('battlefield');
  });

  it('freezes effective type when the attached type-granting source is destroyed too', () => {
    const land = def('cr609-type-victim', 'Land', 0);
    const auraCreature = def(
      'cr609-type-source',
      'Enchantment Creature — Aura',
      2,
      'Enchanted land is a creature in addition to its other types.',
    );
    let state = initGame([{ def: land, isCommander: false }, { def: auraCreature, isCommander: false }], 1);
    state = moveToBattlefield(state, 'c1');
    state = moveToBattlefield(state, 'c2');
    state = applyCommand(state, { type: 'attach', cardId: 'c2', to: 'c1' }).state;
    state = applyCommand(state, {
      type: 'destroyPermanents',
      selector: { kind: 'battlefield-filter', typesAnyOf: ['creature'] },
    }).state;
    expect(state.cards.c1.zone).toBe('graveyard');
    expect(state.cards.c2.zone).toBe('graveyard');
    expect(destroyEvents(state, ['c1', 'c2'])).toHaveLength(2);
  });

  it('target destroy uses destroyPermanents and Feed-the-Swarm life loss stays ordered', () => {
    const plain: EffectPrompt = {
      atom: 'effect.destroy', kind: 'target', count: 1,
      filter: { types: ['creature'] }, raw: 'Destroy target creature.',
    };
    expect(buildGuidedCommands(plain, { kind: 'target', cardIds: ['victim'] }, {
      sourceId: 'source', def: def('cr609-target-source', 'Sorcery'),
    })).toEqual([{
      type: 'destroyPermanents', selector: { kind: 'cards', cardIds: ['victim'] },
    }]);

    const feed = compile('Destroy target creature. You lose life equal to its mana value.');
    expect(buildGuidedCommands(feed.prompts[0], {
      kind: 'target', cardIds: ['victim'], targetSnapshots: [{ manaValue: 4 } as never],
    }, { sourceId: 'source', def: def('cr609-feed-source', 'Sorcery') })).toEqual([
      { type: 'destroyPermanents', selector: { kind: 'cards', cardIds: ['victim'] } },
      { type: 'adjustLife', delta: -4 },
    ]);
  });

  it.each([
    ['Culling Ritual', 'Destroy each nonland permanent with mana value 2 or less. Add {B} or {G} for each permanent destroyed this way.'],
    ['Blasphemous Act', 'Blasphemous Act deals 13 damage to each creature.'],
    ['Toxic Deluge', 'All creatures get -X/-X until end of turn.'],
    ['missing X', 'Destroy each artifact, creature, and enchantment with mana value X or less.'],
    ['regeneration suffix', "Destroy all creatures. They can't be regenerated."],
    ['unsupported companion', 'Destroy all creatures. Surveil X.'],
  ])('keeps %s wholly manual with no executable subset', (_name, text) => {
    expect(compile(text)).toMatchObject({ decision: 'manual', commands: [], prompts: [] });
  });
});
