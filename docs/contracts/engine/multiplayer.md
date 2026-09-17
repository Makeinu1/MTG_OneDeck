# Player and multiplayer boundary

<!-- clause: ENG-MP-001 -->
The engine keeps a local player identity, an ordered player list, player records, and player-private zones where the current state supports them. Existing solo defaults remain unchanged.

<!-- clause: ENG-MP-002 -->
Player-aware commands carry an explicit recipient or controller when the command vocabulary supports one. Life, poison, mana, draw, defeat advisory, and private-zone records must not silently substitute the local player for an explicit recipient.

<!-- clause: ENG-MP-003 -->
APNAP ordering consumes the state player order. A player who is not reachable through the current setup path is not fabricated by a compiler or UI action. Opponent setup remains a deterministic setup-to-command transaction with cancel preserving the canonical snapshot.

<!-- clause: ENG-MP-004 -->
The multiplayer contract is additive at the state boundary. It does not authorize arbitrary UI expansion, protocol changes, or a new player identity spelling. UX Constitution v6.3 is the higher authority for room-administration and interaction semantics; implementing those semantics may require separately reviewed UI or protocol work rather than being prohibited by this clause.

<!-- clause: ENG-MP-005 -->
Room Owner is session-administration authority, not Magic operation authority. Kick/removal and room termination must be explicit and attributable. Temporary disconnection alone does not eliminate a player. When a player is explicitly removed or eliminated, their owned game objects cease ordinary participation according to the supported lifecycle model; administrative isolation must not be represented as ordinary Magic Exile merely because exile is an existing zone.
