import type { ModeNeutralCoreObjectRegistrySliceV2, ModeNeutralCoreObjectRuntimeSliceV2 } from '../../object/objectRegistryStateV2';
import { validateModeNeutralCoreObjectRegistrySliceV2, validateModeNeutralCoreObjectRuntimeSliceV2 } from '../../object/objectRegistryValidationV2';
import type { ModeNeutralCoreStackAnnouncementSliceV1 } from '../stackAnnouncementSliceV1';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../stackAnnouncementValidationV1';
import type { CoreStackTransactionBundleV1 } from './stackTransactionBundleV1';
import {
  deepFreezeStackTransactionV1,
  freezeStackTransactionResultV1,
  inspectionFailureIssueV1,
  inspectStackTransactionBundleInputV1,
  nestedTransactionIssuesV1,
  type StackTransactionBundlePartsV1,
} from './internalStackTransactionV1';

export type CoreStackTransactionValidationCodeV1 =
  | 'INVALID_TRANSACTION_BUNDLE'
  | 'INVALID_OPERATION_INPUT'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_NOT_ON_STACK'
  | 'SOURCE_ALREADY_ON_STACK'
  | 'OBJECT_ALREADY_EXISTS'
  | 'OBJECT_KIND_MISMATCH'
  | 'ANNOUNCEMENT_KIND_MISMATCH'
  | 'INVALID_DESTINATION'
  | 'ID_COLLISION'
  | 'CARD_TRANSITION_FAILED'
  | 'TARGET_SELECTION_NOT_FOUND'
  | 'DUPLICATE_TARGET_REPLACEMENT'
  | 'RETARGET_STRUCTURE_MISMATCH'
  | 'CANDIDATE_INVALID';

export type CoreStackTransactionValidationNestedIssueV1 = Readonly<{
  readonly code: string;
  readonly path: string;
  readonly message: string;
}>;

export type CoreStackTransactionValidationIssueV1 = Readonly<{
  readonly code: CoreStackTransactionValidationCodeV1;
  readonly path: string;
  readonly message: string;
  readonly nested?: readonly CoreStackTransactionValidationNestedIssueV1[];
}>;

export type CoreStackTransactionValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: CoreStackTransactionBundleV1 }>
  | Readonly<{
      readonly ok: false;
      readonly issues: readonly CoreStackTransactionValidationIssueV1[];
    }>;

function transactionIssue(
  path: string,
  message: string,
  nested: readonly { readonly code: string; readonly path: string; readonly message: string }[],
): CoreStackTransactionValidationIssueV1 {
  return {
    code: 'INVALID_TRANSACTION_BUNDLE',
    path,
    message,
    nested: nestedTransactionIssuesV1(nested),
  };
}

function failure(
  issues: readonly CoreStackTransactionValidationIssueV1[],
): CoreStackTransactionValidationResultV1 {
  return freezeStackTransactionResultV1({
    ok: false,
    issues: issues.map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
      ...(issue.nested === undefined ? {} : { nested: issue.nested.map((nested) => ({ ...nested })) }),
    })),
  });
}

function validateRegistry(input: unknown):
  | Readonly<{ readonly ok: true; readonly value: ModeNeutralCoreObjectRegistrySliceV2 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly { readonly code: string; readonly path: string; readonly message: string }[] }> {
  try {
    const result = validateModeNeutralCoreObjectRegistrySliceV2(input);
    return result.ok
      ? result
      : { ok: false, issues: nestedTransactionIssuesV1(result.issues) };
  } catch {
    return { ok: false, issues: [inspectionFailureIssueV1()] };
  }
}

function validateRuntime(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  input: unknown,
):
  | Readonly<{ readonly ok: true; readonly value: ModeNeutralCoreObjectRuntimeSliceV2 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly { readonly code: string; readonly path: string; readonly message: string }[] }> {
  try {
    const result = validateModeNeutralCoreObjectRuntimeSliceV2(registry, input);
    return result.ok
      ? result
      : { ok: false, issues: nestedTransactionIssuesV1(result.issues) };
  } catch {
    return { ok: false, issues: [inspectionFailureIssueV1()] };
  }
}

function validateAnnouncements(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  input: unknown,
):
  | Readonly<{ readonly ok: true; readonly value: ModeNeutralCoreStackAnnouncementSliceV1 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly { readonly code: string; readonly path: string; readonly message: string }[] }> {
  try {
    const result = validateModeNeutralCoreStackAnnouncementSliceV1(registry, input);
    return result.ok
      ? result
      : { ok: false, issues: nestedTransactionIssuesV1(result.issues) };
  } catch {
    return { ok: false, issues: [inspectionFailureIssueV1()] };
  }
}

function validatedBundle(
  parts: StackTransactionBundlePartsV1,
): CoreStackTransactionValidationResultV1 {
  const registry = validateRegistry(parts.objectRegistry);
  if (!registry.ok) {
    return failure([transactionIssue('/objectRegistry', 'Object Registry V2 is invalid', registry.issues)]);
  }

  const runtime = validateRuntime(registry.value, parts.objectRuntime);
  const announcements = validateAnnouncements(registry.value, parts.stackAnnouncements);
  const issues: CoreStackTransactionValidationIssueV1[] = [];
  if (!runtime.ok) {
    issues.push(transactionIssue('/objectRuntime', 'Object Runtime V2 is invalid', runtime.issues));
  }
  if (!announcements.ok) {
    issues.push(transactionIssue('/stackAnnouncements', 'Stack Announcement V1 is invalid', announcements.issues));
  }
  if (!runtime.ok || !announcements.ok) return failure(issues);

  return freezeStackTransactionResultV1({
    ok: true,
    value: deepFreezeStackTransactionV1({
      objectRegistry: registry.value,
      objectRuntime: runtime.value,
      stackAnnouncements: announcements.value,
    }),
  });
}

export function validateCoreStackTransactionBundleV1(
  input: unknown,
): CoreStackTransactionValidationResultV1 {
  const inspected = inspectStackTransactionBundleInputV1(input);
  if (!inspected.ok) {
    return failure([transactionIssue('', 'Transaction bundle input is invalid', inspected.issues)]);
  }
  return validatedBundle(inspected.value);
}
