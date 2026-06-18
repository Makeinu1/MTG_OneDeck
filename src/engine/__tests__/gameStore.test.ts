import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '../../store/gameStore';
import { createRng, shuffledOrder } from '../random';
import { makeDef, makeDeck } from './helpers';

const store = () => useGameStore.getState();

describe('GameStore', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('newGame draws 7 and defers auto-advance to the mulligan decision (M4.17)', () => {
    store().newGame(makeDeck(30), 1);
    const s = store().state!;
    expect(s).not.toBeNull();
    expect(s.phase).toBe('untap');
    expect(s.zones.hand).toHaveLength(7);
    expect(s.zones.library).toHaveLength(23);
    expect(store().mulliganDecisionPending).toBe(true);
    expect(store().canUndo).toBe(false);
  });

  it('beginFirstTurn auto-advances to main1 and draws (hand 8) after keep', () => {
    store().newGame(makeDeck(30), 1);
    store().keepOpeningHand();
    store().beginFirstTurn();
    const s = store().state!;
    expect(s.phase).toBe('main1');
    expect(s.zones.hand).toHaveLength(8);
    expect(s.zones.library).toHaveLength(22);
    expect(store().canUndo).toBe(false);
  });

  it('newGame stays on untap with 7 cards when auto-advance is disabled', () => {
    useGameStore.setState({ autoAdvanceToMain: false });

    store().newGame(makeDeck(30), 1);
    const s = store().state!;

    expect(s.phase).toBe('untap');
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

  it('tapForMana adds the parsed amount for multi-mana sources', () => {
    const vault = makeDef({
      scryfallId: 'vault',
      typeLine: 'Artifact',
      producedMana: ['C'],
      faces: [
        {
          name: 'vault',
          typeLine: 'Artifact',
          oracleText: '{T}: Add {C}{C}{C}.',
        },
      ],
    });
    const deck = [{ def: vault, isCommander: false }, ...makeDeck(5)];
    store().newGame(deck, 1);
    const vaultId = Object.values(store().state!.cards).find((c) => c.defId === 'vault')!.id;
    store().moveCard(vaultId, 'battlefield', 'bottom');

    expect(store().tapForMana(vaultId)).toBe('ok');
    expect(store().state!.manaPool.C).toBe(3);
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
    // castCommander remains on the legacy path: the cast itself increments
    // castCount, and returning to command increments it again.
    store().dispatch({ type: 'addMana', color: 'G', amount: 3 });
    const res = store().castCommander(cmdId);
    expect(res).toEqual({ shortfall: 3 });
  });

  it('adjustMana edits the pool through the store and clamps at 0', () => {
    store().newGame(makeDeck(10), 1);

    store().adjustMana('W', 2);
    expect(store().state!.manaPool.W).toBe(2);

    store().adjustMana('W', -5);
    expect(store().state!.manaPool.W).toBe(0);
  });

  it('playLand requests confirmation after the first land', () => {
    const first = makeDef({
      scryfallId: 'land-1',
      typeLine: 'Basic Land — Plains',
      faces: [{ name: 'land-1', typeLine: 'Basic Land — Plains' }],
    });
    const second = makeDef({
      scryfallId: 'land-2',
      typeLine: 'Basic Land — Plains',
      faces: [{ name: 'land-2', typeLine: 'Basic Land — Plains' }],
    });
    store().newGame([
      { def: first, isCommander: false },
      { def: second, isCommander: false },
      ...makeDeck(5),
    ], 1);
    const firstId = Object.values(store().state!.cards).find((c) => c.defId === 'land-1')!.id;
    const secondId = Object.values(store().state!.cards).find((c) => c.defId === 'land-2')!.id;

    expect(store().playLand(firstId)).toBe('ok');
    expect(store().playLand(secondId)).toBe('needs-confirm');
    expect(store().state!.cards[secondId].zone).toBe('hand');
    expect(store().playLand(secondId, { force: true })).toBe('ok');
    expect(store().state!.cards[secondId].zone).toBe('battlefield');
    expect(store().warnings).toContain('このターン2枚目の土地です。');
  });

  it('castFromHand auto-taps and resolves as a single undo step', () => {
    const mountain = makeDef({
      scryfallId: 'mountain',
      typeLine: 'Basic Land — Mountain',
      producedMana: ['R'],
      faces: [{ name: 'mountain', typeLine: 'Basic Land — Mountain' }],
    });
    const bolt = makeDef({
      scryfallId: 'bolt',
      typeLine: 'Instant',
      faces: [{ name: 'bolt', typeLine: 'Instant', manaCost: '{R}' }],
    });
    store().newGame([
      { def: mountain, isCommander: false },
      { def: bolt, isCommander: false },
      ...makeDeck(5),
    ], 1);
    const mountainId = Object.values(store().state!.cards).find((c) => c.defId === 'mountain')!.id;
    const boltId = Object.values(store().state!.cards).find((c) => c.defId === 'bolt')!.id;

    store().playLand(mountainId);
    store().clearWarnings();

    expect(store().castFromHand(boltId)).toBe('ok');
    expect(store().state!.cards[mountainId].tapped).toBe(true);
    expect(store().state!.cards[boltId].zone).toBe('graveyard');
    expect(store().state!.manaPool.R).toBe(0);

    store().undo();
    expect(store().state!.cards[mountainId].zone).toBe('battlefield');
    expect(store().state!.cards[mountainId].tapped).toBe(false);
    expect(store().state!.cards[boltId].zone).toBe('hand');
  });

  it('cycle discards, draws, and undoes as a single step', () => {
    const island = makeDef({
      scryfallId: 'island',
      typeLine: 'Basic Land — Island',
      producedMana: ['U'],
      faces: [{ name: 'island', typeLine: 'Basic Land — Island' }],
    });
    const cycler = makeDef({
      scryfallId: 'cycler',
      typeLine: 'Creature',
      faces: [
        {
          name: 'cycler',
          typeLine: 'Creature',
          manaCost: '{3}{U}',
          oracleText: 'Cycling {U}',
        },
      ],
    });
    store().newGame([
      { def: island, isCommander: false },
      { def: cycler, isCommander: false },
      ...makeDeck(12),
    ], 1);
    const islandId = Object.values(store().state!.cards).find((c) => c.defId === 'island')!.id;
    const cyclerId = Object.values(store().state!.cards).find((c) => c.defId === 'cycler')!.id;

    store().moveCard(islandId, 'battlefield', 'bottom');
    const handBeforeCycle = store().state!.zones.hand.length;
    expect(store().cycle(cyclerId)).toBe('ok');
    expect(store().state!.cards[cyclerId].zone).toBe('graveyard');
    expect(store().state!.cards[islandId].tapped).toBe(true);
    expect(store().state!.zones.hand.length).toBe(handBeforeCycle);

    store().undo();
    expect(store().state!.cards[cyclerId].zone).toBe('hand');
    expect(store().state!.cards[islandId].tapped).toBe(false);
    expect(store().state!.zones.hand.length).toBe(handBeforeCycle);
  });

  it('cycle returns a shortfall when mana is missing', () => {
    const cycler = makeDef({
      scryfallId: 'cycler-short',
      typeLine: 'Creature',
      faces: [
        {
          name: 'cycler-short',
          typeLine: 'Creature',
          oracleText: 'Cycling {2}',
        },
      ],
    });
    store().newGame([{ def: cycler, isCommander: false }, ...makeDeck(5)], 1);
    const cyclerId = Object.values(store().state!.cards).find((c) => c.defId === 'cycler-short')!.id;

    expect(store().cycle(cyclerId)).toEqual({ shortfall: 2 });
    expect(store().state!.cards[cyclerId].zone).toBe('hand');
  });

  it('warns when summoning-sick creatures are tapped manually', () => {
    const dork = makeDef({
      scryfallId: 'dork',
      typeLine: 'Creature — Elf Druid',
      producedMana: ['G'],
      faces: [{ name: 'dork', typeLine: 'Creature — Elf Druid' }],
    });
    store().newGame([{ def: dork, isCommander: false }, ...makeDeck(5)], 1);
    const dorkId = Object.values(store().state!.cards).find((c) => c.defId === 'dork')!.id;
    store().moveCard(dorkId, 'battlefield', 'bottom');
    store().clearWarnings();

    expect(store().tapForMana(dorkId)).toBe('ok');
    expect(store().warnings).toContain('《dork》は召喚酔い中です。');
    expect(store().state!.cards[dorkId].tapped).toBe(true);
    expect(store().state!.manaPool.G).toBe(1);

    store().clearWarnings();
    store().toggleTap(dorkId);
    expect(store().warnings).toContain('《dork》は召喚酔い中です。');
  });

  it('mulligan is committed as a single free-mulligan step', () => {
    store().newGame(makeDeck(20), 1);
    const opening = JSON.stringify(store().state);

    store().mulligan();
    expect(store().state!.zones.hand).toHaveLength(7);
    expect(store().state!.mulliganCount).toBe(1);

    store().undo();
    expect(JSON.stringify(store().state)).toBe(opening);
  });

  it('cracks treasure tokens through the store', () => {
    store().newGame(makeDeck(5), 1);
    store().createToken('宝物', 'Token Artifact — Treasure', undefined, undefined, 1, {
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      tokenKind: 'treasure',
    });
    const treasureId = store().state!.zones.battlefield.find((id) => store().state!.cards[id].isToken)!;

    store().crackTreasure(treasureId, 'R');
    expect(store().state!.manaPool.R).toBe(1);
    expect(store().state!.cards[treasureId]).toBeUndefined();
  });

  it('discardRandom is deterministic for a fixed seed', () => {
    store().newGame(makeDeck(12), 1);
    const handBefore = store().state!.zones.hand.slice();
    const expected = shuffledOrder(handBefore, createRng(1)).slice(0, 3);

    vi.spyOn(Math, 'random').mockReturnValue(0);
    store().discardRandom(3);

    expect(store().state!.zones.graveyard.slice(-3)).toEqual(expected);
    expect(expected.every((id) => store().state!.cards[id].zone === 'graveyard')).toBe(true);
  });

  it('clearWarnings empties warnings', () => {
    store().newGame(makeDeck(30), 1);
    store().dispatch({ type: 'payMana', payment: { W: 5, U: 0, B: 0, R: 0, G: 0, C: 0 } });
    expect(store().warnings.length).toBeGreaterThan(0);
    store().clearWarnings();
    expect(store().warnings).toEqual([]);
  });
});
