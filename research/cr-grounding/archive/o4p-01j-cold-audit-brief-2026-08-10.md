# O4P-01J Cold Audit Brief

## Candidate identity

- Milestone: `O4P-01J`
- Scope: Atomic Stack Commit, Retarget & Removal Transaction V1
- Required ancestor: `444f538221139dc31aeb8fcfa93f879a0fe3fd67`
- Plan SHA: `3476e170124158da849dadb5a3031dfda4a28a3c`
- Final contract SHA: `4c9ae2590875c273199f0fb5922efe5b9327b190`
- Candidate SHA: `535ae6f67837b770a91dee6b676c5bd9fec1c564`
- Candidate tree fingerprint: `29e377b31edb7b2b81a91dee288f818d1e1ac3c80464bdf4551702fb1f941001`
- The fingerprint excludes this brief and the future findings record; the auditor must independently recompute and match both candidate SHA and fingerprint before inspecting the candidate.

## Auditor independence

This is a findings-only cold audit. The auditor receives this path, the final
candidate SHA, and the final candidate fingerprint. Do not request or receive
implementation reasoning, repair history, parent conversation, lane reports,
or expected conclusions. Do not edit files, run git mutation commands, or
change ledger/review/docs/source artifacts.

## Frozen source of truth

- Fixed CR text: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`
- Frozen contract: `research/cr-grounding/o4p-01j-atomic-stack-transaction.contract.draft.md`
- Grounding drafts: `research/cr-grounding/o4p-01j-r-stack-transaction-cr-matrix.draft.md`, `o4p-01j-a-v2-card-transition-reuse.draft.md`, `o4p-01j-b-synthetic-stack-lifecycle.draft.md`, `o4p-01j-c-retarget-contract.draft.md`, `o4p-01j-d-atomicity-failure-result.draft.md`
- Acceptance review: `src/engine/core/stack/transaction/__tests__/review.o4p-01j-stack-transaction.test.ts`
- Architecture review: `src/test/architecture/review.o4p-01j-stack-transaction-boundary.test.ts`
- Committed fixture: `src/engine/core/stack/transaction/fixtures/stack-transaction-v1.json`
- Verification entrypoint: `npm run verify:mode-neutral-core-stack-transaction`

## Fingerprint procedure

The candidate fingerprint is computed with the repository's
`computeTreeFingerprint` helper over the 46 paths changed from PLAN_SHA to the
candidate SHA, excluding this brief and the future findings record. Recompute
from the repository root with:

```sh
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const base='3476e170124158da849dadb5a3031dfda4a28a3c'; const head='535ae6f67837b770a91dee6b676c5bd9fec1c564'; const paths=execFileSync('git',['diff','--name-only',base,head],{encoding:'utf8'}).trim().split('\\n').filter(Boolean).filter((p)=>!['research/cr-grounding/archive/o4p-01j-cold-audit-brief-2026-08-10.md','research/cr-grounding/archive/o4p-01j-cold-audit-2026-08-10.md'].includes(p)); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

## Audit questions

1. Verify that Bundle validation is strict and ordered as Registry V2, Runtime V2 against Registry, and Announcement V1 against Registry, with no validator-logic duplication, exact key-set checks, input nonmutation, frozen issues, and deep-frozen successful values.
2. Verify all-or-nothing candidate publication for card commit, synthetic commit, retarget, card removal, and synthetic cease. No partial Registry, Runtime, or Announcement result may escape.
3. Verify card ObjectId/incarnation replacement, physical-card exactly-one preservation, owner/controller handling, source-zone removal, destination insertion, stack-tail append/removal, Runtime reset, stale old-object attachment detachment only where required for a valid candidate, and exact Announcement parity.
4. Verify spell-copy, activated-ability, and triggered-ability kind/ID/announcement matching, controller and definition requirements, historical source-reference treatment, no PhysicalCard creation, no Runtime row, and cease semantics.
5. Verify retarget changes only requested target references while preserving selectionId, groupKey, target array order, unspecified targets, modes, variables/X, cost choices, distributions, text, record kind, ObjectId, Runtime, and stack order. Verify no current-target existence or legality check is implemented.
6. Verify middle-stack removal preserves the relative order of all remaining entries and deletes exactly the matching Announcement.
7. Verify operation errors use only the frozen error-code union, nested issues remain deterministic and frozen, hostile Proxy/accessor/non-enumerable/symbol/sparse inputs fail closed, and no unknown field is ignored or defaulted.
8. Verify deterministic canonicalization and deep freeze without sorting semantic stack order, trimming, deduplicating, `localeCompare`, `Math.random`, `Date.now`, crypto randomness, network, callbacks, event metadata, command metadata, legality, priority, APNAP, resolution, or UI/runtime imports.
9. Verify property tests are non-vacuous and review tests independently exercise all mandatory pins.
10. Verify O4P-01G/H/I production/contracts/fixtures, Solo source, Online source, version values, package-lock, dependencies, docs, ledger, and existing review tests are unchanged except for the explicitly integrated O4P-01J additions.
11. Verify the Compiler API architecture boundary and machine-check order. A public barrel re-export is required and is not a reverse dependency violation.

## Required report

Return findings only, grouped by severity `BLOCKER`, `HIGH`, `MEDIUM`, and
`LOW`, with file/line evidence and a concise remediation condition. State the
recomputed candidate SHA and fingerprint. End with exactly one verdict:
`AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero, or
`AUDIT-FAIL` otherwise. Do not run the full `npm run check`; the orchestrator
will run it only after a matching successful audit.
