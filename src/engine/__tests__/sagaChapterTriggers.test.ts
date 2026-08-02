import { describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from './helpers';
import { applyCommand, type GameCommand } from '../commands';
import { initGame } from '../init';
import type { GameState } from '../types';

function sagaDef(id: string, oracleText: string) {
  return makeDef({
    scryfallId: id,
    typeLine: 'Enchantment — Saga',
    faces: [{ name: id, typeLine: 'Enchantment — Saga', oracleText }],
  });
}

function instanceId(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((entry) => entry.defId === defId);
  if (!card) throw new Error(`missing instance for ${defId}`);
  return card.id;
}

function apply(state: GameState, commands: readonly GameCommand[]): GameState {
  return commands.reduce((current, command) => applyCommand(current, command).state, state);
}

function setupWithSaga(def: ReturnType<typeof makeDef>): { state: GameState; sagaId: string } {
  let state = initGame([{ def, isCommander: false }, ...makeDeck(8)], 1);
  const sagaId = instanceId(state, def.scryfallId);
  state = applyCommand(state, {
    type: 'moveCard',
    cardId: sagaId,
    to: 'battlefield',
    position: 'bottom',
  }).state;
  return { state, sagaId };
}

/** Advance phase to main1 (untap → upkeep → draw → main1). */
function advanceToMain1(state: GameState): GameState {
  return apply(state, [
    { type: 'nextPhase' }, // untap → upkeep
    { type: 'nextPhase' }, // upkeep → draw
    { type: 'nextPhase' }, // draw → main1
  ]);
}

const THREE_CHAPTER_TEXT = [
  'I — Draw a card.',
  'II, III — Each opponent loses 2 life.',
  'IV — You gain 4 life.',
].join('\n');

describe('CR 714.2b Saga chapter triggers', () => {
  it('ETB Saga with lore=1 triggers chapter I', () => {
    const def = sagaDef('test-saga', THREE_CHAPTER_TEXT);
    const { state, sagaId } = setupWithSaga(def);

    // Lore should be 1 after ETB
    expect(state.cards[sagaId].counters.lore).toBe(1);

    // Chapter I trigger should be pending
    const chapterTriggers = state.pendingTriggers.filter(
      (t) => t.sourceId === sagaId && t.triggerId.startsWith('saga-chapter-'),
    );
    expect(chapterTriggers).toHaveLength(1);
    expect(chapterTriggers[0].triggerId).toBe(`saga-chapter-${sagaId}-0`);
    expect(chapterTriggers[0].label).toContain('第I章');
    expect(chapterTriggers[0].resolutionText).toBe('Draw a card.');
    expect(chapterTriggers[0].stackPlacementBucket).toBe('ability-triggered');
  });

  it('turn-based lore increment at main1 triggers correct chapter', () => {
    const def = sagaDef('turn-saga', THREE_CHAPTER_TEXT);
    const { state, sagaId } = setupWithSaga(def);

    // Clear ETB triggers to isolate the turn-based trigger
    const cleanState: GameState = { ...state, pendingTriggers: [] };

    // Advance to main1: lore 1 → 2, should trigger "II, III" (ability index 1)
    const afterMain1 = advanceToMain1(cleanState);

    expect(afterMain1.cards[sagaId].counters.lore).toBe(2);

    const chapterTriggers = afterMain1.pendingTriggers.filter(
      (t) => t.sourceId === sagaId && t.triggerId.startsWith('saga-chapter-'),
    );
    expect(chapterTriggers).toHaveLength(1);
    expect(chapterTriggers[0].triggerId).toBe(`saga-chapter-${sagaId}-1`);
    expect(chapterTriggers[0].label).toContain('第II章');
    expect(chapterTriggers[0].resolutionText).toBe('Each opponent loses 2 life.');
  });

  it('lore increment does NOT happen at untap (CR 714.3c timing)', () => {
    const def = sagaDef('timing-saga', THREE_CHAPTER_TEXT);
    const { state, sagaId } = setupWithSaga(def);

    // Clear ETB triggers
    const cleanState: GameState = { ...state, pendingTriggers: [] };

    // Advance to upkeep only (untap → upkeep)
    const atUpkeep = apply(cleanState, [{ type: 'nextPhase' }]);

    // Lore should still be 1 (not incremented at untap)
    expect(atUpkeep.cards[sagaId].counters.lore).toBe(1);

    // No new chapter triggers
    const chapterTriggers = atUpkeep.pendingTriggers.filter(
      (t) => t.sourceId === sagaId && t.triggerId.startsWith('saga-chapter-'),
    );
    expect(chapterTriggers).toHaveLength(0);
  });

  it('multi-chapter line triggers once when crossing threshold', () => {
    // A saga where lore jumps from 0 to 2 (ETB lore=1, then addCounters +1)
    // "I, II — Combined effect." should trigger once, not twice.
    const def = sagaDef('multi-saga', 'I, II — Combined effect.\nIII — Final effect.');
    const { state, sagaId } = setupWithSaga(def);

    // ETB: lore 0→1, crosses I → triggers ability 0 once
    const etbTriggers = state.pendingTriggers.filter(
      (t) => t.sourceId === sagaId && t.triggerId.startsWith('saga-chapter-'),
    );
    expect(etbTriggers).toHaveLength(1);
    expect(etbTriggers[0].triggerId).toBe(`saga-chapter-${sagaId}-0`);

    // Clear and advance to main1: lore 1→2, crosses II → triggers ability 0 again
    // (because II is in [1,2] range and previousLore=1 < 2)
    const cleanState: GameState = { ...state, pendingTriggers: [] };
    const afterMain1 = advanceToMain1(cleanState);

    const main1Triggers = afterMain1.pendingTriggers.filter(
      (t) => t.sourceId === sagaId && t.triggerId.startsWith('saga-chapter-'),
    );
    // "I, II" line: previousLore=1, newLore=2. N=1: 1<1 false. N=2: 1<2 && 2>=2 true.
    // So it triggers once for the same ability line.
    expect(main1Triggers).toHaveLength(1);
    expect(main1Triggers[0].triggerId).toBe(`saga-chapter-${sagaId}-0`);
  });

  it('no trigger when lore was already >= N', () => {
    // Saga with chapters I and III. After ETB (lore=1), advancing to main1 (lore=2)
    // should NOT re-trigger chapter I (previousLore=1, N=1, 1<1 is false).
    // Chapter III also doesn't trigger (N=3, 2<3). Final chapter=3 so SBA won't sacrifice.
    const def = sagaDef('no-retrigger-saga', 'I — Draw a card.\nIII — You win the game.');
    const { state, sagaId } = setupWithSaga(def);

    // ETB triggers chapter I
    expect(
      state.pendingTriggers.filter((t) => t.triggerId.startsWith('saga-chapter-')),
    ).toHaveLength(1);

    // Clear triggers and advance to main1: lore 1→2
    const cleanState: GameState = { ...state, pendingTriggers: [] };
    const afterMain1 = advanceToMain1(cleanState);

    expect(afterMain1.cards[sagaId].counters.lore).toBe(2);

    // No chapter triggers: I already crossed (1<1 false), III not yet (2<3)
    const chapterTriggers = afterMain1.pendingTriggers.filter(
      (t) => t.sourceId === sagaId && t.triggerId.startsWith('saga-chapter-'),
    );
    expect(chapterTriggers).toHaveLength(0);
  });

  it('ETB trigger has correct PendingTrigger fields', () => {
    const def = sagaDef('field-saga', 'I — Scry 1.');
    const { state, sagaId } = setupWithSaga(def);

    const trigger = state.pendingTriggers.find(
      (t) => t.sourceId === sagaId && t.triggerId.startsWith('saga-chapter-'),
    );
    expect(trigger).toBeDefined();
    if (!trigger) return;

    expect(trigger.sourceId).toBe(sagaId);
    expect(trigger.controllerId).toBe('P1');
    expect(trigger.stackPlacementBucket).toBe('ability-triggered');
    expect(trigger.abilityLineIndex).toBe(0);
    expect(trigger.resolutionText).toBe('Scry 1.');
    expect(trigger.sourceSnapshot.physicalCardId).toBe(sagaId);
    expect(trigger.pendingTriggerId).toContain('saga-chapter');
    expect(trigger.simultaneousGroupId).toContain('saga-chapter');
  });
});
