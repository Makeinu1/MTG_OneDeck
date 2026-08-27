# O4P-09E visibility, Look, Reveal, and Choose contract

Date: 2026-08-27
Base SHA: `b8f851794ce8051811093093adc8b22196f3d4c2`
Risk: R3 / BROAD hidden-information authority, projection, persistence, and player UI

## Goal

Connect the shipped Core visibility-grant, search-session, decision-authority,
and audience-safe projection substrate to one versioned production player
journey for `Look`, `Reveal`, and `Choose`. Every accepted action is bound on
the server from the authenticated seat and current authoritative root, applied
through one Core command reducer, persisted in the ordinary journal, and
reconstructed by deterministic replay. The client never submits a Core patch,
private root, capability, hidden library order, or wider chooser authority.

This slice implements manual permission/result plumbing, not arbitrary Oracle
automation. A player may intentionally expose only that player's own supported
hidden subject. Unsupported compound instructions remain visibly Freeform
Manual and do not receive executable hidden-zone access.

## Pinned CR semantics

- CR 400.2 distinguishes public zones from hidden hand/library zones.
- CR 401.2 forbids looking at or reordering a library without permission.
- CR 402.3 permits a player to inspect their own hand, not another player's.
- CR 406.3-406.4 governs face-down exile inspection and selection.
- CR 608.2d requires effect-time choices to be legal and possible.
- CR 701.20a-d makes Reveal public, non-moving, and temporary; library reorder
  ends reveal and creates new objects.
- CR 701.20e makes Look use Reveal semantics for only the specified player.
- CR 101.4a permits hidden-zone choices to remain face down when the chosen
  object is unambiguously indicated.

## Closed versioned intent vocabulary

The public E wire is a new exact `online-visibility-intent-v1` envelope. It
contains only schema version, command ID, base revision, and one of:

1. `look`: an actor-owned supported subject, an explicit non-empty list of
   active player viewers, and one server-bound bounded duration.
2. `reveal`: an actor-owned supported subject, the implicit audience
   `all-players`, and one server-bound bounded duration.
3. `choose`: an active projected search-session ID and a unique list of
   projected candidate handles satisfying that session's exact cardinality.

The intent contains no actor/decision-maker override, Core grant key, duration
revision/turn number, source identity not already represented by an authorized
projection handle, zone order, hidden index, selected effect, arbitrary result,
script, property path, room/invite/capability material, or raw error.

Wire duration is an exact discriminated value:
`{ kind: 'next-command' }`, `{ kind: 'end-of-turn' }`,
`{ kind: 'source-bound', sourceHandle }`, or
`{ kind: 'choice-bound', searchSessionId }`. The latter two values may name
only an authorized current projection handle; they never carry a Core ID.
They map exactly to Core authority values: `next-command` maps to a new
`until-next-command` Core duration containing the server-derived opening
sequence; `end-of-turn` maps to existing `until-end-of-turn` with the
server-derived current turn; `source-bound` maps to existing
`while-source-exists` with a server-resolved source ID; and `choice-bound` maps
to a new `until-search-completes` Core duration with the server-resolved
session key. Projection schema exposes only the semantic labels
`next-command`, `end-of-turn`, `source-bound`, and `choice-bound`; it never
exports opening sequence, Core source ID, or search-session authority key.

The D `OnlineTabletopIntentEnvelopeV1` continues to reject its legacy
`look`/`reveal`/`choose` members. E is a separate, narrower authority boundary;
enabling the D placeholders would create an unversioned bypass.

## Supported subjects and authority

The executable production subject set is deliberately smaller than the Core
visibility algebra:

- one visible object handle from the actor's own hand;
- one concealed/public object handle whose authoritative object is owned or
  currently controlled by the actor in battlefield, stack, exile, graveyard,
  or command; or
- the top `1..10` objects of the actor's own library, expressed as a count and
  never as identities or indices.

Whole-zone grants, another player's hand/library, an unprojected handle, and a
library count beyond the current authoritative zone size fail closed. The
server maps the projected subject/source handle to the current Core object ID,
rechecks subject ownership/current control/zone and incarnation, rechecks that
a source handle is owned or currently controlled by the actor in a public
zone, derives the actor from the authenticated participant seat, and generates
the Core grant key from server data. A `look` audience is canonical
ascending-`CorePlayerId` sorted,
duplicate-free, and limited to active players. Seat order may be used for
display only. A `reveal` always targets all active players; a
client-supplied reveal audience is an unknown field.

Selection authority and state-mutation authority remain separate. For
`choose`, the connected seat must equal the active search session's
`selectorPlayerId`; Core command `actorPlayerId` is the session's
`rulesActorPlayerId`, `decisionMakerPlayerId` is the connected selector, and
the decision context is that exact search session. The narrow online protocol
exception for an actor/seat mismatch applies only to `search-complete` with
those authoritative equalities. Every other command retains actor-equals-seat.

The selected IDs are resolved only from the selector's projected candidate
handles and revalidated by Core against the authoritative candidate snapshot,
minimum/maximum, and current decision authority. The shipped O4P-01L
`criteriaKey` is intentionally opaque and has no executable predicate; E must
therefore reject every non-empty `qualified` selection rather than pretend to
revalidate it. A `qualified` session may complete empty only when its
server-owned `mayFailToFind` is true. Such unsupported qualification remains a
visible Freeform Manual boundary until a later frozen compiler contract owns an
executable predicate. Core
emits a typed private structured-result event containing the selected Core IDs
and a projection-safe result count, then closes the session; the client
cannot nominate the effect to apply or mutate any unrelated object. Existing
effect/compiler code may consume that typed Core result later. E does not
invent a generic chooser-wide patch language.

For E, a projected candidate handle may carry the same incarnation-safe string
as its current Core object ID, but it is authority-bearing only because it is a
member of the selector's validated current projection. The server intersects
submitted handles with that projection and the authoritative session before
building `search-complete`. Selected Core IDs remain in the private Core event
and journal; ordinary projections expose only an allowed result count unless
the session's existing `revealFound` rule makes the selected identity public.

## Bounded visibility and automatic closure

Network-opened grants may use only these semantic durations:

1. `next-command`: remains visible for the opening revision and closes before
   projection of the next successfully accepted Core command.
2. `end-of-turn`: closes when the authoritative turn number advances beyond
   the turn in which the server opened it.
3. `source-bound`: names one actor-owned/currently-controlled projected public
   source and closes when that exact incarnation ceases to exist.
4. `choice-bound`: names one active search session visible to the actor or
   designated viewer and closes when that session completes or disappears.

`indefinite` and `manual` are invalid on the E wire. The server derives the
opening command sequence, current turn, source Core ID, and search-session key;
the client never supplies those authority values. Rejected commands do not
advance or close a grant. Automatic closure is part of the same accepted Core
transition and journal event, not a timer or client cleanup.

Every E top-library grant stores a server-derived, Core-only canonical digest
of the exact top object-ID prefix at open time. The digest is validated against
the authoritative prefix during the opening transition, persisted/replayed as
part of the grant, compared after every accepted command, and never projected.
Existing non-E grants may omit it; every network-created E top-library grant
must contain it.

Regardless of declared duration, a grant closes when its object subject no
longer exists, its top-library snapshot digest changes, the subject player
exits, or its audience no longer contains an active player. Shuffle/reorder and
zone movement therefore cannot retain stale revealed identities. Reconnect and
journal replay derive the same active grants and the same final Core digest.

## Projection and secrecy

Core remains the sole identity authority. Projection may widen one card
identity only for the effective viewers of an active grant or the authorized
selector of an active search session:

- Look exposes the supported subject only to the exact player audience.
- Reveal uses the Core `all-players` audience. An observer is not a viewer or
  command actor, but its existing observer-safe projection may mirror the
  revealed identity as a public table fact; it receives no grant/source key,
  effective-player list, or other private grant metadata.
- The shipped search substrate may continue to expose candidates to its exact
  `rulesActorPlayerId` and `selectorPlayerId`; E widens that set to nobody.
  Only the exact selector/decision maker may submit Choose.

No projection, DOM, console, public error, fixture, screenshot, or evidence may
contain a Core grant key, source Core ID, decision-authority record, raw search
candidate list for another viewer, another player's hand/library identity,
pre/post-shuffle order, Room ID, invite, capability, or raw private error.
Projected grant handles and duration labels are opaque, stable only for the
authorized projection, and insufficient to authorize a command by themselves.

An exact duplicate returns the original receipt/projection and creates neither
a second grant nor a second choice result. Stale, reused-with-different-bytes,
unauthorized, malformed, descriptor-hostile, or persistence-failed requests
leave root, grants, sessions, journal, revision, and every projection unchanged.

## Production player surface

After Pregame, `PublicOnlineApp` composes one `OnlineVisibilityDecisions` panel
inside the already-shipped `GameScreen` presentation boundary. It reuses the
current audience-safe participant projection and public application controller;
it does not receive the room object, credential, raw Core root, WebSocket,
journal, or apply function. No `OnlineGameScreen`, `OnlineBoard`, `OnlineHand`,
`OnlineStack`, second reducer, or optimistic hidden state is permitted.

The Japanese UI provides explicit `見る`, `公開する`, and `選ぶ` flows;
viewer and duration summaries before confirmation; projected-only candidates;
44px controls and keyboard/button alternatives; updating/offline gating; and
bounded recovery guidance. Identities appear only after a newer validated
server projection. The D manual panel keeps the three old operations disabled
and points players to the E panel. Unsupported arbitrary choice/effect text is
labelled `Freeform Manual（非公開情報は送信しません）`.

The same semantic tree and CSS media queries support 375x812, 812x375, and
1440x900 with horizontal overflow 0, console warning/error 0, and secret leak 0.

## Scope exclusions

O4P-09E does not implement arbitrary access to another player's hand/library,
whole-zone visibility, client-supplied Core IDs or grant keys, arbitrary result
application, APNAP multi-player simultaneous choice orchestration, card-text
compilation, HOLD/priority/steward (O4P-09F), combat/defeat (O4P-09G), shared
takeback (O4P-09H), full-match closure (O4P-09I), spectator product UI
(O4P-09J), dependencies, CR-pin changes,
or a second player surface.

## Verification

Acceptance requires executable 2-player and 4-player Look/Reveal/Choose
journeys; exact audience differences; every automatic closure; shuffle/zone/
exit invalidation; delegated selector authority; illegal candidate/cardinality
rejection; duplicate/stale/descriptor/persistence attacks; journal reconstruction
and final Core digest parity; participant/table/observer redaction; reconnect
without optimistic reveal; Solo and D regression; and the three responsive
production browser viewports.
