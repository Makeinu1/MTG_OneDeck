# O4P-07A Full-Check Repair 2

Date: 2026-08-22
Base SHA: `55fe011700bd6bb10a699e1bd431f0bf12cc40cb`
Prior audited fingerprint: `63d5fa16377bcd1d42ca396e44f4f83c52e31bc51127b20b1585ecebf24a16a6`
Owner: Judge

## Trigger

The user-authorized exceptional third `npm run check` passed every verifier,
docs, lint, and Core 227/2093, then failed the DOM project. Six failures were
deterministic historical-gate drift and six were timeout failures under severe
host CPU contention. The candidate was not shipped and O4P-07B was not started.

## Bounded deterministic repair

1. Register `src/online/deckSubmission` in the three exact Online module-kind
   lists already used by the mode-neutral, O4P-02D, and O4P-02E boundaries.
2. Allow only `coreSha256HexV1` from the Core public barrel in the exact two
   deck-submission files that produce canonical input and snapshot digests.
   Synthetic tests continue to reject every other file, symbol, and barrel.
3. Preserve the O4P-03D headless boundary while allowing the dedicated local
   Scryfall resolver name in runtime wiring. Worker/runtime/persistence still
   reject React, Zustand, IndexedDB, and a direct Scryfall API URL.
4. Advance the historical O4P-03D SQLite migration assertion from schema v1 to
   the audited application schema v2 introduced by O4P-07A.
5. Convert the O4P-07 registration review from a moving working-tree diff to
   the immutable registration closure SHA
   `55fe011700bd6bb10a699e1bd431f0bf12cc40cb`, while retaining a live healthy
   `codex:context` check whose expected next program member is derived from the
   synchronized ledger.
6. Re-pin only the exact changed O4P-03D authorities through the executable
   O4P-03D -> O4P-05C -> O4P-05D verifier hash chain.

No product source, timeout value, dependency, CR authority, public UI, start
path, fixed catalog, or acceptance meaning changes in this repair.

## Timeout classification

The full-check process reported timeouts in existing O4P-02E, O4P-05B,
O4P-06B, lobby start, and Cloudflare lobby tests. A `maxWorkers=1` replay made
O4P-06B pass but four short-timeout tests still exceeded their 5/15-second
limits. A read-only process snapshot then showed external host contention:
`ReportCrash` near 91% CPU, MTG Arena near 67%, and Codex processes near 50%
combined. No timeout was raised and no semantic assertion was relaxed. These
tests must be rerun after host contention is removed; their current result is
environment-blocked, not green evidence.

## Targeted evidence before audit

- Seven deterministic repair files: 7 files / 45 tests, then the corrected
  O4P-01I file alone: 2/2 pass.
- All six Cloudflare/O4P-05 verifier commands pass after exact hash re-pinning.
- Full-check repair remains unshippable until a same-fingerprint full
  `npm run check` is explicitly reauthorized and passes.
