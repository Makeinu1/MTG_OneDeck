# O4P-09 Shared Table Playable MVP roadmap contract

Date: 2026-08-25
Authority: user-ruling-2026-08-25-shared-chat
Source: https://chatgpt.com/share/6a8ce545-5344-83e8-a5d2-531fd6a266cc
Base SHA: `629de59eb244e6c9eeb78c3bdab29cfd15596b48`
Risk: R3 / BROAD roadmap and selection-policy registration

## Product goal

O4P-09 makes the existing OneDeck play surface usable as a synchronized
Commander table from pregame through a winner. Players may resolve unsupported
card semantics by voice and tabletop primitives. The product is not a fully
automated Arena-style rules client.

The governing product sentence is:

> State is strict, rules are assisted, and social protocol remains with the
> players.

The completion measure is whether real players can finish a game without
leaving the production player surface for a developer-only screen. It is not a
claim that every Oracle sentence or CR priority exchange is automated.

## Reuse and non-duplication boundary

- `GameScreen` remains the sole adaptive player-surface root. O4P-09 must not
  create `OnlineGameScreen`, `OnlineBoard`, `OnlineHand`, or `OnlineStack`.
- Local and Remote use one shared GameIntent/Application boundary and the same
  Mode-Neutral Core semantics. Local executes in-browser; Remote submits the
  same intent to the server-authoritative application. Card, mana, target,
  combat, and effect logic are not implemented twice.
- Existing Core command, turn/priority, visibility-grant, combat/player-exit,
  Room/Protocol/Projection, reconnect/replay, `CardView`, `TableDisplay`, and
  `PersonalWorkbench` assets are substrate to adapt, not parallel systems to
  replace.
- `PlayerGameScreen` and `SpectatorTable` are separate presentations over
  shared Core and projection primitives. A spectator presentation must never
  receive player-private projection data.

## Responsibility model

### Enforced shared facts

OneDeck is authoritative for card/object identity, zones, owner/controller,
hidden information and visibility, tapped state, counters, life/poison/
commander damage, mana, active player, turn/phase/step, stack order, player
lifecycle, concede/outcome, revision, synchronization, and reconnect.

### Assisted tabletop procedures

OneDeck records and assists casts, targets, combat declarations, searches,
Look/Reveal/Choose, manual zone movement, counters, life/mana corrections,
tokens, attachments, control, damage, stack entries, and manual resolution.
Structured Manual means the system understands the primitive sequence and Core
applies the selected result. Freeform Manual means players agree by voice and
record the resulting shared facts through safe primitives.

### Social / voice procedures

Players retain responsibility for unsupported Oracle meaning, shortcut
consent, whether everyone actually passed priority, missed-trigger and
takeback agreement, and table etiquette. No vote or approval workflow is added
for takeback.

## Lifecycle

The product lifecycle is `ROOM -> PREGAME -> PLAYING -> FINISHED`.

Pregame covers commander reveal, starting-player selection, exact turn order,
server-authoritative random result, shuffle, opening seven, per-player
mulligan state, bounded pregame tabletop actions, and the transition to turn
one. Unsupported pregame Oracle semantics remain manual.

Playing retains the CR priority model internally but exposes assisted response
windows. Frequently used explicit windows are: after a stack addition, before
entering combat, after attackers, after blockers, before the end step, and
before passing the turn. HOLD is available to every player as a general table
checkpoint, including less common CR windows.

## Steward, HOLD, advance, resolve, and undo

- With an empty stack, the active player is the steward.
- With a nonempty stack, the player who most recently added the top stack
  object is the steward.
- During a bounded decision, the decision's authorized actor may be the
  temporary steward for that decision only.
- Every player may assert or clear HOLD.
- Only the current steward may Resolve, Advance, or invoke shared UNDO.
- The steward is not a game master and gains no authority to manipulate other
  players' objects or private information.
- Resolve/Advance is a social assertion that the table accepted the shortcut;
  the CR priority model is not simplified or deleted.
- Shared UNDO returns one shared game commit. Agreement happens by voice; no
  voting or approval UI is implemented. Information exposure is warned about
  but does not make undo impossible because memory cannot be rolled back.

## Tabletop primitive boundary

The vocabulary includes Move, Shuffle, server-authoritative Random/Reorder,
Draw, Tap/Untap, Add/Remove Counter, Adjust Life/Mana, Create Token, Change
Controller, Attach/Detach, Mark Damage, Temporary Note, Manual Stack entry, and
Manual Resolve. The vocabulary may describe Look, Reveal, and Choose, but no
hidden-zone operation becomes executable before O4P-09E supplies exact
audience, duration, decision authority, and secret-safe projection.

Selection authority and state mutation are separate. In Structured Manual, the
authorized chooser selects and Core applies the validated result. Freeform
Manual may fall back to the object's authorized operator without granting a
chooser arbitrary manipulation authority.

## Serial milestones

### O4P-09A — Unified Game Surface seam

Extract a mode-neutral interaction/presentation port from the existing
`GameScreen` while preserving Solo behavior and shared visual assets. This is a
bounded seam extraction; it does not yet add Remote wiring or a second screen.

### O4P-09B — Shared Intent / Application boundary

Define the single GameIntent/Application path and Local/Remote adapters. Both
paths apply the same Core semantics, validation, receipts, and projection
rules. Protocol changes remain versioned and fail closed.

### O4P-09C — Pregame and starting-player flow

Add `Pregame` as a first-class state between lobby and play: commander reveal,
starting player and turn order, shuffle, opening seven, mulligan, pregame
actions, readiness, and game start.

### O4P-09D — Tabletop primitive operations

Freeze and implement the safe public/shared-state primitive algebra and the
Structured Manual / Freeform Manual distinction. Hidden-zone disclosure stays
fail closed until O4P-09E.

### O4P-09E — Visibility, Look, Reveal, and Choose

Connect the shipped visibility-grant and secret-safe projection substrate to
versioned commands, decisions, and UI. Support explicit audience and bounded
duration; apply structured choices through Core without revealing unrelated
private state.

### O4P-09F — Assisted Priority, HOLD, and stack steward

Keep CR priority in Core while adding the steward policy, the six common
response windows, global HOLD, steward-only Resolve/Advance, and the
steward-only undo authority predicate. Shared rollback storage is O4P-09H.

### O4P-09G — Combat, manual damage, and player defeat

Adapt the shipped combat/player-exit substrate to the shared surface. Ordinary
attacks, blocks, damage, commander damage, concede, elimination, and outcome
are shared facts; complex assignment/replacement cases may use Manual Damage
without claiming full automation.

### O4P-09H — Shared checkpoints, reconnect, and takeback

Add server/Core-authoritative shared game commits and one-step steward UNDO,
preserve them through the shipped reconnect/replay path, and warn when a
rollback crosses information exposure. Local Zustand history is not Remote
authority and no takeback voting UI is added.

### O4P-09I — Full-match E2E

Prove the production player journey through room/deck, Pregame, land/cast,
HOLD/response/resolve, combat, secret Look/Choose, unsupported Manual Resolve,
disconnect/reconnect, concede/elimination, and winner. The executable suite
must cover a complete two-player game and four-player continuity without a
developer-only escape hatch.

### O4P-09J — Spectator Table and program closure

Build a separate top-down spectator presentation from public projections and
shared `CardView`/table primitives. Show public battlefields, status, graveyard,
public exile, counts, stack, turn, and phase; never show hands, libraries, or
audience-limited grants. O4P-09 completes only after I and J pass audit,
responsive/browser evidence, full check, exact-head CI, and applicable public
runtime verification.

## Global exclusions

O4P-09 does not add full-pass UI for every CR priority window, automate all
Oracle text, enforce every card legality rule, replace the Core priority model,
add accounts/ranking/matchmaking, add broadcast effects, expand Commander into
other variants, add dependencies, update the CR pin, or treat Host as a game
master. Unsupported compound behavior remains visibly assisted/manual.

## Registration semantics

Registration activates the exact A-to-J order but claims no O4P-09 product
implementation. Registration does not claim a GameIntent layer exists.
O4P-08A-D remain immutable shipped history.
`GOV-CODEX-56R2-2026-08` remains `audited` and unchanged; it is not silently
promoted, shipped, or made a product dependency by this roadmap registration.
