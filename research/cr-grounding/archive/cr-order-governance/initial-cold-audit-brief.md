# CR-order governance cold-audit brief

## Audit target

- Milestone: `cr-order-governance`
- Claimed status: governance frozen; four legacy domains remain `implemented-not-audited`
- User ruling: normal Commander/EDH scope, CR chapter/section order, minimum dependency detours, MyDeck only as acceptance fixture/same-CR tie-break
- Frozen diff: governance canon, autoloop references, `research/cr-grounding/cr-backbone-ledger.json`, and the non-weakening Vitest file-serialization fix in `vite.config.ts`

## Status claims to challenge

1. The new selection rule is deterministic and makes `cr-118-costs-act4` the first eligible code slice.
2. Every non-`shipped` domain has `crOrder`, `dependsOn`, `status`, `evidence`, `boundary`, and `manualBoundary`.
3. Mixed carry work is split by CR family; design/maintenance/variant/deferred work cannot displace the CR queue.
4. These four legacy domains have executable evidence but must not become `shipped` unless this audit finds BLOCKER/HIGH = 0:
   - `cr-604-611-612-613-layers-continuous`
   - `cr-614-615-616-replacement-prevention`
   - `cr-702-keyword-abilities-frequent`
   - `cr-20260619-new-vocabulary-boundary`

## Required audit

Read `.claude/audit-standing.md` first and follow it. Do not edit any file; findings only.

1. Run `npm run check`, `npm run check:forbidden`, and the relevant `review.*` tests.
2. Validate ledger JSON, required top-level keys, domain/plannedSequence count non-loss, unique domain IDs, dependency references, and active queue ordering.
3. Search all current governance sources for live rules that still make MyDeck demand override CR order. Historical shipped notes are not live selection rules.
4. Compare the four legacy domains' boundaries and evidence with the cited specs, tests, and pinned CR. Check that no unsupported residual behavior is described as implemented.
5. Perform at least one restored vacuity probe for each of the four domain claims, or explain precisely why a boundary-only claim uses a different non-vacuous check.
6. Check that normal Commander scope exclusions do not silently exclude an ordinary in-scope rule merely because current MyDeck demand is zero.
7. Verify that `fileParallelism: false` changes scheduling only: no assertion, timeout, test file, or coverage gate is weakened. Reproduce that the formerly timing-out visual tests and the canonical full check pass.

## Output

For each finding: `BLOCKER|HIGH|MEDIUM|LOW`, `file:line`, reproducible input/action, actual result, expected result, classification (`governance|contract|implementation|evidence|ambiguity`).

Then give separate verdicts for:

- governance status claim
- each of the four legacy domains (`SHIPPED-OK` or blocking findings)
- whether the milestone may ship

Do not implement fixes and do not change status values.
