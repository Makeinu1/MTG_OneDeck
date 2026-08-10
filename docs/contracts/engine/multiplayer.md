# Player and multiplayer boundary

The engine keeps a local player identity, an ordered player list, player records, and player-private zones where the current state supports them. Existing solo defaults remain unchanged.

Player-aware commands carry an explicit recipient or controller when the command vocabulary supports one. Life, poison, mana, draw, defeat advisory, and private-zone records must not silently substitute the local player for an explicit recipient.

APNAP ordering consumes the state player order. A player who is not reachable through the current setup path is not fabricated by a compiler or UI action. Opponent setup remains a deterministic setup-to-command transaction with cancel preserving the canonical snapshot.

The multiplayer contract is additive at the state boundary. It does not authorize UI expansion, protocol changes, or a new player identity spelling.
