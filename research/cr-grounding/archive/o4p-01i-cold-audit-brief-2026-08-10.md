# O4P-01I cold-audit brief

- Milestone: O4P-01I Stack Announcement Payload & Lifecycle V1
- Required ancestor: `05963480e87788a6362b3e188ce1c558c53a003d`
- Initial BASE_SHA: `aad8b24b9a0fcfe0a8dad51dc28095d1a0348966`
- PLAN_SHA: `5418d82`
- CONTRACT_SHA: `3b1fd76`
- FOUNDATION_SHA: `4ed8287`
- PAYLOAD_SHA: `ae94453`
- SLICE_SHA: `e1762fe`
- TEST_ASSET_SHA: `c8a17d0`
- Initial candidate SHA: `e1cd3de`
- Initial candidate fingerprint: `346f44fb789ffadacffaef95cc0938d0d878df09659fe4e32c955e37bbe874fa`
- Repair candidate SHA: `328128a5b1a7833a7dc52efe55201e694ce8485e`
- Repair candidate fingerprint: `49ee8ec0a00064335830acfc2ed298abc681ebd5c7c4bfa892de73cf0a2d6d04`
- Final re-audit candidate SHA: `1c33bdbc96ac5df55d23071710fd290468f8634f`
- Final re-audit candidate fingerprint: `3fab6aa5f33981073c88f1d176fb23fa460aded70549e6d858b002c30f714627`
- Proxy-hardening candidate SHA: `c1a9641c3b11d575ad2d0f693fa3e06bd890074d`
- Proxy-hardening candidate fingerprint: `73c27b37404f641749486863ee95dd2d46897860a326f92ff37df4b1a6c2ba01`
- Type-corrected candidate SHA: `0c7e58ad174a36332c68ac357dc6b55045676ac7`
- Type-corrected candidate fingerprint: `b37b0e8f330be331a727193c820701c1cb38fda5f125126ace69dd8c1d6d8ae1`

## Fingerprint procedure

The candidate fingerprint is computed with the repository's
`computeTreeFingerprint` helper over the sorted 45 paths listed below, which
are exactly `git diff --name-only aad8b24b9a0fcfe0a8dad51dc28095d1a0348966 0c7e58ad174a36332c68ac357dc6b55045676ac7`.
This audit brief and the later findings record are excluded from the hash.
Recompute from the repository root with:

```sh
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const paths=execFileSync('git',['diff','--name-only','aad8b24b9a0fcfe0a8dad51dc28095d1a0348966','0c7e58ad174a36332c68ac357dc6b55045676ac7'],{encoding:'utf8'}).trim().split('\\n').filter(Boolean); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

## Initial audit and remediation

Independent cold auditor `019fe93e-0b66-71f0-b9fe-b6cfaf049e07` matched the
initial fingerprint and found two HIGH issues: the stack property test used an
invalid empty registry and was therefore vacuous, and nested hostile target
proxies could escape the target-reference validator. The judge repaired the
property test with the committed Object Registry V2 fixture. The Foundation
implementer repaired guarded prototype, own-key, and descriptor inspection and
added hostile-proxy tests. A focused pre-audit run also found that the F-lane
accepted-case property could generate same-group duplicate targets; the F
implementer made the generated group keys unique per row. The subsequent
re-audit found another unguarded hostile selection/array proxy path; the same F
implementer added guarded prototype, own-key, descriptor, length, and index
inspection with deterministic fail-closed issues and adversarial tests. The
proxy-hardening candidate is the SHA and fingerprint listed above. The judge
then narrowed the validated array length to `number` before the loop, closing a
strict build/type-check failure without changing runtime semantics. The
type-corrected candidate is the SHA and fingerprint listed above; a fresh cold
re-audit is required before any full check.

## Candidate paths

```text
package.json
research/cr-grounding/cr-backbone-ledger.json
research/cr-grounding/ledger-update.draft.json
research/cr-grounding/o4p-01i-a-solo-stack-payload-reuse.draft.md
research/cr-grounding/o4p-01i-b-target-distribution.draft.md
research/cr-grounding/o4p-01i-c-mode-variable-cost-copy.draft.md
research/cr-grounding/o4p-01i-d-committed-lifecycle.draft.md
research/cr-grounding/o4p-01i-e-announcement-primitives.draft.md
research/cr-grounding/o4p-01i-f-target-announcement.draft.md
research/cr-grounding/o4p-01i-g-choice-announcement.draft.md
research/cr-grounding/o4p-01i-h-stack-announcement-slice.draft.md
research/cr-grounding/o4p-01i-j-fixture-v1.draft.md
research/cr-grounding/o4p-01i-k-architecture-boundary.draft.md
research/cr-grounding/o4p-01i-orchestration-plan.draft.md
research/cr-grounding/o4p-01i-r-stack-announcement-cr-matrix.draft.md
research/cr-grounding/o4p-01i-stack-announcement.contract.draft.md
scripts/__tests__/machine-checks.test.mjs
scripts/checks/machine-checks.mjs
scripts/checks/tsconfig.json
scripts/checks/verify-mode-neutral-core-stack-announcement.ts
src/engine/core/index.ts
src/engine/core/stack/__tests__/announcementPrimitivesV1.test.ts
src/engine/core/stack/__tests__/announcementPrimitivesV1Property.test.ts
src/engine/core/stack/__tests__/choiceAnnouncementV1.test.ts
src/engine/core/stack/__tests__/choiceAnnouncementV1Property.test.ts
src/engine/core/stack/__tests__/review.o4p-01i-stack-announcement.test.ts
src/engine/core/stack/__tests__/stackAnnouncementFixtureV1.test.ts
src/engine/core/stack/__tests__/stackAnnouncementPropertyV1.test.ts
src/engine/core/stack/__tests__/stackAnnouncementRecordV1.test.ts
src/engine/core/stack/__tests__/stackAnnouncementRoundTripV1.test.ts
src/engine/core/stack/__tests__/stackAnnouncementSliceV1.test.ts
src/engine/core/stack/__tests__/stackAnnouncementValidationV1.test.ts
src/engine/core/stack/__tests__/targetAnnouncementV1.test.ts
src/engine/core/stack/__tests__/targetAnnouncementV1Property.test.ts
src/engine/core/stack/announcementPrimitivesV1.ts
src/engine/core/stack/choiceAnnouncementV1.ts
src/engine/core/stack/fixtures/stack-announcement-v1.json
src/engine/core/stack/index.ts
src/engine/core/stack/stackAnnouncementCanonicalizationV1.ts
src/engine/core/stack/stackAnnouncementRecordV1.ts
src/engine/core/stack/stackAnnouncementSliceV1.ts
src/engine/core/stack/stackAnnouncementValidationV1.ts
src/engine/core/stack/targetAnnouncementV1.ts
src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts
src/test/architecture/review.o4p-01i-stack-announcement-boundary.test.ts
```

## Audit instructions

The auditor is independent and findings-only. Do not edit files, run the full
`npm run check`, change git state, or infer approval from the implementer
reports. Verify the candidate fingerprint first, then inspect the fixed CR,
contract, all candidate paths, and the existing O4P-01H Object Registry V2
fixture/contracts.

Audit at minimum:

1. exact stack key parity and bottom-to-top order without duplicate stackOrder;
2. registry-kind matching for card spell, spell copy, activated ability, and
   triggered ability;
3. committed-only boundary with no proposal/payment/status state;
4. historical target references without current-existence or legality checks;
5. same-group duplicate rejection and cross-group duplicate allowance;
6. repeated modes, code-unit variable/cost/distribution ordering, and X=0;
7. distribution references and assignment ordering;
8. ability text snapshots and source-disappearance semantics;
9. strict unknown/accessor/non-enumerable/symbol/sparse-array handling,
   canonicalization, deep freeze, and input non-mutation;
10. property-test non-vacuity and independent review-test coverage;
11. V1/V2 public contract preservation, Solo preservation, no Online runtime,
    no version/dependency/package-lock changes, and machine-check ordering.

Return findings classified as BLOCKER, HIGH, MEDIUM, or LOW with file and line
evidence. If BLOCKER/HIGH are zero, return exactly the verdict
`AUDIT-OK-PENDING-FULL-CHECK` plus all severity counts. Do not create the audit
record; the judge will record the result after receiving the findings.
