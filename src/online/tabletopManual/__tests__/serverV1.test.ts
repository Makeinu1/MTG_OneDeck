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

function hold(baseRevision = 0): OnlineTabletopIntentEnvelopeV1 {
  return { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, commandId: 'hold-command', baseRevision, mode: 'structured', primitive: { kind: 'priority-hold', held: true } };
}

function advance(baseRevision = 0): OnlineTabletopIntentEnvelopeV1 {
  return { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, commandId: 'advance-command', baseRevision, mode: 'structured', primitive: { kind: 'priority-advance' } };
}

function cardState(window: Record<string, unknown>, typeLine = 'Basic Land — Forest', phase: 'precombat-main' | 'postcombat-main' | 'combat' = 'precombat-main'): never {
  return {
    revision: 0,
    room: {
      lifecycle: 'active',
      participants: [{ participantId: 'player-one', role: 'player', presence: 'connected', seatIndex: 0 }],
      seats: [{ seatIndex: 0, corePlayerId: 'P1', seatCapability: 'seat-capability', participantId: 'player-one', outcome: 'pending' }],
    },
    coreRoot: {
      ruleAuthority: {
        turnPriorityBundle: {
          lifecycle: { position: { phase, step: phase === 'combat' ? 'declare-attackers' : null }, window },
          stackBundle: { objectRegistry: {
            activePlayerId: 'P1',
            players: { P1: { landsPlayedThisTurn: 0 } },
            physicalCards: { PC1: { definitionId: 'def-land', ownerPlayerId: 'P1' } },
            cardDefinitions: { 'def-land': { typeLine, faces: [{ typeLine }] } },
            objects: { 'PC1:0': { kind: 'card', physicalCardId: 'PC1' } },
            zones: { byPlayer: { P1: { hand: ['PC1:0'] } }, shared: { stack: [] } },
          } },
        },
      },
    },
  } as never;
}

function playLand(baseRevision = 0): OnlineTabletopIntentEnvelopeV1 {
  return { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, commandId: 'play-land-command', baseRevision, mode: 'structured', primitive: { kind: 'play-land', objectId: 'PC1:0' as never } };
}

function castSpell(baseRevision = 0): OnlineTabletopIntentEnvelopeV1 {
  return { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, commandId: 'cast-spell-command', baseRevision, mode: 'structured', primitive: { kind: 'cast-spell', objectId: 'PC1:0' as never } };
}

function manualResolve(baseRevision = 0): OnlineTabletopIntentEnvelopeV1 {
  return { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, commandId: 'manual-resolve-command', baseRevision, mode: 'structured', primitive: { kind: 'manual-resolve', entryId: 'manual-entry' } };
}

function firstTurnUpkeepState(playerCount: 2 | 4): never {
  const players = Array.from({ length: playerCount }, (_, index) => `P${String(index + 1)}`);
  const participants = players.map((_, index) => ({ participantId: `player-${String(index + 1)}`, role: 'player' as const, presence: 'connected' as const, seatIndex: index }));
  const seats = players.map((corePlayerId, seatIndex) => ({ seatIndex, corePlayerId, seatCapability: `seat-capability-${String(seatIndex + 1)}`, participantId: `player-${String(seatIndex + 1)}`, outcome: 'pending' as const }));
  return {
    revision: 0,
    room: { lifecycle: 'active', participants, seats },
    coreRoot: {
      ruleAuthority: {
        turnPriorityBundle: {
          lifecycle: { turnNumber: 1, position: { phase: 'beginning', step: 'upkeep' }, window: { kind: 'position-advance-ready' } },
          stackBundle: { objectRegistry: { activePlayerId: 'P1', turnOrder: players, zones: { shared: { stack: [] } } } },
        },
      },
    },
  } as never;
}

function stewardState(): Record<string, unknown> {
  return {
    revision: 0,
    room: {
      lifecycle: 'active',
      participants: [
        { participantId: 'player-one', role: 'player', presence: 'connected', seatIndex: 0 },
        { participantId: 'player-two', role: 'player', presence: 'connected', seatIndex: 1 },
      ],
      seats: [
        { seatIndex: 0, corePlayerId: 'P1', seatCapability: 'seat-capability', participantId: 'player-one', outcome: 'pending' },
        { seatIndex: 1, corePlayerId: 'P2', seatCapability: 'seat-capability', participantId: 'player-two', outcome: 'pending' },
      ],
    },
    coreRoot: {
      ruleAuthority: {
        turnPriorityBundle: {
          lifecycle: { window: { kind: 'turn-advance-ready' } },
          stackBundle: { objectRegistry: { activePlayerId: 'P1', zones: { shared: { stack: [] } } } },
        },
        control: { effectOrder: [], byEffect: {}, continuityByObject: {} },
      },
    },
  };
}

function abilityStewardState(): never {
  const base = stewardState();
  const coreRoot = base.coreRoot as Record<string, unknown>;
  const authority = coreRoot.ruleAuthority as Record<string, unknown>;
  const turn = authority.turnPriorityBundle as Record<string, unknown>;
  const stackBundle = turn.stackBundle as Record<string, unknown>;
  const registry = stackBundle.objectRegistry as Record<string, unknown>;
  return {
    ...base,
    coreRoot: {
      ...coreRoot,
      ruleAuthority: {
        ...authority,
        turnPriorityBundle: {
          ...turn,
          stackBundle: {
            ...stackBundle,
            objectRegistry: {
              ...registry,
              zones: { shared: { stack: ['@activated-ability:cast'] } },
              objects: { '@activated-ability:cast': { kind: 'activated-ability', controllerPlayerId: 'P2' } },
            },
          },
        },
      },
    },
  } as never;
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

  it('binds an author-owned HOLD into the Core command path', () => {
    const bound = bindOnlineTabletopIntentOnServerV1({ state: state(), participantId: 'player-one', envelope: hold(), randomize: (order) => order });
    expect(bound.command.payload).toEqual({ kind: 'table-priority-hold', held: true });
    expect(bound.command.actorPlayerId).toBe('P1');
    expect(bound.command.decisionMakerPlayerId).toBe('P1');
  });

  it('rejects Advance from a non-steward player before Core command creation', () => {
    expect(() => bindOnlineTabletopIntentOnServerV1({ state: stewardState() as never, participantId: 'player-two', envelope: advance(), randomize: (order) => order })).toThrow('Only the current stack steward may advance or resolve');
  });

  it('recognizes an ability controller as steward and blocks active HOLD shortcuts', () => {
    const bound = bindOnlineTabletopIntentOnServerV1({ state: abilityStewardState(), participantId: 'player-two', envelope: advance(), randomize: (order) => order });
    expect(bound.command.payload).toEqual({ kind: 'table-turn-progress', transition: { kind: 'next-turn' } });
    const held = stewardState();
    const heldRoot = held.coreRoot as Record<string, unknown>;
    const heldWithManual = { ...heldRoot, tabletopManual: { kind: 'core-tabletop-manual-state-v1', notes: {}, noteOrder: [], stackEntries: [], priorityHolds: [{ playerId: 'P1', setRevision: 1 }] } };
    expect(() => bindOnlineTabletopIntentOnServerV1({ state: { ...held, coreRoot: heldWithManual } as never, participantId: 'player-one', envelope: advance(), randomize: (order) => order })).toThrow('Active priority HOLD blocks advance or resolve');
  });

  it('binds land play to the dedicated Core payload and rejects casts outside priority', () => {
    const land = bindOnlineTabletopIntentOnServerV1({ state: cardState({ kind: 'priority', holderPlayerId: 'P1' }), participantId: 'player-one', envelope: playLand(), randomize: (order) => order });
    expect(land.command.payload).toEqual({ kind: 'table-land-play', objectId: 'PC1:0' });
    expect(() => bindOnlineTabletopIntentOnServerV1({ state: cardState({ kind: 'turn-based-action-required', action: 'precombat-main-actions', playerId: 'P1' }, 'Sorcery'), participantId: 'player-one', envelope: castSpell(), randomize: (order) => order })).toThrow('must hold priority');
    expect(() => bindOnlineTabletopIntentOnServerV1({ state: cardState({ kind: 'priority', holderPlayerId: 'P1' }, 'Sorcery', 'combat'), participantId: 'player-one', envelope: castSpell(), randomize: (order) => order })).toThrow('empty main-phase stack');
    expect(bindOnlineTabletopIntentOnServerV1({ state: cardState({ kind: 'priority', holderPlayerId: 'P1' }, 'Instant', 'combat'), participantId: 'player-one', envelope: castSpell(), randomize: (order) => order }).command.payload.kind).toBe('stack-commit-card-spell');
  });

  it('uses the first-turn draw skip only for two-player upkeep', () => {
    const twoPlayer = bindOnlineTabletopIntentOnServerV1({ state: firstTurnUpkeepState(2), participantId: 'player-1', envelope: advance(), randomize: (order) => order });
    expect(twoPlayer.command.payload).toEqual({ kind: 'table-turn-progress', transition: { kind: 'first-turn-draw-skip' } });
    const fourPlayer = bindOnlineTabletopIntentOnServerV1({ state: firstTurnUpkeepState(4), participantId: 'player-1', envelope: advance(), randomize: (order) => order });
    expect(fourPlayer.command.payload).toEqual({ kind: 'table-turn-progress', transition: { kind: 'position', nextPosition: { phase: 'beginning', step: 'draw' } } });
  });

  it('binds manual resolve only at the explicit empty-stack boundary', () => {
    const base = cardState({ kind: 'priority', holderPlayerId: 'P1' }) as Record<string, unknown>;
    const coreRoot = base.coreRoot as Record<string, unknown>;
    const bound = bindOnlineTabletopIntentOnServerV1({
      state: { ...base, coreRoot: { ...coreRoot, tabletopManual: { stackEntries: [{ id: 'manual-entry', authorPlayerId: 'P1', sourceObjectId: null }], priorityHolds: [] } } } as never,
      participantId: 'player-one',
      envelope: manualResolve(),
      randomize: (order) => order,
    });
    expect(bound.command.payload).toMatchObject({ kind: 'table-manual-resolve', entryId: 'manual-entry' });
    const heldRoot = { ...coreRoot, tabletopManual: { stackEntries: [{ id: 'manual-entry', authorPlayerId: 'P1', sourceObjectId: null }], priorityHolds: [{ playerId: 'P1', setRevision: 1 }] } };
    expect(() => bindOnlineTabletopIntentOnServerV1({ state: { ...base, coreRoot: heldRoot } as never, participantId: 'player-one', envelope: manualResolve(), randomize: (order) => order })).toThrow('HOLD');
  });
});
