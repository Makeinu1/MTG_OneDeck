# O4P-01N repair wave 2 brief

Role: final bounded return to the same Luna implementer. This is not a new
implementation lane, contract-author task, audit, integration, or release task.

Base SHA: `435b691b63492ebb66389cfa37c8a5a3d6d102b4`

Frozen authority:

- `research/cr-grounding/o4p-01n-mode-neutral-core-closure.contract.draft.md`,
  including amendments 8 and 9
- `research/cr-grounding/o4p-01n-acceptance-brief.draft.md`

Allowed writes remain exactly:

- `src/engine/core/closure/**`
- ordinary tests under `src/engine/core/closure/__tests__/**`

Do not edit judge-owned drafts. Do not perform git operations.

## Findings to close

### BLOCKER N-R2-01 player exit deletes historical damage authority

The shipped Object Registry validator requires `registry.players`,
`zones.byPlayer`, and `turnOrder` to be the same active-participant set.
Accordingly, keep the current removal of P4 from all three structures and keep
root validation comparing that registry set with lifecycle-active entries.
Do not edit or widen the shipped registry validator.

The remaining defect is filtering Commander-damage and provenance
defending-player allowlists and historical entries to surviving turn order.
Those histories are keyed to the stable full lifecycle roster. Preserve both
allowlists and all existing records across player exit. Root validation must
compare both player allowlists with the complete lifecycle roster, not registry
turn order. Add a test proving P4 remains in lifecycle with `status: exited`,
is absent from registry players/turn order/player-zone keys, and remains in
both damage allowlists with historical entries preserved.
Because the allowlist remains historical, the `commander-damage-record`
adapter must separately reject a defending player whose lifecycle status is
already exited; preservation of history is not permission to add new damage to
an inactive defender.

### HIGH N-R2-02 replay sequence rejects a valid rejected-command journal

`validateCoreReplayPackageV1` currently advances expected sequence by journal
index. Rejected commands do not advance `acceptedCommandCount`; therefore a
following accepted command correctly reuses the rejected command's sequence.

Validate each entry against `initial acceptedCommandCount + prior accepted or
accepted-with-warning entries + 1`. A rejected entry does not advance the
expected value. Add a round-trip package with rejected then accepted commands
sharing the same sequence, plus a truly stale/gapped negative case.

### HIGH N-R2-03 search-open selector authority is not verified

Before accepting `search-open`, verify both:

- envelope actor equals `input.rulesActorPlayerId`; and
- the session produced by `openCoreSearchSessionV1` has
  `selectorPlayerId === command.decisionMakerPlayerId`.

Reject a mismatch atomically with a stable typed issue and no event. Do not
duplicate or replace the shipped selector algorithm.

### HIGH N-R2-04 four-player authority and replay proof remain incomplete

The current helper always makes actor and decision maker equal, the random
vector has a one-element no-op order, replay only matches final-state digest,
and no random-payload tamper is exercised.

Extend the ordinary four-player vector to prove all of the following:

- install a shipped scoped decision authority and execute at least one
  accepted command with different actor and decision maker; use search-open so
  the produced selector proves the separation;
- use an actual permutation of at least two object IDs;
- assert replay final-state digest and event-transcript digest both equal the
  live closure values;
- tamper the recorded random order and assert typed package rejection or first
  deterministic divergence;
- retain the exact DEFER list and full 15-payload coverage.

### HIGH N-R2-05 remaining actor bindings lack explicit V1 proof

Add focused acceptance/reject tests for bindings represented in current
payloads:

- stack commit actor equals `input.controllerPlayerId`;
- Commander cast actor equals the registered Commander owner;
- combat attack actor equals `attackerControllerPlayerId`;
- combat block actor equals `blockerControllerPlayerId`;
- player-zone random order actor equals the zone player.

For stack removal, combat-step, control-effect, Commander-damage recording, and
shared-zone random order, the closed V1 payload has no independent rules-actor
field. Keep their authority boundary as active actor plus the shipped decision
authority query and explicitly test/document that boundary; do not invent a new
field or stronger rule authority.

### HIGH N-R2-06 correction reason metadata leak

`manual-correction-applied` currently exposes `reasonLength`. The frozen
contract keeps the supplied reason only in the authoritative command journal;
derived length is also reason metadata and must not appear in events, warnings,
issues, or log-facing output. Remove `reasonLength` from the event payload and
assert that two different non-empty reasons produce byte-identical safe event
payload shapes apart from command-envelope evidence that is independent of the
reason. The journal command must continue to retain the exact untrimmed reason.

### HIGH N-R2-07 command validator conflates identifier domains

`commandV1.ts` currently uses one permissive ID regex containing `:` and `@`
for player IDs, physical-card IDs, object IDs, and rule keys. This permits a
structurally invalid typed command to pass validation and defers rejection to a
shipped operation.

Use the shipped domain validators at the command boundary: `isCoreBaseId` for
player and physical-card IDs, `isCanonicalCoreObjectIdV2` for object IDs, and
`validateCoreRuleKeyV1` for rule/session/decision/random IDs including unsafe
record-key rejection. Keep operation-dependent validation in the shipped
operation, but do not conflate identifier grammars. Add representative negative
tests for `@`/`:` player or rule IDs and non-canonical object IDs.

## Required checks

- all ordinary closure tests
- targeted ESLint for `src/engine/core/closure/**`
- `npm run build`
- `git diff --check`
- exact changed-file and forbidden-path comparison against the Base SHA

Do not run full `npm run check`, change public payloads/root fields/versions,
edit judge-owned paths, or perform git operations.

Return the normal implementation packet plus a finding-by-finding closure table
for N-R2-01 through N-R2-07. STOP if a fix requires a new payload kind, root
field, version, dependency, or write outside the lane.
