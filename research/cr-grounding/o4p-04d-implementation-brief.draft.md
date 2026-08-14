# O4P-04D bounded implementer brief

Milestone: `O4P-04D`

Base SHA: `1f6a465b859ba64c9961c6fcdae80087e33b9882`

Authority:
`research/cr-grounding/o4p-04d-guided-manual-actions.contract.draft.md`

Acceptance:
`research/cr-grounding/o4p-04d-acceptance-brief.draft.md`

Role: implementer. Model: `gpt-5.6-luna`, reasoning `xhigh`.

## Goal

Implement the exact Guided/Manual Actions pure module, React surface, pairing
successor composition, ordinary tests, and deterministic dev fixture described
by the frozen contract.

## Write scope

- `src/online/guidedActions/**` excluding any `review.*` file;
- `src/components/online/OnlineGuidedActions.tsx`;
- `src/components/online/onlineGuidedActions.css`;
- ordinary `OnlineGuidedActions` tests;
- the minimum O4P-04D edit to `src/components/online/OnlineDisplayPairing.tsx`;
- the minimum deterministic edits under `src/dev/displayPairing/**` and
  `research/design/display-pairing/index.html`.

Do not edit the contract/acceptance/audit drafts, `review.*`, architecture
tests, docs, ledgers, loop-state, governance, dependencies, versions, Vite
config, App/root integration, Store/Solo/Core/protocol/projection semantics, or
git state.

## Required implementation behavior

1. Validate hostile projection/session/action inputs through the shipped public
   validators and exact descriptor-safe roots; never reflect diagnostics.
2. Return fresh deep-frozen views/actions/frames without source mutation,
   inferred hidden identity, sorting, trimming, deduplication, defaulting, or
   previous-state retention.
3. Bind only the four frozen command-attempt action families to existing Core
   payloads and protocol envelopes. Manual-only actions must fail binding.
   Implement the exact public runtime names frozen in the contract, including
   `createOnlineGuidedActionV1({ projection, action })` and
   `bindOnlineGuidedCommandActionV1({ session, action, commandId })`.
4. Render five truthful Japanese sections with native forms, guided
   confirmation, visible manual-only labels, disabled updating/offline state,
   stale-input reset, stable test IDs, and responsive ordinary scrolling.
5. Add focused ordinary tests. Run only the complete O4P-04D ordinary targeted
   suite plus scoped ESLint and `npx tsc -b` while iterating. Do not run the
   full release check.

## Report

Return changed files, targeted command/results, explicit DEFERs, and unresolved
issues. Do not claim audit or ship approval.
