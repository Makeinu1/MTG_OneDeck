# O4P-01H-B — Token identity and runtime boundary draft

Status: `analyzed-not-integrated`
Role: Domain Analyst
Scope: token identity, provenance, placement, and the V2 runtime substrate boundary.

This is a structural analysis only. It does not implement token creation, derive
copiable values, execute copy effects, or decide priority, targets, choices, or
payments.

## 1. Identity and ownership

- A token is an object and a permanent when it is on the battlefield (CR 109.1,
  110.1, 111.1). It is not a card, even when represented by a card-shaped
  marker (CR 111.6).
- The player who creates the token is its owner, and the token enters under
  that player's control (CR 111.2). Owner must therefore be an explicit
  creation result; it must not be inferred from the source card's owner.
- Controller is separate from owner. A battlefield token has a controller;
  an object outside the battlefield normally has no controller (CR 109.4,
  110.2). A later control change must not rewrite ownership.
- `owner`, `controller`, provenance, zone placement, status, counters, damage,
  and attachments are object/runtime metadata, not copiable characteristics
  (CR 109.3, 707.2). They must not be folded into the token definition
  snapshot.
- Every token creation gets a fresh universal object identity. Equal names,
  token kinds, definitions, or creators do not make two token objects the same
  object.

## 2. Definition snapshot and provenance

The token definition is an immutable snapshot separate from object identity and
runtime state.

- The snapshot represents only values explicitly supplied by the creating
  spell/ability, a predefined token definition, or an authoritative named-card
  lookup (CR 111.3, 111.10, 111.11). Undefined characteristics remain
  undefined; the implementation must not fill them from a normal card or UI
  defaults.
- A definition snapshot may be shared by multiple equivalent Solo tokens, but
  sharing a snapshot does not share object identity, runtime state, or
  provenance.
- Provenance must distinguish at least:
  - direct creation by a resolving spell/ability, with the creating effect's
    object/event reference;
  - a token created from a copy of a permanent spell (CR 111.13, 707.10f);
  - a token intended to copy an object, including the source object reference
    observed at the copy decision; and
  - a named-card or explicitly permitted last-known-information source
    (CR 111.12, 707.13, 707.14).
- Provenance is an audit/reference record, not a second source of
  characteristics. This lane records no copiable values and does not define
  their derivation. The CR 707 evaluator owns that later decision.
- A source reference must be an object identity plus the relevant creation or
  copy event context, never only a physical card ID, current name, or current
  zone. Once an ability has triggered or activated, it remains independent of
  source removal (CR 113.7, 113.7a).
- If a requested copy source no longer exists, creation is not allowed to fall
  back silently to a card with the same name or physical ID. CR 111.12 permits
  the nonexistent-object case only where the applicable effect uses last known
  information; CR 707.14 is an explicit LKI example. Otherwise the result is
  “no token” or a deferred/manual boundary, as determined by the later CR
  evaluator.

## 3. Placement and runtime fields

- A directly created token is placed in the shared `battlefield` zone as a
  permanent, atomically with its registry entry (CR 110.1, 111.1). It has no
  physical card record and must not be represented as a card-backed object.
- Unless the effect says otherwise, it enters untapped, face up, and phased in
  (CR 110.5b). Tap/status is runtime state and exists only for a permanent;
  cards outside the battlefield are neither tapped nor untapped (CR 110.5d).
- Each battlefield token has its own runtime row containing the applicable
  orientation/status, counters, marked damage, and attachment state. Initial
  values are independent: untapped by default, no counters, no marked damage,
  and unattached unless the authoritative placement effect says otherwise.
- Counters are not objects and are not tokens (CR 122.1). They belong to the
  current object and are not retained across a zone change (CR 122.2, 400.7).
- Damage marked on a creature is runtime state, not a characteristic; ordinary
  damage is marked by the damage event and remains until cleanup while the
  object is relevant (CR 120.3e, 120.6). A token's marked damage must not be
  carried into a new object incarnation.
- An Aura/Role token or other attaching token stores its attachment as a
  runtime reference to the current universal object or player target. The
  relation is not part of the token definition. Attachment legality and
  state-based cleanup remain governed by CR 301.5, 303.4, and 704.

## 4. Token, zone, and copy boundaries

The V2 registry must preserve these distinctions:

| Case | Required boundary |
| --- | --- |
| Normal token creation | New token object, battlefield permanent, creator as owner and initial controller. |
| Token leaves the battlefield | It may be observed in the destination zone for applicable triggers, then ceases to exist as a state-based action (CR 111.7, 704). |
| Token has already left the battlefield | It cannot move again or return; a later zone-change attempt leaves it in place until it ceases (CR 111.8). |
| Copy of instant/sorcery card as a token | No token is created (CR 111.5). |
| Copy of a nonexistent object | No token unless the effect explicitly uses applicable LKI (CR 111.12). |
| Copy of a permanent spell | The spell copy resolves into a token permanent, but this is not a “created token” event for creation-token replacement effects/triggers (CR 111.13, 707.10f). |
| Copy of a spell/ability | It is a stack object with no card required; it is not a battlefield token, and a spell copy outside the stack ceases to exist (CR 112.1a, 707.10, 707.10a). |

The implementation must therefore keep `token`, `card`, `spell-copy`, and
`ability` as distinct object kinds even if all are addressable by one universal
object ID. A `token` kind is normally battlefield-only; a stack copy that will
become a token remains a `spell-copy` until the CR 707/608 resolution boundary.

## 5. V2 registry/runtime key invariant

The V2 runtime key invariant is:

> For every live entry in `universalObjectRegistryV2`, there is exactly one
> runtime entry keyed by that same canonical universal object ID; every runtime
> key resolves to exactly one live registry entry; no ceased object retains a
> runtime row.

Consequences:

- The runtime key is the universal object ID, never a physical card ID and
  never a reusable token display ID. Card-backed V1 IDs remain addressable by
  their physical-card/incarnation identity through the adapter; token and
  stack/ability objects have identity without a physical card.
- Registry membership and zone placement are exact-set data: an object is in
  one zone at most once, and a token-cease transition removes its registry and
  runtime entries together. There is no hidden “token pool” entry that can be
  mistaken for a live token.
- Definition snapshots may be deduplicated, but runtime rows may not be
  shared. Two identical Treasure tokens can differ in tap state, counters,
  damage, attachment, controller, and provenance.
- The existing V1 card runtime exact-key rule remains valid for card objects.
  V2 extends the same exact-key discipline to all supported object kinds; it
  must not weaken V1 public contracts by pretending every V2 object is a card.
- Common runtime fields are constrained by zone: tapped/attachment/marked
  damage are battlefield state; counters are object state but are cleared when
  the object changes zones; stack objects use stack-specific state. The V2
  validator/adapter must reject stale, duplicate, missing, or cross-kind keys
  rather than silently backfilling them.

## 6. Solo token reuse boundary

Solo mode may reuse an immutable definition snapshot or a visual marker only.
It may not reuse any of the following:

- a universal token object ID;
- a physical-card ID in place of token identity;
- a runtime row containing tap state, counters, damage, or attachment;
- owner/controller state; or
- creation/copy provenance or event identity.

After a token ceases to exist, a later token with the same name, kind, or
definition is a new object with a new identity and new provenance. Solo's
single-player presentation does not relax CR 111, 400.7, or 707 boundaries.

## 7. Explicit DEFER / unresolved

- Token creation command/event shape and the monotonic universal-ID allocator.
- The concrete V2 object-registry and union-runtime schema, including
  activated/triggered ability and spell-copy payloads.
- Copiable-value extraction and copy-effect application under CR 707,
  including exceptions, face status, “as enters” choices, and linked effects.
- Replacement/prevention effects that alter whether or how a token enters
  (CR 111.5 and related CR 614/615 rules).
- Priority, stack resolution, target legality, choices, cost payment, and
  state-based-action execution/ordering.
- Operational LKI capture and the exact zone-change/event adapter behavior for
  source disappearance and token cease.
- Projection, Online protocol, and UI representation.

## CR references

`109.1–109.5`, `110.1–110.5d`, `111.1–111.13`, `112.1–112.4`, `113.7–113.8`,
`120.3e`, `120.6–120.7`, `122.1–122.2`, `122.6`, `301.5`, `303.4`, `400.7`
(`400.7e–j`), `405.1–405.6`, `604/608` as resolution dependencies, `704`,
`707.1–707.3`, `707.5–707.10g`, `707.12–707.14`.
