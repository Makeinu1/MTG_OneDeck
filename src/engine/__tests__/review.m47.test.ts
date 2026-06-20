/**
 * Reviewer-owned adversarial tests for M4.7 (docs/engine-spec.md §8).
 * Implementation agents must NOT modify this file.
 */
import { describe, expect, it } from 'vitest';
import type { CardDef } from '../../types/card';
import { applyCommand, EngineError } from '../commands';
import { keywords, landEntersTapped, effectivePower } from '../status';
import { initGame, type InitDeckCard } from '../init';
import { useGameStore } from '../../store/gameStore';
import type { GameState } from '../types';
import { makeDef } from './helpers';

function def(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return makeDef({ scryfallId: id, ...overrides });
}

function gameOf(defs: CardDef[]): GameState {
  const deck: InitDeckCard[] = defs.map((d) => ({ def: d, isCommander: false }));
  return initGame(deck, 1);
}

function idOf(s: GameState, defId: string): string {
  return Object.values(s.cards).find((c) => c.defId === defId)!.id;
}

describe('arrangeTop (spec §8.2, §8.5/I8)', () => {
  function libGame(n: number): GameState {
    return gameOf(Array.from({ length: n }, (_, i) => def(`c-${i}`)));
  }

  it('reorders the top, sends some to bottom and graveyard, preserving every id (I1)', () => {
    const s = libGame(6);
    const top4 = s.zones.library.slice(0, 4);
    const [a, b, c, d] = top4;
    const r = applyCommand(s, {
      type: 'arrangeTop',
      topOrder: [b, a], // keep b,a on top in this order
      toBottom: [c],
      toGraveyard: [d],
    });
    // top of library is now b, a
    expect(r.state.zones.library[0]).toBe(b);
    expect(r.state.zones.library[1]).toBe(a);
    // c was sent to the bottom
    expect(r.state.zones.library[r.state.zones.library.length - 1]).toBe(c);
    // d is in the graveyard, gone from library
    expect(r.state.zones.graveyard).toContain(d);
    expect(r.state.zones.library).not.toContain(d);
    // I1: every original id still present exactly once across zones
    const all = [...r.state.zones.library, ...r.state.zones.graveyard];
    expect(new Set(all).size).toBe(all.length);
    expect(r.state.zones.library.length + r.state.zones.graveyard.length).toBe(6);
    expect(r.state.cards[d].zone).toBe('graveyard');
  });

  it('rejects when the provided ids are not exactly the top N', () => {
    const s = libGame(6);
    const top = s.zones.library.slice(0, 2);
    const deeper = s.zones.library[4];
    expect(() =>
      applyCommand(s, { type: 'arrangeTop', topOrder: [top[0], deeper], toBottom: [], toGraveyard: [] }),
    ).toThrow(EngineError);
    // duplicates also rejected
    expect(() =>
      applyCommand(s, { type: 'arrangeTop', topOrder: [top[0], top[0]], toBottom: [], toGraveyard: [] }),
    ).toThrow(EngineError);
  });
});

describe('adjustOpponentLife (spec §8.2)', () => {
  it('adjusts from a 40 baseline and allows going to zero/negative', () => {
    const s = gameOf([def('a')]);
    let r = applyCommand(s, { type: 'adjustOpponentLife', label: '対戦相手A', delta: -40 });
    expect(r.state.opponentLife['対戦相手A']).toBe(0);
    r = applyCommand(r.state, { type: 'adjustOpponentLife', label: '対戦相手A', delta: -3 });
    expect(r.state.opponentLife['対戦相手A']).toBe(-3);
    // unknown label starts at 40
    const r2 = applyCommand(s, { type: 'adjustOpponentLife', label: 'B', delta: -1 });
    expect(r2.state.opponentLife['B']).toBe(39);
  });
});

describe('landEntersTapped (spec §8.3)', () => {
  it('classifies always / never / conditional', () => {
    const tapland = def('tap', {
      typeLine: 'Land',
      faces: [{ name: 'tap', typeLine: 'Land', oracleText: 'This land enters tapped.' }],
    });
    const basic = def('plains', {
      typeLine: 'Basic Land — Plains',
      faces: [{ name: 'plains', typeLine: 'Basic Land — Plains' }],
    });
    const shock = def('shock', {
      typeLine: 'Land',
      faces: [
        {
          name: 'shock',
          typeLine: 'Land',
          oracleText: 'As this land enters, you may pay 2 life. If you don’t, it enters tapped.',
        },
      ],
    });
    const altTap = def('alttap', {
      typeLine: 'Land',
      faces: [{ name: 'alttap', typeLine: 'Land', oracleText: 'This land enters the battlefield tapped.' }],
    });
    expect(landEntersTapped(tapland)).toBe('always');
    expect(landEntersTapped(basic)).toBe('never');
    expect(landEntersTapped(shock)).toBe('conditional');
    expect(landEntersTapped(altTap)).toBe('always');
  });
});

describe('keywords (spec §8.3)', () => {
  it('detects evergreen keywords from a pure English keyword line', () => {
    const en = def('drake', {
      typeLine: 'Creature — Drake',
      faces: [{ name: 'drake', typeLine: 'Creature — Drake', oracleText: 'Flying, vigilance, trample' }],
    });
    expect(keywords(en).sort()).toEqual(['flying', 'trample', 'vigilance']);
    const multi = def('oni', {
      typeLine: 'Creature — Demon',
      faces: [{ name: 'oni', typeLine: 'Creature — Demon', oracleText: 'Deathtouch, flying, lifelink' }],
    });
    expect(keywords(multi).sort()).toEqual(['deathtouch', 'flying', 'lifelink']);
    expect(keywords(def('vanilla', { faces: [{ name: 'v', typeLine: 'Creature' }] }))).toEqual([]);
  });
});

describe('effectivePower (spec §8.4)', () => {
  it('adds +1/+1 and subtracts -1/-1, treats non-numeric power as 0', () => {
    const star = def('star', {
      typeLine: 'Creature',
      faces: [{ name: 'star', typeLine: 'Creature', power: '*', toughness: '*' }],
    });
    let s = gameOf([star]);
    s = applyCommand(s, { type: 'draw', count: 1 }).state;
    const id = idOf(s, 'star');
    s = applyCommand(s, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
    expect(effectivePower(s, id)).toBe(0); // '*' -> 0
    s = applyCommand(s, { type: 'addCounters', cardId: id, counterType: '+1/+1', delta: 3 }).state;
    expect(effectivePower(s, id)).toBe(3);

    const bear = def('bear', {
      typeLine: 'Creature — Bear',
      faces: [{ name: 'bear', typeLine: 'Creature — Bear', power: '2', toughness: '2' }],
    });
    let s2 = gameOf([bear]);
    s2 = applyCommand(s2, { type: 'draw', count: 1 }).state;
    const bid = idOf(s2, 'bear');
    s2 = applyCommand(s2, { type: 'moveCard', cardId: bid, to: 'battlefield', position: 'bottom' }).state;
    s2 = applyCommand(s2, { type: 'addCounters', cardId: bid, counterType: '-1/-1', delta: 1 }).state;
    expect(effectivePower(s2, bid)).toBe(1);
  });
});

describe('store: declareAttack & auto-advance', () => {
  function bear(id: string, opts: { power?: string; vigilance?: boolean } = {}): CardDef {
    const text = opts.vigilance ? 'Vigilance' : undefined;
    return def(id, {
      typeLine: 'Creature — Bear',
      faces: [{ name: id, typeLine: 'Creature — Bear', power: opts.power ?? '3', toughness: '3', oracleText: text }],
    });
  }

  it('declareAttack sums power, taps non-vigilance attackers, drains chosen opponent', () => {
    const store = useGameStore.getState();
    store.newGame(
      [bear('a', { power: '4' }), bear('b', { power: '2', vigilance: true })].map((d) => ({
        def: d,
        isCommander: false,
      })),
      99,
    );
    // move both to battlefield and clear summoning sickness by advancing a turn
    let st = useGameStore.getState().state!;
    const aId = Object.values(st.cards).find((c) => c.defId === 'a')!.id;
    const bId = Object.values(st.cards).find((c) => c.defId === 'b')!.id;
    useGameStore.getState().moveCard(aId, 'battlefield', 'bottom');
    useGameStore.getState().moveCard(bId, 'battlefield', 'bottom');
    useGameStore.setState({ autoAdvanceToMain: false });
    useGameStore.getState().nextTurn();

    useGameStore.getState().declareAttack([aId, bId], '対戦相手A');
    st = useGameStore.getState().state!;
    expect(st.opponentLife['対戦相手A']).toBe(40 - 6);
    expect(st.cards[aId].tapped).toBe(true); // no vigilance -> tapped
    expect(st.cards[bId].tapped).toBe(false); // vigilance -> stays untapped
  });

  it('auto-advance lands on main1 in a single undo step', () => {
    const store = useGameStore.getState();
    store.newGame(Array.from({ length: 8 }, (_, i) => ({ def: def(`d-${i}`), isCommander: false })), 7);
    useGameStore.setState({ autoAdvanceToMain: true });
    const before = useGameStore.getState().state!;
    // jump to end phase, then a single nextPhase should roll to next turn's main1
    useGameStore.setState({ state: { ...before, phase: 'end' } });
    useGameStore.getState().nextPhase();
    const after = useGameStore.getState().state!;
    expect(after.phase).toBe('main1');
    expect(after.turn).toBe(before.turn + 1);
    // exactly one undo returns to the pre-advance (end-phase) state
    useGameStore.getState().undo();
    expect(useGameStore.getState().state!.phase).toBe('end');
  });
});
