# O4P-09D tabletop primitive algebra contract

Date: 2026-08-26
Base SHA: `9adc0851cd520aa09f1c50cfa266d6dbc610d9a5`
Risk: R3 / BROAD public command authority, randomness, projection, persistence, and player UI

## Goal

Land one closed, replayable algebra for ordinary public/shared tabletop facts and
make it executable from the production player surface inside the sole
`GameScreen`. Every accepted operation passes through the shipped online
application, Core command, journal, persistence, and audience-safe projection
path. No UI reducer or card-specific mutation path may author game state.

The algebra distinguishes `structured` and `freeform` manual modes on every new
tabletop intent and accepted event:

- Structured Manual is a typed operation whose object/player/zone choices are
  derived from the requesting participant's validated projection.
- Freeform Manual records a table-agreed public fact through the same finite
  primitives. It does not accept an arbitrary patch, property path, reducer,
  script, or wider chooser authority.

Both modes use identical Core invariants, seat authority, revision checks,
receipts, replay, persistence, and projection. Mode is provenance, never an
authorization bypass.

## Closed primitive vocabulary

The executable D vocabulary is finite and versioned:

1. Move a projected object between an allowed own/public zone and draw one or
   more cards through the existing incarnation-safe zone transition. Manual
   Move never accepts a library source identity, a numeric hidden-library
   destination index, or a battlefield/stack base controller other than the
   actor; Draw and Shuffle are the only D operations over an actor library.
2. Shuffle an actor's library and request server-authoritative Random/Reorder.
   No client may submit a seed, entropy, before/after order, permutation, random
   decision ID, or hidden library index. Explicit reorder is limited to a fully
   public projected zone; hidden library reorder stays unavailable.
3. Tap/Untap, Add/Remove Counter, and Mark/Clear Damage on an authorized public
   object.
4. Adjust the actor's own life, poison, energy, experience, or mana with bounded
   integers and non-negative resulting values where the Core fact requires it.
5. Create a bounded token snapshot and remove an authorized token through the
   existing object/definition/runtime factories.
6. Change Controller for a public battlefield object, and Attach/Detach a
   public object, through the existing control and attachment slices.
7. Set/Clear a Temporary Note as a bounded public shared fact. A note has a
   stable public ID, author player, normalized text of 1-160 characters, and a
   creation revision; it is removable or updateable only by its author, and an
   update preserves the original author and creation revision. Another player
   cannot claim an existing ID. Configured capabilities, invite material, raw
   errors, and control characters are rejected.
8. Add a bounded Manual Stack entry and Manual Resolve the current top entry.
   The entry is a public label/provenance record, not an Oracle automation
   claim. A represented card, spell-copy, activated ability, or triggered
   ability must be the author's currently controlled public stack object.
   Resolve is top-only, moves a represented card through the ordinary zone path
   or removes a represented synthetic stack object through the validated
   registry path, and never invents card effects.

Legacy direct tabletop commands remain Core/headless compatible, but are not a
network authority bypass. The Cloudflare boundary rejects client-supplied
`random-zone-order`/`table-shuffle` and requires a valid manual mode before an
authority-sensitive legacy Move/Tap/Counter/Token-removal payload may reach
Core. The D production player surface submits the closed manual intent. A
server binder creates the canonical `CoreCommandV1`; Core remains the only
state reducer. Accepted domain events retain the manual mode and primitive kind
so replay can prove the same final root and public projection.

## Authority and hidden-information boundary

Transport authorization first proves the exact room, connected player seat,
participant capability, command ID, and base revision. The server derives the
actor and decision maker from that seat; a public manual intent cannot nominate
another actor or carry capability material in its operation.

- The actor may operate a battlefield/stack object only when Core identifies
  that player as its current authorized controller/operator. Counter, damage,
  tap, attach, control-transfer, token removal, and manual resolution do not
  grant authority over another player's object.
- A control transfer is initiated by the current controller. Attach/Detach is
  initiated by the controller of the attaching object and may name only a
  projected public legal target.
- Player-fact adjustment is self-only in D. A table may ask the affected player
  by voice to record the agreed correction; Freeform does not let one seat
  change another seat's life or mana.
- Own-hand object identities already present in the audience-safe projection
  may be moved by their owner. Draw and shuffle may operate on the actor's own
  library without revealing or accepting its order. No operation can address
  another player's hand/library or an unprojected hidden identity.
- `Look`, `Reveal`, and `Choose` may appear only as disabled vocabulary. Their
  execution fails closed until O4P-09E supplies audience, duration, decision
  authority, and secret-safe projection.

Every rejected malformed, stale, reused, unauthorized, unprojected, or hidden
operation leaves Core root, journal, revision, persistence, and projection
unchanged and returns only a bounded structured public error.

## Server-authoritative randomness and replay

The public shuffle/random request carries intent only. After authorization and
revision validation, the server obtains entropy from an injected server-only
source, derives the full next order from the authoritative zone, binds an exact
recorded Core random-order payload, applies it, and persists the accepted
command and resulting state atomically. Durable Object SQLite `RETURNING`
cursors are consumed synchronously before any await.

An exact duplicate returns its original receipt and projection without drawing
entropy again. Reconstruction replays the recorded canonical order and reaches
the same Core digest. Clients, projections, rendered DOM, logs, and evidence
never receive the pre-shuffle order, server entropy, random seed, capability,
raw Core root, or private journal.

## Projection and production player surface

Participant and table projections expose the resulting public/shared facts and
only already-authorized own private identities. Runtime tap/counter/damage,
controller, public attachment relations, bounded shared notes, public stack
entries, player totals, and counts update from the accepted Core root. Hidden
zone entries remain count-only or identity-free for unauthorized audiences.

After Pregame, `PublicOnlineApp` renders the active table inside `GameScreen`.
It may compose the shipped personal workbench and an `OnlineTabletopManual`
panel as presentation content, but must not add `OnlineGameScreen`,
`OnlineBoard`, `OnlineHand`, `OnlineStack`, a second reducer, or optimistic
state. The panel offers explicit Structured Manual / Freeform Manual modes,
typed Japanese controls, 44px targets, keyboard/button alternatives, busy
gating, and bounded recovery guidance. Unsupported semantics are visibly
labelled Freeform Manual; no control claims Oracle automation.

The same semantic tree and CSS media queries support 375x812, 812x375, and
1440x900 with console error 0 and no horizontal overflow.

## Scope exclusions

O4P-09D does not implement visibility grants or executable Look/Reveal/Choose
(O4P-09E), HOLD/priority/steward/shared UNDO (O4P-09F/H), combat automation or
defeat (O4P-09G), a full-match journey (O4P-09I), spectator UI (O4P-09J), Oracle
compilation, arbitrary state patches, dependencies, CR-pin changes, or a second
player surface.

## Verification

Acceptance requires executable 2-player and 4-player replays covering every
primitive family and both manual modes; authority/hidden/descriptor/stale/reuse
attacks; duplicate shuffle entropy exactly once; Durable Object reconstruction;
participant/table projection redaction; final Core digest parity; production UI
interaction; Solo regression; and the required responsive browser matrix.
