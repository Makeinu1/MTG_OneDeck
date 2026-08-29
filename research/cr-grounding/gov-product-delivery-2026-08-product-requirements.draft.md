# OneDeck product requirements

## Status and authority

This is the proposed current product authority for OneDeck. It owns the
product position and the player-visible outcomes: **why the product exists**
and **what it must provide**. It does not prescribe delivery process,
implementation mechanics, exact responsive values, audit procedure, or
release authority; those belong to the delivery policy and the existing
document-governance authorities.

This document changes no shipped behavior and does not authorize a release,
external write, or expansion of the O4P-09F--J boundaries.

## Product position

OneDeck combines the spatial presence of a physical Commander table with the
clarity, card presence, feedback, motion, and audio expected from a strong
digital card game. The product helps a player enjoy their own deck while
supporting understanding and discovery through an honest, readable match
experience.

Arena is a temporary comparative reference, scored out of 100. It is not a
mandate to copy Arena's duel layout, and it is not a promise to automate every
Magic rule.

## Immediate player outcome

The immediate outcome is a player completing a recognizable production
two-player match. That journey must preserve continuity for four-player play.
Solo improves incrementally after this two-player proof; progress is not
established by headless substrate, governance completion, or test volume
alone.

The production journey is complete only when it stays usable through its
meaningful player-facing events, including ordinary table play, responses,
combat, private choices, an honest manual fallback where needed, recovery,
elimination, and a winner.

## Shared table system

All play modes share one normalized tabletop vocabulary:

- cards and a spatial table with stable lanes;
- stack, targets, decisions, priority, status, and recent changes;
- coherent motion and audio feedback.

Solo, two-player, four-player, and public-map experiences may compose that
shared vocabulary differently. They must not require parallel concepts that
make the same match meaning read differently across modes.

## Attention model

In ordinary play, a player retains stable memory of their own board while
remaining peripherally aware of opponents. During responses, stack and
priority causality become the shared focus. Combat and post-resolution changes
may temporarily take focus, but must not reshuffle the table merely to obtain
attention.

## Displays

### Display A: private cockpit

Each player has a private, action-authoritative cockpit. It makes that
player's board and hand primary, keeps opponent public summaries inspectable,
and supports the entire match journey without requiring a second display.

### Display B: public table map

The optional public display is read-only and derives only from public
projection data. It preserves stable seats and presents public boards, stack,
priority, targets, combat, and recent changes. Loss of Display B must never
interrupt a match.

## Comparative quality and access

For the first release measured against the Arena reference, every major UI
category must reach at least 70/100 and the complete-match journey at least
80/100. These thresholds evaluate the player experience; they do not dictate
a copied layout.

The product must remain accessible: the complete journey is available through
Display A, and public information remains distinct from private,
action-authoritative information. Interaction and presentation choices must
maintain clear causality and usable, stable spatial orientation.

## Explicit non-goals

- Copying Arena's duel layout or its every automation decision.
- Treating a headless substrate, governance completion, or test count as the
  player outcome.
- Requiring Display B for play or allowing its loss to halt play.
- Replacing secret-safe public projection with private data exposure.
- Promising automation for complex rules that the product cannot complete
  honestly; such behavior remains guided or manual.
- Fixing exact area ratios, breakpoints, density thresholds, timing, or
  transition values before prototype evidence establishes them.

## Boundary with delivery policy

This contract deliberately states product intent and acceptance quality, not
the method of producing evidence. The companion delivery policy owns the
outcome-first workflow, design and audit practice, iteration, and STOP
decisions. Existing document-governance authorities retain detailed role,
candidate, check, and release mechanics.
