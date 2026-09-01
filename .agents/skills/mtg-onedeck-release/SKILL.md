---
name: mtg-onedeck-release
description: Prepare or perform an authorized MTG OneDeck release through targeted local checks, exact-SHA push, and one CI/Pages verification.
---

# MTG OneDeck release

Use only when the user has explicitly authorized the requested external action.
This skill never creates permission. Work in the repository checkout and keep
the release tied to one exact commit.

## Four stages

1. **Authority and clean state** — Read [`AGENTS.md`](../../../AGENTS.md), inspect
   `git status`, `HEAD`, and the intended remote branch. Stop if the checkout is
   dirty, the commit is not the intended one, or commit/push/deploy authority is
   absent. Resolve any required review before continuing.
2. **Targeted pre-push validation** — Without editing or staging files, inspect
   the release diff and repeat only relevant targeted tests. For an exact
   candidate sent to the current deploy-pages CI, do not run local `npm run
   check`; CI's `npm run check:release` runs `npm run check`, the forbidden-diff
   scan, and the build, and is the sole full-strength suite. A local-only
   completion, a change that does not use CI, or an explicit request for local
   full assurance may run local `npm run check` once. If a correction changes a
   checked claim, recheck only the invalidated targeted evidence.
3. **Exact-SHA push** — Only with explicit authority, commit the named files and
   push the exact candidate SHA to the intended branch; the repository's
   configured CI path gates and performs the Pages deploy. Because the repository
   deploys from a direct push to `main`, this CI is a deploy gate rather than a
   pre-merge branch gate. Stop before any external write when authority or the
   exact SHA is unclear.
4. **Verify once** — Inspect the matching CI run, Pages HTTP response, and served
   asset/version once. CI failure is fail-closed: do not deploy or automatically
   retry an external write. Stop, fix the root cause, recheck only invalidated
   targeted evidence, push a new SHA with authority, and rerun CI. Report
   success or the concrete failure; do not claim a release from local checks alone.

## Resume

After interruption, reconstruct from `git status`, `HEAD`, and CI/Pages state.
Continue only at the first missing stage for the same SHA; never infer authority
from a previous message or from a successful local check.
