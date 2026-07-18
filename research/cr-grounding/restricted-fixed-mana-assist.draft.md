# Restricted fixed-mana assistance contract draft

Status: judge review required. This draft does not edit `docs/`, the ledger, or reviewer-owned tests.

## User-visible friction

- Clicking 《奇怪な宝石》 currently only warns that the mana ability must be handled manually, although its deterministic portion is `{T}: Add {C}{C}`.
- The same friction applies to MyDeck cards such as 《前兆の行商人》 whose deterministic portion is `{T}: Add {C}{U}`.

## Proposed deterministic boundary

- Add an `assisted` mana-ability decision for an activated mana ability whose cost and produced literal mana are deterministic but whose produced mana has a spending restriction.
- Until the judge re-owns the reviewer contract, gameplay activation explicitly opts into the assistance capability; an unflagged low-level store activation retains the prior manual behavior.
- Execute the payable deterministic cost and literal mana production atomically, without creating a stack object.
- Keep the aggregate mana pool unchanged: do not add mana provenance, restriction enforcement, or a snapshot schema field.
- Immediately emit a Japanese warning that states the Oracle restriction must be observed manually.
- If the cost cannot be paid, apply neither the cost nor the mana. Existing force semantics remain the only sandbox override.
- The cost, produced mana, semantic events, and warning are one store transaction and one canonical undo step.
- Choice-based, conditional, targeted, or otherwise non-deterministic restricted mana remains guided/manual as appropriate; this draft does not authorize guessing a mana choice.

## CR grounding

- CR 106.6 says a spending restriction does not change the mana’s type; therefore the literal symbols can be added without reinterpreting their types.
- CR 118.3 requires the full cost to be payable and rules out partial payment.
- CR 405.6c and 605.3b require mana abilities to resolve immediately without using the stack.
- CR 602.2 requires activation costs to be paid as part of activation and rolls back an illegal activation.
- CR 605.1a supplies the activated-mana-ability classification boundary: no target, could add mana, and not a loyalty ability.

## Judge-owned acceptance requested

- Re-own the current reviewer pin that leaves all restricted mana manual, replacing it with fixed-literal assistance plus an explicit manual-restriction warning.
- Pin 《奇怪な宝石》 as `{C}{C}` and 《前兆の行商人》 as `{C}{U}`, stack size unchanged, atomic failure, and one-step undo.
- Pin that the implementation does not claim to enforce or preserve spending restrictions in the mana pool.
