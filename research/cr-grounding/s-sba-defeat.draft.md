# S-SBA Defeat-State Substrate Engine-Spec §34.15 Draft

CR source: Magic: The Gathering Comprehensive Rules, effective 2026-06-19. Local pin: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` / metadata sha256 in `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json`. Relevant CR refs: 104.1, 104.3b, 104.3c, 104.3d, 104.5, 117.5, 121.1, 121.2, 121.4, 121.5, 122.1f, 704.1, 704.2, 704.3, 704.5a, 704.5b, 704.5c, 704.6c, 903.7, 903.10a.

## Current State Survey

- `GameState.life` is the app player's life total, initialized to `40` in `initGame`; this matches Commander starting life for each player (CR 903.7) and is the existing substrate for the app player's life-loss defeat advisory (CR 704.5a, CR 104.3b).
- `GameState.opponentLife: Record<string, number>` is the current opponent life substrate, initialized as `{ 対戦相手A: 40 }`; opponent entries are labels rather than full player objects, but life `<= 0` can still be evaluated per label for the same life-loss defeat advisory (CR 704.5a, CR 104.3b).
- `GameState.poison` is the only poison-counter field in current state and represents the app player; no `opponentPoison` field exists, so this slice can only evaluate poison defeat for the app player until a per-opponent poison substrate is added (CR 704.5c, CR 122.1f).
- `adjustLife` allows negative `state.life`, and `adjustOpponentLife` allows opponent life below zero; those values are therefore available for an advisory SBA check without changing the existing life commands (CR 704.5a, CR 104.3b).
- `adjustPlayerCounter` supports `poison | energy | experience` and clamps counters at `>= 0`; `state.poison >= 10` is therefore the current poison-defeat condition for the app player (CR 704.5c, CR 122.1f).
- Draws pass through `drawCards(draft, count)` from both explicit `draw` commands and automatic draw-step entry; `drawCards` currently stops when `zones.library.length === 0` and returns the actual drawn count, so it does not preserve the "attempted to draw from an empty library since the last SBA check" fact required for empty-library defeat (CR 121.1, CR 121.2, CR 121.4, CR 704.5b).
- Explicit `draw` commands increment `drawnThisTurn` only by actual drawn cards and warn if fewer cards were drawn than requested; this is insufficient for CR 704.5b because an unsuccessful draw attempt must be remembered even when `drawnThisTurn` does not increase (CR 121.2, CR 121.4, CR 704.5b).
- Milling uses `applyMill` and moves cards from library to graveyard without using the draw path; it must not set the empty-library draw-attempt flag because moving library cards to hand without "draw" is not a draw, and mill is not draw (CR 121.1, CR 121.5, CR 704.5b).
- `performStateBasedActionsOnce` is the current SBA fixed-point unit; it collects candidate ids, applies all applicable actions under one `simultaneousGroupId`, returns `true` when an action was performed, and `stabilizeBeforePriority` repeats it until no action applies (CR 704.1, CR 704.2, CR 704.3, CR 117.5).
- The current 704.5g/h pattern is "collect candidates -> skip stale candidates after earlier moves -> emit event metadata with `reason: 'sba'`, `sbaApplied`, and `simultaneousGroupId` -> push a Japanese log"; this is the pattern to follow for defeat advisory events even though defeat does not move a card between zones (CR 704.3, CR 704.5g, CR 704.5h).
- The commit object `b6ab728` was not inspected because this implementer brief forbids git operations; the current checked-out implementation contains the 704.5g/h pattern described above (CR 704.5g, CR 704.5h).
- `GameEvent` is currently only `ZoneChangeEvent`, and existing CR-grounding golden tests assert `eventLog` metadata such as `reason: 'sba'`, `sbaApplied: '704.5g'`, and `simultaneousGroupId`; defeat needs a non-zone-change event shape to preserve the same audit surface (CR 704.3, CR 704.5a, CR 704.5b, CR 704.5c).
- Snapshot forward compatibility is currently centralized in `normalizeSnapshotState`, which backfills newer fields such as `drawnThisTurn`, marked damage, pending choices, and event log; defeat fields should be backfilled there rather than by assuming old snapshots already contain them (CR 704.5a, CR 704.5b, CR 704.5c).

## Proposed §34.15 Text

### 34.15 S-SBA: defeat-state substrate(CR 704.5a/b/c) - draft

**Positioning**: This slice adds the loss-condition SBA substrate for life `<= 0`, empty-library draw attempt, and poison `>= 10`; it records advisory defeat state and metadata but does not end the app session (CR 704.5a, CR 704.5b, CR 704.5c, CR 104.1, CR 104.5).

**CR basis**:

- A player with life total `0` or less loses the game as a state-based action the next time a player would receive priority (CR 704.5a, CR 104.3b, CR 117.5).
- A player who attempted to draw a card from an empty library since the last SBA check loses the game as a state-based action (CR 704.5b, CR 121.4, CR 104.3c).
- A player with ten or more poison counters loses the game as a state-based action; Two-Headed Giant replacement threshold is out of scope for this app slice (CR 704.5c, CR 122.1f, CR 104.3d).
- State-based actions are checked before priority, do not use the stack, and repeat to a fixed point (CR 704.1, CR 704.2, CR 704.3, CR 117.5).
- Under CR, a losing player leaves the game and a game can end immediately; this app deliberately records only advisory defeat so the sandbox can continue (CR 104.1, CR 104.5, CR 704.5a, CR 704.5b, CR 704.5c).

**1. State contract (`src/engine/types.ts`)**:

```ts
type DefeatReason = 'lifeZero' | 'emptyLibraryDraw' | 'poison';
type DefeatRuleRef = '704.5a' | '704.5b' | '704.5c';
type DefeatPlayerRef = 'P1' | `opponent:${string}`;

interface DefeatAdvisoryRecord {
  reasons: DefeatReason[];
  ruleRefs: Partial<Record<DefeatReason, DefeatRuleRef>>;
  advisory: true;
}

interface GameState {
  // Existing fields remain the numeric truth sources.
  life: number;
  opponentLife: Record<string, number>;
  poison: number;

  // New fields.
  defeat: Partial<Record<DefeatPlayerRef, DefeatAdvisoryRecord>>;
  emptyLibraryDrawAttemptedSinceLastSba: Partial<Record<PlayerId, boolean>>;
}
```

- `state.life` remains the app player's life source for `DefeatPlayerRef === 'P1'`; no duplicate life field is introduced (CR 704.5a, CR 104.3b, CR 903.7).
- `state.opponentLife[label]` remains the opponent life source for `DefeatPlayerRef === 'opponent:${label}'`; no opponent player object is required for the life-zero advisory (CR 704.5a, CR 104.3b).
- `state.poison` remains the app player's poison source; opponent poison defeat is deferred until a per-opponent poison field exists (CR 704.5c, CR 122.1f).
- `emptyLibraryDrawAttemptedSinceLastSba.P1` is set when a draw instruction attempts an individual draw while `zones.library` is empty; this encodes the "since the last time state-based actions were checked" condition (CR 121.2, CR 121.4, CR 704.5b).
- `emptyLibraryDrawAttemptedSinceLastSba` is cleared by the SBA check after it has been evaluated, whether or not a new advisory reason was added; this keeps the flag scoped to the interval named by CR 704.5b (CR 704.5b, CR 121.4).
- `defeat[playerRef].reasons` is append-only for this app session unless a future explicit "clear advisory" command is designed; CR would remove the player, while this app keeps an advisory record so the user can continue (CR 104.5, CR 704.5a, CR 704.5b, CR 704.5c).

**2. Event metadata contract (`src/engine/types.ts`)**:

```ts
interface DefeatAdvisoryEvent {
  type: 'defeatAdvisory';
  eventId: string;
  sequence: number;
  reason: 'sba';
  sbaApplied: '704.5a' | '704.5b' | '704.5c';
  simultaneousGroupId: string;
  playerRef: DefeatPlayerRef;
  defeatReason: DefeatReason;
  advisory: true;
  observedValue?: number;
}

type GameEvent = ZoneChangeEvent | DefeatAdvisoryEvent;
```

- Defeat advisory events use `reason: 'sba'`, `sbaApplied`, and `simultaneousGroupId` to match the current 704.5g/h audit pattern while avoiding fake zone-change events (CR 704.1, CR 704.3, CR 704.5a, CR 704.5b, CR 704.5c).
- Multiple defeat reasons found in the same SBA pass share one `simultaneousGroupId`, preserving the simultaneous-single-event structure of state-based actions (CR 704.3).
- `observedValue` records life, poison, or attempted-empty-draw count/value context when useful for tests and UI, but the authoritative reason remains `sbaApplied` plus `defeatReason` (CR 704.5a, CR 704.5b, CR 704.5c).

**3. Draw hook contract (`src/engine/commands.ts`)**:

- `drawCards(draft, count)` must continue drawing one card at a time and must set `emptyLibraryDrawAttemptedSinceLastSba.P1 = true` when an individual draw is attempted with an empty library (CR 121.1, CR 121.2, CR 121.4, CR 704.5b).
- A multi-card draw where the library runs out after drawing remaining cards must set the empty-library draw-attempt flag for the first unavailable individual draw (CR 121.2, CR 121.4, CR 104.3c, CR 704.5b).
- `draw` command counts `<= 0` must not create an empty-library draw attempt because no individual draw is attempted (CR 121.1, CR 121.2, CR 704.5b).
- `mill`, `arrangeTop`, `moveCard`, and other non-draw library movement must not set the empty-library draw-attempt flag (CR 121.1, CR 121.5, CR 704.5b).
- The automatic draw-step path through `enterPhase(..., 'draw', drawnHandled=false)` must use the same `drawCards` hook so turn-based draws and effect draws share the same empty-library defeat substrate (CR 121.1, CR 121.4, CR 704.5b).

**4. SBA contract (`performStateBasedActionsOnce`)**:

- Add defeat candidates to the existing candidate-collection pass before the "no candidates" return, using the same `simultaneousGroupId = sba-${nextEventSeq}` pattern as 704.5g/h (CR 704.3, CR 704.5a, CR 704.5b, CR 704.5c).
- `lifeZero`: if `state.life <= 0` and `defeat.P1.reasons` lacks `lifeZero`, add the reason and emit `DefeatAdvisoryEvent { sbaApplied: '704.5a', playerRef: 'P1', defeatReason: 'lifeZero', advisory: true }` (CR 704.5a, CR 104.3b).
- `lifeZero`: for each `state.opponentLife[label] <= 0`, add `lifeZero` to `defeat['opponent:${label}']` and emit the same event shape with `playerRef: 'opponent:${label}'` (CR 704.5a, CR 104.3b).
- `emptyLibraryDraw`: if `emptyLibraryDrawAttemptedSinceLastSba.P1 === true` and `defeat.P1.reasons` lacks `emptyLibraryDraw`, add the reason and emit `DefeatAdvisoryEvent { sbaApplied: '704.5b', playerRef: 'P1', defeatReason: 'emptyLibraryDraw', advisory: true }` (CR 704.5b, CR 121.4, CR 104.3c).
- `poison`: if `state.poison >= 10` and `defeat.P1.reasons` lacks `poison`, add the reason and emit `DefeatAdvisoryEvent { sbaApplied: '704.5c', playerRef: 'P1', defeatReason: 'poison', advisory: true }` (CR 704.5c, CR 122.1f, CR 104.3d).
- The empty-library draw-attempt flag must be cleared after the check that observes it, even if `emptyLibraryDraw` was already present; otherwise the app's advisory continuation would keep a stale "since last SBA" fact forever (CR 704.5b, CR 121.4, CR 104.5).
- Once a defeat reason is already present, later SBA checks must not re-emit the same advisory event solely because the losing condition still numerically holds; CR would remove the player, but the app keeps play going, so the advisory action must be idempotent to preserve the fixed-point loop (CR 104.5, CR 704.3, CR 704.5a, CR 704.5b, CR 704.5c).
- Defeat advisories must return `true` from `performStateBasedActionsOnce` only when a new advisory reason was added or the empty-draw interval flag was consumed; this prevents infinite fixed-point loops while still modeling an SBA check boundary (CR 704.3, CR 704.5b).
- Existing card-moving SBAs 704.5d/e/f/g/h/i/q and pending rule-choice behavior remain unchanged by this slice (CR 704.3, CR 704.5d, CR 704.5e, CR 704.5f, CR 704.5g, CR 704.5h, CR 704.5i, CR 704.5q).

**5. Sandbox / advisory policy**:

- The app must not hard-enforce defeat by ending the game, clearing state, blocking commands, blocking phase/turn movement, or forcing a player to leave the game; it must only set advisory state, emit metadata, log/warn, and allow the user to continue (CR 104.1, CR 104.5, CR 704.5a, CR 704.5b, CR 704.5c).
- UI may display a warning banner or marker for each advisory reason, but the engine state remains operable after the advisory appears (CR 104.5, CR 704.5a, CR 704.5b, CR 704.5c).
- The app-level difference from CR must be documented: CR says the player loses and leaves; this app records "would lose under CR" as advisory state and keeps the sandbox playable (CR 104.1, CR 104.5, CR 704.5a, CR 704.5b, CR 704.5c).

**6. State invariants**:

- `defeat[playerRef].reasons` contains only `lifeZero`, `emptyLibraryDraw`, and `poison`, and each reason's `ruleRefs` value matches exactly `704.5a`, `704.5b`, or `704.5c` respectively (CR 704.5a, CR 704.5b, CR 704.5c).
- `lifeZero` may be present for `P1` only when `state.life <= 0` was observed by an SBA check, and for `opponent:${label}` only when `state.opponentLife[label] <= 0` was observed by an SBA check (CR 704.5a, CR 104.3b, CR 704.3).
- `emptyLibraryDraw` may be present for `P1` only when an empty-library draw attempt was observed by an SBA check after the last flag reset (CR 121.4, CR 704.5b, CR 704.3).
- `poison` may be present for `P1` only when `state.poison >= 10` was observed by an SBA check (CR 704.5c, CR 122.1f, CR 704.3).
- Missing `defeat` in old snapshots must backfill to `{}` and missing `emptyLibraryDrawAttemptedSinceLastSba` must backfill to `{}` so old snapshots do not falsely assert a CR 704.5a/b/c advisory or crash during SBA (CR 704.5a, CR 704.5b, CR 704.5c).
- Invalid `defeat` reasons from malformed snapshots must be dropped rather than trusted, because only the three CR 704.5a/b/c reasons are in this substrate (CR 704.5a, CR 704.5b, CR 704.5c).
- `emptyLibraryDrawAttemptedSinceLastSba` must not persist as `true` across a completed SBA check; the flag represents only attempts since the last SBA check (CR 704.5b, CR 121.4).

**7. Golden / test contract**:

- Add CR-grounded golden entries for life-zero, empty-library draw attempt, poison threshold, advisory-continuation, and snapshot forward compatibility (CR 704.5a, CR 704.5b, CR 704.5c, CR 104.5).
- Expected event metadata for positive cases is `type: 'defeatAdvisory'`, `reason: 'sba'`, `sbaApplied: '704.5a' | '704.5b' | '704.5c'`, a stable `playerRef`, `defeatReason`, `advisory: true`, and a shared `simultaneousGroupId` for same-pass advisories (CR 704.3, CR 704.5a, CR 704.5b, CR 704.5c).
- Negative cases must assert that poison `9` and non-draw library movement do not create defeat advisory events (CR 704.5c, CR 122.1f, CR 121.5, CR 704.5b).
- Adversarial cases must assert that phase/turn progression and commands still work after the advisory appears, because this app records advisory defeat instead of applying CR's leave-the-game consequence (CR 104.5, CR 704.5a, CR 704.5b, CR 704.5c).

**8. Scope boundaries / defer**:

- Commander-damage defeat is deferred to the next slice and must not be claimed as PASS here (CR 903.10a, CR 704.6c, CR 104.3j).
- Detailed multiplayer simultaneous-loss outcomes, including draw outcomes when all remaining players lose simultaneously, are deferred and must not be claimed as PASS here (CR 104.4a, CR 704.3).
- Actual game-ending, player-leaves-game processing, winner determination, and `104.5` leave-game consequences are intentionally not implemented in this slice because the app's sandbox policy keeps defeat advisory-only (CR 104.1, CR 104.2a, CR 104.5, CR 704.5a, CR 704.5b, CR 704.5c).
- Two-Headed Giant life/poison thresholds are out of scope because current app state does not model shared team life or team poison counters (CR 704.5c, CR 704.6a, CR 704.6b).
