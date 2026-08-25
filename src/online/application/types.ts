import type { CoreCommandV1 } from '../../engine/core/index';
import type {
  OnlineCommandAckV1,
  OnlineCommandEnvelopeV1,
  OnlineCommandRejectV1,
  OnlineProtocolCommandIdV1,
  OnlineProtocolRevisionV1,
  OnlineVariableProtocolStateV2,
} from '../protocol/index';
import type {
  OnlineRoomIdV1,
  OnlineRoomParticipantIdV1,
  OnlineRoomSeatCapabilityV1,
} from '../room/index';
import type { OnlineVariableParticipantProjectionV3 } from '../projection/index';

export const GAME_INTENT_SCHEMA_VERSION_V1 = 1 as const;
export const GAME_APPLICATION_SCHEMA_VERSION_V1 = 1 as const;

export type GameIntentV1 = Readonly<{
  readonly kind: 'game-intent-v1';
  readonly schemaVersion: typeof GAME_INTENT_SCHEMA_VERSION_V1;
  readonly commandId: OnlineProtocolCommandIdV1;
  readonly baseRevision: OnlineProtocolRevisionV1;
  readonly command: CoreCommandV1;
}>;

export type GameApplicationAuthorityV1 = Readonly<{
  readonly protocolVersion: number;
  readonly roomId: OnlineRoomIdV1 | string;
  readonly participantId: OnlineRoomParticipantIdV1 | string;
  readonly participantCapability: OnlineRoomSeatCapabilityV1 | string;
}>;

export type GameApplicationIssueCodeV1 =
  | 'INVALID_INTENT'
  | 'INVALID_DESCRIPTOR'
  | 'INVALID_AUTHORITY'
  | 'INVALID_ENVELOPE'
  | 'INVALID_RECEIPT'
  | 'INVALID_PROJECTION'
  | 'TRANSPORT_FAILURE'
  | 'APPLICATION_FAILURE';

export type GameApplicationIssueV1 = Readonly<{
  readonly code: GameApplicationIssueCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export type GameApplicationReceiptV1 = OnlineCommandAckV1 | OnlineCommandRejectV1;

export type GameApplicationExchangeV1 = Readonly<{
  readonly kind: 'game-application-exchange-v1';
  readonly receipt: GameApplicationReceiptV1;
  readonly projection: OnlineVariableParticipantProjectionV3;
}>;

export type GameApplicationAttemptV1 =
  | Readonly<{ readonly ok: true; readonly value: GameApplicationExchangeV1 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly GameApplicationIssueV1[] }>;

export type GameApplicationExecutionV1 =
  | Readonly<{ readonly ok: true; readonly value: unknown }>
  | Readonly<{ readonly ok: false; readonly issues: readonly GameApplicationIssueV1[] }>;

export type GameApplicationAdapterV1 = Readonly<{
  readonly kind: 'local' | 'remote';
}>;

type GameApplicationAdapterInternalsV1 = Readonly<{
  readonly kind: 'local' | 'remote';
  readonly authority: GameApplicationAuthorityV1;
  readonly applyEnvelope: (
    envelope: OnlineCommandEnvelopeV1,
  ) => Promise<GameApplicationExecutionV1>;
}>;

const adapterRegistry = new WeakMap<object, GameApplicationAdapterInternalsV1>();

export function registerGameApplicationAdapterV1(
  kind: GameApplicationAdapterInternalsV1['kind'],
  authority: GameApplicationAuthorityV1,
  applyEnvelope: GameApplicationAdapterInternalsV1['applyEnvelope'],
): GameApplicationAdapterV1 {
  const adapter = Object.freeze({ kind });
  adapterRegistry.set(adapter, Object.freeze({ kind, authority, applyEnvelope }));
  return adapter;
}

export function lookupGameApplicationAdapterV1(
  input: unknown,
): GameApplicationAdapterInternalsV1 | null {
  if (input === null || (typeof input !== 'object' && typeof input !== 'function')) return null;
  return adapterRegistry.get(input) ?? null;
}

export type CreateLocalGameApplicationAdapterV1Input = Readonly<{
  readonly authority: GameApplicationAuthorityV1;
  readonly initialState: OnlineVariableProtocolStateV2;
}>;

export type RemoteGameApplicationSubmitV1 = (
  envelope: OnlineCommandEnvelopeV1,
) => Promise<unknown>;

export type CreateRemoteGameApplicationAdapterV1Input = Readonly<{
  readonly authority: GameApplicationAuthorityV1;
  readonly submit: RemoteGameApplicationSubmitV1;
}>;
