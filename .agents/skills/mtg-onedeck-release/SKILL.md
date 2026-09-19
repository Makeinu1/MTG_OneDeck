---
name: mtg-onedeck-release
description: Prepare or perform an authorized MTG OneDeck release using targeted candidate verification and a full cumulative release gate at the actual release/certification boundary.
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

2. **Candidate-relative PR gate** — Ordinary incremental work goes through a PR
   to `main`. `.github/workflows/candidate-verification.yml` runs the exact PR
   candidate through `npm run check:fast`. The fast gate selects changed runnable
   tests, validation domains, and M3 semantic evidence; unknown paths, unrunnable
   changed tests, and domains marked `full` escalate fail-closed to
   `npm run check:release`. Do not require unrelated full repository/browser
   evidence merely because a PR exists.

   A PR green under targeted verification is an integration candidate, not by
   itself a production-release certification. Do not use a direct push to
   `main` as a release path. Repository protection should require the candidate
   gate before autonomous merge; while protection is absent, keep merge
   human-gated rather than treating a green branch as self-authorizing.

3. **Release / certification full gate** — Full `check:release` belongs at an
   actual release, milestone certification, explicit full-risk domain, or explicit
   full-assurance boundary. Production/release-relevant `main` pushes start
   `.github/workflows/deploy-pages.yml`, which resolves the latest successful
   Pages main-push SHA and reruns `check:release` over the cumulative diff to the
   new `main` SHA. A previous failed production release therefore remains inside
   the next release diff. Docs/M6-control-plane-only merges intentionally do not
   start Pages or a full release scan.

   Only a green cumulative gate may deploy Pages. The Worker workflow accepts only
   the exact SHA from a successful Pages `main` push; production workflows expose
   no manual-dispatch deployment bypass.

4. **Verify once** — For an actual release, inspect the matching candidate gate,
   full release/certification evidence, Pages deployment, Worker deployment, and
   served version as applicable. CI failure is fail-closed: do not deploy or
   automatically retry an external write. Stop, fix the root cause, recheck only
   invalidated targeted evidence, push a new candidate with authority, and let the
   required gate run again. Do not turn every incremental PR into a release merely
   to obtain reassurance.

## M6 verification cadence

During M6, control-plane PRs use targeted verification by default. Full
repository/release verification is reserved for the final M6 certification unless
an earlier change enters a validation domain explicitly classified `full`.
This is the standing policy for M6 work, not a session-local shortcut.

## Resume

After interruption, reconstruct from `git status`, `HEAD`, the PR, and GitHub
workflow/deployment state. Distinguish candidate-targeted, candidate-full,
integrated-main, release-verified, Pages-deployed, and Worker-deployed SHAs.
Continue only at the first missing required stage for the same SHA; never infer
authority from a previous message or from a successful local check.
