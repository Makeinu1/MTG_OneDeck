import { describe, expect, it } from 'vitest';

import * as Core from '../../../engine/core/index';
import {
  applyGameIntentV1,
  createLocalGameApplicationAdapterV1,
  createRemoteGameApplicationAdapterV1,
  validateGameApplicationAuthorityV1,
  validateGameApplicationAttemptV1,
  validateGameIntentV1,
} from '../index';
import type { GameIntentV1 } from '../index';
import { buildVariableRoomGenesisV3 } from '../../genesis/index';
import {
  handleOnlineVariableCommandEnvelopeV2,
  type OnlineVariableProtocolStateV2,
} from '../../protocol/index';
import { projectOnlineVariableProtocolV3 } from '../../projection/index';
import type { CardDef } from '../../../types/card';

const CARD_ID = '8d991178-1f2e-4d69-8ea3-5c3ac23cf565';
const ORACLE_ID = '60ac5965-e827-480f-a9a2-61c8138bb010';

function reviewCard(): CardDef {
  return Object.freeze({
    scryfallId: CARD_ID,
    oracleId: ORACLE_ID,
    name: 'Application test card',
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    colorIdentity: [],
    typeLine: 'Artifact',
    faces: [{ name: 'Application test card', typeLine: 'Artifact', oracleText: '' }],
  });
}

function protocolState(): OnlineVariableProtocolStateV2 {
  const entries = Object.freeze([Object.freeze({
    index: 0,
    section: 'main' as const,
    quantity: 40,
    scryfallId: CARD_ID,
    oracleId: ORACLE_ID,
    definition: reviewCard(),
  })]);
  const serialized = JSON.stringify({ entries });
  const seats = Object.freeze(Array.from({ length: 2 }, (_, index) => Object.freeze({
    seatIndex: index as 0 | 1,
    corePlayerId: `P${String(index + 1)}` as 'P1' | 'P2',
    participantId: `application-player-${String(index + 1)}`,
    seatCapability: `seat_${String(index + 1).repeat(40)}`,
    snapshot: Object.freeze({
      entries,
      serialized,
      digest: Core.coreSha256HexV1(serialized),
    }),
  })));
  const result = buildVariableRoomGenesisV3(Object.freeze({
    roomId: 'application-test-room',
    serverBuildId: 'application-test-build',
    configuration: Object.freeze({ playerCount: 2 as const, startingLife: 20 as const }),
    seats,
  }));
  if (!result.ok) throw new Error('Application test genesis failed');
  return result.protocolState;
}

function authority(state: OnlineVariableProtocolStateV2) {
  const seat = state.room.seats[0];
  if (seat === undefined || seat.participantId === null) throw new Error('Application test seat missing');
  return Object.freeze({
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: seat.participantId,
    participantCapability: seat.seatCapability,
  });
}

function intent(baseRevision: number, delta = 1): ReturnType<typeof Core.createCoreCommandV1> {
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence: baseRevision + 1,
    actorPlayerId: 'P1' as Core.CorePlayerId,
    decisionMakerPlayerId: 'P1' as Core.CorePlayerId,
    decisionContext: { kind: 'decision', decisionKey: 'application-test' },
    payload: { kind: 'table-mana-adjust', color: 'G', delta },
  });
}

describe('Game application v1 boundary', () => {
  it('rejects malformed authority without exposing capabilities', () => {
    const capability = `seat_${'x'.repeat(40)}`;
    const result = validateGameApplicationAuthorityV1({
      protocolVersion: 1,
      roomId: 'room-application-test',
      participantId: 'participant-application-test',
      participantCapability: capability,
      extra: true,
    });
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain(capability);
  });

  it('rejects intent accessors before reading their values', () => {
    let called = false;
    const input = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(input, {
      kind: { enumerable: true, value: 'game-intent-v1' },
      schemaVersion: { enumerable: true, value: 1 },
      commandId: { enumerable: true, value: 'application-test-command' },
      baseRevision: { enumerable: true, value: 0 },
      command: {
        enumerable: true,
        get: () => {
          called = true;
          return null;
        },
      },
    });
    expect(validateGameIntentV1(input)).toMatchObject({ ok: false });
    expect(called).toBe(false);
  });

  it('keeps stale and command-ID reuse rejections at the same Local/Remote revision', async () => {
    const initial = protocolState();
    const playerAuthority = authority(initial);
    const local = createLocalGameApplicationAdapterV1({ authority: playerAuthority, initialState: initial });
    let remoteState = initial;
    const remote = createRemoteGameApplicationAdapterV1({
      authority: playerAuthority,
      submit: (envelope) => {
        const transition = handleOnlineVariableCommandEnvelopeV2(remoteState, envelope);
        remoteState = transition.state;
        return Promise.resolve(Object.freeze({
          kind: 'game-application-exchange-v1' as const,
          receipt: transition.response,
          projection: projectOnlineVariableProtocolV3(remoteState, playerAuthority.participantId),
        }));
      },
    });
    const acceptedIntent = Object.freeze({
      kind: 'game-intent-v1' as const,
      schemaVersion: 1 as const,
      commandId: 'application-parity-first' as GameIntentV1['commandId'],
      baseRevision: 0 as const,
      command: intent(0),
    });
    expect(await applyGameIntentV1(local, acceptedIntent)).toEqual(await applyGameIntentV1(remote, acceptedIntent));

    const staleIntent = Object.freeze({
      ...acceptedIntent,
      commandId: 'application-stale' as GameIntentV1['commandId'],
    });
    const localStale = await applyGameIntentV1(local, staleIntent);
    const remoteStale = await applyGameIntentV1(remote, staleIntent);
    expect(localStale).toEqual(remoteStale);
    expect(localStale).toMatchObject({ ok: true, value: { receipt: { kind: 'online-command-reject-v1', issues: [{ code: 'STALE_REVISION' }] }, projection: { revision: 1 } } });

    const reuseIntent = Object.freeze({
      ...acceptedIntent,
      command: intent(0, 2),
    });
    const localReuse = await applyGameIntentV1(local, reuseIntent);
    const remoteReuse = await applyGameIntentV1(remote, reuseIntent);
    expect(localReuse).toEqual(remoteReuse);
    expect(localReuse).toMatchObject({ ok: true, value: { receipt: { kind: 'online-command-reject-v1', issues: [{ code: 'COMMAND_ID_REUSE_MISMATCH' }] }, projection: { revision: 1 } } });
  });

  it('redacts hostile attempt descriptors and transport errors', async () => {
    const state = protocolState();
    const playerAuthority = authority(state);
    const hostile = new Proxy(Object.create(null) as object, {
      getOwnPropertyDescriptor: () => { throw new Error('private-attempt-detail'); },
    });
    expect(() => validateGameApplicationAttemptV1(hostile, playerAuthority, {
      kind: 'game-intent-v1', schemaVersion: 1, commandId: 'hostile' as GameIntentV1['commandId'], baseRevision: 0, command: intent(0),
    })).not.toThrow();
    expect(validateGameApplicationAttemptV1(hostile, playerAuthority, {
      kind: 'game-intent-v1', schemaVersion: 1, commandId: 'hostile' as GameIntentV1['commandId'], baseRevision: 0, command: intent(0),
    })).toMatchObject({ ok: false });
    const remote = createRemoteGameApplicationAdapterV1({
      authority: playerAuthority,
      submit: () => Promise.reject(new Error('private-transport-detail')),
    });
    const result = await applyGameIntentV1(remote, {
      kind: 'game-intent-v1', schemaVersion: 1, commandId: 'transport' as GameIntentV1['commandId'], baseRevision: 0, command: intent(0),
    });
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain('private-transport-detail');

    const impossibleRemote = createRemoteGameApplicationAdapterV1({
      authority: playerAuthority,
      submit: (envelope) => Promise.resolve(Object.freeze({
        kind: 'game-application-exchange-v1' as const,
        receipt: Object.freeze({
          kind: 'online-command-reject-v1' as const,
          protocolVersion: playerAuthority.protocolVersion,
          roomId: playerAuthority.roomId,
          participantId: playerAuthority.participantId,
          commandId: envelope.commandId,
          baseRevision: envelope.baseRevision,
          currentRevision: state.revision,
          duplicate: true,
          resyncRequired: false,
          issues: Object.freeze([Object.freeze({
            code: 'STALE_REVISION' as const,
            path: '',
            message: 'hostile stale receipt detail',
          })]),
        }),
        projection: projectOnlineVariableProtocolV3(state, playerAuthority.participantId),
      })),
    });
    const impossible = await applyGameIntentV1(impossibleRemote, {
      kind: 'game-intent-v1',
      schemaVersion: 1,
      commandId: 'impossible-stale' as GameIntentV1['commandId'],
      baseRevision: 0,
      command: intent(0),
    });
    expect(impossible).toMatchObject({ ok: false });
    expect(JSON.stringify(impossible)).not.toContain('hostile stale receipt detail');

    const impossibleEqualRevision = createRemoteGameApplicationAdapterV1({
      authority: playerAuthority,
      submit: (envelope) => Promise.resolve(Object.freeze({
        kind: 'game-application-exchange-v1' as const,
        receipt: Object.freeze({
          kind: 'online-command-reject-v1' as const,
          protocolVersion: playerAuthority.protocolVersion,
          roomId: playerAuthority.roomId,
          participantId: playerAuthority.participantId,
          commandId: envelope.commandId,
          baseRevision: envelope.baseRevision,
          currentRevision: state.revision,
          duplicate: false,
          resyncRequired: true,
          issues: Object.freeze([Object.freeze({
            code: 'STALE_REVISION' as const,
            path: '',
            message: 'equal stale revision detail',
          })]),
        }),
        projection: projectOnlineVariableProtocolV3(state, playerAuthority.participantId),
      })),
    });
    const equalRevision = await applyGameIntentV1(impossibleEqualRevision, {
      kind: 'game-intent-v1',
      schemaVersion: 1,
      commandId: 'impossible-equal-stale' as GameIntentV1['commandId'],
      baseRevision: 0,
      command: intent(0),
    });
    expect(equalRevision).toMatchObject({ ok: false });
    expect(JSON.stringify(equalRevision)).not.toContain('equal stale revision detail');

    let advancedState = state;
    const impossibleAckRemote = createRemoteGameApplicationAdapterV1({
      authority: playerAuthority,
      submit: (envelope) => {
        const first = handleOnlineVariableCommandEnvelopeV2(advancedState, envelope);
        if (first.response.kind !== 'online-command-ack-v1') throw new Error('Application test expected first ACK');
        advancedState = first.state;
        const second = handleOnlineVariableCommandEnvelopeV2(advancedState, {
          ...envelope,
          commandId: 'application-hidden-second',
          baseRevision: 1,
          command: intent(1),
        });
        advancedState = second.state;
        return Promise.resolve(Object.freeze({
          kind: 'game-application-exchange-v1' as const,
          receipt: Object.freeze({ ...first.response, currentRevision: advancedState.revision }),
          projection: projectOnlineVariableProtocolV3(advancedState, playerAuthority.participantId),
        }));
      },
    });
    const impossibleAck = await applyGameIntentV1(impossibleAckRemote, {
      kind: 'game-intent-v1',
      schemaVersion: 1,
      commandId: 'impossible-ack' as GameIntentV1['commandId'],
      baseRevision: 0,
      command: intent(0),
    });
    expect(impossibleAck).toMatchObject({ ok: false });
  });
});
