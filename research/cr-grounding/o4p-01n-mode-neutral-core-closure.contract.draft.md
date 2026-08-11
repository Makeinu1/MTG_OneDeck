# O4P-01N Mode-Neutral Core closure contract

Status: frozen by the Sol judge for bounded implementation on 2026-08-12.

Base SHA: `435b691b63492ebb66389cfa37c8a5a3d6d102b4`

Grounding:
`research/cr-grounding/o4p-01n-to-02e-forward-plan.draft.md`

## Purpose and authority

O4P-01N closes O4P-01 by composing the shipped O4P-01J/K/L/M value objects
behind one immutable Core root and one typed deterministic command boundary.
The command reducer is the sole state-transition authority. Domain events are
ordered derived evidence and MUST NOT be accepted as a second state reducer.

The completed milestone must execute, save, load, and replay a four-player
Commander MVP in one process. It introduces no Room, participant, seat,
connection, network, Cloudflare, WebSocket, projection, UI, or Solo snapshot
authority.

## Version boundary

The closure owns a deeply frozen `CoreClosureVersionVectorV1` with these exact
independent fields, all equal to `1` in this milestone:

- `coreStateSchemaVersion`
- `coreCommandSchemaVersion`
- `coreEventSchemaVersion`
- `coreReplaySchemaVersion`

These values do not replace or mutate Solo `SNAPSHOT_VERSION`, shared
`stateSchemaVersion`, `eventSchemaVersion`, future `protocolVersion`, future
`projectionSchemaVersion`, ruleset metadata, or Build ID. No existing version
is bumped by the implementer lane.

## Root state

Public name: `ModeNeutralCoreRootV1`.

The root is an exact-record value with these fields in this canonical order:

1. `kind: 'mode-neutral-core-root-v1'`
2. `versions: CoreClosureVersionVectorV1`
3. `acceptedCommandCount: number`
4. `ruleAuthority: CoreRuleAuthorityBundleV1`
5. `playerLifecycle: CorePlayerLifecycleStateV1`
6. `commanders: readonly CoreCommanderIdentityV1[]`
7. `commanderCastLedgers: readonly CoreCommanderCastLedgerV1[]`
8. `commanderDamage: CoreCommanderDamageStateV1`
9. `commanderDamageProvenance: CoreCommanderDamageProvenanceLedgerV1`
10. `combatContext: CoreCombatContextV1 | null`

`ruleAuthority` already nests the K turn/priority bundle, J stack transaction
bundle, object registry/runtime, stack announcements, and L control,
visibility, search, play-permission, and decision-authority slices. The root
MUST NOT duplicate those fields elsewhere.

`acceptedCommandCount` is a Core journal sequence counter. It is not a Room or
protocol revision. An accepted command requires
`command.sequence === root.acceptedCommandCount + 1` and increments the count
exactly once. A rejected command leaves it unchanged.

`createModeNeutralCoreRootV1` and `validateModeNeutralCoreRootV1` must validate
all nested shipped bundles plus these cross-slice invariants:

- registry player order, player-zone keys, and turn order contain the same
  lifecycle-active player IDs in the same order;
- the lifecycle roster remains the stable full historical player roster;
- each Commander owner exists in the full lifecycle roster; physical Commander
  IDs are unique;
- each cast ledger maps to exactly one registered Commander;
- Commander damage/provenance registries match the root Commander allowlist
  and full lifecycle player roster;
- combat attacker/defenders are lifecycle-active and registered;
- no field is optional and no unknown field is accepted.

Successful creation/validation returns a fresh deeply frozen canonical value.
Validation is trap-safe, reports deterministic complete frozen issues ordered
by code-unit path then code, and never mutates, sorts, trims, deduplicates,
merges, or deletes supplied array entries.

## Typed command envelope

Public name: `CoreCommandV1`.

Every command is an exact record:

```ts
type CoreCommandV1 = Readonly<{
  kind: 'mode-neutral-core-command-v1';
  schemaVersion: 1;
  sequence: number;
  actorPlayerId: CorePlayerId;
  decisionMakerPlayerId: CorePlayerId;
  decisionContext: CoreDecisionContextV1;
  payload: CoreCommandPayloadV1;
}>;
```

`actorPlayerId` is the rules-side player whose action or decision is being
performed. `decisionMakerPlayerId` is the person currently authorized to make
that decision. For every accepted command it must equal
`coreDecisionMakerForV1(root.ruleAuthority.decisionAuthorities,
actorPlayerId, decisionContext)`. Both players must exist and remain active.
No local-client, host, seat, session, connection, or transport identity may be
substituted for either field.

The closed V1 payload union contains these exact kinds:

- `stack-commit-card-spell`, carrying `CoreCardSpellCommitInputV1`;
- `stack-remove-object`, carrying `CoreStackRemovalInputV1`;
- `priority-pass`, carrying the passing player ID;
- `search-open`, carrying an explicit session key and
  `CoreSearchSessionInputV1`;
- `search-complete`, carrying a session key and ordered selected object IDs;
- `control-effect-apply`, carrying an effect key and a value validated by the
  shipped control-effect operation;
- `commander-cast-record`, carrying physical Commander ID, cast origin, and
  accepted flag;
- `commander-damage-record`, carrying physical Commander ID, defending player,
  damage amount, and combat object provenance;
- `combat-step-set`, carrying the next shipped combat step;
- `combat-attack-add`, carrying the shipped attack value;
- `combat-block-add`, carrying the shipped block value;
- `player-exit`, carrying player ID and `concession | defeat` cause;
- `random-zone-order`, carrying a random-decision ID, an exact player-library
  zone reference, the complete before-order, and the complete after-order;
- `correct-player-life`, carrying player ID, replacement life total,
  `expectedBeforeStateDigest`, and non-empty reason;
- `correct-commander-damage`, carrying physical Commander ID, defending player,
  replacement damage total, `expectedBeforeStateDigest`, and non-empty reason.

Payload data must use the existing shipped operation types where named. No
`unknown` payload escape, arbitrary path, JSON Patch, whole-state replacement,
generic callback, or open string command kind is permitted.

For `commander-damage-record`, the referenced combat object must be a current
card object whose `physicalCardId` equals the recorded physical Commander ID.
An unrelated card, token, copy, or ability object is not Commander-damage
provenance and rejects atomically.

V1 explicitly DEFERs typed adapters for retargeting, synthetic stack commit,
turn-position advance, trigger placement, SBA automation, permission mutation,
visibility mutation, replacement-layer automation, and full combat damage.
Those shipped APIs remain directly usable Core primitives but are not falsely
claimed as V1 command handlers. Adding a new payload kind requires a later
judge contract amendment.

## Command application and authority

Public entry point:

```ts
applyCoreCommandV1(
  root: ModeNeutralCoreRootV1,
  command: CoreCommandV1,
): CoreCommandResultV1
```

Application is synchronous, pure, deterministic, and atomic:

1. Validate the root and complete command before invoking a shipped operation.
2. Validate sequence and actor/decision-maker authority.
3. Invoke exactly one closed handler, except Commander damage may atomically
   update both damage state and provenance.
4. Validate the complete candidate root.
5. Return a new frozen root and ordered events only after full success.

Any validation or shipped-operation failure returns a typed rejection. It
does not throw a raw error, expose a partial candidate, increment the sequence,
or emit a semantic event. The rejected result returns the exact input root
reference. Error details may contain codes, JSON-pointer paths, and safe
messages, but MUST NOT echo arbitrary input values.

`player-exit` uses the shipped lifecycle and reconciliation operations. It must
replace the nested J/K/L/M fields according to explicit typed reconciliation;
it must not delete historical player identity, treat disconnect as exit, or
invent cleanup for a reference not covered by the shipped M contract.

`random-zone-order` is the V1 deterministic-randomness proof. The before-order
must exactly equal the current referenced zone, and after-order must be a dense
exact permutation of it. The reducer never calls `Math.random`, reads a seed,
uses time, or redraws during replay. The recorded complete outcome is the
authority.

## Results, warnings, and events

`CoreCommandResultV1` is a closed union:

- `accepted`: new root, ordered events, empty warnings, before/after digest;
- `accepted-with-warning`: new root, ordered events, one or more typed warnings,
  before/after digest;
- `rejected`: exact input root, empty events, typed issues, unchanged digest.

Only the two correction commands return `accepted-with-warning` in V1. Their
warning code is `MANUAL_CORRECTION_APPLIED`; every correction requires the
current canonical state digest to equal `expectedBeforeStateDigest`, a
non-empty untrimmed reason, valid actor/decision-maker authority, and a value
that preserves root invariants. Empty/whitespace-only reason, stale digest,
invalid target, duplicate replay, or invariant break is rejected. Correction
is replayable and never mutates an earlier snapshot.

`CoreDomainEventV1` is an immutable envelope with schema version, command
sequence, zero-based event index, actor, decision maker, and one closed payload.
The V1 event payload kinds are:

- `stack-changed`
- `priority-changed`
- `search-session-changed`
- `control-changed`
- `commander-cast-recorded`
- `commander-damage-recorded`
- `combat-changed`
- `player-exited`
- `zone-randomized`
- `manual-correction-applied`

Events describe the successful semantic change using IDs, operation kind, and
safe scalar metadata. They do not serialize the whole Core root or private
zone contents. One command may emit multiple events only where the contract
requires an atomic coupled transition; their order is fixed by the handler.
Events are derived output and never become replay input authority.

## Canonical serialization and digest

Public APIs:

- `canonicalizeModeNeutralCoreRootV1`
- `serializeModeNeutralCoreRootV1`
- `serializeCoreDomainEventsV1`
- `coreCanonicalDigestV1`

Canonicalization recursively emits exact-record fields in contract order,
preserves array order, and emits record keys in UTF-16 code-unit order. It
rejects unsupported JSON values, symbols, accessors, sparse arrays,
non-enumerable data, non-finite numbers, and prototype/descriptor traps.

`coreCanonicalDigestV1` is lowercase hexadecimal SHA-256 of UTF-8 canonical
JSON bytes. It is implemented in Core without a new dependency, Node-only
import, ambient state, or platform-specific serialization. Standard SHA-256
test vectors are mandatory. Digest equality is evidence, not authorization.

## Journal, save, load, and replay

Public names:

- `CoreCommandJournalEntryV1`
- `CoreReplayPackageV1`
- `appendCoreCommandJournalEntryV1`
- `createCoreReplayPackageV1`
- `validateCoreReplayPackageV1`
- `replayCoreCommandsV1`

The authoritative replay input is the canonical initial root plus ordered
typed commands. Journal entries also retain the canonical command digest,
result status, ordered event digest, before-state digest, and after-state
digest as audit evidence. Replay compares the recorded command digest before
applying each command, so tampering with command-only audit fields such as a
manual-correction reason reports `COMMAND_DIGEST_MISMATCH` at the first
affected journal index. Journal entries do not store events as a second
transition authority.

The replay package is an exact frozen record containing its V1 kind, closure
version vector, initial root, ordered journal entries, expected final-state
digest, and expected event-transcript digest. Loading validates every field,
version, digest, command sequence, and canonical root before replay.

Replay always invokes `applyCoreCommandV1` from the initial root. It never
rerolls randomness and never trusts stored result/event data to update state.
It fails closed with a typed divergence report at the first mismatched status,
before digest, after digest, or event digest. Successful replay returns the
final root, reconstructed ordered events, and both final digests.

## Four-player closure vectors

The ordinary headless scenario and later judge-owned fixture/verifier must use
four active players and exercise, through `applyCoreCommandV1` only:

1. initial root validation and canonical digest;
2. priority progression;
3. one stack commit and removal transaction;
4. one search-session open/complete flow with separated actor and decision
   maker;
5. one control-effect transition;
6. Commander command-zone cast count/tax;
7. multiplayer attack/block structure;
8. Commander damage plus provenance;
9. deterministic player-library permutation;
10. one accepted typed correction and one stale correction rejection;
11. concession/player exit while preserving valid surviving turn, priority,
    combat, search, control, and decision references;
12. at least one rejected ordinary command with exact root-reference
    preservation and zero events;
13. save, JSON round-trip load, deterministic replay, and equality of final
    canonical state digest and event-transcript digest.

The scenario must state that full combat-damage calculation, arbitrary manual
state mutation, network, Room, projection, and UI remain DEFERred.

## Security and structural invariants

- No `Math.random`, `Date`, timer, locale sort, environment variable, network,
  React, DOM, Zustand, Solo `GameState`/`GameCommand`, or `src/online/**` import.
- No `any`; `unknown` is accepted only at validation boundaries and narrowed
  by strict guards.
- No input mutation on success or failure.
- All accepted values, issues, warnings, journal entries, and events are fresh
  and deeply frozen.
- Dense-array and descriptor/proxy hardening follows the shipped O4P-01J–M
  validator precedent.
- Error/event payloads never echo private card definitions, full hidden-zone
  contents, or the complete root.

## Integration ownership

The Luna implementer owns only `src/engine/core/closure/**` and ordinary tests
under that directory. The Sol judge owns `src/engine/core/index.ts`, fixture,
machine verifier and registration, architecture/review evidence, generated API
manifest, active contract manifest, ledger, loop state, git, audit adjudication,
and release.

The implementation candidate remains `implemented-not-audited` until an
independent Luna cold auditor, created with `fork_context: false`, reports
BLOCKER/HIGH zero for the frozen candidate fingerprint. Full `npm run check`
follows that verdict on the same fingerprint.

## Judge amendment — first implementation review (2026-08-12)

The first Luna candidate passed its four small ordinary tests, lint, and build,
but that evidence did not cover the frozen acceptance surface. The following
clarifications are binding repair authority and do not add a payload kind or
expand the milestone.

1. Command validation is structural authority, not a TypeScript cast. Every
   nested payload record and array must be descriptor-safe, exact-field,
   recursively canonical, freshly deeply frozen, and syntactically validated
   before a shipped state operation runs. A factory must not use object spread
   on untrusted input before descriptor validation.
2. Every rejection against a valid root, including a malformed command, returns
   the real unchanged 64-character before/after state digest. Empty digest is
   not a valid rejection result.
3. Correction warning text is fixed safe text. The user-supplied reason remains
   in the authoritative command journal but is not echoed in warning, event,
   error, or log-facing metadata. The expected-before digest must itself be
   validated as lowercase 64-character SHA-256.
4. Journal entry and replay-package validation use exact fields, dense arrays,
   descriptor-safe reads, deep-frozen canonical values, and contiguous command
   sequence validation. Getter/proxy traps return typed validation issues and
   never escape as raw errors.
5. `reconcileCorePlayerExitV1` output is the sole cleanup directive authority.
   The N adapter must consume its returned lists and handoff values rather than
   recomputing different lists or choosing an arbitrary first player. Because
   the shipped object registry cannot represent `activePlayerId: null`, V1
   rejects exit of the current active player with the stable typed issue
   `ACTIVE_PLAYER_EXIT_REQUIRES_TURN_TRANSITION` and no mutation. If the
   exiting player is the current priority holder and the existing K lifecycle
   cannot be rebuilt exactly from the returned handoff without a new authority,
   V1 similarly rejects with
   `PRIORITY_HOLDER_EXIT_REQUIRES_TURN_TRANSITION`. The accepted four-player
   vector exits a non-active, non-priority player. These two cases remain an
   explicit guided/manual boundary rather than a guessed K transition.
6. Payload authority must be bound to the envelope. At minimum: priority-pass
   actor and payload player are equal; search-open actor equals
   `rulesActorPlayerId` and decision maker equals the shipped selector result;
   concession actor/decision maker equals the exiting player; correction actor
   and decision maker equal the corrected player for life, and equal the
   defending player for Commander damage. Other handlers must document and
   test their V1 actor binding rather than relying only on generic activity.
7. The ordinary four-player test is not satisfied by a generic loop containing
   one Commander-cast command. The lane must add a deterministic scenario that
   covers every V1 payload kind through a positive or intentional reject vector,
   separated actor/decision maker, random permutation, both corrections,
   non-active player exit, replay round trip, tamper divergence, exact final
   state/event digests, and the DEFER list.
8. The shipped Object Registry couples `players`, `zones.byPlayer`, and
   `turnOrder` as one active-participant set. Player exit therefore removes the
   exiting player from those three registry structures while preserving the
   complete ordered lifecycle roster as the Core historical player-identity
   authority. Commander-damage and provenance defending-player allowlists and
   historical entries remain keyed to that full lifecycle roster. Owned
   objects leave according to the shipped reconciliation directives. Root
   validation compares the active registry set with the lifecycle-active
   subset, and separately compares damage/provenance player allowlists with the
   full lifecycle roster. This is the only representation compatible with both
   the shipped O4P-01H registry validator and O4P-01M stable-roster decision;
   no shipped prerequisite is widened in O4P-01N.
9. A replay journal records rejected commands as evidence. Its expected command
   sequence is `initial acceptedCommandCount + prior accepted entries + 1`.
   A rejected entry uses that expected sequence but does not advance it, so the
   following command may legitimately reuse the same sequence.
10. `CoreCommandJournalEntryV1` contains the lowercase SHA-256
    `commandDigest` of its freshly normalized command. Entry validation checks
    its exact field and digest grammar; package creation and replay compare it
    with the canonical command before application. This is audit evidence for
    tamper detection and does not create a second command authority.
