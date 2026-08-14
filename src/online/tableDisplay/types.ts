export const TABLE_DISPLAY_SCHEMA_VERSION_V1 = 1 as const;

export type TableDisplayCounterV1 = Readonly<{
  readonly kind: string;
  readonly count: number;
}>;

export type TableDisplayManaV1 = Readonly<{
  readonly W: number;
  readonly U: number;
  readonly B: number;
  readonly R: number;
  readonly G: number;
  readonly C: number;
}>;

export type TableDisplayStackObjectV1 = Readonly<{
  readonly kind: 'stack-object';
  readonly objectId: string;
  readonly objectKind: 'spell-copy' | 'activated-ability' | 'triggered-ability';
  readonly label: '呪文のコピー' | '起動型能力' | '誘発型能力';
  readonly controllerPlayerId: string | null;
}>;

export type TableDisplayConcealedCardV1 = Readonly<{
  readonly kind: 'concealed-card';
  readonly objectId: string;
  readonly label: '《裏向きのカード》';
  readonly tapped: boolean;
  readonly phasedOut: boolean;
  readonly counters: readonly TableDisplayCounterV1[];
  readonly markedDamage: number;
}>;

export type TableDisplayVisibleCardV1 = Readonly<{
  readonly kind: 'visible-card';
  readonly objectId: string;
  readonly label: string;
  readonly typeLine: string;
  readonly ownerPlayerId: string | null;
  readonly controllerPlayerId: string | null;
  readonly commander: boolean;
  readonly tapped: boolean;
  readonly phasedOut: boolean;
  readonly counters: readonly TableDisplayCounterV1[];
  readonly markedDamage: number;
}>;

export type TableDisplayCardV1 =
  | TableDisplayStackObjectV1
  | TableDisplayConcealedCardV1
  | TableDisplayVisibleCardV1;

export type TableDisplayZoneV1 = Readonly<{
  readonly count: number;
  readonly cards: readonly TableDisplayCardV1[];
}>;

export type TableDisplayPlayerSummaryV1 = Readonly<{
  readonly playerId: string;
  readonly seatIndex: number;
  readonly isActive: boolean;
  readonly presence: 'connected' | 'disconnected';
  readonly outcome: 'pending' | 'conceded' | 'defeated';
  readonly life: number;
  readonly poison: number;
  readonly energy: number;
  readonly experience: number;
  readonly mana: TableDisplayManaV1;
  readonly status: 'active' | 'exited';
  readonly handCount: number;
  readonly libraryCount: number;
  readonly graveyardCount: number;
}>;

export type TableDisplayViewV1 = Readonly<{
  readonly kind: 'table-display-view-v1';
  readonly schemaVersion: typeof TABLE_DISPLAY_SCHEMA_VERSION_V1;
  readonly revision: number;
  readonly roomLifecycle: 'forming' | 'ready' | 'started' | 'active' | 'finished';
  readonly tablePresence: 'connected' | 'disconnected';
  readonly turn: Readonly<{
    readonly activePlayerId: string;
    readonly turnNumber: number;
    readonly phase: 'beginning' | 'precombat-main' | 'combat' | 'postcombat-main' | 'ending';
    readonly step: string | null;
  }>;
  readonly players: readonly TableDisplayPlayerSummaryV1[];
  readonly zones: Readonly<{
    readonly battlefield: TableDisplayZoneV1;
    readonly stack: TableDisplayZoneV1;
    readonly exile: TableDisplayZoneV1;
    readonly command: TableDisplayZoneV1;
  }>;
}>;
