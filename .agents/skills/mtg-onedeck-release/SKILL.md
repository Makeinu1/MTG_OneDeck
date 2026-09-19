---
name: mtg-onedeck-release
description: Prepare or perform an authorized MTG OneDeck release through a pre-merge full candidate gate and exact-SHA cumulative deployment verification.
---

# MTG OneDeck release

Use only when the user has explicitly authorized the requested external action.
This skill never creates permission. Work in the repository checkout and keep
the release tied to one exact commit.

## Four stages

1. **Authority and clean state** — Read [`AGENTS.md`](../../../AGENTS.md), inspect
   `git status`, `HEAD`, the intended branch/PR, and current GitHub protection.
   Stop if the checkout is dirty, the commit is not the intended one, or
   commit/push/merge/deploy authority is absent. Resolve any required independent
   review before integration.
2. **Pre-merge full candidate gate** — Release work goes through a PR to `main`.
   `.github/workflows/candidate-verification.yml` runs the exact PR candidate
   through `npm run check:release`, including the forbidden-diff scan, ordinary
   machine checks/build, and candidate-relative semantic verification. Do not use
   a direct push to `main` as a release path. Repository protection should require
   this candidate gate before autonomous merge; while protection is absent, keep
   merge human-gated rather than treating a green branch as self-authorizing.
3. **Merge and cumulative deployment gate** — After an authorized merge, the
   `main` push starts `.github/workflows/deploy-pages.yml`. It resolves the
   latest successful Pages run SHA and reruns `check:release` over the cumulative
   diff from that last-known-good release to the new `main` SHA; a previous
   failed `main` commit therefore remains inside the next release diff. Only a
   green cumulative gate may deploy Pages. The Worker workflow accepts only the
   exact SHA from a successful Pages `main` push; production workflows expose no
   manual-dispatch bypass.
4. **Verify once** — Inspect the matching Candidate Verification, Pages deployment,
   Worker deployment, and served version once. CI failure is fail-closed: do not
   deploy or automatically retry an external write. Stop, fix the root cause,
   recheck only invalidated targeted evidence, push a new candidate with authority,
   and let the same gates run again. Do not claim a release from local checks alone.

## Resume

After interruption, reconstruct from `git status`, `HEAD`, the PR, and GitHub
workflow/deployment state. Distinguish candidate-verified, integrated-main,
release-verified, Pages-deployed, and Worker-deployed SHAs. Continue only at the
first missing stage for the same SHA; never infer authority from a previous
message or from a successful local check.
