import { describe, expect, it } from 'vitest';
import { migrateCockpitSnapshot } from '../cockpitMigration';
import { applyTableOperation, type CockpitTable } from '../cockpitTable';
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

  it('retains last-in-first-out order across mixed legacy stack items and JSON reload', () => {
    const deck = makeDeck(20);
    let state = initGame(deck, 7);
    state = applyCommand(state, { type: 'draw', count: 7 }).state;
    const [first, second, source] = state.zones.hand;
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: source,
      to: 'battlefield',
      position: 'top',
    }).state;
    for (const cardId of [first, second])
      state = applyCommand(state, { type: 'moveCard', cardId, to: 'stack', position: 'top' }).state;
    state = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: source,
      kind: 'activated',
      resolutionText: 'Manual ability',
      sourceSnapshot: objectSnapshotForCard(state, source)!,
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
    const snapshot = { version: 1, state, deck, autoAdvanceToMain: false };
    const original = structuredClone(snapshot);
    let table = migrateCockpitSnapshot(snapshot);
    const expected = [...state.zones.stack].reverse();
    expect(table.stack.map((entry) => entry.stackCardId)).toEqual(expected);
    expect(table.stack[0]).toMatchObject({
      kind: 'activated',
      targets: ['OPPONENT_A'],
      text: 'Manual ability',
    });
    const mana = structuredClone(table.seats[0].mana);
    table = JSON.parse(JSON.stringify(table)) as CockpitTable;
    for (const cardId of expected) {
      expect(table.stack[0].stackCardId).toBe(cardId);
      table = applyTableOperation(table, { type: 'resolve.begin' });
      table = applyTableOperation(table, { type: 'resolve.end', to: 'graveyard' });
    }
    expect(table.stack).toHaveLength(0);
    expect(table.seats[0].mana).toEqual(mana);
    expect(snapshot).toEqual(original);
  });


  it('covers explicit zero, triggered and copied legacy stack cases through JSON reload and top resolution', () => {
    const deck = makeDeck(16);

    {
      const state = initGame(deck, 31);
      const snapshot = { version: 1, state, deck, autoAdvanceToMain: false };
      const original = structuredClone(snapshot);
      let table = migrateCockpitSnapshot(snapshot);
      expect(table.stack).toEqual([]);
      table = JSON.parse(JSON.stringify(table)) as CockpitTable;
      expect(table.stack).toEqual([]);
      expect(snapshot).toEqual(original);
    }

    {
      let state = initGame(deck, 32);
      state = applyCommand(state, { type: 'draw', count: 7 }).state;
      const source = state.zones.hand[0];
      state = applyCommand(state, {
        type: 'moveCard',
        cardId: source,
        to: 'battlefield',
        position: 'top',
      }).state;
      state = applyCommand(state, {
        type: 'addAbilityToStack',
        sourceId: source,
        kind: 'triggered',
        resolutionText: 'Triggered legacy effect',
        sourceSnapshot: objectSnapshotForCard(state, source)!,
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
      const legacyTop = state.zones.stack.at(-1)!;
      const snapshot = { version: 1, state, deck, autoAdvanceToMain: false };
      const original = structuredClone(snapshot);
      let table = migrateCockpitSnapshot(snapshot);
      expect(table.stack[0]).toMatchObject({
        stackCardId: legacyTop,
        kind: 'triggered',
        text: 'Triggered legacy effect',
        targets: ['OPPONENT_A'],
      });
      table = JSON.parse(JSON.stringify(table)) as CockpitTable;
      expect(table.stack[0].stackCardId).toBe(legacyTop);
      table = applyTableOperation(table, { type: 'resolve.begin' });
      expect(table.resolution).toMatchObject({ stackCardId: legacyTop, kind: 'triggered' });
      table = applyTableOperation(table, { type: 'resolve.end', to: 'graveyard' });
      expect(table.stack).toHaveLength(0);
      expect(snapshot).toEqual(original);
    }

    {
      let state = initGame(deck, 33);
      state = applyCommand(state, { type: 'draw', count: 7 }).state;
      const spell = state.zones.hand[0];
      state = applyCommand(state, {
        type: 'moveCard',
        cardId: spell,
        to: 'stack',
        position: 'top',
      }).state;
      state.cards[spell].isCopy = true;
      const snapshot = { version: 1, state, deck, autoAdvanceToMain: false };
      const original = structuredClone(snapshot);
      let table = migrateCockpitSnapshot(snapshot);
      expect(table.stack[0]).toMatchObject({ stackCardId: spell, kind: 'spell', copied: true });
      table = JSON.parse(JSON.stringify(table)) as CockpitTable;
      expect(table.stack[0]).toMatchObject({ stackCardId: spell, copied: true });
      table = applyTableOperation(table, { type: 'resolve.begin' });
      expect(table.resolution?.copied).toBe(true);
      table = applyTableOperation(table, { type: 'resolve.end', to: 'graveyard' });
      expect(table.stack).toHaveLength(0);
      expect(table.cards[spell]).toBeUndefined();
      expect(snapshot).toEqual(original);
    }
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
