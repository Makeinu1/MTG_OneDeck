---
name: mtg-onedeck-release
description: Prepare or perform an authorized MTG OneDeck release through one local check, exact-SHA push/deploy, and one CI/Pages verification.
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
2. **One read-only release check** — Without editing or staging files, inspect
   the release diff and run the repository's final check once (`npm run check`).
   Record its result. If a correction changes a checked claim, recheck that
   claim and perform the final check again; do not repeat it for reporting only.
3. **Exact-SHA push/deploy** — Only with explicit authority, commit the named
   files, push the exact verified SHA to the intended branch, and deploy through
   the repository's configured path. Stop before any external write when
   authority or the exact SHA is unclear.
4. **Verify once** — Inspect the matching CI run, Pages HTTP response, and served
   asset/version once. Report success or the concrete failure. Do not claim a
   release from local checks alone, and do not retry external writes without a
   new, explicit decision.

## Resume

After interruption, reconstruct from `git status`, `HEAD`, and CI/Pages state.
Continue only at the first missing stage for the same SHA; never infer authority
from a previous message or from a successful local check.
