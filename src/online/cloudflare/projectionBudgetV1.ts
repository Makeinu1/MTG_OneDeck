import type { OnlineVariableProtocolStateV2 } from '../protocol/index';
import {
  projectOnlineVariableProtocolV2,
  projectOnlineVariableProtocolV3,
} from '../projection/index';
import {
  ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1,
} from './security';
import { serializeOnlineCloudflareWebSocketValueV1 } from './websocket';

type ProjectionRole = 'player' | 'table' | 'spectator';

function audienceIds(state: OnlineVariableProtocolStateV2): readonly string[] {
  const ids = new Set<string>();
  for (const participant of state.room.participants) ids.add(participant.participantId);
  for (const observer of state.observerAuthorizations) ids.add(observer.participantId);
  return [...ids];
}

function roleFor(state: OnlineVariableProtocolStateV2, participantId: string): ProjectionRole {
  const participant = state.room.participants.find((entry) => entry.participantId === participantId);
  if (participant !== undefined) return participant.role;
  return 'table';
}

function projectedSnapshot(
  state: OnlineVariableProtocolStateV2,
  participantId: string,
  projection: unknown,
  knownRevision: number,
  clientBuildIdMatch: boolean,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    kind: 'online-projected-snapshot-v1',
    protocolVersion: state.protocolVersion,
    status: 'accepted',
    roomId: state.room.roomId,
    participantId,
    role: roleFor(state, participantId),
    knownRevision,
    revision: state.revision,
    serverBuildId: state.serverBuildId,
    clientBuildIdMatch,
    reason: knownRevision === state.revision ? 'synchronized' : 'snapshot-required',
    projection,
    issues: Object.freeze([]),
  });
}

/**
 * Admission guard for variable-room mutations.  Every audience that can ask
 * for either supported projection generation is checked against the exact
 * projected-snapshot envelope sent over the WebSocket.  A failed check is
 * intentionally a boolean so callers can return a bounded public rejection
 * before journal/CAS persistence.
 */
export function isOnlineVariableProjectionWithinFrameBudgetV1(
  state: OnlineVariableProtocolStateV2,
): boolean {
  try {
    // The projection request accepts any non-negative safe integer as its
    // known revision.  Check a synchronized current revision and a stale
    // revision with the longest legal decimal representation.  The actual
    // runtime also reports a false build-match for incompatible clients;
    // `false` serializes one byte longer than `true`, so include both boolean
    // variants while reserving the conservative longer shape.
    const staleRevision = state.revision === Number.MAX_SAFE_INTEGER
      ? Number.MAX_SAFE_INTEGER - 1
      : Number.MAX_SAFE_INTEGER;
    const knownRevisions = [state.revision, staleRevision] as const;
    for (const participantId of audienceIds(state)) {
      const compact = projectOnlineVariableProtocolV2(state, participantId);
      for (const knownRevision of knownRevisions) {
        for (const clientBuildIdMatch of [false, true] as const) {
          const compactResponse = serializeOnlineCloudflareWebSocketValueV1(
            projectedSnapshot(state, participantId, compact, knownRevision, clientBuildIdMatch),
          );
          if (compactResponse === null || new TextEncoder().encode(compactResponse).length > ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1) return false;
        }
      }

      const full = projectOnlineVariableProtocolV3(state, participantId);
      for (const knownRevision of knownRevisions) {
        for (const clientBuildIdMatch of [false, true] as const) {
          const fullResponse = serializeOnlineCloudflareWebSocketValueV1(
            projectedSnapshot(state, participantId, full, knownRevision, clientBuildIdMatch),
          );
          if (fullResponse === null || new TextEncoder().encode(fullResponse).length > ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1) return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}
