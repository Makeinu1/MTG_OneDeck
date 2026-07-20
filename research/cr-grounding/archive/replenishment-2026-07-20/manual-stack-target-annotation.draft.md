# Manual stack target annotation contract draft

Status: judge review required. This draft does not edit `docs/`, the ledger, or reviewer-owned tests.

## Purpose

When the grammar cannot model a card, the user may annotate a stack item with any other stack spell or battlefield permanent. This is a sandbox visibility feature, not a claim that the selection is CR-legal and not an instruction to execute the card effect automatically.

## Deterministic boundary

- Command: `setManualTargets { stackItemId, targetIds }`.
- Source must currently be on the stack.
- Candidates are other non-ability stack objects and non-ability battlefield objects.
- Store annotations as `manual-target-N`, `raw: 手動で指定した対象`, `legalityMode: unchecked-warning`.
- Preserve parser-created target selections; replace or clear only the `manual-target-` namespace.
- Existing Stack Workspace projection displays the labels and arrows.
- Guided compilation and stored-target execution must never consume `manual-target-*` as rules targets.
- One command means one undo/redo step; no cache schema change is required.

## CR relationship

CR 115.1a and 601.2c remain the authority for real spell targets. The annotation is explicitly unchecked because the app cannot prove target count, restrictions, or timing for an unsupported oracle text. CR 608.2b legality handling is therefore not inferred from this annotation.

## Judge-owned acceptance requested

- Pin that manual annotations cannot suppress guided prompts or execute effects.
- Pin preservation of checked targets, replace/clear semantics, determinism, undo/redo, and stack-to-stack arrows.
- Decide whether zone changes should clear all `targetSelections` or only the manual namespace; stale annotations after resolve/recast are currently a known risk.

