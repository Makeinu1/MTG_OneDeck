# O4P-06 Roadmap Registration Acceptance

Date: 2026-08-15<br>
Authority: user-ruling-2026-08-15<br>
Base SHA: `69559e13716e9d0767d8189714d8c14fb630db46`

## Acceptance conditions

1. `goalPolicy.activeProgram` is exactly `O4P-06` with ordered IDs
   `O4P-06A` through `O4P-06F`.
2. Each ID exists exactly once in `domains` and exactly once in
   `plannedSequence`; the two representations have synchronized fields and
   `status: pending`.
3. `O4P-06A` depends on shipped `O4P-05D`; every later entry depends only on
   the immediately preceding O4P-06 parent. `crOrder` is 1018 through 1023.
4. All pre-existing ledger entries, array order, shipped status/evidence, CR
   pin, selection rule, status definitions, and judge policy remain unchanged.
5. The six boundaries retain the approved order: real-deck bootstrap and size;
   playable commands; lobby/invite HTTP; browser WebSocket recovery; public App
   integration; four-browser production release.
   O4P-06A cannot ship after a failed 1 MiB measurement until a bounded
   alternative is implemented and verified inside A; a design decision alone
   cannot unlock O4P-06B.
6. Registration evidence is roadmap-only. No entry claims source,
   acceptance-test, CI, Pages, Cloudflare, or browser completion.
7. Product/configuration/dependency files are byte-identical to the base. The
   only `src` change is the Judge-owned `review.o4p-06-roadmap-registration`
   architecture test.
8. `npm run codex:context` reports `health.ok=true`, active O4P-06,
   `nextDomainId=O4P-06A`, and selection reason `active-program-order`.
9. The targeted review, JSON parse, `git diff --check`, and documentation checks
   pass before a candidate fingerprint is frozen.
10. A context-free BROAD cold auditor reports BLOCKER/HIGH zero. Its record is
    added without changing roadmap semantics, then the final candidate is
    rechecked before the one allowed full `npm run check`.

## Explicit non-acceptance

This task does not make four-player browser play available, does not deploy or
publish anything, and does not start O4P-06A. Each product claim remains
blocked on its own milestone's executable evidence and release gates.
