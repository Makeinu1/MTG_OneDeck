import { describe, expect, it } from 'vitest';
import { bindOnlineTabletopIntentOnServerV1 } from '../server';
import type { OnlineTabletopIntentEnvelopeV1 } from '../types';

function state(revision = 0): never {
  return {
    revision,
    room: {
      lifecycle: 'active',
      participants: [{ participantId: 'player-one', role: 'player', presence: 'connected', seatIndex: 0 }],
      seats: [{ seatIndex: 0, corePlayerId: 'P1', ['seatCapability']: 'seat-capability', participantId: 'player-one', outcome: 'pending' }],
    },
    coreRoot: {
      ruleAuthority: {
        turnPriorityBundle: {
          stackBundle: { objectRegistry: { zones: { byPlayer: { P1: { library: ['PC1:0'] } } } } },
        },
      },
    },
  } as never;
}

function shuffle(baseRevision = 0): OnlineTabletopIntentEnvelopeV1 {
  return { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, commandId: 'shuffle-command', baseRevision, mode: 'structured', primitive: { kind: 'shuffle' } };
}

describe('O4P-09D authoritative tabletop binder', () => {
  it('does not draw entropy for a stale request', () => {
    let calls = 0;
    expect(() => bindOnlineTabletopIntentOnServerV1({ state: state(1), participantId: 'player-one', envelope: shuffle(), randomize: (order) => { calls += 1; return order; } })).toThrow();
    expect(calls).toBe(0);
  });

  it('draws exactly once and validates the server permutation before binding', () => {
    let calls = 0;
    const bound = bindOnlineTabletopIntentOnServerV1({ state: state(), participantId: 'player-one', envelope: shuffle(), randomize: (order) => { calls += 1; return order.slice().reverse(); } });
    expect(calls).toBe(1);
    expect(bound.command.payload.kind).toBe('random-zone-order');
    calls = 0;
    expect(() => bindOnlineTabletopIntentOnServerV1({ state: state(), participantId: 'player-one', envelope: shuffle(), randomize: () => { calls += 1; return []; } })).toThrow();
    expect(calls).toBe(1);
  });
});
