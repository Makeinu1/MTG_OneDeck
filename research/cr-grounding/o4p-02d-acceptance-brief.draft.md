# O4P-02D judge-owned acceptance brief

Milestone: `O4P-02D`

Base SHA: `84edd7e0639d7f7ec4e239f5e522ca8fa5815af8`

Authority:
`research/cr-grounding/o4p-02d-audience-projection.contract.draft.md`

The acceptance author is the judge, not the implementer. Judge evidence is
reserved and may not be changed by the implementation lane.

## Required executable scenarios

1. Project one active four-player protocol state to each Player, one Table,
   and one Spectator. Assert exact versions/roles/revisions, capability-free
   Room allowlists, deep freeze, input non-mutation, and Table/Spectator game
   byte parity.
2. Seed unique card-name/face/oracle/definition/physical/object sentinels in
   each hand and library. Assert only the owning player sees its hand identity;
   no player sees a library by default; observers see neither; unauthorized
   entries have no object/definition/physical/runtime field.
3. Assert face-up public objects are visible to all audiences; face-down
   battlefield/stack objects expose identity only to effective controller;
   face-down exile requires an applicable grant. Other audiences receive only
   the closed concealed public-zone shape with no definition/owner/controller.
4. Exercise object, zone, and top-library VisibilityGrants. Player look is
   player-specific; all-player reveal reaches Player/Table/Spectator; observer
   look never does. Assert filtered grant order and omission of grant key,
   source object, and source-bound duration ID.
5. Open a SearchSession with distinct rules actor and selector. Assert only
   the actor, selector, or exact applicable decision maker receives its ID,
   criteria, flags, and every ordered visible candidate. All other projections
   reveal no session existence/count/candidate.
6. Apply decision authority and matching/nonmatching request contexts. Assert
   controlled-player private information appears only for the exact matching
   in-game context and disappears for null, wrong key/session/turn, observers,
   and outside-scope requests.
7. Add object and top-library PlayPermissions. Assert only the allowed player
   or exact decision maker receives currently attemptable permissions; hidden
   top identity stays null without independent visibility; stale-zone,
   face-down-exile-without-visibility, and observer permission surfaces are
   empty. Assert no false full-legality claim.
8. Assert normalized visible/concealed runtime: public counters/damage/tap/
   phase and safe attachment, visible face index only when identity is visible,
   and concealed attachment when a target handle is not public.
9. Authenticate all three roles, reject wrong/cross-role capabilities with the
   same generic shape, and reconnect one player and one observer. Assert only
   presence changes; Core digest, revision, receipt history, roles, seats, and
   outcomes remain unchanged.
10. Falsify request and projection validation with ownKeys/descriptor traps,
    accessors, non-enumerable/symbol fields, non-ordinary prototypes, sparse/
    extra-property arrays, invalid IDs/integers/literals, duplicate handles,
    count/order/role/seat drift, invalid runtime/definition/subject/duration,
    and search-candidate coverage drift. Assert deterministic complete frozen
    issues, no getter execution, raw throw, or caller mutation.
11. Serialize every failed validation result, accepted/rejected response,
    typed operation error, and returned log. Assert absence of every configured
    capability literal/substring, unauthorized hidden sentinel, Core/Room issue/event/
    warning text, command/receipt/digest, physical-card/hidden-definition ID,
    raw error, and stack. Inject a configured capability into a would-be public
    Core string and assert generic fail-closed `PROJECTION_REJECTED`.
12. Architecture evidence allows only public Core/Room/protocol/versioning
    imports, rejects reducer/mutation imports including aliases/namespaces/
    dynamic forms, prevents reverse dependencies and root Online barrel, and
    permits only `architecture`, `room`, `protocol`, and `projection` below
    `src/online`.
13. Projection fixture/verifier/domain evidence is non-vacuous. Existing
    O4P-01L/O4P-01N/O4P-02A/B/C verifiers and Solo compatibility remain green.

## Judge-owned evidence paths

- `src/online/projection/__tests__/review.o4p-02d-audience-projection.test.ts`
- `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts`
- `src/online/projection/fixtures/o4p-02d-audience-projection-v1.json`
- `scripts/checks/verify-online-audience-projection.ts`

These files and their registrations are outside implementer write scope.
