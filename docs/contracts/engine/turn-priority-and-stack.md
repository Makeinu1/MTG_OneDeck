# Turn, priority, and stack

The phase order is `untap`, `upkeep`, `draw`, `main1`, `combat`, `main2`, `end`, and `cleanup`. A phase or turn transition is a command transaction and is legal only when the stack boundary permits it.

The shared stack is ordered with the last announced item on top. Priority and pending trigger placement are deterministic. APNAP ordering is represented by the current player order and does not depend on UI iteration order.

Turn entry performs the existing untap, per-turn reset, draw-step, cleanup, and mana-pool operations for the applicable player. The opening flow has its own setup path; this contract introduces no additional setup ruling.

Unresolved choices remain visible as pending state. The user must resolve or cancel the choice before a transition that would violate the stack or priority boundary.
