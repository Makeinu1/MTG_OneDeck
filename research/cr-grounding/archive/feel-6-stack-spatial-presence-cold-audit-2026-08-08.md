# feel-6 stack spatial presence cold-audit record

- Candidate base: `c4541b551e5828bb764a4850e0c35d8f480c1e7d`
- Corrected candidate fingerprint before release metadata: `2a752d0d83eadc098ca845b1a4f8faca8ff6743d1a9dc337d482571664446879`
- Auditor: `/root/feel6_cold_auditor` (independent, no implementation context)
- Date: 2026-08-08

## Scope and result

The audit inspected the front-card focal styling, expanded-list boundary, spell-cast arrival ghost, source-zone/card identity, pointer-events and timer cleanup, reduced-motion fallback, and existing stack/presentation behavior. Browser checks covered 375×812, 812×375, and 1440×900 with exact root/document/body viewport geometry, no scroll overflow, and empty console error/warning logs. A real hand spell cast produced one 300ms ghost with `data-card-id` and `data-source-zone="hand"`; front geometry was 150×210 scaled to 159×221.6.

- Initial audit target: 6 files / 67 tests passed; additional UI/presentation target: 5 files / 71 tests passed.
- `npx tsc -b`, scoped ESLint, and `git diff --check`: passed.
- Initial finding: rapid spell events reused the ghost DOM node, so CSS flight did not restart.
- Repair: `key={stackArrival.id}` forces a remount for each event; the same fix was independently re-audited.
- Re-audit target: 6 files / 67 tests passed; additional UI/presentation target: 5 files / 71 tests passed.
- Findings after repair: BLOCKER 0, HIGH 0, MEDIUM 0, LOW 0.
- Verdict: `AUDIT-OK-PENDING-FULL-CHECK`.

The subsequent single full `npm run check` completed on the corrected candidate: core 126 files/1323 tests, DOM 226 files/1577 tests, build and lint green. The only build note was the pre-existing large-chunk warning.

The C1 values were frozen from the unfinished UI thread under the user's direct instruction to carry the work through: front scale 1.06, shallow ±2px bob over 2600ms, transform-only motion, restrained shadow, and 300ms arrival ghost.
