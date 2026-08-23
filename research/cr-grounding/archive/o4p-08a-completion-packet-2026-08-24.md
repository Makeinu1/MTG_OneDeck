# O4P-08A Completion Packet — 2026-08-24

Milestone: `O4P-08A`
Risk: R3 / BROAD
Implementation base: `2c338a69f41eb693696db12c086e706423679aa6`
Product commit: `050090564a91f59669357c2e1ea2fee6e03fa3f1`
Release HEAD: `209cc9553789391d8a3acd32e0adbe676640dbe3`

This packet contains only sanitized facts. Room IDs, participant IDs, shared
invites, seat/table capabilities, and raw API response bodies are not retained.

## Released outcome

- One reusable shared invitation admits the lowest available seat until the
  four-seat lobby is full, started, closed, or the invitation is rotated.
- Shared admission authority is exchanged for a unique participant/seat
  credential. Host-only invitation and table authority are excluded from
  non-host recovery responses.
- Browser recovery records preserve same-participant/same-seat re-entry across
  reload and browser restart and clear on terminal or credential-invalidating
  results. Legacy v1 creation remains compatible without persisting an
  unusable v3 recovery record.
- The host can rotate or close admission and kick a non-host only before start.
  Kick atomically clears the seat deck/readiness and revokes the old
  participant/seat credential. A non-host can leave; host leave closes the
  forming lobby.
- Recognized public failures use the closed v3 error envelope with a random
  correlation ID, HTTP status, retryability, and no credential or private-card
  material. Missing/rejecting bindings map to 503 and mutation abuse maps to
  429.

## Audit and verification chain

- Fresh-context Sol/high semantic and affected-claim cold audits closed at
  `BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0` after bounded remediation. Clean semantic
  fingerprint: `2047804951b54e402827594df6f44cb0fe4456aba5f03bd37b0ff89e19cc631b`.
- Exact historical guard reauthorization was independently audited at
  `0/0/0/0`; final product/guard fingerprint:
  `5ed88238d5d555fd111df533957650a1f67814f31ee404f6e7584f9816e6b9e3`.
- Judge review evidence passed 31 O4P-08A tests. The bounded regression set
  passed 12 files / 80 tests; targeted lint, TypeScript build, docs, and diff
  hygiene passed.
- Candidate Actions `32651781070` at the exact product commit passed the full
  canonical check, then stopped only at the expected Judge ownership boundary.
  Fresh-context reauthorization audit closed the two-file metadata candidate at
  `0/0/0/0` with final fingerprint
  `101d77ab1b6949a67e6d7a65b1afbd27d9655da9d6b12346c39bb4fd79d791a1`.

## Exact-head CI and Pages

Actions `32652846197` checked out exact release HEAD
`209cc9553789391d8a3acd32e0adbe676640dbe3` and passed:

- build job `97227007064`: full `npm run check`, exact diff-base, ownership
  scan, Pages configuration, and artifact upload;
- Core 227 files / 2,093 tests;
- DOM 342 files / 2,319 passed and 1 skipped (2,320 total);
- all verifiers, docs, lint, TypeScript, Vite build, and O4P-07C production
  graph checks;
- deploy job `97228706331`: Pages publication success.

Served Pages evidence after deployment:

- HTML: HTTP 200, 1,305 bytes;
- `assets/index-DvzndVuh.js`: HTTP 200, 1,034,297 bytes;
- `assets/index-DB7TO263.css`: HTTP 200, 207,206 bytes;
- HTML Last-Modified: `Sun, 23 Aug 2026 17:02:25 GMT`.

## Worker and sanitized production acceptance

Wrangler 4.125.0 deployed Worker version
`ce347521-0b6a-4bb9-9634-cfbecfdc716c` in deployment
`16558e13-1855-4681-b0bf-139a877a1d46`. It is the newest deployment at 100%
allocation, retains only `ONLINE_ROOMS` and `CF_VERSION_METADATA`, starts in 5
ms, and returns the expected safe-root HTTP 404.

A fresh production scenario passed from start to finish and proved shared
claim, same-seat recovery, non-host secret separation, non-host kick rejection,
invitation rotation and old-invite rejection, host kick and old-credential
revocation, admission closure, participant leave, host recovery, host close and
terminal room rejection, and correlation IDs on every exercised failure. The
sanitized result explicitly emitted no secret value.

Two earlier acceptance attempts stopped because the local smoke harness used
incorrect expected HTTP statuses for `CREDENTIAL_KICKED` and
`ADMISSION_CLOSED`; production returned its frozen 410 and 403 contracts. The
harness expectations were corrected and the entire scenario was rerun in a
new isolated room. No product byte changed.

## Deferred boundary and transition

O4P-08A deliberately does not redesign the public page, expose lobby host
controls, change the four-seat roster, or add two-player genesis/table
surfaces. Those user-visible tasks remain serially owned by O4P-08B through
O4P-08D. O4P-08B may start only after this terminal metadata receives an
independent completion audit, exact-head CI/Pages confirmation,
`HEAD == origin/main`, and clean-worktree transition.

## Independent completion audit

Fresh-context cold auditor `/root/o4p08a_completion_audit` first detected and
rejected a weakened evidence assertion. The Judge replaced it with exact
ordered equality for all O4P-08A evidence while preserving exact registration
evidence for O4P-08B/C/D. The affected review, lint, and diff hygiene passed.

The affected-claim re-audit recomputed seven-path fingerprint
`23b1bd67da820ac3ed57e8b739d739e32c4db378428d147d763dcb071d1bde4c`
and returned `BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`.

`O4P-08A-COMPLETION-COLD-AUDIT-OK:23b1bd67da820ac3ed57e8b739d739e32c4db378428d147d763dcb071d1bde4c`

Exact-head terminal CI/Pages confirmation and final clean transition remain
required after this record-bearing metadata is frozen.

## Terminal CI ownership evidence

Terminal candidate HEAD `007f116e25b101fee74d62dcf12db8a63152bdc8`
has parent/diff-base `209cc9553789391d8a3acd32e0adbe676640dbe3`.
Actions `32654555902`, build job `97231184084`, passed the complete canonical
full check and exact diff-base resolution before stopping only at the expected
Judge ownership scan. Pages configuration, artifact upload, and deployment were
skipped.

The classifier reported exactly three NEEDS-REAUTH research paths and four
FORBIDDEN Judge-review paths:

| Category | Path | Terminal candidate SHA-256 |
| --- | --- | --- |
| NEEDS-REAUTH | `research/cr-grounding/archive/o4p-08a-completion-packet-2026-08-24.md` | `196e3cf301ff569a2638ef97844187f583aa0e8c8dd459f298d4f93425ea5045` |
| NEEDS-REAUTH | `research/cr-grounding/cr-backbone-ledger.json` | `d8e9210c1bb3e244bc964026fe90dc5364e175be811a562412c435dc57d12318` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08a-completion-cold-audit-brief-2026-08-24.draft.md` | `14046738f7cf3535db6531479c1880dd22d172197745dc7fb04de020bb40560f` |
| FORBIDDEN | `src/test/architecture/review.gov-codex-56-program-orchestration.test.ts` | `5d9af7275626a8de51b8efacec1559f53aff4e3f34f7060a48ad09c379ecdceb` |
| FORBIDDEN | `src/test/architecture/review.o4p-06-roadmap-registration.test.ts` | `454f5e3276cdb53d48258b56206b621c2ca8812c4a0c385bf10e4b57fb11076a` |
| FORBIDDEN | `src/test/architecture/review.o4p-07-roadmap-registration.test.ts` | `01a1b5daf0a50ab4b00b14142fba295a3d43e8c9e53db4df89fc42fc992b6dbe` |
| FORBIDDEN | `src/test/architecture/review.o4p-08-roadmap-registration.test.ts` | `f177be0ba02df75d15da4841af4d61c65f11c6380990317df04a154dbd0c3ae6` |

The proposed follow-up commit appends only this evidence and the adjacent audit
instructions. It changes no ledger, review, product, dependency, workflow,
configuration, or generated byte, so its parent-only diff contains no
FORBIDDEN path. Replacement exact-head green CI/Pages, HEAD/origin equality,
clean worktree, and O4P-08B projection remain required.

Fresh-context auditor `/root/o4p08a_completion_audit` independently verified
this terminal reauthorization at two-file fingerprint
`45edabd858809472aa105f4a377e18d9261e2818fdc50aa9d6e5ef0fdcc3499d`
with `BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`.

`O4P-08A-TERMINAL-CI-OWNERSHIP-REAUTH-OK:45edabd858809472aa105f4a377e18d9261e2818fdc50aa9d6e5ef0fdcc3499d`

This approval authorizes only the two-file metadata commit and replacement
exact-head CI/Pages flow; it is not a broader product or shipment claim.
