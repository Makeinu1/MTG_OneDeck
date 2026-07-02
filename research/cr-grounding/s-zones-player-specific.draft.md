# S-ZONES Player-Specific Zones Design Draft

Draft lane only. Do not copy to `docs/engine-spec.md` until judge review.
This file is design-lock input only; it contains no implementation plan that
should be treated as approved code.

Domain: `cr-player-specific-zones`
Lane: `late-backbone`
Ledger status at drafting time: `drafted`
Ledger next gate: freeze player-specific library/hand/graveyard storage and
legacy snapshot backfill before implementing per-player draw/mill/search or
per-opponent-exact commander damage.

CR source: Magic: The Gathering Comprehensive Rules, effective 2026-06-19.
Pinned local source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`
(`rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json` sha256
`e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b`).

Relevant CR refs: 108.3, 108.4a, 111.2, 400.1, 400.3, 400.6,
401.1, 402.1, 404.1, 903.10a.

## 1. CR Grounding

- Player-specific private zones are not an app convenience; CR 400.1 says each
  player has their own library, hand, and graveyard, while battlefield, stack,
  exile, and command are shared by all players. CR 401.1 says each player's
  deck becomes that player's library. CR 402.1 defines hand as the place for
  cards drawn by that player, and CR 404.1 defines a player's graveyard as that
  player's discard pile.

- A model with only flat `zones.library`, `zones.hand`, and `zones.graveyard`
  can represent the current solo P1 case, but it cannot faithfully represent a
  second player's library/hand/graveyard because CR 400.1 gives those zones to
  each player separately. Shared zones may remain flat/global because CR 400.1
  explicitly makes battlefield, stack, exile, and command shared.

- Owner routing is mandatory for private-zone moves. CR 400.3 says if an object
  would go to a library, graveyard, or hand other than its owner's, it goes to
  the owner's corresponding zone. Therefore a command/effect may request a
  private zone, but the actual storage owner for library/hand/graveyard must be
  the object's owner, not the controller or selected opponent label. CR 400.6 is
  the event-level hook: determine the zone-change event, apply replacement
  effects, let controller or owner choose among contradictory effects, then move
  the object.

- The state must know each object's owner before applying CR 400.3. CR 108.3
  defines the owner of a card in the game, CR 111.2 gives tokens an owner, and
  CR 108.4a says if a controller is requested for a card that has no controller,
  use its owner instead. The existing M2 owner/controller substrate is therefore
  the prerequisite for this design.

- `ObjectSnapshot` / zone-change event data needs to distinguish "which zone"
  from "which player's private zone" for library/hand/graveyard. CR 400.1
  distinguishes player-owned private zones from shared zones, and CR 400.6 makes
  the zone-change event the deterministic place to record actual movement. A
  snapshot that only says `toZone: graveyard` is not enough once multiple
  graveyards exist; private-zone events need a zone owner identity as metadata.

- Per-opponent-exact commander damage depends on a real target player identity.
  CR 903.10a says a player loses after being dealt 21 or more combat damage by
  the same commander over the course of the game. That condition is per target
  player and per source commander. The current coarse
  `commanderDamage: Record<string, number>` can only be interpreted as a
  P1-only advisory counter; a future exact form needs a target-player key and a
  stable source-commander key.

## 2. Design Forks

### Fork 1: Storage Shape for Private Zones

Option A: single map, `zonesByPlayer: Record<PlayerId, private zones>`.

- CR grounding: CR 400.1 groups library, hand, and graveyard by player; CR
  401.1, 402.1, and 404.1 define those zones as player-specific.
- Tradeoff: This shape makes "draw/mill/search for player X" local to one
  player record and gives owner routing a single destination surface. It also
  makes backfill easy: legacy flat private zones become `zonesByPlayer.P1`.
  The cost is that existing code reading `state.zones.library` cannot be moved
  all at once; a temporary P1 mirror or accessor layer is needed.
- Alias/coexistence strategy: Keep shared zones in the existing flat `zones`
  during migration. For private zones, make `zonesByPlayer.P1` the future truth
  and keep `zones.library` / `zones.hand` / `zones.graveyard` as a P1 mirror
  until all direct readers are migrated. The mirror must be covered by an
  invariant so it cannot silently diverge. CR grounding remains CR 400.1 and
  CR 400.3.

Option B: separate maps, `libraryByPlayer`, `handByPlayer`, and
`graveyardByPlayer`.

- CR grounding: CR 400.1 still requires a per-player library, hand, and
  graveyard; CR 400.3 routes each private-zone destination to the owner.
- Tradeoff: This shape is convenient for zone-specific operations and makes
  "all libraries" easy to scan. The cost is consistency: every invariant,
  snapshot backfill, and object-location check must coordinate three maps, and
  adding another player-specific zone later repeats the pattern.

Recommended default for judge review: Option A, `zonesByPlayer`, with a
temporary P1 mirror in flat `zones`. It follows CR 400.1's player grouping, has
the smallest backfill surface, and lets existing review/golden coverage migrate
incrementally instead of forcing a full cutover in one slice.

### Fork 2: Opponent Model

Option A: promote opponents to first-class `PlayerId`s.

- CR grounding: CR 400.1 assigns private zones to each player, not to labels.
  CR 903.10a's losing condition is "a player" receiving damage from "the same
  commander," so commander damage needs target-player identity. CR 401.1,
  402.1, and 404.1 also become per-player operations once an opponent can draw,
  mill, discard, or search.
- Tradeoff: This is the honest rules model and gives a direct path to
  `opponents: PlayerId[]`, per-player private zones, per-player defeat, and
  commander damage shaped as target player -> source commander -> amount. The
  cost is UI and compatibility work: current `opponentLife` labels and
  commander-damage labels need a bridge to stable player ids.
- Commander-damage path: Future exact shape should be target-player keyed and
  source-commander keyed. The source key should be a stable commander identity
  over the game, not a transient object id, because CR 903.10a counts damage by
  the same commander over the course of the game.

Option B: keep the current `opponentLife` label model and do not store opponent
zones.

- CR grounding: This can only remain a product/UI compatibility layer, not a
  CR-complete model, because CR 400.1 requires each player to have library,
  hand, and graveyard. It also cannot express CR 903.10a for multiple target
  players because labels are not player identities.
- Tradeoff: It preserves existing UI and tests with minimal work, but it blocks
  per-player draw/mill/search and keeps commander damage in the current P1-only
  advisory boundary.

Recommended default for judge review: Option A. Keep `OPPONENT_A` as the first
default opponent id and bridge it to the existing label `対戦相手A` while migrating.
Do not delete `opponentLife` in the same slice; treat it as a compatibility
view until per-player life/defeat is separately frozen.

### Fork 3: Legacy Snapshot Backfill

Option A: lossless P1 backfill from legacy flat zones.

- CR grounding: CR 400.1 allows a single-player snapshot to be represented as
  P1's library/hand/graveyard, and CR 401.1, 402.1, and 404.1 identify those
  zone meanings for that player. CR 108.3 / 111.2 provide owner ids, but legacy
  snapshots may have no explicit owner and current restore logic already
  backfills missing card owners to P1.
- Tradeoff: This preserves old snapshots exactly: legacy `zones.library`,
  `zones.hand`, and `zones.graveyard` are copied into `zonesByPlayer.P1`, all
  opponent private zones start empty, and no card is moved between players
  during restore. The cost is that a malformed or partially future snapshot
  containing an opponent-owned card in a flat P1 private zone is not "CR-repaired"
  during restore. The next real zone-change command must apply CR 400.3.

Option B: owner-partition backfill.

- CR grounding: CR 400.3 says private-zone destinations belong to the object's
  owner, so legacy flat private zones could be partitioned by each card's
  `ownerId`.
- Tradeoff: This produces a more CR-shaped state for mixed-owner snapshots, but
  it changes visible zone contents during restore and risks breaking existing
  review/golden cases that assume old P1 arrays are preserved. It also depends
  on legacy owner data being trustworthy, which is not true for pre-M2
  snapshots backfilled to P1.

Recommended default for judge review: Option A. Snapshot normalization should
be preservation-first. It must not infer opponent private-zone contents from
legacy flat data unless a later judge-approved migration explicitly opts into
that repair.

### Fork 4: Migration Stage

Option A: progressive migration with flat `zones` as P1 private-zone mirror.

- CR grounding: The final model still satisfies CR 400.1 by storing
  player-specific library/hand/graveyard in `zonesByPlayer`, and CR 400.3 by
  routing future private-zone moves to the owner. The mirror is an app
  compatibility surface, not an extra CR zone.
- Tradeoff: This minimizes blast radius. Existing review tests, golden replay,
  UI selectors, and store helpers can keep reading `zones.library` while new
  code moves to player-aware helpers. The cost is a temporary mirror invariant:
  `zones.library`/`hand`/`graveyard` must equal `zonesByPlayer.P1` until the
  mirror is retired.

Option B: full cutover.

- CR grounding: A full cutover can be equally CR-correct if every private-zone
  read/write becomes player-aware and shared zones remain shared per CR 400.1.
- Tradeoff: This is cleaner long-term but has high regression risk because many
  current commands and tests read flat `zones` directly. It also makes review
  harder by combining storage migration, command migration, golden migration,
  and snapshot migration in one slice.

Recommended default for judge review: Option A. Defer full removal of flat P1
private-zone aliases until after command paths, golden replay, and reviewer
properties have moved to player-aware helpers.

## 3. Design Invariant Candidates

Existing `docs/engine-spec.md` reserves I14 for event determinism, I15 for
effective-characteristics purity, and I16 for forward compatibility. The
following are S-ZONES candidates in the same I14+ family; exact numbering should
be chosen by the judge when promoting to `engine-spec`.

- S-ZONES-I17, owner presence: Every stored card/object that can appear in a
  zone has an `ownerId`; tokens also have an owner. Grounding: CR 108.3,
  CR 111.2, and CR 400.3. Candidate checks: extend
  `src/engine/__tests__/review.properties.test.ts` so random post-command states
  reject zoned cards without an owner; add a CR-grounded restore case in
  `src/store/__tests__/crGrounding.test.ts` for legacy owner backfill.

- S-ZONES-I18, private-zone owner routing: After any non-legacy zone-change
  into library, hand, or graveyard, the card id appears in
  `zonesByPlayer[ownerId][zone]`, not in another player's private zone.
  Grounding: CR 400.3 and CR 400.6. Candidate checks: reviewer-owned
  `review.s-zones-player-specific.test.ts` cases for moving an
  opponent-owned card to "P1 graveyard" and verifying it lands in the owner's
  graveyard; golden candidate `cr-owner-routing-to-owner-graveyard`.

- S-ZONES-I19, private zones are disjoint and shared zones are separate: A card
  id appears at most once across all player-specific private zones and shared
  zones; no id appears in two players' libraries/hands/graveyards at once.
  Grounding: CR 400.1's zone model and existing I1 zone/card consistency.
  Candidate checks: refactor the I1 property in
  `review.properties.test.ts` to flatten `zonesByPlayer` plus shared zones;
  add focused restore tests for duplicate prevention.

- S-ZONES-I20, P1 mirror consistency during migration: While flat private-zone
  aliases exist, `zones.library`, `zones.hand`, and `zones.graveyard` equal
  `zonesByPlayer.P1.library`, `.hand`, and `.graveyard`. Grounding: CR 400.1
  for the final model; this invariant is a migration safety rule, not a
  separate CR claim. Candidate checks: property test after arbitrary commands;
  store restore test that legacy snapshots produce matching P1 mirror arrays.

- S-ZONES-I21, backfill preservation: Restoring a pre-S-ZONES snapshot without
  `zonesByPlayer` preserves legacy P1 library/hand/graveyard contents exactly,
  with no disappearance or duplication, and creates empty private zones for
  known opponents. Grounding: CR 400.1, 401.1, 402.1, 404.1, plus project
  `[[snapshot-forward-compat]]`. Candidate checks:
  `crGrounding.test.ts` restore case and golden candidate
  `cr-player-zones-backfill-preserves-p1-flat-zones`.

- S-ZONES-I22, commander damage target/source separability once exact damage is
  introduced: A commander-damage threshold is evaluated per target player and
  per stable source commander, with no label or opponent aggregation. Grounding:
  CR 903.10a. Candidate checks: future reviewer-owned extension of
  `review.903-10a.test.ts` for `P1` and `OPPONENT_A` as distinct targets;
  golden candidates `cr-903-10a-targets-not-aggregated` and
  `cr-903-10a-sources-not-aggregated`.

- S-ZONES-I23, per-player draw/mill/search target isolation once those commands
  are made player-aware: Drawing from P1's library does not mutate an
  opponent's library, and milling an opponent uses that opponent's library and
  owner-routed graveyard. Grounding: CR 400.1, 401.1, 402.1, 404.1, and
  CR 400.3. Candidate checks: future CR-grounding golden cases for P1 draw,
  opponent draw, P1 mill, opponent mill, and owner-routed mill of a card owned
  by another player.

## 4. Backfill Discipline

- Normalize card ownership before validating S-ZONES invariants. Missing
  `CardInstance.ownerId` must be backfilled to P1 under the existing M2 rule
  before any owner-routing invariant is evaluated. Grounding: CR 108.3,
  CR 111.2, and CR 400.3.

- For snapshots with no `zonesByPlayer`, use preservation-first P1 backfill:
  legacy `zones.library`, `zones.hand`, and `zones.graveyard` become
  `zonesByPlayer.P1.library`, `.hand`, and `.graveyard` in the same order.
  Known opponents get empty library/hand/graveyard arrays. Grounding: CR 400.1,
  401.1, 402.1, 404.1; project `[[snapshot-forward-compat]]`.

- During the progressive migration, rebuild the flat P1 private-zone mirror from
  `zonesByPlayer.P1` after normalization. Shared flat zones remain the storage
  for battlefield, stack, exile, and command until or unless a later design
  creates a separate `sharedZones` field. Grounding: CR 400.1.

- Do not silently partition legacy flat private zones by `ownerId` under the
  recommended default. That would be closer to CR 400.3 for malformed mixed-owner
  snapshots, but it is not lossless and can change old saved games. The
  recommended restore rule is to preserve old P1 contents, then require future
  zone-change commands to enforce CR 400.3.

- If `zonesByPlayer` exists but is missing a known player or a private zone,
  fill the missing arrays with empty arrays rather than leaving `undefined`.
  This is the same failure mode as prior zone additions: absent arrays crash
  old snapshots. Grounding: project `[[snapshot-forward-compat]]`, with CR 400.1
  defining which private zones must exist per player.

- If both `zonesByPlayer.P1` and legacy flat private zones exist, prefer the
  explicit `zonesByPlayer.P1` contents and rebuild the flat mirror from it.
  Rationale: once a snapshot has the new field, the player-specific field is the
  more precise CR 400.1 representation.

- Private-zone event snapshots should carry both the zone id and the private
  zone owner id. Shared-zone event snapshots may omit the zone owner. Grounding:
  CR 400.1 distinguishes private from shared zones, and CR 400.6 makes the
  zone-change event the place where the actual movement is determined.

- `CACHE_SCHEMA_VERSION` should not be part of the default design-lock. The
  project already handles optional state additions through `restoreGame`
  normalization, and `CACHE_SCHEMA_VERSION` is not a snapshot migration switch.
  Any exception should be a judge decision outside this draft.

## 5. Scope Boundaries

Do not mix the following into S-ZONES design-lock:

- Full multiplayer turn structure, turn order, active-player rotation, or
  multiplayer draw/play exceptions. S-ZONES only needs player identities for
  private zones. CR grounding for the private-zone part remains CR 400.1.

- Dummy opponent behavior or AI. Opponents becoming first-class player ids does
  not require an automated opponent pilot. CR grounding for private zones is
  CR 400.1; behavior policy is a product scope decision.

- Real per-player priority, APNAP expansion beyond existing substrate, or full
  multiplayer SBA resolution. Commander damage's future matrix is grounded in
  CR 903.10a, but the exact multiplayer loss/winner flow is outside this
  storage design-lock.

- Hidden-information UI policy for opponent hands/libraries, opponent deck
  import, opponent search UI, or reveal permissions. CR 400.2/402.3 matter for
  eventual visibility design, but S-ZONES freezes storage and owner routing only.

- Combat attribution automation for commander damage. S-ZONES should make the
  exact data shape possible; combat damage classification and source attribution
  are later work. CR grounding for the matrix remains CR 903.10a.

## 6. Skeleton for Promotion to `engine-spec` Section 34.17

If the judge accepts the recommended forks, promote the following outline to
`engine-spec` §34.17:

1. Title: `34.17 S-ZONES player-specific library/hand/graveyard`.

2. CR refs: 108.3, 111.2, 400.1, 400.3, 400.6, 401.1, 402.1, 404.1,
   903.10a.

3. State contract: Add player-specific private zones using `zonesByPlayer`.
   Library, hand, and graveyard are per player. Battlefield, stack, exile, and
   command stay shared. During migration, flat `zones.library`/`hand`/`graveyard`
   are a P1 mirror, not an independent truth. Grounding: CR 400.1, 401.1,
   402.1, 404.1.

4. Player contract: Introduce first-class opponent player ids behind the current
   label UI. The default opponent id maps to the existing `対戦相手A` label for
   compatibility. Grounding: CR 400.1 and CR 903.10a.

5. Owner-routing contract: Any move into library, hand, or graveyard resolves
   the actual destination player from the object's owner. Requested target
   player may be recorded for UI/event explanation, but actual storage follows
   owner. Grounding: CR 400.3 and CR 400.6.

6. Event/snapshot contract: Zone-change event snapshots for private zones record
   zone id plus zone owner id. Grounding: CR 400.1 and CR 400.6.

7. Snapshot-forward-compat contract: `restoreGame` normalizes missing
   `zonesByPlayer`, missing player entries, and missing private-zone arrays.
   Pre-S-ZONES flat private zones are copied to P1 without loss or duplication;
   known opponents receive empty private zones. Grounding: CR 400.1, 401.1,
   402.1, 404.1; project `[[snapshot-forward-compat]]`.

8. Invariants: Promote S-ZONES-I17 through S-ZONES-I21 immediately with the
   implementation slice. Promote S-ZONES-I22 when exact commander-damage matrix
   lands. Promote S-ZONES-I23 when per-player draw/mill/search commands land.

9. Golden/review hooks: Add CR-grounded golden cases for P1 backfill
   preservation, owner-routed graveyard move, private-zone disjointness, P1
   mirror consistency, and later commander-damage target/source separation.
   Reviewer-owned tests should live in `review.*`; implementation-owned tests
   may cover normalization helpers and non-review golden replay plumbing.

10. Scope boundary: S-ZONES freezes storage, owner routing, event metadata, and
    backfill only. Full multiplayer turn structure, dummy opponent behavior,
    actual per-player priority, AI, and combat attribution are deferred.
