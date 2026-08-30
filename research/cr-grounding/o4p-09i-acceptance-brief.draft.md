# O4P-09I full-match production evidence brief (draft)

This brief defines the evidence boundary for the shared-table player journey.
It is not a shipment claim and does not promote a roadmap ledger entry.

## Scope

The evidence runner drives the deployed production page through isolated Chrome
contexts. It may inspect DOM, viewport geometry, revision markers, public
outcome markers, browser console counters, and same-origin resource timing for
the pinned Worker origin. It may not inject commands, call Core reducers,
mutate a Worker directly, or use a developer escape hatch.

The two-player path must visibly cover room/deck entry, Pregame, land/cast,
HOLD, response/pass/resolve, a guided attacker/defender declaration, combat and
nonlethal explicit Manual Damage, private Look/Choose without cross-seat
leakage, unsupported compound semantics through Manual Stack/Manual Resolve,
disconnect/reconnect revision continuity, and a final lethal Manual Damage
winner. The four-player path starts four seats, keeps fixed
public seat/board geometry, performs a shared mutation, reconnects one seat,
and proves the other three continue at a matching revision without secret
exposure.

The runner uses the hardened O4P-06F isolated Chrome/CDP adapter by default; an
operator may inject an equivalent adapter implementing `O4p09iBrowserV1`
(including visible DOM evaluation, context/page close, and viewport resizing)
for tests.  It does not claim a production run from a synthetic browser or
provide a command/Worker escape hatch.
Invite values, deck material, capability strings, and private-choice candidate
handles are runtime-only scanner material and are never emitted in the summary.
For Look/Choose, the runner keeps a bounded in-memory candidate/attribute/text
payload and digest, then probes every unauthorized seat's text, attributes,
form values, and choice controls for exact-token or digest-equivalent leakage.

## Fixed evidence facts

Each scenario records the ordered semantic phases and action labels only after
the corresponding visible controls have been clicked successfully.  DOM probes
derive monotonic revision checkpoints, `crossSeatLeak: false`, the explicit
manual fallback boundary, outcome markers, and eliminated seats.  The
responsive matrix is fixed at 375x812, 812x375, and 1440x900; each measured
probe requires one `GameScreen`, zero horizontal overflow, zero console errors,
and bounded DOM rectangles for the viewport, operation rail, hand, battlefield,
an enabled primary action, an open panel, and an accessible scroll container.
The runner fails closed on a clipped primary action, rail/hand collision,
off-screen panel, inaccessible scroll region, or fully obscured battlefield.
Cleanup must close six isolated contexts, eight pages (including
reconnect pages), and the adapter must remove its temporary profile.

## Scoring rubric

The Judge scores independently; the harness never self-certifies a release.
Major categories are orientation/board memory, stack-priority causality,
action/response discoverability, card presence/feedback, accessibility/recovery,
and privacy/trust. Each major category must score at least 70/100. The
continuous full journey must score at least 80/100. A missing step, stale or
divergent revision, console error, capability fragment, cross-seat private
leak, direct injection, or cleanup failure fails closed and invalidates the
corresponding score claim.

## Deferred boundaries

Unsupported compound effects, secret choices beyond the projected Look/Choose
surface, and any operation without a trusted server-bound primitive remain
visible Manual boundaries. No second GameScreen, reducer, combat engine, or
parallel online state is introduced. Spectator-only and future O4P-09J work are
out of scope.
