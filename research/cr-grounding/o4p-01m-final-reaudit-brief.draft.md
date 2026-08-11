# O4P-01M final replacement cold-audit brief

- Milestone: `O4P-01M`
- Base SHA: `1d5a75a60bc6f13a4ed6fd3daf7687e2ed4a0dcf`
- Candidate fingerprint: `0880024d47613157f4a3ea69c76873ae57c06ee0a1bd09e881896d549e57b00e`
- Contract: `research/cr-grounding/o4p-01m-commander-combat-player-exit.contract.draft.md`
- Profile: `STANDARD`; findings only; do not run the release `npm run check`

Read `.claude/audit-standing.md` first and follow it exactly. Do not edit any
file and do not delegate. Verify the orchestrator-provided candidate fingerprint
yourself before reviewing semantics.

Recompute the fingerprint from the repository root with this exact command.
The exclusions are the brief itself, superseded historical audit records, and
the unrelated forward plan; all semantic candidate, contract, ledger, review,
generated API, registration, and TypeScript-project files remain included.

```sh
set -o pipefail
candidate_files="$(
  {
    git diff --name-only --diff-filter=ACMRTUXB HEAD
    git ls-files --others --exclude-standard
  } |
  LC_ALL=C sort -u |
  rg -v '^(research/cr-grounding/o4p-01m-final-reaudit-brief\.draft\.md|research/cr-grounding/o4p-01n-to-02e-forward-plan\.draft\.md|research/cr-grounding/archive/o4p-01m-cold-audit-record-2026-08-11-(final|microcandidate)\.md)$'
)"
printf '%s\n' "$candidate_files" |
while IFS= read -r file; do
  [ -n "$file" ] || continue
  printf '%s\0' "$file"
  shasum -a 256 "$file" | awk '{printf "%s", $1}'
  printf '\0'
done |
shasum -a 256 |
awk '{print $1}'
```

## Candidate scope

- `src/engine/core/commander/**`
- `src/engine/core/combat/**`
- `src/engine/core/player-lifecycle/**`
- the O4P-01M ordinary and judge-owned review tests under
  `src/engine/core/__tests__/`
- `src/engine/core/index.ts`
- `src/engine/core/fixtures/o4p-01m-commander-combat-player-exit-v1.json`
- `scripts/checks/verify-mode-neutral-core-commander-combat-player-exit.ts`
- `tsconfig.node.json` only for strict verifier type/lint registration
- `package.json`, `scripts/checks/machine-checks.mjs`, and
  `scripts/__tests__/machine-checks.test.mjs` only for exact verifier
  registration
- `src/test/architecture/modeNeutralCoreBoundary.test.ts` and
  `src/test/architecture/review.o4p-01m-commander-combat-player-exit-boundary.test.ts`
- `docs/generated/engine-api.md`
- the O4P-01M contract, grounding, implementation brief, orchestration plan,
  and audit records under `research/cr-grounding/`

`research/cr-grounding/o4p-01n-to-02e-forward-plan.draft.md` is an unrelated
read-only future plan. Confirm it does not claim O4P-01M shipped and do not use
it as contract authority.

## Specific adversarial checks

1. Confirm every O4P-01M input is strictly validated before branded Core IDs or
   numeric damage are used. Reject accessors, unknown keys, malformed IDs,
   duplicates, sparse/non-ordinary arrays, unsafe integers, proxy/prototype/
   descriptor traps, and forged mutable state without getter execution, raw
   errors, or partial output. Issues must be frozen and path-then-code sorted.
2. Confirm physical Commander identity, command-zone-only tax, typed 903.9a/b
   choice, independent Commander/defender cells, and provenance-only 21-damage
   threshold match the frozen contract. Provenance construction and recording
   must reject an unsafe cumulative total for the exact Commander/defender
   cell, while an unrelated saturated cell must not reject a safe update.
   Damage and cast-count inputs must reject negative zero while canonical
   positive zero remains accepted and JSON-round-trippable.
3. Confirm `CoreCombatContextV1` is the sole combat authority and the deleted
   assignment API has no root export. Confirm combatId/positive turnNumber,
   one defender per unique attacker, attacker/controller/defender relations,
   declare-attacker/blocker step gates, no backward step, block-to-attack
   relation, stable controller/defender identity when one blocker blocks
   multiple attackers, and deterministic player-exit pruning. It remains
   structural and does not claim damage, SBA, turn, or priority mutation.
4. Confirm lifecycle entries are exactly active/exited plus null or typed exit
   cause. Confirm the three-input atomic reconciliation validates lifecycle,
   reference bundle, and request together; returns the updated lifecycle,
   surviving turn order, active/priority result, disjoint CR 800.4 object
   cleanup, and control/decision/SearchSession cleanup. `searchSessionIds`
   means the shipped Core rules-domain SearchSession, not transport metadata.
   The three rule-domain cleanup-key collections must reuse the shipped
   `CoreRuleKeyV1` validator and reject unsafe record keys.
5. Confirm no Core disconnect, connection, Room, protocol, projection, UI,
   clock, hidden PRNG, Solo snapshot, generic patch, or command/event/replay
   authority was introduced.
6. Confirm four Commanders and the fixture version are present, the standalone
   verifier consumes only the public Core root, machine-check registration is
   exact, the verifier is in `tsconfig.node.json`, and generated API is current.
   DEFER proof must derive from `Object.keys(Core)` and exact runtime result
   shapes; a repeated constant is not proof.
7. Inspect test deletion lines and assertion strength. Perform a bounded
   vacuity probe where safe and restore byte-identically.
8. Confirm maximum-length sparse arrays fail promptly in combat and both
   player-lifecycle readers without looping over declared length. Dense arrays
   must retain order, and descriptor/getter/trap safety must remain intact.

## Required commands

```sh
npm run codex:context -- --domain O4P-01M
npm run check:forbidden -- --diff HEAD
npm exec vitest -- run src/engine/core/__tests__/review.o4p-01m-commander-combat-player-exit.test.ts src/test/architecture/review.o4p-01m-commander-combat-player-exit-boundary.test.ts scripts/__tests__/machine-checks.test.mjs src/test/architecture/modeNeutralCoreBoundary.test.ts
npm run verify:mode-neutral-core-commander-combat-player-exit
npm run generate:docs-api -- --check
git diff --check
```

The forbidden scan is expected to identify the two new `review.*` files because
the scanner enforces implementer ownership mechanically. Those files were
authored by the seated judge. Verify that fact from scope and report any other
hard `FORBIDDEN` path as a finding; do not silently dismiss it.

`npm run check:docs` is not a required pre-commit audit command. The generated
API freshness subcheck passes, while its manifest `lastVerifiedCommit` remains
stale by design until a candidate commit exists. Do not treat that expected
pre-commit metadata state as semantic green or as a code finding.

## Verdict

Return only reachable findings with severity and exact `file:line`. A clean
verdict must state `BLOCKER/HIGH: 0` and
`AUDIT-OK-PENDING-FULL-CHECK`; it is not ship approval. Any candidate change,
failed required command, missing proof, or restored-vacuity mismatch prevents a
clean verdict.
