import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../../store/gameStore';
import { makeDef, makeDeck } from './helpers';

const store = () => useGameStore.getState();

describe('GameStore', () => {
  beforeEach(() => {
    useGameStore.setState({ state: null, warnings: [], canUndo: false, canRedo: false });
  });

  it('newGame initializes and draws 7', () => {
    store().newGame(makeDeck(30), 1);
    const s = store().state!;
    expect(s).not.toBeNull();
    expect(s.zones.hand).toHaveLength(7);
    expect(s.zones.library).toHaveLength(23);
    expect(store().canUndo).toBe(false);
  });

  it('dispatch pushes history and enables undo/redo', () => {
    store().newGame(makeDeck(30), 1);
    const before = store().state!.life;
    store().dispatch({ type: 'adjustLife', delta: -5 });
    expect(store().state!.life).toBe(before - 5);
    expect(store().canUndo).toBe(true);

    store().undo();
    expect(store().state!.life).toBe(before);
    expect(store().canRedo).toBe(true);

    store().redo();
    expect(store().state!.life).toBe(before - 5);
  });

  it('undo/redo round trip preserves state', () => {
    store().newGame(makeDeck(30), 1);
    const snap = JSON.stringify(store().state);
    store().dispatch({ type: 'adjustLife', delta: -1 });
    store().dispatch({ type: 'adjustLife', delta: -1 });
    store().undo();
    store().undo();
    expect(JSON.stringify(store().state)).toBe(snap);
  });

  it('history is capped at 200', () => {
    store().newGame(makeDeck(30), 1);
    for (let i = 0; i < 250; i++) {
      store().dispatch({ type: 'adjustLife', delta: -1 });
    }
    // We can only undo at most 200 times.
    let undos = 0;
    while (store().canUndo && undos < 1000) {
      store().undo();
      undos++;
    }
    expect(undos).toBe(200);
  });

  it('toggleTap flips tapped state', () => {
    store().newGame(makeDeck(30), 1);
    const id = store().state!.zones.hand[0];
    store().moveCard(id, 'battlefield', 'bottom');
    store().toggleTap(id);
    expect(store().state!.cards[id].tapped).toBe(true);
    store().toggleTap(id);
    expect(store().state!.cards[id].tapped).toBe(false);
  });

  it('tapForMana single-color taps and adds mana', () => {
    const land = makeDef({
      scryfallId: 'forest',
      typeLine: 'Basic Land — Forest',
      producedMana: ['G'],
    });
    const deck = [{ def: land, isCommander: false }, ...makeDeck(5)];
    store().newGame(deck, 1);
    // ensure the forest is in hand then on battlefield
    let s = store().state!;
    const forestId = Object.values(s.cards).find((c) => c.defId === 'forest')!.id;
    store().moveCard(forestId, 'battlefield', 'bottom');
    const res = store().tapForMana(forestId);
    expect(res).toBe('ok');
    s = store().state!;
    expect(s.cards[forestId].tapped).toBe(true);
    expect(s.manaPool.G).toBe(1);
  });

  it('tapForMana multi-color needs choice', () => {
    const dual = makeDef({
      scryfallId: 'dual',
      typeLine: 'Land',
      producedMana: ['W', 'U'],
    });
    const deck = [{ def: dual, isCommander: false }, ...makeDeck(5)];
    store().newGame(deck, 1);
    const dualId = Object.values(store().state!.cards).find((c) => c.defId === 'dual')!.id;
    store().moveCard(dualId, 'battlefield', 'bottom');
    expect(store().tapForMana(dualId)).toBe('needs-choice');
    // still untapped, no mana
    expect(store().state!.cards[dualId].tapped).toBe(false);
    expect(store().tapForMana(dualId, 'U')).toBe('ok');
    expect(store().state!.manaPool.U).toBe(1);
  });

  it('castFromHand returns shortfall when underfunded and not forced', () => {
    const spell = makeDef({
      scryfallId: 'bolt',
      typeLine: 'Instant',
      faces: [{ name: 'bolt', typeLine: 'Instant', manaCost: '{R}' }],
    });
    const deck = [{ def: spell, isCommander: false }, ...makeDeck(5)];
    store().newGame(deck, 1);
    const id = Object.values(store().state!.cards).find((c) => c.defId === 'bolt')!.id;
    const res = store().castFromHand(id);
    expect(res).toEqual({ shortfall: 1 });
    // state unchanged: still in hand
    expect(store().state!.cards[id].zone).toBe('hand');
  });

  it('castFromHand succeeds with sufficient mana', () => {
    const spell = makeDef({
      scryfallId: 'bolt',
      typeLine: 'Instant',
      faces: [{ name: 'bolt', typeLine: 'Instant', manaCost: '{R}' }],
    });
    const deck = [{ def: spell, isCommander: false }, ...makeDeck(5)];
    store().newGame(deck, 1);
    const id = Object.values(store().state!.cards).find((c) => c.defId === 'bolt')!.id;
    store().dispatch({ type: 'addMana', color: 'R', amount: 1 });
    const res = store().castFromHand(id);
    expect(res).toBe('ok');
    expect(store().state!.cards[id].zone).toBe('graveyard');
    expect(store().state!.manaPool.R).toBe(0);
  });

  it('castCommander adds commander tax', () => {
    const cmd = makeDef({
      scryfallId: 'cmd-1',
      typeLine: 'Legendary Creature',
      faces: [{ name: 'cmd-1', typeLine: 'Legendary Creature', manaCost: '{1}{G}' }],
    });
    store().newGame(makeDeck(5, [cmd]), 1);
    const cmdId = store().state!.commanders[0].cardId;
    // first cast costs {1}{G} = 2. give 2 generic-able mana
    store().dispatch({ type: 'addMana', color: 'G', amount: 2 });
    expect(store().castCommander(cmdId)).toBe('ok');
    expect(store().state!.commanders[0].castCount).toBe(1);

    // send back to command zone
    store().moveCard(cmdId, 'command', 'top');
    // second cast: cost 2 + tax 2 = 4. only give 3 -> shortfall 1
    store().dispatch({ type: 'addMana', color: 'G', amount: 3 });
    const res = store().castCommander(cmdId);
    expect(res).toEqual({ shortfall: 1 });
  });

  it('clearWarnings empties warnings', () => {
    store().newGame(makeDeck(30), 1);
    store().dispatch({ type: 'payMana', payment: { W: 5, U: 0, B: 0, R: 0, G: 0, C: 0 } });
    expect(store().warnings.length).toBeGreaterThan(0);
    store().clearWarnings();
    expect(store().warnings).toEqual([]);
  });
});
