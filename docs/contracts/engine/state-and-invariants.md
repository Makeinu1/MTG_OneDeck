# Engine state and invariants

<!-- clause: ENG-STATE-001 -->
`GameState` is an immutable snapshot of the solo game. Engine functions are pure and deterministic: the same state and command produce the same result. Randomness is selected before a command is created and is carried by that command.

<!-- clause: ENG-STATE-002 -->
The state owns cards, definitions, zones, turn and phase, mana, stack objects, pending choices, events, and derived records required by the existing engine. A state transition returns a fresh result and does not mutate its input. Structural sharing is allowed when an unchanged branch can be reused safely.

<!-- clause: ENG-STATE-003 -->
Every card instance has stable physical identity and a zone-change counter. Object identity is derived from both values. A state cannot contain the same physical card in two exclusive zones, and an unknown command is a deterministic failure.

<!-- clause: ENG-STATE-004 -->
Snapshots are the boundary for undo and redo. Restoring an older snapshot backfills fields introduced after that snapshot without changing existing card order or event order. The store owns history navigation; the engine does not.

<!-- clause: ENG-STATE-005 -->
The pinned Comprehensive Rules text is the authority for deterministic rules questions. A contract clause that lacks an executable replay remains guided or manual.
