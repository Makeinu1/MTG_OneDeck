// Reviewer-owned adversarial tests for cr-601-casting-stack Slice A: playing lands
// from the graveyard (design-lock: docs/engine-spec.md §34.36). 実装エージェント
// (Codex含む)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 601.2a-style play permission: Muldrotha/Serra Paragon/Icetill Explorer/Crucible
//   of Worlds grant "play a land from your graveyard" (verified byte-exact against the
//   local Scryfall snapshot).
// - CR 113.6e-f/400.7g-h: playing a land from a non-hand zone is itself CR-legal once
//   permission exists; this project's sandbox philosophy does not enforce the granting
//   permanent's specific once-per-turn/type conditions (matches the pre-existing
//   cast-from-graveyard behavior, which already has zero zone/condition checks).
// 契約の要石=applyPlayLandのzone制限をhand|graveyardへ緩和するのみ。新規GameState/
// GameCommandなし。exileは対象外(honest defer=現行demandに実例なし)。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDef } from './helpers';

function cardDef(id: string, typeLine: string, oracleText?: string): CardDef {
  return makeDef({ scryfallId: id, name: id, typeLine, faces: [{ name: id, typeLine, ...(oracleText ? { oracleText } : {}) }] });
}

function move(state: GameState, cardId: string, to: 'battlefield' | 'hand' | 'graveyard' | 'exile'): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

function idOf(state: GameState, defId: string): string {
  return Object.values(state.cards).find((card) => card.defId === defId)?.id ?? '';
}

describe('cr-601-casting-stack Slice A: play land from graveyard (CR 601.2a-style permission)', () => {
  it('golden: a land in the graveyard can be played to the battlefield', () => {
    const land = cardDef('r-cr601-grave-land', 'Land');
    let state = initGame([{ def: land, isCommander: false }], 1);
    const id = idOf(state, 'r-cr601-grave-land');
    state = move(state, id, 'graveyard');

    state = applyCommand(state, { type: 'playLand', cardId: id, forced: false }).state;
    expect(state.cards[id].zone).toBe('battlefield');
  });

  it('non-regression: playing a land from hand is unchanged', () => {
    const land = cardDef('r-cr601-hand-land', 'Land');
    let state = initGame([{ def: land, isCommander: false }], 1);
    const id = idOf(state, 'r-cr601-hand-land');
    state = move(state, id, 'hand');

    state = applyCommand(state, { type: 'playLand', cardId: id, forced: false }).state;
    expect(state.cards[id].zone).toBe('battlefield');
  });

  it('type gate: a non-land card in the graveyard is rejected (unaffected by this slice)', () => {
    const spell = cardDef('r-cr601-grave-nonland', 'Instant');
    let state = initGame([{ def: spell, isCommander: false }], 1);
    const id = idOf(state, 'r-cr601-grave-nonland');
    state = move(state, id, 'graveyard');

    expect(() => applyCommand(state, { type: 'playLand', cardId: id, forced: false })).toThrow();
  });

  it('scope gate: exile is not included (honest defer — no golden card in current demand needs it)', () => {
    const land = cardDef('r-cr601-exile-land', 'Land');
    let state = initGame([{ def: land, isCommander: false }], 1);
    const id = idOf(state, 'r-cr601-exile-land');
    state = move(state, id, 'exile');

    expect(() => applyCommand(state, { type: 'playLand', cardId: id, forced: false })).toThrow();
  });

  it('landsPlayedThisTurn counter and warning still apply when the land comes from the graveyard', () => {
    const landA = cardDef('r-cr601-count-a', 'Land');
    const landB = cardDef('r-cr601-count-b', 'Land');
    let state = initGame([{ def: landA, isCommander: false }, { def: landB, isCommander: false }], 1);
    const idA = idOf(state, 'r-cr601-count-a');
    const idB = idOf(state, 'r-cr601-count-b');
    state = move(state, idA, 'graveyard');
    state = move(state, idB, 'graveyard');

    let result = applyCommand(state, { type: 'playLand', cardId: idA, forced: false });
    state = result.state;
    expect(state.landsPlayedThisTurn).toBe(1);
    expect(result.warnings).toEqual([]);

    result = applyCommand(state, { type: 'playLand', cardId: idB, forced: true });
    state = result.state;
    expect(state.landsPlayedThisTurn).toBe(2);
    expect(result.warnings.some((w) => w.includes('2枚目'))).toBe(true);
  });

  it('non-regression: casting a spell from the graveyard already worked before this slice and still does', () => {
    const spell = cardDef('r-cr601-cast-nonreg', 'Instant');
    let state = initGame([{ def: spell, isCommander: false }], 1);
    const id = idOf(state, 'r-cr601-cast-nonreg');
    state = move(state, id, 'graveyard');

    state = applyCommand(state, { type: 'castToStack', cardId: id, payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, forced: true }).state;
    expect(state.cards[id].zone).toBe('stack');
  });
});
