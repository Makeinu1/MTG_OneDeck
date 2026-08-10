# O4P-01L Wave 3-J — Rule Visibility V1

Status: `implemented-not-audited` (implementation-lane draft; not judge-approved or shipped)

Base: `CONTROL_AUTHORITY_SHA=fed094d`

## Scope implemented

This lane adds the additive `CoreVisibilityGrantV1` and
`ModeNeutralCoreVisibilitySliceV1` validator/factory plus the pure
`coreCanPlayerViewObjectIdentityV1` query. The validator uses exact records,
closed subject/audience/mode/duration variants, deterministic issues, fresh
canonical values, and deep freezing. Audience player IDs are unique and
canonicalized by code-unit order; grant order remains semantic order.

The query accepts the frozen authority-bundle shape and the narrow
registry-plus-visibility fixture shape. It returns only a boolean identity
visibility decision. It never creates a projection or mutates zones, runtime,
grants, or inputs. When runtime is supplied, orientation.faceDown is used;
face-down exile is fail-closed when runtime is unavailable.

## Contract cases

- Own hand is visible; libraries remain hidden unless an explicit object/top
  grant applies.
- Face-up public-zone objects are visible to all players.
- Face-down battlefield/stack objects are visible only to their effective
  controller when control context is supplied.
- Face-down exile requires an applicable grant; look grants remain additive.
- Reveal grants require `all-players`; look grants may name unique players.
- Search actor/selector candidate access is represented only by the narrow
  in-game query context and does not reveal, move, or shuffle cards.
- Outside-game and unknown object identities fail closed.

## Deferred

No card movement, reveal event, network/UI projection, search lifecycle,
continuous-effect dependency evaluation, or runtime barrel integration is
included in this lane. Independent cold audit and judge-owned release checks
remain outstanding.
