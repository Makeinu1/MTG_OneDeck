# O4P-01L-D: Play-permission grounding draft

## Scope and decision boundary

This lane defines an attempt-permission query for a player attempting to use a
specific object or the current top card of that player's library. It answers
only whether the permission's subject, player, current zone/top position, and
required visibility match. A `yes` result is not a legal cast/play decision.

The query deliberately does **not** decide timing, card type, mana, costs,
payment, land count, color identity, Commander legality, or any other casting
or playing restriction. Those checks are downstream gates.

## Grounding terms

- **Player / actor**: the player making the attempt. The permission must name
  this player, or its effect must unambiguously grant permission to this player.
  “You” is resolved by the effect's controller at the point the permission is
  created; an effect's decision maker is not thereby changed.
- **Decision maker**: the player or effect that chooses modes, targets, or
  other choices. A permission can authorize one player while a separate rule
  or effect determines a choice. Do not infer authorization from who makes a
  choice.
- **Subject**: either a stable object identity for a specific object, or the
  dynamic selector `top card of <player>'s library` evaluated at attempt time.
- **Current zone**: permission is checked against the object's current zone,
  not the zone in which an earlier effect observed it. A zone change creates a
  new object for this purpose (CR 400.7).
- **Owner / controller**: ownership and control are independent attributes.
  Owner is the player who began the game with the card in the deck or who
  otherwise owns it; controller is the player who controls a permanent or
  spell where applicable (CR 108.4, 108.5). A permission's actor and a card's
  owner/controller must not be substituted for one another.
- **Expected zone**: the permission records the zone it authorizes, such as
  `hand`, `graveyard`, `exile`, or `library-top`. `library-top` is a dynamic
  position, not a permanent object location.
- **Visibility**: the actor must be able to identify the subject required by
  the permission. Face-down exile is not treated as visible card identity
  merely because the card is in the actor's controlled exile; apply the
  visibility requirement before returning `allowed` (CR 406.3, 707.2).

## Permission forms

The contract supports these authorization forms:

1. **Specific-object**: permits the named object, provided it is still the
   same object, remains in the expected zone, and satisfies visibility.
2. **Dynamic top-library**: permits the card that is the top card of the
   specified player's library at attempt time. A card is not authorized merely
   because it was previously the top card; a changed top card is a different
   subject for the query.

Each permission carries a use policy:

- `indefinite`: remains available while its grant exists.
- `until-end-of-turn`: expires at the relevant turn's cleanup boundary.
- `while-source-exists`: remains available only while the stated source
  condition is true; if the source leaves or the condition ends, it is stale.
- `single-use`: is consumed exactly once after the permission successfully
  authorizes an attempt. A denied attempt does not consume it. Consumption is
  an event/state transition outside this pure query.
- `manual`: the system must expose the permission as a guided/manual option;
  it must not claim that the resulting play or cast is automated.

The query itself is observational and must not consume a grant, move an object,
reveal a face-down card, or mutate the library.

## Proposed query contract

```ts
type PlayPermissionSubject =
  | { kind: 'specific-object'; objectId: string; expectedZone: 'hand' | 'graveyard' | 'exile' }
  | { kind: 'top-library'; libraryPlayerId: string };

type PlayPermissionGrant = {
  actorId: string;
  subject: PlayPermissionSubject;
  requiredVisibility: 'identity-visible' | 'position-visible';
  usePolicy: 'indefinite' | 'until-end-of-turn' | 'while-source-exists' | 'single-use' | 'manual';
  available: boolean;
};

type PermissionAttemptView = {
  actorId: string;
  currentZone: 'hand' | 'graveyard' | 'exile' | 'library';
  objectId?: string;
  isTopLibraryCard?: boolean;
  identityVisible: boolean;
  positionVisible: boolean;
};

type PlayPermissionResult =
  | { status: 'allowed'; grant: PlayPermissionGrant; subjectObjectId: string }
  | { status: 'denied'; reason: 'wrong-player' | 'missing-subject' | 'wrong-zone-or-position' | 'not-visible' | 'unavailable' };

function queryPlayPermission(
  grant: PlayPermissionGrant,
  attempt: PermissionAttemptView,
): PlayPermissionResult;
```

Required checks, in order:

1. `grant.available` is true and `attempt.actorId === grant.actorId`.
2. For `specific-object`, `attempt.objectId` identifies the granted object and
   `attempt.currentZone === expectedZone`.
3. For `top-library`, `attempt.currentZone === 'library'` and
   `attempt.isTopLibraryCard === true`; the dynamic subject is resolved now.
4. `requiredVisibility` is satisfied: identity-visible requires
   `identityVisible`; position-visible requires `positionVisible`.
5. Return the subject object id without changing any state. If any check fails,
   return a deterministic denial reason and do not consume the grant.

The query may be used by both “cast” and “play land/card” entry points, but
those entry points must retain separate downstream rules. Casting a spell is
governed by the spell-casting procedure (CR 601); playing a land is governed by
the land-play rules (CR 305). “Play a card” is an interface label only until
the card-type-specific downstream gate classifies it.

## Required state

The minimal state supplied to this query must make the following facts
inspectable without consulting unrelated legality rules:

- actor/player identity;
- stable object identity and current zone for a specific-object attempt;
- the named library player's current top object for a dynamic attempt;
- whether the subject's identity is visible and, for a dynamic subject,
  whether top position is visible;
- grant availability and its subject/expected zone;
- enough lifetime metadata for an upstream grant manager to mark an expired
  duration or source-dependent grant unavailable;
- a consumption marker managed outside the query for single-use grants.

No owner/controller field is required to produce a positive result unless the
permission's subject explicitly names one; when present, owner/controller
remain separate fields and are not aliases for `actorId`.

## Acceptance scenarios

1. A player may attempt the specifically granted card while it remains the
   same object in the expected zone and its identity is visible: `allowed`.
2. The same card leaves the expected zone and a new object later appears in the
   expected zone: `denied` (`wrong-zone-or-position` or `missing-subject`), not
   inherited permission.
3. A dynamic permission authorizes the card currently on top of the named
   player's library; changing the top card before the attempt resolves the
   subject at attempt time and does not use the old card.
4. A player other than the authorized actor attempts either form: `denied`
   (`wrong-player`), even if that player owns or controls the card.
5. A face-down exiled card fails an identity-visible requirement unless the
   governing effect explicitly supplies the required identity/visibility:
   `denied` (`not-visible`).
6. An expired EOT grant, a grant whose required source no longer exists, or a
   consumed single-use grant is unavailable and returns `denied`.
7. A denied attempt does not consume a single-use permission; a successful
   authorization is the only point at which its external consumption event may
   be recorded.
8. An `allowed` result does not bypass timing, card type, mana, cost/payment,
   land-count, color-identity, or Commander-legality checks. Each remains an
   explicit deferred gate for the cast/play pipeline.

## CR references

- CR 108.4–108.5: owner and controller are distinct concepts.
- CR 305.1, 305.3: playing a land and the permission/timing boundary for land
  play (full land-play legality is deferred here).
- CR 400.7: an object that moves between zones becomes a new object and does
  not retain the prior permission by identity alone.
- CR 406.3: exiled cards' face-up/face-down status and visibility boundary.
- CR 601.2: casting a spell is a multi-step procedure; this lane supplies only
  an authorization precondition and does not perform the procedure.
- CR 611.2: continuous-effect durations and expiration semantics relevant to
  EOT/source-dependent grant lifetime (lifetime bookkeeping is deferred to the
  grant manager).
- CR 707.2: face-down objects do not expose ordinary characteristics absent an
  effect that permits their use/identification.

## DEFER / ambiguity notes

- **DEFER** full timing priority, flash/sorcery restrictions, card type and
  subtype rules, mana availability, cost determination/payment, land-play
  count, color identity, Commander legality, replacement effects, and the
  actual cast/play procedure.
- **DEFER** exact source-lifetime bookkeeping and cleanup timing to the grant
  manager; this query consumes only the already-normalized `available` bit.
- **DEFER** owner/controller-based permissions whose wording needs a full
  continuous-effect and control-layer analysis; this lane preserves the fields
  but does not infer them.
- **AMBIGUITY** “position-visible” is sufficient for locating a dynamic top
  card, but not necessarily for identifying its characteristics. The caller
  must request `identity-visible` whenever card identity is needed to choose or
  classify the card.
- **AMBIGUITY** “play a card” is not a CR operation name; the UI/compiler must
  map it to cast-a-spell or play-a-land before legality is evaluated.
- **AMBIGUITY** a face-down exile effect may define an exceptional permission or
  reveal/use rule. The query accepts only the normalized visibility fact and
  must not invent that exception.
