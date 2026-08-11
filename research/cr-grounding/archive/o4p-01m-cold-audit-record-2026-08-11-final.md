# O4P-01M final cold audit record — 2026-08-11

## Candidate

The candidate contains the additive Commander identity/replacement/tax,
physical Commander damage, provenance threshold, structural combat assignment
and context, player lifecycle, player-exit reconciliation directives, Core
root exports, fixture, and ordinary closure verifier.

## Audit history

The independent audit loop first found and closed the following issues:

- unfrozen replacement and damage errors;
- unregistered Commander query accepted as zero;
- forged mutable state accepted by combat/damage operations;
- missing defending-player allowlist;
- collection sorting/merging/zero deletion;
- player lifecycle roster sorting.

Each repair was followed by targeted verification. A separate final cold
auditor reviewed the current tree after all repairs. The auditor explicitly
treated `searchSessionIds` as the existing Core domain SearchSession reference,
not as transport session or connection metadata.

## Final verdict

`PASS` — `BLOCKER/HIGH: 0`.

Judge evidence immediately before full check:

- 11 O4P-01M ordinary test files;
- 83 targeted tests passed;
- `git diff --check` passed;
- final cold auditor changed no files and reported no BLOCKER/HIGH findings.

This record authorizes the fingerprint-matched full check only. Parent ledger
shipment remains a separate judge action after full check and release evidence.

## Generated-docs re-audit

The judge synchronized `docs/generated/engine-api.md` with the normal
`npm run generate:docs-api` command. Because that changed the candidate
fingerprint, an independent Luna cold re-audit was repeated at fingerprint
`2eb8cff3e9f4faabfaf53a3a33d4d9acb4b321bb224c3ee82ec9af78431f7315`.
It returned `PASS`, with `BLOCKER/HIGH: none`, and changed no files.

## Build-gate invalidation

A subsequent judge-run `npm run build` exposed strict TypeScript failures in
the O4P-01M candidate: validated `unknown` values were not narrowed to branded
Core IDs/numbers in several Commander/combat modules, two ordinary tests widened
branded IDs to plain strings, and one ordinary test omitted explicit Vitest
imports. The earlier audit verdict therefore no longer authorizes the release
full check. The candidate returned to `audit-fix-required`; a repaired tree must
pass targeted tests and production build, receive a new fingerprint, and be
cold-audited again before any release gate or shipment claim.

## Repaired parent-closure candidate

The bounded TypeScript repair subsequently closed the build failures without a
public API or semantic change. The judge then identified and closed two parent
acceptance gaps before re-freezing the candidate:

- the fixture now carries version
  `mode-neutral-core-commander-combat-player-exit-v1` and registers four
  physical Commanders owned by the four players;
- a standalone public-root machine verifier is registered in `package.json`
  and `scripts/checks/machine-checks.mjs`;
- judge-owned behavioral and architecture `review.*` tests pin the frozen
  acceptance and purity boundaries.

Judge evidence before the replacement cold audit:

- 15 targeted files / 105 tests passed, including the two judge-owned review
  files, the machine-check harness, and the Core architecture boundary;
- `npm run verify:mode-neutral-core-commander-combat-player-exit` passed with
  four Commanders, four damage cells, provenance threshold, multiplayer combat,
  lifecycle/exit cleanup, freeze/immutability/JSON, network-authority absence,
  and explicit combat-damage/SBA DEFER evidence;
- `npm run lint`, `npm run build`, generated-API freshness, and
  `git diff --check` passed.

The forbidden-file scan reports the two new `review.*` files because that tool
cannot infer the active role. They were authored by the seated Sol judge, not
by either Luna implementer; all other reported paths are informational
`NEEDS-REAUTH` paths under the same judge/orchestrated candidate. This role
adjudication does not replace the required independent cold audit.

## Replacement cold-audit findings

The independent Luna audit verified fingerprint
`eec93d2adc1780352016bf489694b3f489e29c7bfd42e36fc761d6ff0de1705a`
and returned `BLOCKER/HIGH: 10`, `MEDIUM: 2`; release progression is rejected.
The judge accepted the reachable findings and froze the repair semantics in the
contract amendment named `replacement cold-audit adjudication`:

- one attacker was incorrectly accepted against multiple defenders;
- attack/block operations ignored step and basic participant relations;
- combat ID/turn/controller fields and deterministic exit pruning were absent;
- lifecycle lacked an explicit exited state/cause record and atomic CR 800.4
  result with surviving turn order;
- active/priority references could name non-eligible players;
- non-card stack kinds and cleanup-category precedence were not enforced;
- sparse/accessor arrays and prototype/descriptor traps could bypass typed
  deterministic validation;
- Commander replacement issues were not canonically sorted;
- machine-verifier DEFER evidence was tautological.

The auditor's vacuity probe was restored byte-identically and the candidate
fingerprint was reconfirmed. The candidate is now `audit-fix-required`; its
earlier PASS records are superseded and must not be used as release evidence.

## Repaired-candidate cold audit — 2026-08-12

After the accepted replacement findings were closed, the candidate was frozen
at semantic-scope fingerprint
`8d852b5c0d19d19c447db55f895b97fae6870d77dbce1d9855ec32cf005e7d47`.
An independent Luna auditor recomputed that fingerprint and returned
`BLOCKER/HIGH: 0`, `MEDIUM: 3`; it did not issue
`AUDIT-OK-PENDING-FULL-CHECK`.

The judge accepted all three findings:

- the provenance factory allowed individually safe records in one
  Commander/defender cell to sum beyond `Number.MAX_SAFE_INTEGER`;
- the append overflow guard incorrectly summed unrelated cells and could reject
  a valid update to an independent Commander/defender cell;
- `.claude/loop-state.md` stored the semantic-scope audit hash instead of the
  all-tree fingerprint computed by `scripts/codex-context.mjs`.

The first two require a bounded Commander provenance repair and adversarial
tests. The loop-state finding requires recording the final `codex:context`
fingerprint after the repair and audit brief are stable. No release full check
was run; the parent remains `implemented-not-audited`.

## Per-cell repair cold audit — 2026-08-12

After the provenance overflow repair and judge acceptance pin, the candidate
was frozen at semantic-scope fingerprint
`f0d63f19d2071624f4ce0e34952fbb79d1098c4fdc5d871801800f329fb81e32`.
The independent Luna auditor matched that fingerprint and returned one HIGH and
three MEDIUM findings; it did not issue `AUDIT-OK-PENDING-FULL-CHECK`.

The judge accepted all four findings as reachable:

- one blocker object could be reused across different defenders/controllers
  when blocking distinct attackers, producing an invalid combat context;
- maximum-length sparse arrays could force loops proportional to declared
  length in combat and player-lifecycle readers;
- Commander damage, provenance damage, and cast count accepted negative zero,
  which is not preserved by canonical JSON round-tripping;
- player-exit `searchSessionIds` used the generic base-ID validator instead of
  the shipped `CoreRuleKeyV1` authority and accepted unsafe key names.

The two expected judge-owned `review.*` paths were the only hard forbidden-scan
results. No release full check was run. The parent remains
`implemented-not-audited` and returns to `audit-fix-required`.

## Four-finding repair candidate

Three disjoint Luna implementation lanes repaired the accepted findings:

- combat now preserves one-blocker/multiple-attacker support only under a
  stable controller and defender, and fails fast on maximum-length sparse
  arrays;
- Commander damage, provenance damage, and cast count reject negative zero
  while preserving canonical positive zero and the prior per-cell overflow
  behavior;
- lifecycle and exit readers fail fast on sparse arrays, and control-effect,
  decision-authority, and SearchSession cleanup keys reuse the shipped
  `CoreRuleKeyV1` validator.

Judge-owned review pins cover all four findings. The refreshed targeted gate is
14 files / 136 tests passed; `npm run lint`, `npm run build`, the standalone
verifier, generated-API freshness, and `git diff --check` also passed. The
candidate still requires a fresh independent cold audit before any release full
check.

## Final repaired-candidate audit verdict

Independent Luna cold auditor
`019ff181-a586-7220-a1cd-f1834d011fba` recomputed and matched semantic-scope
fingerprint
`1270d3b97e6caef475413c4b6cd56f2d44f2baadd192b54970830c943b8eadc1`.
The required targeted tests, standalone verifier, generated-API freshness, and
`git diff --check` passed. The forbidden scan identified only the two expected
judge-owned `review.*` files. The auditor reported no reachable findings and
issued:

`BLOCKER/HIGH: 0`

`AUDIT-OK-PENDING-FULL-CHECK`

The release full check was not run by the auditor. This verdict is not ship
approval and remains tied to the audited semantic fingerprint.

## Whitespace-only replacement audit

Before the authorized candidate commit, `git diff --cached --check` exposed
three trailing-space lines in the player-exit grounding draft. The judge
removed only those spaces and froze replacement semantic-scope fingerprint
`0880024d47613157f4a3ea69c76873ae57c06ee0a1bd09e881896d549e57b00e`.

Independent Luna cold auditor
`019ff19a-5d53-7433-bfd2-92b0e01e446b` recomputed and matched that fingerprint.
Its initial packet reported one MEDIUM because `.claude/loop-state.md` still
held the pre-brief all-tree fingerprint. The judge updated only that ignored
governance state to the exact `codex:context` fingerprint. The same auditor's
targeted re-audit then confirmed `codex:context` exit 0, loop state `current`,
the unchanged semantic fingerprint above, and closure of the sole MEDIUM.

Final replacement verdict:

`BLOCKER/HIGH: 0`

`AUDIT-OK-PENDING-FULL-CHECK`

The replacement auditor did not run the release full check.
