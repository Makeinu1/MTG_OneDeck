import { describe, expect, it } from 'vitest';
import { createCoreCommandV1 } from '../../../engine/core/index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  assertDeepFrozen,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import { activateOnlineRoomV1, startOnlineRoomV1 } from '../../room/index';
import { createOnlineProtocolStateV1 } from '../../protocol/index';
import {
  deserializeOnlineCloudflareProtocolStateV1,
  serializeAcceptedCoreCommandV1,
  serializeOnlineCloudflareProtocolStateV1,
} from '../index';

function protocolState() {
  const coreRoot = makeCoreRoot();
  const room = activateOnlineRoomV1(startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]), {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot,
  });
  return createOnlineProtocolStateV1({
    serverBuildId: 'ordinary-cloudflare-codec-build',
    room,
    coreRoot,
    observerAuthorizations: [],
  });
}

describe('O4P-03A codec', () => {
  it('round-trips deterministic canonical JSON into a fresh deeply frozen state', () => {
    const input = protocolState();
    const serialized = serializeOnlineCloudflareProtocolStateV1(input);
    const restored = deserializeOnlineCloudflareProtocolStateV1(serialized);
    expect(serializeOnlineCloudflareProtocolStateV1(restored)).toBe(serialized);
    expect(restored).not.toBe(input);
    assertDeepFrozen(restored);
  });

  it('rejects malformed, non-canonical, and oversized payloads', () => {
    const serialized = serializeOnlineCloudflareProtocolStateV1(protocolState());
    expect(() => deserializeOnlineCloudflareProtocolStateV1('{}')).toThrow();
    expect(() => deserializeOnlineCloudflareProtocolStateV1(`${serialized} `)).toThrow();
    expect(() => deserializeOnlineCloudflareProtocolStateV1(' '.repeat(1_048_577))).toThrow();
  });

  it('does not mutate invalid input and rejects capability fragments in command JSON', () => {
    const invalid = Object.freeze({ kind: 'bad' });
    expect(() => serializeOnlineCloudflareProtocolStateV1(invalid)).toThrow();
    expect(invalid).toEqual({ kind: 'bad' });
    const command = createCoreCommandV1({
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P1' as never,
      decisionMakerPlayerId: 'P1' as never,
      decisionContext: { kind: 'decision', decisionKey: 'codec-command' },
      payload: {
        kind: 'commander-cast-record',
        physicalCardId: 'PC1' as never,
        origin: 'command-zone',
        accepted: true,
      },
    });
    expect(() => serializeAcceptedCoreCommandV1(command, [CAPABILITIES[0]])).not.toThrow();
    expect(() =>
      serializeAcceptedCoreCommandV1(
        { ...command, decisionContext: { kind: 'decision', decisionKey: CAPABILITIES[0] } },
        [CAPABILITIES[0]],
      ),
    ).toThrow();
    expect(JSON.stringify(command)).not.toContain(CAPABILITIES[0]);
  });
});
