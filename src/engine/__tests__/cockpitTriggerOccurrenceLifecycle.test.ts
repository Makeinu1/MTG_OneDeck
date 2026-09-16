import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../cockpitTable';
import { makeDeck } from './helpers';

const REVIEW_TEXT =
  'Whenever you draw one or more cards, this ability triggers only once each turn.';

function reviewFixture() {
  let table = createCockpitTable(makeDeck(30), 1);
  const watcherId = table.seats[0].zones.hand[0];
  const def = table.defs[table.cards[watcherId].defId];
  def.faces[0].oracleText = REVIEW_TEXT;
  table = applyTableOperation(
    table,
    { type: 'move', ids: [watcherId], to: 'battlefield', position: 'top' },
    'watcher-enter',
  );
  table = applyTableOperation(table, { type: 'draw', seatId: 'P1', count: 1 }, 'review-draw');
  const candidate = table.triggers!.candidates.find((entry) => entry.requiresManualRuling);
  expect(candidate).toBeDefined();
  expect(table.triggers!.ledger.consumedKeys).toEqual([]);
  return { table, candidate: candidate! };
}

it('materializes a reviewed occurrence only after successful trigger.place', () => {
  const { table, candidate } = reviewFixture();
  const placed = applyTableOperation(
    table,
    { type: 'trigger.place', candidateId: candidate.pendingTriggerId, id: 'reviewed', targets: [] },
    'place-reviewed',
  );

  expect(placed.triggers!.candidates.find((entry) => entry.pendingTriggerId === candidate.pendingTriggerId)?.status).toBe('placed');
  expect(placed.triggers!.ledger.consumedKeys).toHaveLength(1);
});

it('does not materialize or consume the ledger when a review candidate is dismissed', () => {
  const { table, candidate } = reviewFixture();
  const dismissed = applyTableOperation(
    table,
    { type: 'trigger.dismiss', candidateId: candidate.pendingTriggerId, reason: '誘発条件を満たしていないため' },
    'dismiss-reviewed',
  );

  expect(dismissed.triggers!.candidates.find((entry) => entry.pendingTriggerId === candidate.pendingTriggerId)?.status).toBe('dismissed');
  expect(dismissed.triggers!.ledger.consumedKeys).toEqual([]);
});

it('materializes a reviewed occurrence after successful trigger.link', () => {
  const { table, candidate } = reviewFixture();
  table.stack.unshift({
    id: 'manual-trigger',
    kind: 'triggered',
    source: structuredClone(candidate.source),
    controllerId: candidate.controllerId,
    targets: [],
    paid: [],
    text: candidate.text,
  });

  const linked = applyTableOperation(
    table,
    { type: 'trigger.link', candidateId: candidate.pendingTriggerId, entryId: 'manual-trigger' },
    'link-reviewed',
  );

  expect(linked.triggers!.candidates.find((entry) => entry.pendingTriggerId === candidate.pendingTriggerId)?.status).toBe('linked');
  expect(linked.triggers!.ledger.consumedKeys).toHaveLength(1);
});

it('keeps failed review placement atomic and leaves the occurrence restriction unconsumed', () => {
  const { table, candidate } = reviewFixture();
  const saved = structuredClone(table);

  expect(() =>
    applyTableOperation(
      table,
      {
        type: 'trigger.place',
        candidateId: candidate.pendingTriggerId,
        id: 'invalid-reviewed',
        targets: ['missing-target'],
      },
      'failed-place-reviewed',
    ),
  ).toThrow();

  expect(table).toEqual(saved);
  expect(table.triggers!.ledger.consumedKeys).toEqual([]);
});
