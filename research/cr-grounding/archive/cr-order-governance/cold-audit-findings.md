# CR-order governance cold-audit record

Date: 2026-07-23

## Scope

Management milestone that changes the live roadmap to normal-Commander CR order,
normalizes legacy status claims, repairs existing automation found by audit, and
keeps unsupported behavior visibly manual.

## Independent sessions

- Initial adversarial audit: `/root/governance_cold_audit`
- Post-repair adversarial audit: `/root/governance_cold_reaudit`
- Narrow live-STOP canon audit: `/root/stop_canon_cold_reaudit`
- Runtime repair implementer (not an auditor): `/root/governance_runtime_repair`

All auditors were spawned without parent conversation context and were
findings-only. No auditor edited the frozen worktree.

## Findings and adjudication

Initial audit found five HIGH and one MEDIUM:

1. Normal-Commander Role/Battle/Saga/day-night/monarch/initiative/new-frame/Rad
   work was permanently excluded by stale `pruned + deferred + user-stop`.
2. Autoloop sources conflicted over `plannedSequence`-first versus
   `crOrder + dependsOn`.
3. CR604 boundary overclaimed color/P-T Layer behavior.
4. The real `resolveCombatDamage` path bypassed the global combat-damage
   prevention shield.
5. Lifelink classification used stale CR 702.13 instead of 702.15.
6. The new-vocabulary boundary overclaimed runtime recognition for
   702.193/702.194/722.

The judge repaired governance and boundaries. A context-free implementer repaired
only `src/engine/commands.ts`, `src/engine/keywordGrammar.ts`, and their ordinary
tests. Reviewer-owned adversarial pins were written by the judge before the
runtime repair.

The post-repair audit found no BLOCKER/HIGH and returned `SHIPPED-OK` for:

- `cr-604-611-612-613-layers-continuous`
- `cr-614-615-616-replacement-prevention`
- `cr-702-keyword-abilities-frequent`
- `cr-20260619-new-vocabulary-boundary`

It found one governance MEDIUM: slice-selection STOP① (three cases) and the
loop-wide STOP categories (four cases) were conflated in live compatibility
sources. The judge removed the obsolete Phase S/C branch and live `CLAUDE.md`
role dependency, then a fresh narrow auditor reported findings none:

- live STOP canon: `OK`
- prior MEDIUM repaired: `YES`
- management milestone may ship: `YES`

## Evidence

- Parent repair pins: 4 files / 42 tests PASS.
- Canonical parent `npm run check`: lint PASS; 278 files / 2211 tests PASS;
  typecheck/build PASS.
- Post-repair audit: 9 legacy evidence files / 98 tests PASS.
- Restored vacuity probes:
  - Layer 4 mutation: 8 failures.
  - Layer 6 mutation: 6 failures.
  - real-combat prevention mutation: 2 failures.
  - stale Lifelink 702.13 mutation: 2 failures.
  - false 702.193 runtime-recognition probe: red as expected.
- Ledger: valid JSON; 68 domains; 36 planned entries; duplicate IDs 0; missing
  dependency references 0; non-shipped required-field gaps 0.
- `git diff --check`: PASS.
- `fileParallelism: false` changes scheduling only; assertions, timeout, coverage,
  and test selection were not weakened.
- `npm run check:forbidden` before commit listed only expected judge/reviewer
  ownership and reauthorization paths. A clean-worktree post-commit run remains
  the release gate.

## Honest residual boundaries

- CR604: color/P-T continuous layers, timestamps, duration, and dependency
  ordering remain unimplemented.
- CR614-616: damage doubling, kicker-dependent ETB counters, and full 616.1
  replacement-order choice remain manual.
- CR702: first/double strike, ward, flying/reach/menace legality, multiple
  blockers, and planeswalker/Battle combat remain outside the shipped subset.
- New vocabulary: Heal is recognized as a rule reference only; Power-up,
  Teamwork, and Preparation runtime recognition/execution remain pending in
  separate CR-ordered domains. None is represented as automatically resolved
  without a final-GameState replay.
