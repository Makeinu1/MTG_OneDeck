import { expect, it } from 'vitest';
import { initGame } from '../init';
import {
  classifyTriggerDetection,
  materializeTriggerOccurrence,
} from '../triggerOccurrence';
import type { PendingTrigger } from '../types';

function pending(overrides: Partial<PendingTrigger> = {}): PendingTrigger {
  return {
    pendingTriggerId: 'event-1:trigger.etb:card-1:0:line-0',
    eventId: 'event-1',
    simultaneousGroupId: 'event-1',
    triggerId: 'trigger.etb',
    sourceId: 'card-1',
    sourceObjectId: 'card-1:0',
    sourceSnapshot: {
      physicalCardId: 'card-1',
      objectId: 'card-1:0',
      defId: 'def-1',
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
    label: 'ETB',
    abilityLineIndex: 0,
    stackPlacementBucket: 'ordinary',
    ...overrides,
  };
}

it('materializes deterministic and confirmed-review detections through one idempotent occurrence boundary', () => {
  const initial = initGame([], 0);
  const deterministic = classifyTriggerDetection(
    pending(),
    'When this creature enters the battlefield, draw a card.',
    'turn-1|card-1:0|line-0',
  );
  expect(deterministic.kind).toBe('deterministic');

  const first = materializeTriggerOccurrence(initial, deterministic);
  expect(first.created).toBe(true);
  expect(first.state.pendingTriggers).toHaveLength(1);
  expect(first.state.oncePerTurnTriggerLedger.consumedKeys).toEqual([
    'turn-1|card-1:0|line-0',
  ]);

  const retry = materializeTriggerOccurrence(first.state, deterministic);
  expect(retry.created).toBe(false);
  expect(retry.state).toBe(first.state);
  expect(retry.state.pendingTriggers).toHaveLength(1);

  const review = classifyTriggerDetection(
    pending({ pendingTriggerId: 'event-2:trigger.etb:card-1:0:line-0' }),
    'Whenever one or more creatures enter the battlefield, draw a card.',
    'turn-1|card-2:0|line-0',
  );
  expect(review.kind).toBe('review');
  expect(initial.oncePerTurnTriggerLedger.consumedKeys).toEqual([]);

  const confirmed = materializeTriggerOccurrence(initial, review);
  expect(confirmed.created).toBe(true);
  expect(confirmed.state.oncePerTurnTriggerLedger.consumedKeys).toEqual([
    'turn-1|card-2:0|line-0',
  ]);
});

it('fails closed for ambiguous/unsupported detection and does not consume restrictions before materialization', () => {
  const initial = initGame([], 0);
  const ambiguous = classifyTriggerDetection(
    pending({ abilityLineIndex: undefined }),
    undefined,
    'turn-1|card-1:0|unknown',
  );
  expect(ambiguous).toMatchObject({
    kind: 'review',
    reason: 'ability-identity-ambiguous',
  });
  expect(initial.pendingTriggers).toEqual([]);
  expect(initial.oncePerTurnTriggerLedger.consumedKeys).toEqual([]);

  const unsupportedIf = classifyTriggerDetection(
    pending({ pendingTriggerId: 'event-3:trigger.etb:card-1:0:line-0' }),
    'When this creature enters the battlefield, if a condition is true, draw a card.',
    'turn-1|card-1:0|line-0',
  );
  expect(unsupportedIf).toMatchObject({
    kind: 'review',
    reason: 'trigger-condition-unsupported',
  });
  expect(initial.pendingTriggers).toEqual([]);
  expect(initial.oncePerTurnTriggerLedger.consumedKeys).toEqual([]);
});

it('accepts supported structured conditions and schedules while failing closed for unsupported next clauses', () => {
  const supportedIf = classifyTriggerDetection(
    pending({ condition: { kind: 'source-is-tapped' } }),
    'When this creature enters the battlefield, if it is tapped, draw a card.',
  );
  expect(supportedIf.kind).toBe('deterministic');

  const supportedNext = classifyTriggerDetection(
    pending({ schedule: { kind: 'next-end-step', createdTurn: 1 } }),
    'At the beginning of the next end step, draw a card.',
  );
  expect(supportedNext.kind).toBe('deterministic');

  const unsupportedNext = classifyTriggerDetection(
    pending({ pendingTriggerId: 'event-next:trigger.etb:card-1:0:line-0' }),
    'At the beginning of the next end step, draw a card.',
  );
  expect(unsupportedNext).toMatchObject({
    kind: 'review',
    reason: 'trigger-condition-unsupported',
  });
});

it('rejects a second restricted occurrence but resets a stale prior-turn ledger', () => {
  const decision = classifyTriggerDetection(
    pending(),
    'Whenever you draw a card, this ability triggers only once each turn.',
    '1|card-1:0|line-0|P1',
  );
  const state = initGame([], 0);
  state.turn = 1;
  state.oncePerTurnTriggerLedger = { turn: 1, consumedKeys: ['1|card-1:0|line-0|P1'] };
  expect(() => materializeTriggerOccurrence(state, decision)).toThrow(
    'この誘発はこのターンすでに発生済みです。',
  );

  const staleLedgerState = initGame([], 0);
  staleLedgerState.turn = 2;
  staleLedgerState.oncePerTurnTriggerLedger = {
    turn: 1,
    consumedKeys: ['1|card-1:0|line-0|P1'],
  };
  const nextDecision = classifyTriggerDetection(
    pending({ pendingTriggerId: 'event-turn-2:trigger.etb:card-1:0:line-0' }),
    'Whenever you draw a card, this ability triggers only once each turn.',
    '2|card-1:0|line-0|P1',
  );
  const materialized = materializeTriggerOccurrence(staleLedgerState, nextDecision);
  expect(materialized.state.oncePerTurnTriggerLedger).toEqual({
    turn: 2,
    consumedKeys: ['2|card-1:0|line-0|P1'],
  });
});

it('materializes unrestricted occurrences without inventing a ledger entry', () => {
  const initial = initGame([], 0);
  const decision = classifyTriggerDetection(
    pending(),
    'When this creature enters the battlefield, draw a card.',
  );
  const result = materializeTriggerOccurrence(initial, decision);
  expect(result.created).toBe(true);
  expect(result.state.oncePerTurnTriggerLedger).toEqual(initial.oncePerTurnTriggerLedger);
});
