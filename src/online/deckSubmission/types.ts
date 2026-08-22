import type { CardDef } from '../../types/card';

export const ONLINE_DECK_SUBMISSION_SCHEMA_VERSION_V2 = 2 as const;
export const ONLINE_DECK_SUBMISSION_MAX_CANONICAL_BYTES_V2 = 262_144 as const;

export type OnlineDeckSubmissionSectionV2 = 'commander' | 'main';
export type OnlineDeckSubmissionIssueCodeV2 =
  | 'EMPTY_LIST'
  | 'INVALID_SECTION'
  | 'INVALID_QUANTITY'
  | 'INVALID_CARD_ID'
  | 'CARD_NOT_FOUND'
  | 'IDENTITY_MISMATCH'
  | 'SCRYFALL_UNAVAILABLE'
  | 'SUBMISSION_CONFLICT'
  | 'STALE_RESOLUTION'
  | 'SNAPSHOT_TOO_LARGE';

export type OnlineDeckSubmissionEntryV2 = Readonly<{
  readonly section: OnlineDeckSubmissionSectionV2;
  readonly quantity: number;
  readonly scryfallId: string;
  readonly oracleId: string;
}>;

export type OnlineDeckSubmitV2 = Readonly<{
  readonly kind: 'online-forming-lobby-deck-submit-v2';
  readonly schemaVersion: typeof ONLINE_DECK_SUBMISSION_SCHEMA_VERSION_V2;
  readonly participantId: string;
  readonly seatCapability: string;
  readonly deckId: string;
  readonly submissionId: string;
  readonly entries: readonly OnlineDeckSubmissionEntryV2[];
}>;

export type OnlineDeckSubmissionIssueV2 = Readonly<{
  readonly code: OnlineDeckSubmissionIssueCodeV2;
  readonly entryIndex: number | null;
  readonly retryable: boolean;
}>;

export type OnlineDeckSubmissionStateV2 = 'none' | 'resolving' | 'accepted' | 'needs-attention';

export type OnlineDeckResolvedEntryV2 = Readonly<OnlineDeckSubmissionEntryV2 & {
  readonly index: number;
  readonly definition: CardDef;
}>;

export type OnlineDeckResolvedSnapshotV2 = Readonly<{
  readonly entries: readonly OnlineDeckResolvedEntryV2[];
  readonly digest: string;
  readonly serialized: string;
}>;

export type OnlineDeckSubmissionHeadV2 = Readonly<{
  readonly roomId: string;
  readonly seatIndex: 0 | 1 | 2 | 3;
  readonly participantId: string;
  readonly deckId: string;
  readonly submissionId: string;
  readonly contentDigest: string;
  readonly revision: number;
  readonly state: OnlineDeckSubmissionStateV2;
  readonly snapshotDigest: string | null;
}>;

export type OnlineDeckSubmissionResultV2 = Readonly<{
  readonly kind: 'online-forming-lobby-deck-result-v2';
  readonly schemaVersion: typeof ONLINE_DECK_SUBMISSION_SCHEMA_VERSION_V2;
  readonly roomId: string;
  readonly submissionId: string;
  readonly state: OnlineDeckSubmissionStateV2;
  readonly issues: readonly OnlineDeckSubmissionIssueV2[];
  readonly projection: OnlineFormingLobbyProjectionV2;
}>;

export type OnlineFormingLobbyProjectionV2 = Readonly<{
  readonly kind: 'online-forming-lobby-projection-v2';
  readonly schemaVersion: typeof ONLINE_DECK_SUBMISSION_SCHEMA_VERSION_V2;
  readonly lifecycle: 'forming' | 'ready' | 'started';
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly hostParticipantId: string;
  readonly seats: readonly [OnlineFormingLobbySeatProjectionV2, OnlineFormingLobbySeatProjectionV2, OnlineFormingLobbySeatProjectionV2, OnlineFormingLobbySeatProjectionV2];
}>;

export type OnlineFormingLobbySeatProjectionV2 = Readonly<{
  readonly seatIndex: 0 | 1 | 2 | 3;
  readonly corePlayerId: 'P1' | 'P2' | 'P3' | 'P4';
  readonly participantId: string | null;
  readonly deckState: OnlineDeckSubmissionStateV2;
  readonly ready: boolean;
}>;

export type OnlineDeckSubmissionValidationResultV2 =
  | Readonly<{ readonly ok: true; readonly value: OnlineDeckSubmitV2; readonly canonicalInput: string; readonly contentDigest: string }>
  | Readonly<{ readonly ok: false; readonly issues: readonly OnlineDeckSubmissionIssueV2[] }>;

export type OnlineDeckResolutionResultV2 = Readonly<{
  readonly snapshot: OnlineDeckResolvedSnapshotV2 | null;
  readonly issues: readonly OnlineDeckSubmissionIssueV2[];
}>;

export interface OnlineDeckResolverV2 {
  resolve(entries: readonly OnlineDeckSubmissionEntryV2[]): Promise<ReadonlyMap<string, CardDef>>;
  readonly resolveDetailed?: (entries: readonly OnlineDeckSubmissionEntryV2[]) => Promise<Readonly<{ readonly definitions: ReadonlyMap<string, CardDef>; readonly identityMismatches: ReadonlySet<string> }>>;
}
