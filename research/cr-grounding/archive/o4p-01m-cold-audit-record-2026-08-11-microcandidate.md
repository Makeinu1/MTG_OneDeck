# O4P-01M micro-candidate cold audit record — 2026-08-11

## Scope

Independent cold audit of the bounded Commander identity/replacement/tax/
damage, multiplayer combat assignment, player lifecycle, and Core root export
candidate. The audit was performed after the candidate was frozen for the
bounded value-object contract; the auditor did not edit the worktree.

## Findings and disposition

- HIGH: replacement creation errors were not frozen. Fixed by freezing the
  error instance after initialization; targeted tests passed.
- HIGH: the public damage base error was not frozen. Fixed by making the base
  class non-public while retaining frozen public subclasses; targeted tests
  passed.
- HIGH: unregistered Commander damage queries returned zero. Fixed to fail
  closed with the typed unregistered issue.
- HIGH: combat and damage operations accepted forged mutable states. Fixed by
  factory-normalizing incoming states before successful operations and queries.
- HIGH: damage lacked a defending-player allowlist and collections were being
  reordered/merged. Fixed with `defendingPlayerIds`, duplicate rejection,
  zero retention, and order-preserving updates.

## Final bounded verdict

The final independent cold audit returned `PASS`, with `BLOCKER/HIGH: 0` and
`MEDIUM: 0`. The judge independently reran the seven O4P-01M ordinary test
files: 7 files and 53 tests passed; `git diff --check` passed.

This is a micro-candidate audit record only. It does not authorize parent
shipment until the remaining O4P-01M acceptance vectors, fixture/verifier,
and final candidate re-audit are complete.
