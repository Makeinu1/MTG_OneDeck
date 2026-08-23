# O4P-08B Completion Packet — 2026-08-24

Milestone: `O4P-08B`
Status: `shipped`
Implementation base: `8bd8ac143943182d920b5bf8608b4b1c0e3109fd`
Audited semantic HEAD: `da7f6c7354b591a98511b2fa685c9c3f0547146c`
Audited fingerprint: `4cdaab94ff49290f50d993862ae65a25c79a6b67f94602fb7ca9b432cb29d363`

## Delivered

- Deck-first saved-deck journey with equal Solo/Online actions and no global
  `4人オンライン` switch.
- Invite-only create/join entry, fragment scrubbing, mutually exclusive entry,
  recovery, forming lobby, and existing started surfaces.
- Four staged lobby steps, exact empty/deck/ready blockers, accepted-deck
  resubmission, stable player labels, and no public internal IDs.
- Host invitation copy/reveal, rotate/reopen, admission close, participant-bound
  pre-start kick, start, and explicit host/non-host leave confirmation.
- Durable recovery UI with exact v3 compatibility and separately versioned v4
  host `admissionOpen` state for safe Worker-first rolling deployment.
- Action-local structured server/client failures, correlation IDs, correct retry
  actions, bounded body streaming/timeouts, and credential/private-card
  non-disclosure.

## Audit and verification

- Fresh-context Sol/high R3/BROAD cold audit and all affected-claim/R0 guard
  reauthorizations ended at `BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`.
- Final local full check passed Core `227/2093`, DOM `346/2342`, every verifier,
  docs, lint, TypeScript/Vite build, and production runtime graph verification.
- Final-repair browser evidence covered 375x812, 812x375, and 1440x900,
  accepted resubmission, close/reopen, real two-tab join/kick, local kicked
  error placement, 44px targets, overflow 0, and console error 0 in both tabs.
- Saved screenshots were inspected and contain no invitation, capability,
  internal Room/participant identifier, private deck/card content, or raw body.

## Release evidence

The Worker-first deploy completed with version
`31d3c58c-7d83-40ab-9e5b-a5d52229cba2`. Sanitized production recovery smoke
verified exact legacy v3 response compatibility, v4 admission open/closed
state, successful host close, and secret-free projection.

Actions run `32664162807`, build job `97254862165`, at exact candidate HEAD
`46b3a52aa67e8e746306409a899a7ba936445619` passed the complete canonical
check and exact diff-base resolution, then stopped only at the expected Judge
ownership gate. Independent exact-byte reauthorization returned
`O4P-08B-CI-OWNERSHIP-REAUTH-OK` with
`BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`.

Replacement Actions run `32665253749` checked out exact release HEAD
`63267987b17b09495eb773ad6b6f023863b78fc3` and passed:

- build job `97257541437`: full canonical check, exact diff-base, ownership
  scan, Pages configuration, and artifact upload;
- deploy job `97259236097`: Pages publication success.

Served Pages evidence after deployment:

- HTML: HTTP 200, 1,305 bytes, Last-Modified
  `Sun, 23 Aug 2026 20:56:34 GMT`;
- `assets/index-D_oRKqjq.js`: HTTP 200, 1,050,500 bytes;
- `assets/index-B3eS80pY.css`: HTTP 200, 210,498 bytes.

The Worker deployment list confirms version
`31d3c58c-7d83-40ab-9e5b-a5d52229cba2` at 100% allocation. Its root returns
the expected safe JSON HTTP 404. The release HEAD equals `origin/main` and the
worktree was clean before this terminal ledger candidate.

Public browser re-verification after Pages deployment passed:

- 375x812: Solo and Online actions both visible at 44px, overflow 0;
- 812x375: one invitation input, no Room ID label/input, minimum target 44px,
  overflow 0;
- 1440x900: create/join choices, no Room ID input, overflow 0;
- console error 0 at all three sizes.

## Independent completion audit

The terminal completion candidate updates only this packet, the synchronized
O4P-08B ledger entries, its completion-audit brief, and exact Judge review
expectations that project the next active domain as O4P-08C. It does not alter
product, Worker, dependency, workflow, configuration, generated, or O4P-08C/D
implementation bytes.

Fresh-context cold audit returned
`BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`.

`O4P-08B-COMPLETION-COLD-AUDIT-OK`

This shipped claim is bounded to O4P-08B. Variable roster, two-player life,
dynamic genesis/projection, and two-player table rendering remain pending in
O4P-08C/D. The record-bearing terminal metadata still requires exact-head CI,
Pages publication, HEAD/origin equality, and clean-worktree confirmation before
the O4P-08C cycle begins.

## Deferred

Variable two/four-player roster, two-player 20/40 life selection, dynamic
genesis/projection/replay, and two-player table/workbench rendering remain
exclusively in O4P-08C/D.
