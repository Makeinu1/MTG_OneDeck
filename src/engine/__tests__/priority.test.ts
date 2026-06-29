import { describe, expect, it } from 'vitest';

import {
  apnapPlayerOrder,
  orderPendingTriggersApnap,
} from '../priority';
import type { PendingTrigger, PlayerId } from '../types';

function pendingTrigger(
  pendingTriggerId: string,
  controllerId: PlayerId
): PendingTrigger {
  return {
    pendingTriggerId,
    eventId: `event-${pendingTriggerId}`,
    simultaneousGroupId: `event-${pendingTriggerId}`,
    triggerId: 'trigger.etb',
    sourceId: `source-${pendingTriggerId}`,
    sourceObjectId: `source-${pendingTriggerId}:0`,
    sourceSnapshot: {
      physicalCardId: `source-${pendingTriggerId}`,
      objectId: `source-${pendingTriggerId}:0`,
      defId: `def-${pendingTriggerId}`,
      zone: 'battlefield',
      ownerId: 'P1',
      controllerId,
      isToken: false,
      isCommander: false,
      faceIndex: 0,
      tapped: false,
      counters: {},
      typeLine: 'Creature',
    },
    controllerId,
    label: `trigger ${pendingTriggerId}`,
  };
}

describe('APNAP pending trigger ordering', () => {
  it('rotates turn order from the active player', () => {
    expect(apnapPlayerOrder('P1')).toEqual(['P1', 'OPPONENT_A']);
    expect(apnapPlayerOrder('OPPONENT_A')).toEqual(['OPPONENT_A', 'P1']);
  });

  it('orders controller groups by APNAP while preserving each controller choice order', () => {
    const p1a = pendingTrigger('p1-a', 'P1');
    const p1b = pendingTrigger('p1-b', 'P1');
    const opponent = pendingTrigger('opponent', 'OPPONENT_A');

    const result = orderPendingTriggersApnap(
      [p1a, p1b, opponent],
      ['opponent', 'p1-b', 'p1-a'],
      'P1'
    );

    expect(result).toEqual({
      status: 'ordered',
      orderedIds: ['p1-b', 'p1-a', 'opponent'],
    });
  });

  it('uses the current active player as the first APNAP group', () => {
    const p1 = pendingTrigger('p1', 'P1');
    const opponent = pendingTrigger('opponent', 'OPPONENT_A');

    const result = orderPendingTriggersApnap(
      [p1, opponent],
      ['p1', 'opponent'],
      'OPPONENT_A'
    );

    expect(result).toEqual({
      status: 'ordered',
      orderedIds: ['opponent', 'p1'],
    });
  });

  it('rejects incomplete, duplicate, or unknown explicit choices', () => {
    const p1 = pendingTrigger('p1', 'P1');
    const opponent = pendingTrigger('opponent', 'OPPONENT_A');

    expect(orderPendingTriggersApnap([p1, opponent], ['p1'], 'P1')).toMatchObject({
      status: 'incomplete',
      missingIds: ['opponent'],
    });
    expect(
      orderPendingTriggersApnap([p1, opponent], ['p1', 'p1', 'opponent'], 'P1')
    ).toMatchObject({
      status: 'incomplete',
      duplicateIds: ['p1'],
    });
    expect(
      orderPendingTriggersApnap([p1, opponent], ['p1', 'unknown'], 'P1')
    ).toMatchObject({
      status: 'incomplete',
      missingIds: ['opponent'],
      unknownIds: ['unknown'],
    });
  });
});
