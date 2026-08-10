# O4P-01L — Decision authority (lane E) draft

Status: `drafted` (domain-analysis proposal; not judge-approved, implemented, audited, or shipped)

Base: `PLAN_SHA=be3240e77e2c1cfc6be30707bbc3f052c2524b9a`

## Decision

The engine should model decision authority as a first-class, ordered, queryable
state rather than infer it from the active player or from object control. The
default decision maker is the player who is instructed to choose or act. A
player-control effect is an explicit override for the affected player's
turn-scoped decisions; it does not rewrite active-player identity, object
controllers, ownership, visibility, or the affected player's resources.

The minimum authority state is:

```ts
type PlayerId = string;
type ObjectId = string;
type DecisionAuthorityId = string;
type TurnId = string;

type AuthorityScope =
  | { kind: "full-turn"; affectedPlayer: PlayerId; turn: TurnId }
  | { kind: "pending-next-turn"; affectedPlayer: PlayerId; anchor: TurnId }
  | { kind: "decision"; decisionId: string }
  | { kind: "search"; selectorId: string };

type DecisionAuthority = {
  id: DecisionAuthorityId;
  sourceRef: ObjectId | null;
  controller: PlayerId;       // player who created/controls the effect
  affectedPlayer: PlayerId;   // player whose turn/decision is controlled
  decisionMaker: PlayerId;
  scope: AuthorityScope;
  createdAt: number;          // monotonic creation order
  status: "pending" | "active" | "expired" | "consumed";
};

type DecisionAuthorityState = {
  authorities: readonly DecisionAuthority[];
};
```

`createdAt` (or an equivalent immutable sequence) is the only precedence key:
for overlapping authorities over the same affected player and scope, the
last-created authority wins. Do not sort, merge, or mutate the input list.
Queries select the latest applicable record after filtering by scope and
lifecycle. A consumed decision-specific or search-specific record is not
reused. A full-turn record remains active for the entire affected turn and
expires at the beginning of the following turn; a pending-next-turn record is
activated only by the next turn that affected player actually takes.

## Authority roles and invariants

* **Actor** is the player who performs the game action. For an ordinary action
  this is the decision maker; it is not necessarily the active player.
* **Decision maker** is the player who must make the choice or announcement at
  that point. Resolve this through the authority query for the concrete
  decision, not from the source controller alone.
* **Controlled player** is the `affectedPlayer` of a player-control effect.
  Control delegates that player's decisions during the applicable turn; it
  does not transfer control of permanents, spells, abilities, or resources.
* **Active player** is unchanged: it remains the player whose turn it is. This
  matters for APNAP ordering even when another player makes choices on the
  active player's behalf.
* **Object controller** is unchanged. A permanent or spell retains its own
  controller, and an activated/triggered ability retains the controller fixed
  by its activation/trigger event. Only the object controller (or owner when
  no controller exists) may activate an activated ability unless the object
  says otherwise.
* **Source reference** identifies the effect that established authority. It is
  provenance only; source removal does not by itself cancel an already-created
  ability/effect.
* A controlled player's mana, life, hand, library, graveyard, permanents, and
  other resources remain that player's resources. The decision-maker may make
  choices for the controlled player but does not become their owner or
  controller.

These distinctions follow CR 102.1, 109.4–109.5, 110.2, 112.2, 113.8,
602.2/602.2a, and 723.1. CR 602.2 is especially important: activating an
ability is normally restricted to the object's controller (or owner if it has
no controller), so player control cannot be treated as a universal permission
to activate opponents' objects.

## Ordered query contract

Queries should be pure and deterministic:

```ts
resolveDecisionMaker(state, {
  decisionId,
  kind,
  affectedPlayer,
  turnId,
  activePlayer,
}): PlayerId

resolveActor(state, decision): PlayerId
canActivate(state, { actor, objectId }): boolean
canAccessHiddenInformation(state, { player, zone, objectId }): boolean
resolveSearchSelector(state, { selectorId, searchingPlayer, zone, criteria }):
  SearchSelector
```

Resolution order:

1. Reject non-game choices: concession, tournament penalty/judge choice, and
   other external match administration are not game decision authority.
2. Establish the rules-instructed player. For a controller-owned decision this
   is the relevant object/ability controller; for an explicit “target player”
   or “that player” instruction it is that named player; for simultaneous
   choices apply APNAP (CR 101.4–101.4d).
3. Apply a matching decision-specific authority, then a matching
   search-specific authority, then an active full-turn authority. Within one
   scope, choose the greatest `createdAt`.
4. If no override applies, the instructed player is both decision maker and
   actor. A controlled-player override changes the decision maker/actor for
   the delegated choice only; it does not change `activePlayer` or the
   controller fields used by rules 109–113.
5. Record the authority consumption for a one-shot decision/search selector;
   do not consume a full-turn authority.

The implementation must not silently use “last authority globally.” It must
filter by affected player, scope, turn/selector identity, lifecycle, and (for
APNAP) the current choice instance before applying last-created-wins.

## Scope and lifecycle

* **Full turn:** a player-control effect created for “that player's next turn”
  is pending until that player actually takes that turn, then covers the
  entire turn and ends at the beginning of the next turn (CR 723.1).
* **Pending next turn:** if the affected player's next scheduled turn is
  skipped, the authority remains pending. It binds to the first later turn the
  player actually takes, not to the skipped turn (CR 723.1b, 614.10–614.10b).
* **Decision-specific:** an explicit effect may delegate one choice or one
  announcement. It is active only for that decision instance and is consumed
  once the decision is completed or becomes impossible.
* **Search-specific:** a search selector is a decision instance with its own
  identity. Its authority determines who selects cards, while search visibility
  determines which cards that player may inspect or find. It must not grant
  access to another player's hidden zone.
* **Turn activation/expiry:** activate pending authority at the turn-start
  boundary, before decisions in that turn; expire full-turn authority at the
  beginning of the next turn. Ending a turn skips the intervening phases/steps
  and goes to cleanup but does not create a new turn (CR 724.1d–724.1f).
  Cleanup ending is therefore not a turn-authority reset except for the normal
  turn boundary.
* **Last-created authority wins:** overlapping player-control effects for the
  same affected player overwrite one another; the most recently created one
  works (CR 723.1a). A later narrower decision/search authority should win
  only for its matching decision/search scope, not erase unrelated full-turn
  state.

## Search and visibility

Search authority and information access are separate predicates. CR 701.23a
allows the searching player to look at every card in the searched zone,
including a hidden zone; CR 701.23b–d defines when finding is optional or
required; CR 701.23e controls whether found cards are revealed; CR 701.23i
uses APNAP for simultaneous searches; and CR 701.23j permits a player to
choose an appropriate card they own from outside the game when the effect
explicitly searches outside the game.

The selector query must therefore return at least:

```ts
type SearchSelector = {
  decisionMaker: PlayerId;
  searchableZone: "own-library" | "named-library" | "outside-game" | "other";
  canInspect: boolean;
  mayFind: "optional-quality" | "required-quantity" | "none";
  revealFound: boolean;
  eligibleOwner?: PlayerId;
};
```

`canInspect` is true only for the player authorized by the search instruction
and the applicable visibility rule. Libraries and hands remain hidden zones
(CR 400.2, 401.2, 402.3); public-zone visibility is not a substitute for
decision authority. A player-control effect may cause the controller to make
the controlled player's search choice, but it does not make the controller
the owner of the library, reveal another player's hand, or broaden an
outside-game search beyond cards the effect and CR permit. Outside the game is
not a zone (CR 400.11), and cards there cannot be affected except for the
limited exceptions in CR 400.11c.

## Explicit exclusions and manual boundaries

* Concession is always an immediate player choice and is excluded from this
  authority substrate (CR 101.1, 405.6g, 104.3a). Do not model it as a
  controller-owned in-game decision.
* Tournament administration, judge penalties, intentional draws, and
  tournament/judge choices are outside the game engine. CR 100.6 and 104.3k
  identify tournament rules and judge penalties; CR 104.4i identifies an
  intentional draw. These require a manual/external match boundary.
* Choices involving hidden physical information, simultaneous multi-player
  paper handling, unclear card wording, or a player-control effect whose
  affected turn cannot be identified remain guided/manual until an executable
  replay can prove the resulting `GameState`.
* APNAP ordering is represented as an ordered choice queue, but nested choices
  that restart APNAP (CR 101.4d), replacement effects that alter the event,
  and non-Commander variants are not claimed automated by this draft unless a
  replay fixture covers them.
* This draft does not define priority, ownership transfer, object-control
  effects, team-turn authority, range-of-influence exceptions, or a complete
  Oracle parser. Those are separate contracts; they may consume these queries
  but must not be inferred here.

## CR authority index

Primary grounding: CR 100.6, 101.1–101.4d, 102.1, 108.3–108.4a,
109.4–109.5, 110.2, 112.2, 113.8, 400.2, 400.11–400.11c, 401.2, 402.3,
405.4, 405.6g, 601.2a–i, 602.2–602.2b, 603.7d–603.7g, 614.10–614.10b,
701.20a/e, 701.23a–j, 723.1–723.1b, 724.1a–f, 104.3a/k, and 104.4i.

The pinned CR is the deterministic authority. Oracle text and product
acceptance cases may supply concrete decision instructions, but cannot weaken
the distinctions or exclusions above.
