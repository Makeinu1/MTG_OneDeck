# O4P-08B Cold Audit Record — 2026-08-24

Milestone: `O4P-08B`
Risk: `R3 / BROAD UI`
Auditor: `/root/o4p08b_cold_audit` (`gpt-5.6-sol`, high, fresh context)
Final audited semantic HEAD: `da7f6c7354b591a98511b2fa685c9c3f0547146c`
Final audited fingerprint: `4cdaab94ff49290f50d993862ae65a25c79a6b67f94602fb7ca9b432cb29d363`
Verdict: `AUDIT-OK-PENDING-FULL-CHECK`
Counts: `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`

## Findings and remediation

The first cold audit rejected the initial candidate at `0/7/3/0`. The findings
covered accepted-deck resubmission, admission reopen and recovered state,
kicked-client invalidation, participant-bound kick confirmation, response
body/time bounds, recovery secret filtering, operation-local errors, upgrade
classification, and private-card-name disclosure.

Subsequent affected-claim audits rejected incomplete repairs at `0/4/3/0`,
`0/2/1/0`, `0/1/0/0`, and `0/1/0/0`. The final candidate closed those paths
by preserving exact v3 recovery while adding separately versioned v4 recovery,
recognizing v4 at both Worker layers, filtering seat and Table credentials,
restoring structured started-action feedback, binding multi-tab membership
loss to the active authority, canceling oversized bodies, and persisting only
privacy-safe browser evidence.

The auditor independently verified the final candidate and the saved visual
artifacts at `0/0/0/0`.

## Full-check repair reauthorization

The first executable full check exposed stale historical hashes for the
intended `runtime.ts` and `worker.ts` changes. Exact SHA-256-only repairs in
the O4P-05C and successor O4P-05D verifiers were independently audited at
`0/0/0/0`; no wildcard, authority, path scope, or test meaning changed.

The next full check passed historical gates, lint, and Core, then found the
O4P-08 registration review still allowed only O4P-08A paths. Nineteen literal
O4P-08B contract/prototype/product/test/review/evidence paths were added. The
same auditor verified the exact-path repair at `0/0/0/0`, with no dependency,
configuration, O4P-08C/D, wildcard, or directory-scope expansion.

The final canonical `npm run check` then passed every verifier, docs, lint,
Core `227 files / 2,093 tests`, DOM `346 files / 2,342 tests`, TypeScript/Vite
build, and O4P-07C production runtime graph verifier. Built assets were
`index-DjOTqPUI.js` and `index-B3eS80pY.css`.

This record contains no Room ID, participant ID, invitation, seat/Table
capability, private deck/card content, or raw response body.
