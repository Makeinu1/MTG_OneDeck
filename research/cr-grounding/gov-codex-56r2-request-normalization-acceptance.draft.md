# GOV-CODEX-56R2 Acceptance

Milestone: `GOV-CODEX-56R2-2026-08`
Base SHA: `2a50db07f3962a11ec5a77b93bedc74ca4f628b6`

## Executable acceptance

1. A free-form inspect request normalizes to `Intent: inspect`, remains read-only,
   and does not acquire a program or ship authority.
2. A free-form local change request normalizes to `Intent: change` and exactly
   one milestone envelope.
3. Only an explicit ordered milestone program normalizes to `Intent: goal`.
   Commit, push, deploy/publish, and release/ship are inferred independently;
   `+ ship` is true only for explicit end-to-end release/ship authority.
4. Missing reversible details are inferred and disclosed. Only a material choice
   that changes scope, authority, or success criteria triggers a user question.
5. The normalized request uses exactly `Intent`, `Program`, `Goal`, `Constraints`,
   `Done when`, `Budget objective`, and `Authority`. Intent grants no authority;
   local writes remain false for commit-only, push-only, and deploy-only cases.
6. Each milestone allows one implementer lineage, one auditor lineage, two total
   correction waves, one normal full check, two absolute full checks, one normal
   semantic push, one replacement push/CI, one logical audit wait, and one
   logical CI wait.
7. Each logical role lineage allows at most two compactions and one fresh
   same-role continuation. It shares the role slot and counters; no third
   compaction, second continuation, or third correction wave is allowed.
8. The 4 KiB terminal packet carries facts and evidence references, not raw logs
   or prior transcripts.
9. Token/model-cycle objectives have explicit hard ceilings; Sol/medium is the
   normal intake default and the R3/BROAD auditor remains explicit Sol/high.
   User budget input replaces the objective only, not those hard ceilings.
10. Existing release and secret-safety evidence remains mandatory.
11. Both fixed-seed card-zone property tests use the same explicit
    `15_000`-millisecond timeout while preserving seeds `2026080908` and
    `2026080909`, run counts 128 and 64, Core file parallelism, and the global
    Vitest timeout.
12. Historical review gates remain strict but future-extensible: the root
    contract routes to the sole workflow that owns the exact cold-audit verdict,
    O4P-08 retains the exact four ordered entries, and its path/package
    guards compare the frozen base and closure commits rather than today's
    unrelated worktree.

## Required validation

- `npx vitest run --project dom src/test/architecture/review.gov-codex-56r2-request-normalization.test.ts`
- `npx vitest run scripts/__tests__/review.codex-ops.test.mjs`
- `npx vitest run --project core src/engine/core/transition/__tests__/cardZoneTransitionProperty.test.ts`
- `npx vitest run scripts/__tests__/review.check-gates.test.mjs`
- `npx vitest run --project dom src/test/architecture/review.o4p-08-roadmap-registration.test.ts`
- `npm run check:docs`
- `git diff --check`
- independent R3/BROAD cold audit of the frozen candidate fingerprint

The release full check is not run until all findings are closed. Each external
action requires its matching authority bit. The 2026-08-25 ruling authorizes
commit, push, and Pages deploy, but not release/ship status.
