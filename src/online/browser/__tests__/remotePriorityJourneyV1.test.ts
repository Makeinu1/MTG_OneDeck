import { describe, expect, it } from 'vitest';

import { validateRemotePriorityJourneyObservationV1 } from '../../../../scripts/online/remote-priority-journey-evidence';

const seat = (
  revision: number,
  overrides: Partial<{
    holds: readonly string[];
    holderPlayerId: string | null;
    stewardPlayerId: string | null;
    windowKind: string;
    stackCount: number;
    topObjectId: string | null;
    recentResolutionObjectId: string | null;
    recentResolutionRevision: number | null;
  }> = {},
) => Object.freeze({
  revision,
  holds: Object.freeze(overrides.holds ?? []),
  holderPlayerId: overrides.holderPlayerId === undefined ? 'P1' : overrides.holderPlayerId,
  stewardPlayerId: overrides.stewardPlayerId === undefined ? 'P1' : overrides.stewardPlayerId,
  windowKind: overrides.windowKind ?? 'priority',
  stackCount: overrides.stackCount ?? 1,
  topObjectId: overrides.topObjectId === undefined ? 'PC3:1' : overrides.topObjectId,
  recentResolutionObjectId: overrides.recentResolutionObjectId ?? null,
  recentResolutionRevision: overrides.recentResolutionRevision ?? null,
});

const step = (
  operation: 'priority-hold' | 'priority-pass' | 'priority-resolve',
  actorPlayerId: string,
  baseRevision: number,
  projected: ReturnType<typeof seat>,
) => Object.freeze({
  operation,
  actorPlayerId,
  receipt: Object.freeze({
    commandId: `remote-${operation}-${String(baseRevision)}`,
    operation,
    outcome: 'accepted' as const,
    baseRevision,
    currentRevision: baseRevision + 1,
    acceptedRevision: baseRevision + 1,
  }),
  seats: Object.freeze([projected, Object.freeze({ ...projected, holds: Object.freeze([...projected.holds]) })]),
});

const observation = Object.freeze({
  kind: 'remote-priority-journey-observation-v1' as const,
  playerIds: Object.freeze(['P1', 'P2'] as const),
  capturedTopObjectId: 'PC3:1',
  steps: Object.freeze([
    step('priority-hold', 'P2', 8, seat(9, { holds: ['P2'] })),
    step('priority-hold', 'P2', 9, seat(10)),
    step('priority-pass', 'P1', 10, seat(11, { holderPlayerId: 'P2' })),
    step('priority-pass', 'P2', 11, seat(12, { holderPlayerId: null, windowKind: 'resolution-ready' })),
    step('priority-resolve', 'P1', 12, seat(13, {
      holderPlayerId: null,
      windowKind: 'sba-check-required',
      stackCount: 0,
      topObjectId: null,
      recentResolutionObjectId: 'PC3:1',
      recentResolutionRevision: 13,
    })),
  ] as const),
});

describe('Remote HOLD/pass/resolve journey evidence', () => {
  it('accepts five accepted transitions with two converged seats and the captured top resolved', () => {
    expect(validateRemotePriorityJourneyObservationV1(observation)).toEqual({
      ok: true,
      value: {
        startRevision: 8,
        resolvedRevision: 13,
        seatCount: 2,
        receiptsAccepted: true,
        revisionsConverged: true,
        holdConverged: true,
        priorityCycleComplete: true,
        capturedTopResolved: true,
      },
    });
  });

  it('fails on a missing receipt relation, divergent seat, or unresolved captured top', () => {
    expect(validateRemotePriorityJourneyObservationV1({
      ...observation,
      steps: observation.steps.map((candidate, index) => index === 2
        ? { ...candidate, receipt: { ...candidate.receipt, currentRevision: 99 } }
        : candidate),
    })).toEqual({ ok: false, code: 'STEP_OR_RECEIPT_INVALID' });

    expect(validateRemotePriorityJourneyObservationV1({
      ...observation,
      steps: observation.steps.map((candidate, index) => index === 3
        ? { ...candidate, seats: [candidate.seats[0], { ...candidate.seats[1], revision: 99 }] }
        : candidate),
    })).toEqual({ ok: false, code: 'STEP_OR_RECEIPT_INVALID' });

    const resolved = observation.steps[4];
    expect(validateRemotePriorityJourneyObservationV1({
      ...observation,
      steps: [...observation.steps.slice(0, 4), {
        ...resolved,
        seats: resolved.seats.map((candidate) => ({ ...candidate, stackCount: 1, topObjectId: 'PC3:1' })),
      }],
    })).toEqual({ ok: false, code: 'CAPTURED_TOP_NOT_RESOLVED' });

    expect(validateRemotePriorityJourneyObservationV1({
      ...observation,
      steps: observation.steps.map((candidate, index) => index === 0
        ? { ...candidate, seats: candidate.seats.map((projected) => ({ ...projected, windowKind: 'resolution-ready' })) }
        : candidate),
    })).toEqual({ ok: false, code: 'HOLD_WINDOW_DIVERGED' });

    expect(validateRemotePriorityJourneyObservationV1({
      ...observation,
      steps: observation.steps.map((candidate, index) => index === 2
        ? { ...candidate, seats: candidate.seats.map((projected) => ({ ...projected, stewardPlayerId: 'P3' })) }
        : candidate),
    })).toEqual({ ok: false, code: 'STATE_ID_NOT_SEATED' });
  });
});
