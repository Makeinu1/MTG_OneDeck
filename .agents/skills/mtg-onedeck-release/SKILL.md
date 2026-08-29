---
name: mtg-onedeck-release
description: Prepare, resume, verify, or execute an already-authorized MTG OneDeck release through its existing audit, full-check, GitHub CI, Pages, and terminal-evidence gates. Use for release, ship, publish, deploy, Pages verification, or interrupted-release recovery; this skill never grants commit, push, deploy, or ship authority.
---

# MTG OneDeck release

This is the operator entry point for releasing one existing milestone candidate.
It creates no authority, candidate, state machine, or quality rule. Read the
repository `AGENTS.md`, recover the selected domain with `codex:context`, then
follow the release section of
[document governance](../mtg-onedeck-development/references/document-governance.md).
Treat every nonzero executable gate as a stop for that phase.

Choose one mode from the request and live state:

- `prepare`: inspect the candidate and run the existing budget, guard-impact,
  and release-preflight checks. Make no external write. Report the exact
  missing audit, fingerprint, permission, or check evidence.
- `ship`: require separately recorded `commit`, `push`, `deploy`, and `ship`
  authority. Continue the executable candidate transitions through the one
  final full check, explicit-file commit, exact release-head push, CI, Pages
  and asset verification, shipped state, and terminal closure.
- `resume`: reconcile worktree, HEAD, `origin/main`, CI, Pages, ledger,
  loop-state, release head, and tracked authority. Resume only the same
  candidate at the first incomplete gate; never reset counters, lineages,
  waits, receipts, or an immutable event prefix.
- `verify`: verify existing exact-head CI, Pages/assets, terminal metadata, and
  clean closure. Reuse fingerprint-bound green evidence and do not repeat the
  full check or deployment merely to produce another report.

Invocation of this skill or `/ship` is not permission. If a required authority
bit is absent, stop before that external action and report the missing bit.
During a fixed-scope release repair, preserve the same acceptance and authority
and use the repair path defined by document governance. Report the delivered
player outcome separately from audit, CI, and governance evidence.
