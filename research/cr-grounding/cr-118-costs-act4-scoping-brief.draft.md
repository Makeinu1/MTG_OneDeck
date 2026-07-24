# CR118 ACT-4 contract-scoping brief

## Role and output

Act as the context-free implementer/drafter. Investigate and write only:

- `research/cr-grounding/cr-118-costs-act4.contract.draft.md`

Do not edit `src/`, `docs/`, `review.*`, the ledger, `AGENTS.md`, `.claude/`, or
git state. Do not implement the feature.

## Target

Normal-Commander activation-cost vocabulary, ledger domain
`cr-118-costs-act4`:

1. tap other permanents chosen by the payer;
2. remove counters as a cost;
3. choose and bind the value of `{X}`.

The result must preserve full-payment atomicity, deterministic command ordering,
cancel with no partial payment, undo/redo, and honest guided/manual fallback.

## Grounding

Use the pinned local CR file and cite at minimum:

- CR 107.3 / 107.3a / 107.3k
- CR 118.3 / 118.4
- CR 601.2f–h
- CR 602.2b

Add narrower CR references required by the actual cost shapes. Treat the pinned
CR as authoritative.

Inspect the current implementation before drafting. In particular:

- `docs/engine-spec.md` §33 and §34.19
- `docs/acceptance.md` G4
- `src/engine/grammar/compile.ts`
- activation planning/payment and resolution-session paths
- `src/engine/__tests__/act4CostVocabulary.test.ts`
- existing `review.grammar-cost`, `review.g4-activate`, and activation-envelope
  evidence
- archived CR118/CR602 drafts

Do not assume ACT-4 is absent merely because the ledger says pending. Identify
any code/tests that already implement part of the claimed slice, and distinguish:

- executable final-state behavior;
- compiler/planner-only behavior;
- unconnected or unreachable behavior;
- missing reviewer-owned evidence.

## Real-card evidence

Use the local Scryfall/MyDeck corpus only. Give representative exact English
Oracle cost lines and counts where a repository script/data source can establish
them. At minimum investigate:

- tap-N / tap-other controlled permanent costs;
- remove-one-or-more counter costs, including wrong counter type/source guards;
- `{X}` and repeated `{X}{X}` activation costs;
- variable nonmana `Pay X` forms that must remain manual if not in this slice.

Do not let MyDeck demand change CR order; use it only to choose acceptance
fixtures and same-domain priorities.

## Required draft sections

1. Current-state inventory with file/function/test references and any
   implemented-but-not-audited behavior.
2. Exact public type/API delta proposal. Prefer existing primitives and the
   shared `EffectPrompt → PendingGuidedResolution / ResolutionSession` boundary.
   Add no `GameCommand` or `GameState` field unless existing primitives cannot
   express the final transition.
3. Frozen behavior for each cost form:
   parsing, legal choices, amount/value constraints, command/payment order,
   failure/cancel behavior, stack insertion, and X binding lifetime.
4. Transaction/undo model proving partial payments cannot escape.
5. Honest boundary table: auto / guided / manual, including composite costs and
   unsupported variable forms.
6. Proposed reviewer-owned red tests and executable golden replays:
   normal, boundary, wrong controller/object/counter type, insufficient
   resources, cancellation, determinism, undo/redo, and relevant old-snapshot
   behavior.
7. UI reachability proposal using the common resolution workspace, including
   keyboard/explicit-button alternatives to pointer-only selection. State
   whether mobile viewport checks are actually triggered by the proposal.
8. Minimal implementation file list, ordinary tests, risks, and open CR
   ambiguities. If the CR gives a unique answer, resolve it by citation rather
   than presenting it as an open choice.

Do not decide that a partially implemented behavior is shipped. The parent judge
will freeze the contract and author `review.*` before implementation.
