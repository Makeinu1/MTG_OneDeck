import type { CoreStackChoiceKeyV1, CoreStackCostChoiceSetV1, CoreStackVariableAnnouncementV1 } from './choiceAnnouncementV1';
import type { CoreStackTargetSelectionV1 } from './targetAnnouncementV1';

export type {
  CoreStackAlternativeCostChoiceV1,
  CoreStackAdditionalCostChoiceV1,
  CoreStackChoiceKeyV1,
  CoreStackCostChoiceSetV1,
  CoreStackVariableAnnouncementV1,
} from './choiceAnnouncementV1';
export type { CoreStackTargetRefV1 } from './announcementPrimitivesV1';
export type { CoreStackTargetSelectionV1 } from './targetAnnouncementV1';

export type CoreStackDistributionAssignmentV1 = Readonly<{
  targetSelectionId: CoreStackChoiceKeyV1;
  amount: number;
}>;

export type CoreStackDistributionAnnouncementV1 = Readonly<{
  distributionKey: CoreStackChoiceKeyV1;
  assignments: readonly CoreStackDistributionAssignmentV1[];
}>;

type CoreStackAnnouncementRecordFields = Readonly<{
  abilityTextSnapshot: string | null;
  chosenModeKeys: readonly CoreStackChoiceKeyV1[];
  targetSelections: readonly CoreStackTargetSelectionV1[];
  announcedVariables: readonly CoreStackVariableAnnouncementV1[];
  distributions: readonly CoreStackDistributionAnnouncementV1[];
  costChoices: CoreStackCostChoiceSetV1;
}>;

export type CoreStackAnnouncementRecordV1 =
  | (Readonly<{ kind: 'card-spell' }> & Readonly<{ abilityTextSnapshot: null }> & Omit<CoreStackAnnouncementRecordFields, 'abilityTextSnapshot'>)
  | (Readonly<{ kind: 'spell-copy' }> & Readonly<{ abilityTextSnapshot: null }> & Omit<CoreStackAnnouncementRecordFields, 'abilityTextSnapshot'>)
  | (Readonly<{ kind: 'activated-ability' }> & Readonly<{ abilityTextSnapshot: string }> & Omit<CoreStackAnnouncementRecordFields, 'abilityTextSnapshot'>)
  | (Readonly<{ kind: 'triggered-ability' }> & Readonly<{ abilityTextSnapshot: string }> & Omit<CoreStackAnnouncementRecordFields, 'abilityTextSnapshot'>);
