# O4P-01L-C Visibility and Search Grounding (draft)

status: drafted
milestone: O4P-01L
role: Domain Analyst
basePlanSha: be3240e77e2c1cfc6be30707bbc3f052c2524b9a

## Purpose and boundary

This lane defines the mode-neutral game-information queries and the minimum
search-session contract for public/private information. It is a rules contract,
not a network or UI projection. A query answers what a rules participant is
allowed to know or choose; a later application layer may redact that answer for
Player/Table/Spectator delivery. Network allowlists, authentication,
serialization, transport, and UI are separate O4P-01L/O4P-02 boundaries.

No operation in this lane moves a card, changes order, shuffles, reveals an
event, evaluates Oracle criteria, or creates a cast/play/search command. The
lane supplies inputs and immutable evidence for those future operations.

## CR-grounded visibility matrix

| object/zone situation | default game-information visibility | rule anchor and contract consequence |
| --- | --- | --- |
| Face-up battlefield, graveyard, stack, command, or face-up exile object | All players may examine the face/characteristics, subject to an explicit rule/effect exception. | CR 400.2, 403, 406.3. Query returns public face-up information; ownership, controller, and characteristics are separate fields. |
| Face-down permanent/object | The physical/object identity and hidden characteristics must not be inferred from the face-down presentation by an unauthorized player. | CR 110.5, 708.2a–708.4. Query returns a redacted face-down object view unless the rules grant the requester access; do not substitute the 2/2 face-down values for hidden identity. |
| Own hand or own library | The owner/player may look at their own hand; a library remains a single face-down ordered pile and its order is not freely inspectable. | CR 401.2, 402.3. The owner gets private hand access and only explicitly granted library access. Library count is public under CR 401.3. |
| Opponent hand or opponent library | Faces are hidden by default. Counting is allowed for a hand; counting a library is allowed, but neither count grants card identity/order. | CR 400.2, 401.2–401.3, 402.3. A requester without a grant receives count/shape only, never card identities or order. |
| Top-library reveal/look grant | Only the specified top card(s), duration, and recipient(s) become visible; changing the top card during announcement/special-action boundaries does not automatically grant visibility to the replacement top card. | CR 401.5–401.6, 701.20a/e. Represent a scoped grant tied to object incarnation and operation/resolution window, not a permanent “library visible” bit. |
| Zone-wide reveal | A reveal instruction can show the specified cards to all players for the time required by the effect; it does not move them. | CR 701.20a–d. Record a public information grant with expiry/relevance, and preserve hidden-zone membership/order. Standalone reveal event execution is deferred. |
| Object-specific look/reveal grant | `look at` exposes only to the specified player(s); `reveal` exposes to all players. Neither changes zone membership. | CR 701.20a–e. Recipient scope and operation (`look` vs `reveal`) are mandatory; never widen a private look to a public projection. |
| Face-down exile that a player was allowed to look at | It remains examinable by that player until it leaves exile or joins a shuffled pile, even after the original permission expires. | CR 406.3. Persist a viewer grant against the current face-down exile object/incarnation and revoke it on the stated invalidation. Other players remain denied. |

Zone visibility is not ownership. CR 400.3 sends a card put into a library,
graveyard, or hand to its owner's corresponding zone, while CR 400.2 determines
whether faces are public. A query must therefore carry `ownerId`, `zoneRef`,
`objectId/incarnation`, and an independently resolved `visibility` result.
Controller, searcher, selector, and viewer are likewise distinct identities.

## Search session contract

The minimum mode-neutral operation is a pure candidate snapshot, followed by a
pure selection result. A concrete type spelling is intentionally left to the
judge-owned contract, but the required fields and invariants are:

```text
VisibilityQuery {
  requesterId, subjectPlayerId, zoneRef, objectIds?, purpose,
  visibilityGrantContext, atRevision?, decisionContext?
}

SearchCandidateSnapshot {
  sessionId, searcherId, selectorId, subjectPlayerId, zoneRef,
  candidateObjectIdsInZoneOrder, candidateIncarnations,
  quantityRule, qualificationRuleRef, canFindFewer,
  foundMustBeRevealed, shuffleAfter?, capturedAuthority
}

SearchSelection {
  sessionId, selectedObjectIdsInSelectionOrder, selectedIncarnations,
  selectorId, revealFoundRequested, authorityProof
}
```

Required semantics:

1. `searcherId` is the player/actor performing the search; `selectorId` is the
   player choosing which candidates are found; `subjectPlayerId` owns the
   searched zone. They may differ. The contract must not silently replace any
   of them with the local player.
2. Candidate discovery means looking at all cards in the named zone, including
   a hidden zone, and filtering against an already-defined qualification. This
   is CR 701.23a. Criteria parsing/evaluation is outside this lane.
3. A quantity search is mandatory for the stated quantity, or as many as
   possible when the zone is short (CR 701.23d). A qualified hidden-zone search
   may find zero or fewer matching cards even when matches exist (CR 701.23b).
   An undefined quality cannot find a card (CR 701.23c). These are distinct
   `quantity`, `qualified`, and `undefined` policies, not one generic optional
   flag.
4. `candidateObjectIdsInZoneOrder` is a snapshot in the zone's current order;
   selection order is separately preserved. The contract must not sort,
   deduplicate, trim, or silently replace candidates. For multiple simultaneous
   searchers, candidate inspection is simultaneous and choices are resolved in
   APNAP order (CR 701.23i; CR 101.4). Each session keeps its own snapshot.
5. A selection is valid only if its object incarnation still matches the
   snapshot and the selector has authority for that session. A stale snapshot
   fails closed with a deterministic `stale-search-snapshot` issue; it must not
   select a newly arrived object that reused an object id. Re-snapshotting is a
   new session, not an implicit retry.
6. `selectedObjectIds` is a set for membership but an ordered list for the
   declared selection order. Repeated ids, ids outside the snapshot, over-limit
   selections, and an unauthorized selector are deterministic validation
   failures. No partial mutation or hidden auto-selection is permitted.
7. CR 701.23e does not reveal found cards unless the effect says so. The
   selection result carries `revealFound`/the grant disposition so the future
   resolver can distinguish “found but still hidden” from “found and revealed”.
   It must not itself emit a reveal event.
8. A `shuffleAfter` field is metadata for a future resolver only. If the effect
   later shuffles a library, the found cards excluded from that shuffle are
   tracked per CR 701.24b. This lane neither creates a permutation nor changes
   library order.

## Decision-authority interaction

Visibility answers “who may know”; search authority answers “who may inspect
and choose”; control/active-player rules answer “whose effect and turn are in
force”. These must not be collapsed into `requesterId`. A search session must
capture the effect's searcher, selector, subject-zone owner, and authority
context at announcement/creation, then validate the same context at selection.
An opponent's library can be searched by an authorized effect without becoming
public, and a player who can look at a card is not thereby authorized to choose
another player's search result. APNAP is an ordering rule for simultaneous
decisions, not a visibility grant (CR 101.4, 101.4a, 701.23i).

## Acceptance cases (contract/golden candidates)

| case | expected result |
| --- | --- |
| Own hand query; opponent hand query | Own identities are returned privately; opponent identities are denied while hand count remains queryable (CR 402.3). |
| Public face-up permanent and face-down permanent | Public face is inspectable; face-down identity is redacted for an unauthorized viewer (CR 400.2, 110.5, 708). |
| Opponent library count vs top-card grant | Count is public; only a granted top card is visible to the specified viewer and a changed top card is not leaked across the operation boundary (CR 401.3, 401.5). |
| Face-down exile looked at by one player | That player retains access until the object leaves exile or enters a shuffled pile; another player remains denied (CR 406.3). |
| Qualified search with two matches and quantity one | Snapshot contains both in zone order; selector may choose zero or one; no card is revealed unless instructed (CR 701.23a–b, 701.23e). |
| Quantity search with fewer cards than requested | Selection may contain all available candidates, marked `shortfall/as-many-as-possible`, and must not invent a card (CR 701.23d). |
| Undefined quality search | Candidate set may be inspected only under the search instruction, but no selection is legal (CR 701.23c). |
| Found-card reveal instruction | Selection preserves found ids and sets public reveal disposition; no zone move or reveal event occurs in this lane (CR 701.23e). |
| Stale snapshot after object incarnation change | Selection is rejected deterministically; no id-only match or partial selection is accepted (CR 400.7 plus contract invariant). |
| Two simultaneous searches | Each snapshot is private to its authorized session; decisions are ordered APNAP, with no cross-session candidate leakage (CR 101.4, 701.23i). |
| Searcher differs from selector and zone owner | All three identities remain distinct and authority is checked against the captured context; local-player fallback is a failure. |

## Explicit DEFER / ambiguity notes

- Card moves, library order changes, shuffle randomness/permutation, reveal
  events, criteria parsing/evaluation, search command/event types, and UI are
  deferred. `shuffleAfter` and `revealFound` are descriptive contract metadata
  only.
- Network projection, redaction serialization, authentication, spectators,
  and simultaneous-session transport are deferred. The game-information model
  must be complete before any projection allowlist is derived from it.
- Full CR 613 continuous-effect dependency evaluation and every face-down
  keyword/exception are deferred; this draft requires a caller-provided
  effective visibility grant rather than pretending to derive all layers.
- A search that is both qualified and quantity-based has an actual CR question
  only when the Oracle wording determines which policy governs; the contract
  must preserve the source wording/policy choice instead of silently merging
  them. If the wording is ambiguous, return `manual/ambiguous-search-policy`.
- “Partial search” means CR-allowed fewer results (qualified hidden-zone search
  or quantity shortfall), not permission to apply a partly resolved card effect.
  Any compound search followed by a move/reveal/shuffle remains outside this
  lane until a later resolver supplies atomicity and replacement-effect rules.
