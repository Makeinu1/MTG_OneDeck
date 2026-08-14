# O4P-05A judge-owned acceptance brief

Milestone: `O4P-05A`

Base SHA: `17965786dba01a15770e19437b9456ca81c0f18b`

Authority:
`research/cr-grounding/o4p-05a-public-release-ruleset.contract.draft.md`

The Judge owns this brief and every `review.*` assertion. The implementer must
not edit them.

## Required executable scenarios

1. Assert the public descriptor has the exact V1 kind, schema, and
   `repository-local-pin` source and references the exact
   `CURRENT_CONTRACT_VERSIONS` object.
2. Assert the descriptor and nested version/ruleset values are deeply frozen.
3. Hash the repository-local CR body as raw bytes and require the exact
   `e99cd70...386f79b` SHA-256. Require metadata object, ID, effective date,
   path, format, source provenance, and SHA to match the frozen local pin.
4. Require the current contract schema and engine/state/event/protocol/
   projection versions to remain exactly `1`; no version bump or copied
   release vector is accepted.
5. Require `verify:cr` and `verify:versions` to remain ordered before the test
   and build steps in the release machine gate. Run both commands directly.
6. Reject a public release module with network/latest lookup, environment
   override, mutable builder, fallback, unversioned alias, or imports outside
   the versioning boundary.
7. Run focused tests only before freeze. After an independent STANDARD R3
   audit has BLOCKER/HIGH zero, run one `npm run check` on the same release
   fingerprint.

## Judge-owned evidence path

- `src/versioning/review.o4p-05a-public-release-ruleset.test.ts`

This file and the contract/audit evidence are outside implementer write scope.
