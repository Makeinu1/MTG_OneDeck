import type {
  CoreCardDefinitionId,
  CorePlayerId,
  CorePhysicalCardId,
} from './ids';

export type CoreManaColorV1 = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
export type CoreColorIdentityV1 = Exclude<CoreManaColorV1, 'C'>;

export type CoreTokenKindV1 =
  | 'treasure'
  | 'clue'
  | 'food'
  | 'blood'
  | 'cursed-role'
  | 'monster-role'
  | 'royal-role'
  | 'sorcerer-role'
  | 'virtuous-role'
  | 'wicked-role'
  | 'young-hero-role';

export type CoreCardDefinitionSourceV1 =
  | Readonly<{
      kind: 'scryfall';
      scryfallId: string;
      oracleId: string;
    }>
  | Readonly<{
      kind: 'engine-synthetic';
    }>;

export interface CoreCardFaceSnapshotV1 {
  readonly name: string;
  readonly manaCost: string | null;
  readonly typeLine: string;
  readonly oracleText: string;
  readonly power: string | null;
  readonly toughness: string | null;
  readonly loyalty: string | null;
  readonly defense: string | null;
}

export interface CoreCardDefinitionSnapshotV1 {
  readonly source: CoreCardDefinitionSourceV1;
  readonly name: string;
  readonly layout: string;
  readonly manaValue: number;
  readonly colorIdentity: readonly CoreColorIdentityV1[];
  readonly typeLine: string;
  readonly keywords: readonly string[];
  readonly producedMana: readonly CoreManaColorV1[];
  readonly tokenKind: CoreTokenKindV1 | null;
  readonly faces: readonly CoreCardFaceSnapshotV1[];
}

export interface CorePhysicalCardV1 {
  readonly definitionId: CoreCardDefinitionId;
  readonly ownerPlayerId: CorePlayerId;
  readonly isCommander: boolean;
}

export type CoreCardDefinitionRecordV1 = Readonly<
  Record<CoreCardDefinitionId, CoreCardDefinitionSnapshotV1>
>;

export type CorePhysicalCardRecordV1 = Readonly<
  Record<CorePhysicalCardId, CorePhysicalCardV1>
>;
