# O4P-06 Roadmap Registration Cold Audit Brief

Audit profile: BROAD<br>
Authority: user-ruling-2026-08-15<br>
Base SHA: `69559e13716e9d0767d8189714d8c14fb630db46`

The auditor receives only this brief and the frozen workspace. Do not edit,
commit, push, deploy, or infer implementation from pending roadmap entries.

## Audit target

1. Verify the user-approved A-to-F order is preserved and materially capable
   of closing the observed four-player Web product gap without silently
   claiming that O4P-05 already delivered browser play.
2. Verify each O4P-06 ID exists exactly once in both ledger collections, both
   collections agree, every status is `pending`, and `crOrder`/dependencies
   form `O4P-05D -> 06A -> 06B -> 06C -> 06D -> 06E -> 06F`.
3. Verify `goalPolicy.activeProgram` selects O4P-06A and no unrelated CR/feel
   entry can preempt the explicit program.
4. Adversarially inspect A-to-F for phase skipping, circular prerequisites,
   over-broad parents, missing privacy/authority/replay gates, and false-green
   release language.
5. Confirm A owns four-real-deck genesis and the current 1 MiB feasibility
   gate; B owns the ordinary tabletop command gap; C owns forming-lobby HTTP
   and exact-origin CORS; D owns browser transport/recovery; E owns public App
   integration; F owns actual four-browser production acceptance/release.
6. Confirm all pre-existing ledger content is unchanged, especially shipped
   O4P-01 through O4P-05 entries and O4P-05D evidence.
7. Confirm no production source, dependency, lockfile, workflow, Worker
   configuration, CR pin, docs canonical file, or existing review test changed.
8. Confirm reference projects are idea-only and do not authorize code copying,
   dependency adoption, license import, or backend replacement.
9. Reproduce JSON parsing, targeted review, `npm run codex:context`,
   `git diff --check`, and changed-file allowlist checks.
10. Check that registration does not start O4P-06A and performs no external
    write.

## Required result

Return findings classified as BLOCKER, HIGH, MEDIUM, or LOW. Return
`AUDIT-OK-PENDING-FULL-CHECK` only if BLOCKER/HIGH are zero. Findings only;
do not repair the candidate. Include a stable auditor task identifier for the
Judge-owned record.
