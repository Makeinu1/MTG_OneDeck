import type { CoreCommanderCastLedgerV1 } from '../commander/commanderTaxV1';
import type { CoreCommanderDamageProvenanceLedgerV1 } from '../commander/commanderDamageProvenanceV1';
import type { CoreCommanderDamageStateV1 } from '../commander/commanderDamageV1';
import type { CoreCommanderIdentityV1 } from '../commander/commanderIdentityV1';
import type { CoreCombatContextV1 } from '../combat/combatContextV1';
import type { CorePlayerLifecycleStateV1 } from '../player-lifecycle/playerLifecycleV1';
import type { CoreRuleAuthorityBundleV1 } from '../rules/ruleAuthorityBundleV1';
import type { CoreClosureVersionVectorV1 } from './versionsV1';

export type ModeNeutralCoreRootV1 = Readonly<{
  readonly kind: 'mode-neutral-core-root-v1';
  readonly versions: CoreClosureVersionVectorV1;
  readonly acceptedCommandCount: number;
  readonly ruleAuthority: CoreRuleAuthorityBundleV1;
  readonly playerLifecycle: CorePlayerLifecycleStateV1;
  readonly commanders: readonly CoreCommanderIdentityV1[];
  readonly commanderCastLedgers: readonly CoreCommanderCastLedgerV1[];
  readonly commanderDamage: CoreCommanderDamageStateV1;
  readonly commanderDamageProvenance: CoreCommanderDamageProvenanceLedgerV1;
  readonly combatContext: CoreCombatContextV1 | null;
}>;

export { createModeNeutralCoreRootV1, CoreRootCreationErrorV1, validateModeNeutralCoreRootV1 } from './rootValidationV1';
export type { CoreRootValidationIssueV1, CoreRootValidationResultV1 } from './rootValidationV1';
