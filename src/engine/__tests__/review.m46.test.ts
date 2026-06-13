/**
 * Reviewer-owned adversarial tests for M4.6 (docs/engine-spec.md §7).
 * Implementation agents must NOT modify this file.
 */
import { describe, expect, it } from 'vitest';
import type { CardDef, ManaColor } from '../../types/card';
import { applyCommand, EngineError } from '../commands';
import { planAutoTap } from '../autotap';
import { isSummoningSick } from '../status';
import { parseManaCost } from '../mana';
import { initGame, type InitDeckCard } from '../init';
import type { GameState } from '../types';
import { makeDef } from './helpers';

function land(id: string, colors: ManaColor[]): CardDef {
  return makeDef({
    scryfallId: id,
    typeLine: 'Land',
    producedMana: colors,
    faces: [{ name: id, typeLine: 'Land' }],
  });
}

function creature(id: string, opts: { haste?: 'en' | 'ja'; mana?: ManaColor[] } = {}): CardDef {
  const oracleText =
    opts.haste === 'en' ? 'Haste\n{T}: Add one mana.' : undefined;
  const printedText = opts.haste === 'ja' ? '速攻' : undefined;
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature — Elf',
    producedMana: opts.mana,
    faces: [{ name: id, typeLine: 'Creature — Elf', oracleText, printedText }],
  });
}

/** Build a game whose battlefield contains the given defs (untapped, entered last turn). */
function boardGame(defs: CardDef[], extraHand: CardDef[] = []): GameState {
  const deck: InitDeckCard[] = [...defs, ...extraHand].map((def) => ({ def, isCommander: false }));
  let s = initGame(deck, 1);
  // draw everything to hand, then place board defs onto the battlefield
  s = applyCommand(s, { type: 'draw', count: deck.length }).state;
  for (const def of defs) {
    const id = Object.values(s.cards).find((c) => c.defId === def.scryfallId)!.id;
    s = applyCommand(s, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
  }
  // advance a full turn so battlefield cards are no longer summoning sick
  s = applyCommand(s, { type: 'nextTurn' }).state;
  return s;
}

function idOf(s: GameState, defId: string): string {
  return Object.values(s.cards).find((c) => c.defId === defId)!.id;
}

describe('playLand (spec §7.2)', () => {
  function gameWithHandLands(): GameState {
    const deck = [land('plains-1', ['W']), land('plains-2', ['W']), creature('bear')].map(
      (def) => ({ def, isCommander: false }),
    );
    let s = initGame(deck, 1);
    s = applyCommand(s, { type: 'draw', count: 3 }).state;
    return s;
  }

  it('counts land plays and warns from the second land', () => {
    const s = gameWithHandLands();
    const r1 = applyCommand(s, { type: 'playLand', cardId: idOf(s, 'plains-1'), forced: false });
    expect(r1.warnings).toEqual([]);
    expect(r1.state.landsPlayedThisTurn).toBe(1);
    const r2 = applyCommand(r1.state, {
      type: 'playLand',
      cardId: idOf(r1.state, 'plains-2'),
      forced: true,
    });
    expect(r2.state.landsPlayedThisTurn).toBe(2);
    expect(r2.warnings.length).toBeGreaterThan(0);
    expect(r2.state.cards[idOf(r2.state, 'plains-2')].zone).toBe('battlefield');
  });

  it('resets the counter on turn change', () => {
    let s = gameWithHandLands();
    s = applyCommand(s, { type: 'playLand', cardId: idOf(s, 'plains-1'), forced: false }).state;
    s = applyCommand(s, { type: 'nextTurn' }).state;
    expect(s.landsPlayedThisTurn).toBe(0);
  });

  it('rejects non-land and non-hand targets', () => {
    const s = gameWithHandLands();
    expect(() =>
      applyCommand(s, { type: 'playLand', cardId: idOf(s, 'bear'), forced: false }),
    ).toThrow(EngineError);
    const placed = applyCommand(s, {
      type: 'playLand',
      cardId: idOf(s, 'plains-1'),
      forced: false,
    }).state;
    expect(() =>
      applyCommand(placed, { type: 'playLand', cardId: idOf(placed, 'plains-1'), forced: false }),
    ).toThrow(EngineError);
  });
});

describe('turn-1 draw & ETB hooks (spec §7.3-§7.5)', () => {
  it('draws on turn 1 at the draw step (EDH rule)', () => {
    const deck = Array.from({ length: 10 }, (_, i) => ({
      def: makeDef({ scryfallId: `c-${i}` }),
      isCommander: false,
    }));
    let s = initGame(deck, 1);
    s = { ...s, phase: 'upkeep' };
    const before = s.zones.hand.length;
    s = applyCommand(s, { type: 'nextPhase' }).state; // -> draw
    expect(s.phase).toBe('draw');
    expect(s.zones.hand.length).toBe(before + 1);
  });

  it('initializes planeswalker loyalty and saga lore on ETB, clears enteredTurn on exit', () => {
    const pw = makeDef({
      scryfallId: 'pw-1',
      typeLine: 'Legendary Planeswalker — Sarkhan',
      faces: [{ name: 'pw-1', typeLine: 'Legendary Planeswalker — Sarkhan', loyalty: '4' }],
    });
    const saga = makeDef({
      scryfallId: 'saga-1',
      typeLine: 'Enchantment — Saga',
      faces: [{ name: 'saga-1', typeLine: 'Enchantment — Saga' }],
    });
    let s = initGame(
      [pw, saga].map((def) => ({ def, isCommander: false })),
      1,
    );
    s = applyCommand(s, { type: 'draw', count: 2 }).state;
    const pwId = idOf(s, 'pw-1');
    const sagaId = idOf(s, 'saga-1');
    s = applyCommand(s, { type: 'moveCard', cardId: pwId, to: 'battlefield', position: 'bottom' }).state;
    s = applyCommand(s, { type: 'moveCard', cardId: sagaId, to: 'battlefield', position: 'bottom' }).state;
    expect(s.cards[pwId].counters.loyalty).toBe(4);
    expect(s.cards[sagaId].counters.lore).toBe(1);
    expect(s.cards[pwId].enteredTurn).toBe(s.turn);

    // saga advances at the start of each turn
    s = applyCommand(s, { type: 'nextTurn' }).state;
    expect(s.cards[sagaId].counters.lore).toBe(2);

    // leaving the battlefield clears enteredTurn
    s = applyCommand(s, { type: 'moveCard', cardId: pwId, to: 'graveyard', position: 'top' }).state;
    expect(s.cards[pwId].enteredTurn).toBe(0);
  });
});

describe('summoning sickness (spec §7.6)', () => {
  it('marks creatures entered this turn, honors Haste (en/ja), clears next turn', () => {
    const normal = creature('walker');
    const hasteEn = creature('rusher', { haste: 'en' });
    const hasteJa = creature('kakeashi', { haste: 'ja' });
    let s = initGame(
      [normal, hasteEn, hasteJa].map((def) => ({ def, isCommander: false })),
      1,
    );
    s = applyCommand(s, { type: 'draw', count: 3 }).state;
    for (const defId of ['walker', 'rusher', 'kakeashi']) {
      s = applyCommand(s, {
        type: 'moveCard',
        cardId: idOf(s, defId),
        to: 'battlefield',
        position: 'bottom',
      }).state;
    }
    expect(isSummoningSick(s, idOf(s, 'walker'))).toBe(true);
    expect(isSummoningSick(s, idOf(s, 'rusher'))).toBe(false);
    expect(isSummoningSick(s, idOf(s, 'kakeashi'))).toBe(false);

    s = applyCommand(s, { type: 'nextTurn' }).state;
    expect(isSummoningSick(s, idOf(s, 'walker'))).toBe(false);
  });

  it('never marks non-creatures', () => {
    const s = boardGame([land('isle', ['U'])]);
    // freshly re-enter the land this turn
    const id = idOf(s, 'isle');
    let s2 = applyCommand(s, { type: 'moveCard', cardId: id, to: 'hand', position: 'top' }).state;
    s2 = applyCommand(s2, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
    expect(s2.cards[id].enteredTurn).toBe(s2.turn);
    expect(isSummoningSick(s2, id)).toBe(false);
  });
});

describe('planAutoTap (spec §7.7)', () => {
  it('solves color-constrained assignments that defeat naive greedy', () => {
    // cost {W}{U}; sources: City (any of WUBRG) and Plains (W only).
    // City must be assigned U so Plains can cover W.
    const s = boardGame([land('city', ['W', 'U', 'B', 'R', 'G']), land('plains', ['W'])]);
    const plan = planAutoTap(s, parseManaCost('{W}{U}'), 0);
    expect(plan.ok).toBe(true);
    const colors = plan.taps.map((t) => t.color).sort();
    expect(colors).toEqual(['U', 'W']);
  });

  it('uses floating mana first and excludes sick creatures and treasures', () => {
    const bop = creature('bop', { mana: ['W', 'U', 'B', 'R', 'G'] });
    let s = boardGame([land('mtn', ['R'])], [bop]);
    // play the mana creature THIS turn -> summoning sick
    s = applyCommand(s, {
      type: 'moveCard',
      cardId: idOf(s, 'bop'),
      to: 'battlefield',
      position: 'bottom',
    }).state;
    // a treasure token on the battlefield
    s = applyCommand(s, {
      type: 'createToken',
      name: '宝物',
      typeLine: 'Token Artifact — Treasure',
      quantity: 1,
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      tokenKind: 'treasure',
    }).state;
    s = applyCommand(s, { type: 'addMana', color: 'C', amount: 1 }).state;

    // cost {1}{R}: C floats for generic, Mountain taps for R.
    const plan = planAutoTap(s, parseManaCost('{1}{R}'), 0);
    expect(plan.ok).toBe(true);
    expect(plan.taps).toHaveLength(1);
    expect(plan.taps[0].cardId).toBe(idOf(s, 'mtn'));

    // cost {2}{R}: only legal source besides the mountain is sick/treasure -> not ok
    const plan2 = planAutoTap(s, parseManaCost('{2}{R}'), 0);
    expect(plan2.ok).toBe(false);
    expect(plan2.shortfall).toBe(1);
  });

  it('completes quickly on a wide board (performance guard)', () => {
    const defs: CardDef[] = [];
    for (let i = 0; i < 10; i++) defs.push(land(`dual-${i}`, ['W', 'U']));
    for (let i = 0; i < 10; i++) defs.push(land(`tri-${i}`, ['B', 'R', 'G']));
    const s = boardGame(defs);
    const t0 = performance.now();
    const plan = planAutoTap(s, parseManaCost('{8}{W}{U}{B}{R}{G}'), 0);
    const elapsed = performance.now() - t0;
    expect(plan.ok).toBe(true);
    expect(plan.taps).toHaveLength(13);
    expect(elapsed).toBeLessThan(300);
  });
});

describe('crackTreasure (spec §7.2)', () => {
  it('adds the chosen color and the token vanishes', () => {
    let s = boardGame([]);
    s = applyCommand(s, {
      type: 'createToken',
      name: '宝物',
      typeLine: 'Token Artifact — Treasure',
      quantity: 1,
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      tokenKind: 'treasure',
    }).state;
    const tokenId = s.zones.battlefield.find((id) => s.cards[id].isToken)!;
    const r = applyCommand(s, { type: 'crackTreasure', cardId: tokenId, color: 'B' });
    expect(r.state.manaPool.B).toBe(1);
    expect(r.state.cards[tokenId]).toBeUndefined();
    expect(r.state.zones.graveyard).not.toContain(tokenId);
  });

  it('rejects non-treasure targets', () => {
    const s = boardGame([land('isle', ['U'])]);
    expect(() =>
      applyCommand(s, { type: 'crackTreasure', cardId: idOf(s, 'isle'), color: 'U' }),
    ).toThrow(EngineError);
  });
});
