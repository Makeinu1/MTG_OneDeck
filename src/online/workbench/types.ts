export const PERSONAL_WORKBENCH_SCHEMA_VERSION_V1 = 1 as const;

export type PersonalWorkbenchInteractionStateV1 = 'ready' | 'updating' | 'offline';

export type PersonalWorkbenchCounterV1 = Readonly<{
  readonly kind: string;
  readonly count: number;
}>;

export type PersonalWorkbenchHiddenCardV1 = Readonly<{
  readonly kind: 'hidden-card';
}>;

export type PersonalWorkbenchStackObjectV1 = Readonly<{
  readonly kind: 'stack-object';
  readonly objectId: string;
  readonly objectKind: 'spell-copy' | 'activated-ability' | 'triggered-ability';
  readonly label: '呪文のコピー' | '起動型能力' | '誘発型能力';
  readonly controllerPlayerId: string | null;
}>;

export type PersonalWorkbenchConcealedCardV1 = Readonly<{
  readonly kind: 'concealed-card';
  readonly objectId: string;
  readonly label: '《裏向きのカード》';
  readonly tapped: boolean;
  readonly phasedOut: boolean;
  readonly counters: readonly PersonalWorkbenchCounterV1[];
  readonly markedDamage: number;
}>;

export type PersonalWorkbenchVisibleCardV1 = Readonly<{
  readonly kind: 'visible-card';
  readonly objectId: string;
  readonly label: string;
  readonly typeLine: string;
  readonly manaCost: string | null;
  readonly oracleText: string;
  readonly ownerPlayerId: string | null;
  readonly controllerPlayerId: string | null;
  readonly commander: boolean;
  readonly tapped: boolean;
  readonly phasedOut: boolean;
  readonly counters: readonly PersonalWorkbenchCounterV1[];
  readonly markedDamage: number;
}>;

export type PersonalWorkbenchCardV1 =
  | PersonalWorkbenchHiddenCardV1
  | PersonalWorkbenchStackObjectV1
  | PersonalWorkbenchConcealedCardV1
  | PersonalWorkbenchVisibleCardV1;

export type PersonalWorkbenchZoneV1 = Readonly<{
  readonly count: number;
  readonly cards: readonly PersonalWorkbenchCardV1[];
}>;

export type PersonalWorkbenchManaV1 = Readonly<{
  readonly W: number;
  readonly U: number;
  readonly B: number;
  readonly R: number;
  readonly G: number;
  readonly C: number;
}>;

export type PersonalWorkbenchPlayerSummaryV1 = Readonly<{
  readonly playerId: string;
  readonly isSelf: boolean;
  readonly isActive: boolean;
  readonly life: number;
  readonly poison: number;
  readonly energy: number;
  readonly experience: number;
  readonly mana: PersonalWorkbenchManaV1;
  readonly status: string;
  readonly handCount: number;
  readonly libraryCount: number;
  readonly graveyardCount: number;
}>;

export type PersonalWorkbenchViewV1 = Readonly<{
  readonly kind: 'personal-workbench-view-v1';
  readonly schemaVersion: typeof PERSONAL_WORKBENCH_SCHEMA_VERSION_V1;
  readonly revision: number;
  readonly corePlayerId: string;
  readonly seatIndex: number;
  readonly roomLifecycle: string;
  readonly presence: string;
  readonly outcome: string;
  readonly turn: Readonly<{
    readonly activePlayerId: string;
    readonly turnNumber: number;
    readonly phase: string;
    readonly step: string | null;
  }>;
  readonly players: readonly PersonalWorkbenchPlayerSummaryV1[];
  readonly zones: Readonly<{
    readonly ownHand: PersonalWorkbenchZoneV1;
    readonly ownLibraryCount: number;
    readonly ownGraveyard: PersonalWorkbenchZoneV1;
    readonly battlefield: PersonalWorkbenchZoneV1;
    readonly stack: PersonalWorkbenchZoneV1;
    readonly exile: PersonalWorkbenchZoneV1;
    readonly command: PersonalWorkbenchZoneV1;
  }>;
  readonly authorityCounts: Readonly<{
    readonly visibilityGrants: number;
    readonly searchSessions: number;
    readonly playPermissions: number;
  }>;
}>;

export type PersonalWorkbenchActionV1 =
  | Readonly<{ readonly kind: 'request-refresh'; readonly knownRevision: number }>
  | Readonly<{ readonly kind: 'priority-pass'; readonly actorPlayerId: string; readonly baseRevision: number }>
  | Readonly<{ readonly kind: 'concede'; readonly actorPlayerId: string; readonly baseRevision: number }>;
