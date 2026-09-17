import { expect, it } from 'vitest';
import { materializeReviewedTriggerOccurrence } from '../cockpitTriggerOccurrence';
import type { PendingTrigger } from '../types';

function review(text: string): PendingTrigger & { text: string } {
  return {
    pendingTriggerId: 'review-1',
    eventId: 'event-1',
    simultaneousGroupId: 'event-1',
    triggerId: 'trigger.draw',
    sourceId: 'watcher',
    sourceObjectId: 'watcher:0',
    sourceSnapshot: {
      physicalCardId: 'watcher',
      objectId: 'watcher:0',
      defId: 'watcher-def',
      zone: 'battlefield',
      ownerId: 'P1',
      controllerId: 'P1',
      isToken: false,
      isCommander: false,
      faceIndex: 0,
      tapped: false,
      counters: {},
      typeLine: 'Creature',
    },
    controllerId: 'P1',
    label: 'draw review',
    abilityLineIndex: 0,
    stackPlacementBucket: 'ordinary',
    text,
  };
}

it('consumes a once-per-turn restriction only when a review is confirmed', () => {
  const ledger = { turn: 1, consumedKeys: [] as string[] };
  const confirmed = materializeReviewedTriggerOccurrence(
    1,
    ledger,
    review('Whenever you draw one or more cards, this ability triggers only once each turn.'),
  );
  expect(ledger.consumedKeys).toEqual([]);
  expect(confirmed.consumedKeys).toHaveLength(1);
});

it('rejects a second confirmed review for the same restricted ability in the same turn', () => {
  const trigger = review(
    'Whenever you draw one or more cards, this ability triggers only once each turn.',
  );
  const first = materializeReviewedTriggerOccurrence(
    1,
    { turn: 1, consumedKeys: [] },
    trigger,
  );
  expect(() => materializeReviewedTriggerOccurrence(1, first, trigger)).toThrow();
});

it('does not invent a restriction for an unrestricted reviewed trigger', () => {
  const ledger = materializeReviewedTriggerOccurrence(
    1,
    { turn: 1, consumedKeys: [] },
    review('Whenever you draw one or more cards, draw a card.'),
  );
  expect(ledger.consumedKeys).toEqual([]);
});
