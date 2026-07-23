# CR-order governance cold re-audit brief

## Audit target

- Milestone: `cr-order-governance`
- Claimed status: repaired after an initial cold audit; not shipped and no legacy
  domain has been promoted.
- Scope: the entire current worktree diff, including governance canon, ledger,
  reviewer-owned pins, runtime repairs, ordinary tests, and Vitest scheduling.
- Constraint: read `.claude/audit-standing.md` first. Do not edit any file; findings only.

## Prior findings to challenge adversarially

Do not assume any item is fixed. Reproduce each claim independently.

1. The live autoloop sources and ledger must use one selection algorithm. The
   `plannedSequence` array position must not override `domains.status`,
   `crOrder`, or `dependsOn`.
2. Normal-Commander Role, Battle, Dungeon/Initiative, Saga, day/night, monarch,
   new card frames, and Rad domains must remain selectable in CR order even when
   MyDeck demand is zero. Ante, team formats, and named casual variants must
   remain explicit out-of-scope boundaries.
3. `cr-604-611-612-613-layers-continuous` must claim only the Layer 4 type and
   Layer 6 keyword accessors evidenced by §34.31/§34.32. It must not claim color
   or P/T continuous layers.
4. `preventCombatDamageThisTurn` must suppress every damage consequence from
   the real `resolveCombatDamage` path: player life, marked damage, lifelink,
   commander damage, and damage events, while normal combat progression remains
   deterministic.
5. Lifelink classification must emit pinned CR `702.15` and recognition must not
   be broadened.
6. The new-vocabulary aggregate must not claim runtime recognition for
   702.193/702.194/722. CR 701.69, 702.193, 702.194, and 722 must have separate
   truthful domains, and bundled CR716/719/720/721/722 work must be split into
   separately selectable domains.

## Required checks

1. Run `npm run check`; run the two new reviewer-owned pins and affected ordinary
   tests separately.
2. Run `npm run check:forbidden`. Because this is a judge-owned management
   milestone, explain whether every `FORBIDDEN` path is a reviewer/governance
   change in the frozen diff and whether implementer changes were confined to
   the four paths named in
   `research/cr-grounding/archive/cr-order-governance/runtime-repair-brief.md`.
   Do not waive an
   unexpected protected-file change.
3. Validate ledger JSON, top-level keys, unique IDs, dependency references,
   non-loss versus HEAD, required fields on every non-shipped domain, and the
   selected next eligible code slice.
4. Search live governance sources for stale MyDeck-first or
   `plannedSequence`-first rules.
5. Re-run vacuity/adversarial probes for the four legacy domain claims, including
   the real-combat prevention path. Restore any temporary mutation before
   reporting.
6. Verify `fileParallelism: false` changes scheduling only; no assertion,
   timeout, coverage, or test selection was weakened.

## Output

For each finding: `BLOCKER|HIGH|MEDIUM|LOW`, `file:line`, reproducible
input/action, actual result, expected result, and classification
(`governance|contract|implementation|evidence|ambiguity`).

Then give separate verdicts for:

- governance status claim
- each legacy domain:
  - `cr-604-611-612-613-layers-continuous`
  - `cr-614-615-616-replacement-prevention`
  - `cr-702-keyword-abilities-frequent`
  - `cr-20260619-new-vocabulary-boundary`
- whether the milestone may ship

Do not implement fixes and do not change status values.
