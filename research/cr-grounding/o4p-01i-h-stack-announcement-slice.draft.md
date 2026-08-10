# O4P-01I-H Stack Announcement Slice V1

Status: `implemented-not-integrated`

## Changed H files

- `src/engine/core/stack/stackAnnouncementRecordV1.ts`
- `src/engine/core/stack/stackAnnouncementSliceV1.ts`
- `src/engine/core/stack/stackAnnouncementValidationV1.ts`
- `src/engine/core/stack/stackAnnouncementCanonicalizationV1.ts`
- `src/engine/core/stack/__tests__/stackAnnouncementRecordV1.test.ts`
- `src/engine/core/stack/__tests__/stackAnnouncementSliceV1.test.ts`
- `src/engine/core/stack/__tests__/stackAnnouncementValidationV1.test.ts`
- `src/engine/core/stack/__tests__/stackAnnouncementPropertyV1.test.ts`

No other files were changed. No git operation was performed.

## Contract coverage

The slice covers the frozen O4P-01I contract for:

- the four exact announcement record kinds and ability-text snapshot rules;
- mode-neutral root shape, committed-only fields, Registry V2 validation, stack key-set parity, kind parity, and bottom-to-top insertion order;
- historical target references without current-existence or legality checks;
- repeated mode/order preservation, sorted unique variables/distributions/additional costs, positive distribution amounts, and target-reference parity;
- strict descriptor, symbol, sparse-array, ordinary-array, accessor, proxy-failure, and unknown-field rejection;
- RFC 6901 paths, exact validation-code mapping, deterministic issue ordering, fresh canonical values, null-prototype records, deep freeze, and input nonmutation;
- factory/validator shared canonicalization with no sorting, deduplication, trimming, defaulting, coercion, or mutation.

## Verification

- Targeted suite: 10 files, 26 tests passed.
- ESLint for the changed H implementation and test files: passed.
- `git diff --check`: passed.

Known full-build blocker: `npm run build` remains blocked by the unintegrated `review.o4p-01i-stack-announcement.test.ts` imports from the Core index. Index integration is outside this H slice allowlist.

## Explicit DEFER

Deferred: Core index/public export integration, review-owned acceptance tests, independent cold audit, full machine check after integration, command/event/payment lifecycle, atomic stack commit/removal/retarget, resolution and legality, copy execution, DecisionAuthority, Online runtime, persistence, protocol, visibility, and UI.
