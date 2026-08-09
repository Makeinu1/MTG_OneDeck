# O4P-01F-E cold-audit brief

- Milestone: `O4P-01F-E`
- Parent: `O4P-01F`
- Role: independent Tier-1 cold auditor, findings only
- Timing profile: `STANDARD` (hard wait: 30 minutes)
- Base SHA: `81e53b99f7744c2281abddb9ccaced635996066f`
- Candidate fingerprint: `12e48ddb75976ac8ac43f1a470bcf933b2b5fcb41172160f9e9483b98b9e0d36`
- Verdict target: `AUDIT-OK-PENDING-FULL-CHECK`

Read `.claude/audit-standing.md` first. Do not edit, stage, commit, push, or
run the release full `npm run check`. Audit the frozen candidate below without
using the implementer's reasoning:

- O4P-01F-D composite runtime contract and implementation;
- E committed fixture and `verify:mode-neutral-core-card-runtime`;
- exact nine-step machine-check order and fail-fast behavior;
- Core boundary allowlist for the new verifier;
- fast-check property independence and vacuity;
- input non-mutation, deep freeze, canonical ObjectId order, and all listed
  cross-state restrictions;
- `npm run check:forbidden` and targeted Core/runtime, machine-order, and
  architecture-boundary tests;
- test diff weakening, scope leakage, version/state-shape changes, and
  missing fixture coverage.

The auditor must recompute the fingerprint from the exact candidate paths,
return findings only, classify each finding, and report BLOCKER/HIGH/MEDIUM/LOW
counts. Do not infer a clean verdict from existing full-check output. Do not
duplicate the full check.

## Frozen candidate paths

```text
package.json
tsconfig.node.json
scripts/checks/machine-checks.mjs
scripts/__tests__/machine-checks.test.mjs
scripts/checks/verify-mode-neutral-core-card-runtime.ts
src/test/architecture/modeNeutralCoreBoundary.test.ts
src/engine/core/index.ts
src/engine/core/fixtures/card-runtime-slice-v1.json
src/engine/core/runtime/cardRuntimeState.ts
src/engine/core/runtime/cardRuntimeValidation.ts
src/engine/core/runtime/index.ts
src/engine/core/runtime/__tests__/cardRuntime.test.ts
src/engine/core/runtime/__tests__/cardRuntimeProperty.test.ts
research/cr-grounding/o4p-01f-d-card-runtime-integration.draft.md
research/cr-grounding/o4p-01f-e-verification-fixture-audit-closure.draft.md
```
