import type { ModeNeutralCoreObjectRegistrySliceV2, ModeNeutralCoreObjectRuntimeSliceV2 } from '../../object/objectRegistryStateV2';
import type { ModeNeutralCoreStackAnnouncementSliceV1 } from '../stackAnnouncementSliceV1';
import { CoreStackTransactionErrorV1 } from './stackTransactionErrorV1';
import { validateCoreStackTransactionBundleV1 } from './stackTransactionValidationV1';

export type CoreStackTransactionBundleV1 = Readonly<{
  readonly objectRegistry: ModeNeutralCoreObjectRegistrySliceV2;
  readonly objectRuntime: ModeNeutralCoreObjectRuntimeSliceV2;
  readonly stackAnnouncements: ModeNeutralCoreStackAnnouncementSliceV1;
}>;

export type CreateCoreStackTransactionBundleV1Input = Readonly<{
  readonly objectRegistry: ModeNeutralCoreObjectRegistrySliceV2;
  readonly objectRuntime: ModeNeutralCoreObjectRuntimeSliceV2;
  readonly stackAnnouncements: ModeNeutralCoreStackAnnouncementSliceV1;
}>;

export { validateCoreStackTransactionBundleV1 } from './stackTransactionValidationV1';
export type {
  CoreStackTransactionValidationCodeV1,
  CoreStackTransactionValidationIssueV1,
  CoreStackTransactionValidationNestedIssueV1,
  CoreStackTransactionValidationResultV1,
} from './stackTransactionValidationV1';
export { CoreStackTransactionErrorV1 } from './stackTransactionErrorV1';
export type { CoreStackTransactionErrorCodeV1 } from './stackTransactionErrorV1';

export function createCoreStackTransactionBundleV1(
  input: CreateCoreStackTransactionBundleV1Input,
): CoreStackTransactionBundleV1 {
  const result = validateCoreStackTransactionBundleV1(input);
  if (!result.ok) {
    throw new CoreStackTransactionErrorV1('INVALID_TRANSACTION_BUNDLE', result.issues);
  }
  return result.value;
}
