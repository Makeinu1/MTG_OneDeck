# Stack object targeting expansion contract draft

Status: judge review required. This draft does not edit `docs/`, the ledger, or reviewer-owned tests.

## User-visible friction

- Counterspells must be able to select spells on the stack from the guided target UI.
- Unsupported/manual cards must still be able to annotate a spell, activated ability, or triggered ability on the stack as their intended target.
- Concrete MyDeck case: the activated ability of 《物真似の達人、悟悟》 targets an activated or triggered ability its controller controls. The app currently opens the manual target UI but rejects both an ability source and an ability target.

## Proposed deterministic boundary

- Extend stack target filters with an explicit object-kind set: spell, activated ability, and triggered ability. Absence keeps the existing spell-only default for compiled “target spell” clauses.
- `setManualTargets` accepts any current stack object as its source and accepts another current stack object, a battlefield permanent, or a player as an unchecked annotation.
- Until the judge re-owns the reviewer contract, the expanded domain is selected by the gameplay UI through an explicit `allowStackAbilities` command capability; an unflagged low-level command retains the prior spell-only contract.
- Reject self-targeting and targets that are no longer in an accepted zone before writing anything.
- Store annotations as `manual-target-N`, `raw: 手動で指定した対象`, and `legalityMode: unchecked-warning`.
- Preserve checked/parser-created selections and replace only the `manual-target-*` namespace. A true zone change clears all selections; copies preserve selections in a distinct array.
- Manual annotations never satisfy a guided prompt and never cause an effect to execute.
- Recognized unconditional counter clauses use checked stack-spell targets. Conditional “unless” and replacement forms remain manual. A safe unconditional counter leaf may execute while an unsupported remainder is surfaced as a manual warning; the remainder is never silently executed.
- One command remains one canonical undo/redo step. In-progress UI choices use transient interaction history outside `GameState`.

## CR grounding

- CR 115.2 permits a spell or ability to specify a spell or ability outside the battlefield as its target.
- CR 115.5 forbids a spell or ability on the stack from targeting itself.
- CR 405.1–405.4 defines spells, activated abilities, and triggered abilities as stack objects and specifies the characteristics/controller of ability objects.
- CR 701.6a–b defines countering as removal from the stack without resolving or refunding costs.
- CR 707.10 and 707.10c establish that copies of spells/abilities copy choices including targets and may receive new legal targets when instructed.

## Judge-owned acceptance requested

- Re-own the current reviewer pin that rejects ability sources/targets and replace it with pins for all three stack object kinds, self-rejection, zone-change clearing, copy preservation, and unchecked-only semantics.
- Pin that a “target spell” filter does not accidentally include abilities, while an ability-aware filter can include activated and/or triggered abilities explicitly.
- Pin that manual target annotations do not suppress guided prompts or execute unsupported rules text.
