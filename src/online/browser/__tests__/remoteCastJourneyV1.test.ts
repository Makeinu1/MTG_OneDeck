import { describe, expect, it } from 'vitest';

import { validateRemoteCastJourneyObservationV1 } from '../../../../scripts/online/remote-cast-journey-evidence';

const observation = Object.freeze({
  kind: 'remote-cast-journey-observation-v1' as const,
  castObjectId: 'PC3:0',
  senderReceipt: Object.freeze({
    commandId: 'remote-cast-pilot-1',
    operation: 'cast-spell' as const,
    outcome: 'accepted' as const,
    baseRevision: 7,
    currentRevision: 8,
    acceptedRevision: 8,
  }),
  seats: Object.freeze([
    Object.freeze({ revision: 8, stackCount: 1, topObjectId: 'PC3:1' }),
    Object.freeze({ revision: 8, stackCount: 1, topObjectId: 'PC3:1' }),
  ]),
});

describe('Remote cast journey evidence', () => {
  it('accepts one sender receipt and two converged shared-stack projections', () => {
    expect(validateRemoteCastJourneyObservationV1(observation, 2)).toEqual({
      ok: true,
      value: {
        acceptedRevision: 8,
        seatCount: 2,
        receiptAccepted: true,
        revisionsConverged: true,
        sharedStackTop: true,
      },
    });
  });

  it('fails when the receipt relation, a seat revision, or the shared top identity is broken', () => {
    expect(validateRemoteCastJourneyObservationV1({
      ...observation,
      senderReceipt: { ...observation.senderReceipt, currentRevision: 9 },
    }, 2)).toEqual({ ok: false, code: 'RECEIPT_RELATION_MISMATCH' });

    expect(validateRemoteCastJourneyObservationV1({
      ...observation,
      seats: [observation.seats[0], { ...observation.seats[1], revision: 9 }],
    }, 2)).toEqual({ ok: false, code: 'REVISION_DIVERGED' });

    expect(validateRemoteCastJourneyObservationV1({
      ...observation,
      seats: [observation.seats[0], { ...observation.seats[1], topObjectId: 'PC4:1' }],
    }, 2)).toEqual({ ok: false, code: 'STACK_DIVERGED' });

    expect(validateRemoteCastJourneyObservationV1({
      ...observation,
      seats: observation.seats.map((seat) => ({ ...seat, topObjectId: 'PC3:2' })),
    }, 2)).toEqual({ ok: false, code: 'CAST_OBJECT_TRANSITION_MISMATCH' });
  });
});
