import type { CoreDecisionContextV1 } from '../../engine/core/index';
import type { OnlineProtocolParticipantCapabilityV1, OnlineProtocolRevisionV1 } from '../protocol/index';
import type { OnlineRoomIdV1, OnlineRoomParticipantIdV1 } from '../room/index';
import type { BuildId } from '../../versioning/index';

export type OnlineProjectionRequestV1 = Readonly<{
  readonly kind: 'online-projection-request-v1';
  readonly protocolVersion: number;
  readonly roomId: OnlineRoomIdV1;
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly ['participantCapability']: OnlineProtocolParticipantCapabilityV1;
  readonly knownRevision: OnlineProtocolRevisionV1;
  readonly clientBuildId: BuildId;
  readonly decisionContext: CoreDecisionContextV1 | null;
}>;
