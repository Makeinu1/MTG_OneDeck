import type { CoreCommandV1, CorePlayerId } from '../../engine/core/index';
import type { OnlineVariableProtocolStateV2 } from '../protocol/variable';

export const ONLINE_VISIBILITY_INTENT_SCHEMA_VERSION_V1 = 1 as const;
export type OnlineVisibilityDurationV1 = Readonly<{ readonly kind: 'next-command' }> | Readonly<{ readonly kind: 'end-of-turn' }> | Readonly<{ readonly kind: 'source-bound'; readonly sourceHandle: string }> | Readonly<{ readonly kind: 'choice-bound'; readonly searchSessionId: string }>;
export type OnlineVisibilityObjectSubjectV1 = Readonly<{ readonly kind: 'object'; readonly handle: string }>;
export type OnlineVisibilityLibrarySubjectV1 = Readonly<{ readonly kind: 'top-of-library'; readonly count: number }>;
export type OnlineVisibilitySubjectV1 = OnlineVisibilityObjectSubjectV1 | OnlineVisibilityLibrarySubjectV1;
export type OnlineVisibilityLookV1 = Readonly<{ readonly subject: OnlineVisibilitySubjectV1; readonly viewerPlayerIds: readonly string[]; readonly duration: OnlineVisibilityDurationV1 }>;
export type OnlineVisibilityRevealV1 = Readonly<{ readonly subject: OnlineVisibilitySubjectV1; readonly duration: OnlineVisibilityDurationV1 }>;
export type OnlineVisibilityChooseV1 = Readonly<{ readonly searchSessionId: string; readonly candidateHandles: readonly string[] }>;
export type OnlineVisibilityIntentPayloadV1 = Readonly<{ readonly look: OnlineVisibilityLookV1 }> | Readonly<{ readonly reveal: OnlineVisibilityRevealV1 }> | Readonly<{ readonly choose: OnlineVisibilityChooseV1 }>;
export type OnlineVisibilityIntentEnvelopeV1 = Readonly<{
  readonly kind: 'online-visibility-intent-v1';
  readonly schemaVersion: typeof ONLINE_VISIBILITY_INTENT_SCHEMA_VERSION_V1;
  readonly commandId: string;
  readonly baseRevision: number;
  readonly look?: OnlineVisibilityLookV1;
  readonly reveal?: OnlineVisibilityRevealV1;
  readonly choose?: OnlineVisibilityChooseV1;
}>;
export type OnlineVisibilityValidationIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;
export type OnlineVisibilityValidationResultV1 = Readonly<{ readonly ok: true; readonly value: OnlineVisibilityIntentEnvelopeV1 }> | Readonly<{ readonly ok: false; readonly issues: readonly OnlineVisibilityValidationIssueV1[] }>;
export type OnlineVisibilityBindingInputV1 = Readonly<{ readonly state: OnlineVariableProtocolStateV2; readonly participantId: string; readonly transportCredential?: string; readonly envelope: OnlineVisibilityIntentEnvelopeV1; readonly projection?: unknown; readonly existingCommand?: unknown }>;
export type OnlineVisibilityBindingResultV1 = Readonly<{ readonly command: CoreCommandV1; readonly actorPlayerId: CorePlayerId; readonly decisionMakerPlayerId: CorePlayerId; readonly grantKey?: string }>;
