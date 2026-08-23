# O4P-08B Completion Packet — 2026-08-24

Milestone: `O4P-08B`
Status: `audited-pending-release`
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

Replacement exact-head green CI/Pages, served-asset verification,
HEAD/origin equality, and clean worktree closure remain pending and must be
appended before status becomes `shipped`.

## Deferred

Variable two/four-player roster, two-player 20/40 life selection, dynamic
genesis/projection/replay, and two-player table/workbench rendering remain
exclusively in O4P-08C/D.
