import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { objectIdOf } from '../../engine/types';
import { makeDeck } from '../../engine/__tests__/helpers';
import { cockpitGameState } from './cockpitGameState';
import { stackItemPresentations } from './stackWorkspaceModel';

it('preserves stack order, source snapshots and the local seat without changing confirmed state', () => {
  const deck = makeDeck(30);
  let table = createCockpitTable(deck, 42, [deck, deck]);
  const [sourceId, targetId] = table.seats[1].zones.hand;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId, targetId],
    to: 'battlefield',
    position: 'top',
  });
  const source = structuredClone(table.cards[sourceId]);
  const target = structuredClone(table.cards[targetId]);
  table.stack = [
    {
      id: 'ability-top',
      kind: 'activated',
      source,
      controllerId: 'P2',
      targets: [targetId],
      targetSnapshots: { [targetId]: target },
      paid: [],
      text: 'Draw a card.',
    },
    {
      id: 'ability-bottom',
      kind: 'triggered',
      source,
      controllerId: 'P2',
      targets: ['P1'],
      paid: [],
      text: 'Gain 1 life.',
    },
  ];
  const before = structuredClone(table);
  const view = cockpitGameState(table, 'P2');
  expect(view.zones.hand).toEqual(table.seats[1].zones.hand);
  expect(view.zonesByPlayer.P1.hand).toEqual([]);
  expect(view.zonesByPlayer.P1.library).toEqual([]);
  expect(view.zones.stack).toEqual(['ability-bottom', 'ability-top']);
  expect(stackItemPresentations(view)[0]).toMatchObject({ cardId: 'ability-top', abilityText: 'Draw a card.' });
  expect(view.cards['ability-top'].sourceSnapshot?.objectId).toBe(objectIdOf(source));
  expect(view.cards['ability-top'].targetSelections?.[0].selection).toMatchObject({
    physicalCardId: targetId,
    objectId: objectIdOf(target),
  });
  expect(view.cards[sourceId].zone).toBe('battlefield');
  expect(table).toEqual(before);
});

it('retains a targets captured identity after zone movement and reflects current combat assignments', () => {
  let table = createCockpitTable(makeDeck(30), 42);
  const [sourceId, targetId] = table.seats[0].zones.hand;
  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId, targetId],
    to: 'battlefield',
    position: 'top',
  });
  const captured = structuredClone(table.cards[targetId]);
  table.stack = [
    {
      id: 'pending',
      kind: 'activated',
      source: structuredClone(table.cards[sourceId]),
      controllerId: 'P1',
      targets: [targetId],
      targetSnapshots: { [targetId]: captured },
      paid: [],
      text: 'Target creature gains flying.',
    },
  ];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [targetId],
    to: 'graveyard',
    position: 'top',
  });
  table.combat = {
    attackers: [{ cardId: sourceId, objectId: objectIdOf(table.cards[sourceId]), targetId: 'P2' }],
    blockers: [],
    assignments: [],
    damageApplied: false,
  };
  const view = cockpitGameState(table, 'P1');
  expect(view.cards.pending.targetSelections?.[0].selection).toMatchObject({
    objectId: objectIdOf(captured),
    snapshot: { zone: 'battlefield' },
  });
  expect(view.cards[targetId].zone).toBe('graveyard');
  expect(view.combat?.attackers[0]).toMatchObject({
    cardId: sourceId,
    target: { type: 'player', playerId: 'P2' },
  });
  table.combat = null;
  expect(cockpitGameState(table, 'P1').combat).toBeNull();
});
