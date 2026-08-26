# O4P-09D Full-Check Repair 3 Cold-Audit Brief

Date: 2026-08-27
Repair-candidate base SHA: 36edfe95a26b53fd312df520c2e998ca4ade2205
Semantic base SHA: d11a54a54bb3f3ad3dcb624132f3ea3e23de1fd2
Risk: R3 / BROAD correction audit
Authority: research/cr-grounding/o4p-09d-full-check-repair-3.draft.md

Read only. Do not edit files, run the release full check, commit, push, deploy,
or publish records. Return BLOCKER/HIGH/MEDIUM/LOW findings and the canonical
candidate fingerprint supplied by the Judge.

## Audit the repair delta

Compare the candidate with base
36edfe95a26b53fd312df520c2e998ca4ade2205 and verify:

1. Executable changes are confined to the nine Judge-owned architecture guard
   files named by the authority.
2. The two Cloudflare file lists add only projectionBudgetV1.ts; the three
   Cloudflare import sets add only ../tabletopManual/index.
3. The three Online-root enumerations add only tabletopManual.
4. The two stack guards exempt only tabletop/operationsV1.ts, and the Solo
   boundary exempts only OnlineTabletopManual.tsx importing its own CSS file.
5. The mode-neutral Core allowance is exact by source file, resolved target
   file, import kind, and imported symbol. It must not admit namespace,
   re-export, dynamic, type-query, unlisted-source, unlisted-target, or
   unlisted-symbol access.
6. Product bytes, ordinary product tests, dependencies, configs, O4P-09D
   acceptance meaning, prior audit evidence, and O4P-09E bytes are unchanged.
7. The exact nine guard files pass 49/49; scoped ESLint, docs/ledger checks,
   git diff --check, release preflight, and candidate fingerprint are green
   and secret-free.
8. The record retains cumulative repair-wave and full-check counters and cites
   explicit user authority for repair candidate 3 plus additional
   commit/push/CI.

Return O4P-09D-FULL-CHECK-REPAIR-3-AUDIT-OK only when
BLOCKER/HIGH/MEDIUM/LOW are all zero. Full check and live release evidence
remain out of scope.
