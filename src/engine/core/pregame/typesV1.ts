import type { CoreObjectId, CorePhysicalCardId, CorePlayerId } from '../ids';
import type { ModeNeutralCoreRootV1 } from '../closure/rootV1';

export type CorePregameOperationIssueV1 = Readonly<{
  readonly code: string;
  readonly path: string;
  readonly message: string;
}>;

export type CorePregameOperationResultV1 = Readonly<{
  readonly ok: true;
  readonly value: ModeNeutralCoreRootV1;
}> | Readonly<{
  readonly ok: false;
  readonly issues: readonly CorePregameOperationIssueV1[];
}>;

export type CorePregamePlayerPhysicalOrderV1 = Readonly<{
  readonly playerId: CorePlayerId;
  readonly order: readonly CorePhysicalCardId[];
}>;

export type CorePregameMulliganInputV1 = Readonly<{
  readonly playerId: CorePlayerId;
  readonly order: readonly CorePhysicalCardId[];
}>;

export type CorePregameBottomBatchEntryV1 = Readonly<{
  readonly playerId: CorePlayerId;
  readonly objectIds: readonly CoreObjectId[];
}>;

export type CorePregameBottomBatchV1 = readonly CorePregameBottomBatchEntryV1[];

export type CorePregameSetupResultV1 = Readonly<{
  readonly root: ModeNeutralCoreRootV1;
  readonly changedObjectIds: readonly CoreObjectId[];
}>;
