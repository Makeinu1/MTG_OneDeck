import { beforeEach, describe, expect, it } from 'vitest';
import { applyCommand, EngineError } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import { effectivePower, keywords, landEntersTapped } from '../status';
import type { GameState } from '../types';
import { useGameStore } from '../../store/gameStore';
import { makeDef, makeDeck } from './helpers';

function setup(deck: InitDeckCard[]): GameState {
  const nonCommanderCount = deck.filter((card) => !card.isCommander).length;
  const base = initGame(deck, 1);
  return applyCommand(base, { type: 'draw', count: nonCommanderCount }).state;
}

function cardIdByDef(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((entry) => entry.defId === defId);
  if (!card) {
    throw new Error(`missing card for ${defId}`);
  }
  return card.id;
}

const store = () => useGameStore.getState();

describe('M4.7 engine helpers', () => {
  it('arrangeTop redistributes cards between top, bottom, and graveyard', () => {
    const state = initGame(makeDeck(6), 1);
    const firstThree = state.zones.library.slice(0, 3);

    const arranged = applyCommand(state, {
      type: 'arrangeTop',
      topOrder: [firstThree[1]],
      toBottom: [firstThree[2]],
      toGraveyard: [firstThree[0]],
    }).state;

    expect(arranged.zones.library).toEqual([
      firstThree[1],
      ...state.zones.library.slice(3),
      firstThree[2],
    ]);
    expect(arranged.zones.graveyard[arranged.zones.graveyard.length - 1]).toBe(firstThree[0]);
    expect(arranged.cards[firstThree[0]].zone).toBe('graveyard');
  });

  it('arrangeTop throws when the supplied ids are not exactly the top N cards', () => {
    const state = initGame(makeDeck(6), 1);
    const topTwo = state.zones.library.slice(0, 2);
    const outsider = state.zones.library[3];

    expect(() =>
      applyCommand(state, {
        type: 'arrangeTop',
        topOrder: [topTwo[0], outsider],
        toBottom: [],
        toGraveyard: [],
      })
    ).toThrow(EngineError);
  });

  it('classifies tapped-entry lands as always, conditional, or never', () => {
    const always = makeDef({
      scryfallId: 'always',
      typeLine: 'Land',
      faces: [
        {
          name: 'always',
          typeLine: 'Land',
          oracleText: 'Always enters the battlefield tapped.',
        },
      ],
    });
    const conditional = makeDef({
      scryfallId: 'conditional',
      typeLine: 'Land',
      faces: [
        {
          name: 'conditional',
          typeLine: 'Land',
          printedText: 'あなたが島をコントロールしていないなら、タップ状態で戦場に出る。',
        },
      ],
    });
    const never = makeDef({
      scryfallId: 'never',
      typeLine: 'Land',
      faces: [{ name: 'never', typeLine: 'Land' }],
    });

    expect(landEntersTapped(always)).toBe('always');
    expect(landEntersTapped(conditional)).toBe('conditional');
    expect(landEntersTapped(never)).toBe('never');
  });

  it('detects keywords from English and Japanese text', () => {
    const english = makeDef({
      scryfallId: 'english-keywords',
      typeLine: 'Creature — Angel',
      faces: [
        {
          name: 'english-keywords',
          typeLine: 'Creature — Angel',
          oracleText: 'Flying, vigilance, ward {2}',
        },
      ],
    });
    const japanese = makeDef({
      scryfallId: 'japanese-keywords',
      typeLine: 'Creature — Samurai',
      faces: [
        {
          name: 'japanese-keywords',
          typeLine: 'Creature — Samurai',
          printedText: '速攻、先制攻撃、呪禁',
        },
      ],
    });

    expect(keywords(english)).toEqual(['flying', 'vigilance', 'ward']);
    expect(keywords(japanese)).toEqual(['first-strike', 'haste', 'hexproof']);
  });

  it('computes effectivePower from printed power and counters', () => {
    const creature = makeDef({
      scryfallId: 'creature',
      typeLine: 'Creature — Beast',
      faces: [{ name: 'creature', typeLine: 'Creature — Beast', power: '3', toughness: '3' }],
    });
    const star = makeDef({
      scryfallId: 'star',
      typeLine: 'Creature — Spirit',
      faces: [{ name: 'star', typeLine: 'Creature — Spirit', power: '*', toughness: '*' }],
    });
    let state = setup([
      { def: creature, isCommander: false },
      { def: star, isCommander: false },
    ]);
    const creatureId = cardIdByDef(state, 'creature');
    const starId = cardIdByDef(state, 'star');

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: creatureId,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: starId,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'addCounters',
      cardId: creatureId,
      counterType: '+1/+1',
      delta: 2,
    }).state;
    state = applyCommand(state, {
      type: 'addCounters',
      cardId: creatureId,
      counterType: '-1/-1',
      delta: 1,
    }).state;

    expect(effectivePower(state, creatureId)).toBe(4);
    expect(effectivePower(state, starId)).toBe(0);
  });

  it('playLand applies entersTapped after the battlefield move', () => {
    const land = makeDef({
      scryfallId: 'guildgate',
      typeLine: 'Land',
      faces: [{ name: 'guildgate', typeLine: 'Land' }],
    });
    const state = setup([{ def: land, isCommander: false }]);
    const landId = cardIdByDef(state, 'guildgate');

    const tapped = applyCommand(state, {
      type: 'playLand',
      cardId: landId,
      forced: false,
      entersTapped: true,
    }).state;
    const untapped = applyCommand(state, {
      type: 'playLand',
      cardId: landId,
      forced: false,
      entersTapped: false,
    }).state;

    expect(tapped.cards[landId].zone).toBe('battlefield');
    expect(tapped.cards[landId].tapped).toBe(true);
    expect(untapped.cards[landId].tapped).toBe(false);
  });
});

describe('M4.7 store flows', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: true,
    });
  });

  it('playLand asks for a tap choice on conditional lands', () => {
    const conditionalLand = makeDef({
      scryfallId: 'conditional-land',
      typeLine: 'Land',
      faces: [
        {
          name: 'conditional-land',
          typeLine: 'Land',
          oracleText: 'This land enters the battlefield tapped unless you control a Plains.',
        },
      ],
    });

    store().newGame([{ def: conditionalLand, isCommander: false }, ...makeDeck(5)], 1);
    const landId = cardIdByDef(store().state!, 'conditional-land');

    expect(store().playLand(landId)).toBe('needs-tap-choice');
    expect(store().state!.cards[landId].zone).toBe('hand');
    expect(store().playLand(landId, { entersTapped: true })).toBe('ok');
    expect(store().state!.cards[landId].zone).toBe('battlefield');
    expect(store().state!.cards[landId].tapped).toBe(true);
  });

  it('declareAttack sums effective power, warns on summoning sickness, and leaves vigilance untapped', () => {
    const vigilant = makeDef({
      scryfallId: 'vigilant',
      typeLine: 'Creature — Angel',
      faces: [
        {
          name: 'vigilant',
          typeLine: 'Creature — Angel',
          power: '2',
          toughness: '2',
          oracleText: 'Vigilance',
        },
      ],
    });
    const brute = makeDef({
      scryfallId: 'brute',
      typeLine: 'Creature — Beast',
      faces: [{ name: 'brute', typeLine: 'Creature — Beast', power: '3', toughness: '3' }],
    });

    store().newGame(
      [
        { def: vigilant, isCommander: false },
        { def: brute, isCommander: false },
        ...makeDeck(5),
      ],
      1
    );
    const vigilantId = cardIdByDef(store().state!, 'vigilant');
    const bruteId = cardIdByDef(store().state!, 'brute');

    store().moveCard(vigilantId, 'battlefield', 'bottom');
    store().moveCard(bruteId, 'battlefield', 'bottom');
    store().dispatch({ type: 'addCounters', cardId: bruteId, counterType: '+1/+1', delta: 1 });
    store().clearWarnings();

    store().declareAttack([vigilantId, bruteId], '対戦相手A');

    expect(store().state!.opponentLife['対戦相手A']).toBe(34);
    expect(store().state!.cards[vigilantId].tapped).toBe(false);
    expect(store().state!.cards[bruteId].tapped).toBe(true);
    expect(store().warnings).toContain('《vigilant》は召喚酔い中です。');
    expect(store().warnings).toContain('《brute》は召喚酔い中です。');
  });

  it('auto-advances from untap to main1 as a single undo step', () => {
    store().newGame(makeDeck(20), 1);
    const base = store().state!;
    useGameStore.setState({
      state: { ...base, phase: 'end' },
      warnings: [],
      canUndo: false,
      canRedo: false,
    });
    const snapshot = JSON.stringify(store().state);
    const handBefore = store().state!.zones.hand.length;

    store().nextPhase();

    expect(store().state!.turn).toBe(2);
    expect(store().state!.phase).toBe('main1');
    expect(store().state!.zones.hand.length).toBe(handBefore + 1);

    store().undo();
    expect(JSON.stringify(store().state)).toBe(snapshot);
  });
});
