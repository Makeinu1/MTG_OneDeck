# O4P-07C completion packet

Date: 2026-08-23
Milestone: O4P-07C
Program: O4P-07
Risk: R3 / BROAD

## Released outcome

Online play no longer limits users to the fixed four decks or 336-card product
catalog. Saved or newly imported lists are submitted as v2 Scryfall identities,
resolved by the server, stored as immutable seat snapshots, and used directly
to construct the Room genesis. Fixed catalog bytes remain regression fixtures
only and are unreachable from production Page/Worker graphs.

Legacy v1 deck, ready, and start operations now fail closed with the exact
secret-free HTTP 426 upgrade response. Arbitrary totals, zero/multiple
commanders, repeated quantities, DFCs, identical decks across seats,
owner-actionable private failures, readiness clearing, reconnect, and replay
remain supported.

## Frozen release chain

- Product release HEAD:
  `829f3f75aab4251aae0977e8ffd028bb08d4ac5c`.
- Semantic fingerprint:
  `250986253e6a3f6cde99ef25ef46df323676f22767ab8e7922df892e6059f587`.
- Primary audit: `/root/o4p07c_final_luna_cold_audit`, 0/0/0/0,
  `O4P-07C-AUDIT-OK-PENDING-FULL-CHECK`.
- Full-check repairs 1-3: fresh Luna/xhigh audits, each 0/0/0/0, with tokens
  frozen in the O4P-07C audit record.
- Exact-head Actions `32633685663`: full check, ownership, artifact, and Pages
  deploy PASS.
- Pages HTML/JS/CSS: HTTP 200 for `index-DfRb-Q8R.js` and
  `index-DB7TO263.css`.
- Worker: version `bb60678b-13b3-4fc7-b80c-a81bd9f1b303`, newest deployment,
  100% active, expected safe root 404.

## Production acceptance

The sanitized production result proves four fixed-catalog-external seats, an
identical pair, zero/multiple commanders, arbitrary totals, repeated quantity,
DFCs, owner-private known failure and retry, exact legacy upgrade, active start,
five WebSockets, reconnect, revision-zero replay stability, and no capability
leak. No raw deck, error detail, room ID, invite, or capability is retained in
the release record.

Safari normal/private, Firefox normal/private, and Chrome
normal/incognito-equivalent were exercised against the served version. Chrome
375x812, 812x375, and 1440x900 had no horizontal overflow or clipped Online
controls; console errors and warnings were zero.

## Closure

Both ledger collections mark O4P-07C shipped. Because O4P-07A, O4P-07B, and
O4P-07C are all shipped, `codex:context` derives active program O4P-07 as
`complete` with `nextDomainId: null`.

The shipped boundary still excludes EDH legality enforcement, sideboards,
client-definition fallback, and a single-operator four-seat switcher. Those
exclusions do not restore any fixed-catalog product restriction.

## Independent completion audit

Fresh-context Luna/xhigh auditor `/root/o4p07c_completion_luna_audit`
recomputed the exact five-path candidate fingerprint
`82e45c5e06309c2a39cf8067ee71233f9530b103a50724acde9d20d35a023fe7`.
It verified both ledger collections, the O4P-07 complete projection, exact-head
CI/Pages assets and test totals, newest 100% Worker deployment, sanitized
production acceptance, browser matrix, fixture/config preservation, and secret
non-disclosure.

Findings: BLOCKER/HIGH/MEDIUM/LOW = `0/0/0/0`.

Approval: `O4P-07C-PRODUCTION-COMPLETION-APPROVED`.

Exact-head terminal CI/Pages confirmation and final clean-worktree closure
remain required after this record-bearing metadata is frozen.
