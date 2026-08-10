# Oracle compiler boundary

<!-- clause: ENG-COMP-001 -->
English `oracleText` is the rules input. `printedText` is display data and is not used to decide whether a clause can be compiled. Each recognized clause maps to a deterministic plan with a CR reference and a declared decision tier.

<!-- clause: ENG-COMP-002 -->
`auto` is allowed only when an executable replay proves the final `GameState` and event result. `guided` is used when a user choice can be collected and then compiled into existing commands. `manual` is the honest result for unsupported or ambiguous compound behavior.

<!-- clause: ENG-COMP-003 -->
The compiler never mutates state, never invents a target, and never treats a warning as a successful rules resolution. Clause boundaries are preserved so a supported leaf can be executed without claiming that an unsupported sibling was resolved.

<!-- clause: ENG-COMP-004 -->
The pinned CR file and local Oracle fixtures are the evidence sources. Live Scryfall access belongs to the online/periodic lane and is not an ordinary acceptance prerequisite.
