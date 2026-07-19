/** Reviewer-owned pure-engine contract for M-STACK-CONTROL. Implementers do not edit. */
import { describe, expect, it } from 'vitest';
import { applyCommand, objectSnapshotForCard } from '../commands';
import { initGame } from '../init';
import type { GameState, ManaPool, TargetSelection, ZoneId } from '../types';
import { makeDef } from './helpers';

const EMPTY_POOL: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

function move(state: GameState, cardId: string, to: ZoneId): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

describe('M-STACK-CONTROL castToStack checked target payload (CR 601.2c/608.2b)', () => {
  it('stores a cloned checked target selection on the new stack object', () => {
    const counter = makeDef({
      scryfallId: 'msc-engine-counter', typeLine: 'Instant',
      faces: [{ name: 'Counterspell', typeLine: 'Instant', oracleText: 'Counter target spell.' }],
    });
    const target = makeDef({
      scryfallId: 'msc-engine-target', typeLine: 'Sorcery',
      faces: [{ name: 'Target', typeLine: 'Sorcery', oracleText: 'Draw a card.' }],
    });
    let state = initGame([
      { def: counter, isCommander: false }, { def: target, isCommander: false },
    ], 9);
    state = move(state, 'c1', 'hand');
    state = move(state, 'c2', 'stack');
    const snapshot = objectSnapshotForCard(state, 'c2');
    expect(snapshot).toBeDefined();
    const selections: TargetSelection[] = [{
      slotId: 'target-0', raw: 'Counter target spell.', kind: 'object', legalityMode: 'checked',
      selection: {
        kind: 'object', physicalCardId: 'c2', objectId: snapshot!.objectId, snapshot: snapshot!,
      },
    }];

    const next = applyCommand(state, {
      type: 'castToStack', cardId: 'c1', payment: EMPTY_POOL, forced: false,
      targetSelections: selections,
    }).state;

    expect(next.cards.c1.zone).toBe('stack');
    expect(next.cards.c1.targetSelections).toEqual(selections);
    expect(next.cards.c1.targetSelections).not.toBe(selections);
    expect(state.cards.c1.targetSelections).toBeUndefined();
  });
});
