# Commands and transactions

<!-- clause: ENG-CMD-001 -->
`GameCommand` is the only engine write vocabulary. Commands describe intent and carry every value needed for deterministic application. The compiler produces commands; it does not write `GameState` directly.

<!-- clause: ENG-CMD-002 -->
`applyCommand` validates preconditions before producing a result. A rejected command returns a stable error and leaves the input state unchanged. Warnings may accompany a forced sandbox action, but the resulting state remains explicit and deterministic.

<!-- clause: ENG-CMD-003 -->
Command batches are applied in order and return one transaction result. A store commit records the resulting snapshot once, so a user-visible compound action has one undo boundary. A batch that cannot complete is atomic at its public boundary.

<!-- clause: ENG-CMD-004 -->
Resolution uses the same command path as direct actions. A guided choice produces the next command only after the user supplies the choice. An unsupported compound clause is represented as guided or manual rather than as a guessed command sequence.
