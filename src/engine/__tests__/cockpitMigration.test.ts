import { describe, expect, it } from 'vitest';
import { migrateCockpitSnapshot } from '../cockpitMigration';
import { applyTableOperation } from '../cockpitTable';
import { initGame } from '../init';
import { applyCommand, objectSnapshotForCard } from '../commands';
import { makeDeck } from './helpers';

describe('legacy snapshot one-way migration', () => {
  it('preserves card facts, ordered zones and an already-paid stack without replaying its cost', () => {
    const deck = makeDeck(10);
    let state = initGame(deck, 17);
    state = applyCommand(state, { type: 'draw', count: 7 }).state;
    const id = state.zones.hand[0];
    const permanent = state.zones.hand[1];
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: permanent,
      to: 'battlefield',
      position: 'top',
    }).state;
    state.cards[permanent].manualKeywords = ['flying'];
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'stack',
      position: 'top',
    }).state;
    const snapshot = { version: 1, state, deck, autoAdvanceToMain: false };
    const original = structuredClone(snapshot);
    const table = migrateCockpitSnapshot(snapshot);
    expect(table.cards[id]).toEqual(state.cards[id]);
    expect(table.seats.find((seat) => seat.id === 'P1')?.zones.hand).toEqual(state.zones.hand);
    expect(table.stack[0].source.id).toBe(id);
    expect(table.grants[0]).toMatchObject({ cardId: permanent, keyword: 'flying' });
    const removed = applyTableOperation(table, {
      type: 'keyword',
      grant: table.grants[0],
      remove: true,
    });
    expect(removed.cards[permanent].manualKeywords).toEqual([]);
    const begun = applyTableOperation(table, { type: 'resolve.begin' });
    const completed = applyTableOperation(begun, { type: 'resolve.end', to: 'battlefield' });
    expect(completed.cards[id].zone).toBe('battlefield');
    expect(completed.seats[0].mana).toEqual(table.seats[0].mana);
    expect(snapshot).toEqual(original);

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'battlefield',
      position: 'top',
    }).state;
    state = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: id,
      kind: 'activated',
      resolutionText: 'Manual effect',
      sourceSnapshot: objectSnapshotForCard(state, id)!,
      targetSelections: [
        {
          slotId: 'player',
          raw: 'target player',
          kind: 'player',
          legalityMode: 'unchecked-warning',
          selection: { kind: 'player', playerId: 'OPPONENT_A' },
        },
      ],
    }).state;
    const historical = structuredClone(state.cards[state.zones.stack[0]].sourceSnapshot);
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: id,
      to: 'graveyard',
      position: 'top',
    }).state;
    const abilityTable = migrateCockpitSnapshot({ ...snapshot, state });
    expect(abilityTable.stack[0].source.sourceSnapshot).toEqual(historical);
    expect(abilityTable.stack[0].source.zone).toBe('battlefield');
    expect(abilityTable.stack[0].targets).toEqual(['OPPONENT_A']);
    expect(abilityTable.stack[0].text).toBe('Manual effect');
  });

  it('keeps an unsupported pending choice intact instead of silently dropping it', () => {
    const deck = makeDeck(10);
    const state = initGame(deck, 1);
    state.pendingRuleChoices = [
      {
        choiceId: 'cleanup',
        kind: 'cleanup-discard',
        ruleRef: '514.1',
        playerId: 'P1',
        cardIds: [],
        requiredCount: 1,
      },
    ];
    const snapshot = { version: 1, state, deck, autoAdvanceToMain: false };
    const before = structuredClone(snapshot);
    expect(() => migrateCockpitSnapshot(snapshot)).toThrow('未確定のルール選択');
    expect(snapshot).toEqual(before);
  });
});
