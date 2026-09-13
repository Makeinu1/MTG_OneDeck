import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../cockpitTable';
import { makeDeck } from './helpers';

function fixture(text: string) {
  const table = createCockpitTable(makeDeck(30), 1);
  const id = table.seats[0].zones.hand[0];
  const def = table.defs[table.cards[id].defId];
  def.faces[0].oracleText = text.replaceAll('SOURCE', def.name);
  return { table, id };
}
it('keeps one ETB occurrence through source departure, registration and manual resolution (CR 603.2, 603.10)', () => {
  const { table, id } = fixture('When SOURCE enters the battlefield, draw a card.');
  const entered = applyTableOperation(
    table,
    { type: 'move', ids: [id], to: 'battlefield', position: 'top' },
    'enter',
  );
  expect(entered.triggers?.candidates).toHaveLength(1);
  const candidate = entered.triggers!.candidates[0];
  expect(candidate.requiresManualRuling).toBe(false);
  const left = applyTableOperation(
    entered,
    { type: 'move', ids: [id], to: 'graveyard', position: 'top' },
    'leave',
  );
  const placed = applyTableOperation(
    left,
    { type: 'trigger.place', candidateId: candidate.pendingTriggerId, id: 'ability', targets: [] },
    'place',
  );
  expect(placed.stack[0].source.zone).toBe('battlefield');
  expect(placed.triggers?.candidates[0].status).toBe('placed');
  expect(placed.seats[0].zones.hand).toEqual(left.seats[0].zones.hand);
  expect(() =>
    applyTableOperation(placed, {
      type: 'trigger.place',
      candidateId: candidate.pendingTriggerId,
      id: 'duplicate',
      targets: [],
    }),
  ).toThrow();
  const resolving = applyTableOperation(placed, { type: 'resolve.begin' });
  const drawn = applyTableOperation(resolving, { type: 'draw', seatId: 'P1', count: 1 });
  const done = applyTableOperation(drawn, { type: 'resolve.end', to: 'graveyard' });
  expect(done.stack).toHaveLength(0);
  expect(done.seats[0].zones.hand.length).toBe(left.seats[0].zones.hand.length + 1);
  expect(entered.triggers?.candidates[0].status).toBe('pending');
});
it('pauses the turn at upkeep and resumes with exactly one draw; invalid placement is atomic (CR 502–504)', () => {
  const { table, id } = fixture('At the beginning of your upkeep, draw a card.');
  let current = applyTableOperation(table, {
    type: 'move',
    ids: [id],
    to: 'battlefield',
    position: 'top',
  });
  current = applyTableOperation(current, { type: 'keep', seatId: 'P1' });
  const handCount = current.seats[0].zones.hand.length;
  current = applyTableOperation(current, { type: 'turn.ready' }, 'start');
  expect(current.phase).toBe('upkeep');
  expect(current.seats[0].zones.hand).toHaveLength(handCount);
  const candidate = current.triggers!.candidates[0];
  const saved = structuredClone(current);
  expect(() =>
    applyTableOperation(current, {
      type: 'trigger.place',
      candidateId: candidate.pendingTriggerId,
      id: 'ability',
      targets: ['missing'],
    }),
  ).toThrow();
  expect(current).toEqual(saved);
  expect(() => applyTableOperation(current, { type: 'phase' })).toThrow();
  current = applyTableOperation(current, {
    type: 'trigger.place',
    candidateId: candidate.pendingTriggerId,
    id: 'ability',
    targets: [],
  });
  current = applyTableOperation(current, { type: 'resolve.begin' });
  current = applyTableOperation(current, { type: 'resolve.end', to: 'graveyard' });
  current = applyTableOperation(current, { type: 'turn.ready' }, 'resume');
  expect(current.phase).toBe('main1');
  expect(current.turn).toBe(1);
  expect(current.seats[0].zones.hand).toHaveLength(handCount + 1);
});
