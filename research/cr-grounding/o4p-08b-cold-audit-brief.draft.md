# O4P-08B Cold Audit Brief

- Milestone: `O4P-08B`
- Risk / breadth: `R3 / BROAD UI`
- Required predecessor: `O4P-08A` shipped at `2cde9a6d69eaa12c54ca60ef1c63444c24486b1a`
- Product-cycle base: `8bd8ac143943182d920b5bf8608b4b1c0e3109fd`
- Initial candidate commit: `811cd7b1076ce09f3df06b2c0e7f60552211f31b`
- Initial candidate fingerprint: `f8e6428f29a832cb5b6ef09a21cb40084ab389782dc81ce75e4d22a03447d3d0`
- Repair candidate commit: `14b1726ab9ee911fb66133b0cd6e7aad9cd2d5b5`
- Repair candidate fingerprint: `9535cad0d32a6ec5de24995c9c164c72060f64c668c864c8daa9ee6d088aa12b`
- Final repair candidate commit: `91f200f1b2fdfa850b65e6488cb52e665b13bd7b`
- Final repair candidate fingerprint: `6a246c181097cb0d04331687a4e9ae5c9f4c102314bf09988de0721b0a0850ad`
- Final-2 repair candidate commit: `3411cb5e6496b4e244d54602129731f5fb897738`
- Final-2 repair candidate fingerprint: `15bb81ebc22fdf269d4cbddb201cd1a918d08ae4cf54f8e7404ca78622623f14`
- Final-3 evidence candidate commit: `3d9cf6cf9b0f7413574d6748b5a14a9218bfcfd1`
- Final-3 evidence candidate fingerprint: `af13dbeb72be6bd29681d6b299725aa0e6cc216e3fd8316e2edc0aa775c200df`
- Final-4 evidence candidate commit: `ed5a72ce52704a500c427982f97e92b8a83bd1c4`
- Final-4 evidence candidate fingerprint: `bb99d6b328ca908fb867fa3db293af8ba7c9a2b0c096b6990aaf77519b876691`
- Full-check hash-repair commit: `41f51598bd7e883aaa82b265a9fabdb61bfe2c00`
- Full-check repair fingerprint: `25c9bc1f599aeb1830af5b6aa9cf78286cc9f5b652c05286c5edc6fd1db7159d`
- Full-check exact-path repair commit: `da7f6c7354b591a98511b2fa685c9c3f0547146c`
- Full-check exact-path fingerprint: `4cdaab94ff49290f50d993862ae65a25c79a6b67f94602fb7ca9b432cb29d363`
- Contract: `research/cr-grounding/o4p-08b-public-online-journey.contract.draft.md`
- Acceptance: `research/cr-grounding/o4p-08b-acceptance-brief.draft.md`
- Browser evidence: `research/cr-grounding/o4p-08b-browser-evidence-2026-08-24.draft.md`

## Fingerprint procedure

From the repository root, compute over the sorted changed paths between the
product-cycle base and candidate:

```sh
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const paths=execFileSync('git',['diff','--name-only','8bd8ac143943182d920b5bf8608b4b1c0e3109fd','da7f6c7354b591a98511b2fa685c9c3f0547146c'],{encoding:'utf8'}).trim().split('\\n').filter(Boolean); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

The result must equal the full-check exact-path fingerprint above before auditing.

## Candidate paths

```text
research/cr-grounding/o4p-08b-browser-evidence-2026-08-24.draft.md
research/cr-grounding/o4p-08b-public-online-journey.contract.draft.md
src/App.css
src/App.tsx
src/components/online/PublicOnlineApp.tsx
src/components/online/__tests__/review.o4p-06e-public-online-app.test.tsx
src/components/online/publicOnlineApp.css
src/online/cloudflare/__tests__/review.o4p-08a-membership-runtime.test.ts
src/online/cloudflare/runtime.ts
src/online/publicApp/index.ts
src/online/publicApp/o4p08b.production.test.ts
src/online/publicApp/review.o4p-07b-public-online-v2.test.ts
src/online/publicApp/review.o4p-08a-recovery-client.test.ts
src/online/publicApp/review.o4p-08b-production-journey.test.ts
src/online/publicApp/types.ts
src/online/publicApp/v2.ts
src/test/architecture/review.o4p-08b-public-online-journey-boundary.test.ts
```

## Audit instructions

This is a read-only, findings-only cold audit. Do not edit files, change git
state, run the full `npm run check`, or infer acceptance from implementer or
judge reports. Inspect the contract, acceptance brief, every candidate path,
the relevant shipped O4P-08A public contracts/API, and the existing fixed-four
started surfaces.

Audit at minimum:

1. deck-first ordering and the absence of the old global/four-player entry;
2. one-field shared-invite admission, fragment scrubbing, and no Room ID input;
3. mutually exclusive entry/join/recovery/lobby/started states and truthful
   recovery/leave clearing;
4. exact step/current-state semantics, deck/ready progression, occupied-seat
   blockers, and no empty-seat fake deck/ready state;
5. authoritative host-only rotate/close/kick/start, confirmation boundaries,
   closed-admission presentation, and no post-start moderation;
6. structured server and local offline/timeout/invalid-response/upgrade errors,
   action-correct retry, correlation IDs, and placement near the responsible
   operation;
7. strict response validation, bounded reads/timeouts, stale-request or retry
   hazards, and safe controller subscription/lifecycle behavior;
8. non-disclosure of Room/participant IDs, invitation/seat/table capabilities,
   private deck/card information, raw response bodies, or bearer fragments in
   UI, notices, errors, attributes, tests, and evidence;
9. preservation of fixed-four O4P-08B scope and existing personal/table/guided
   started surfaces without claiming two-player support;
10. semantic keyboard reachability, visible focus, 44px targets, responsive
    overflow behavior, and adequacy/non-vacuity of ordinary and independent
    review tests;
11. no dependency/version/schema/config change and no hidden expansion into
    O4P-08C/D.

The initial audit reported `0 BLOCKER / 7 HIGH / 3 MEDIUM / 0 LOW`. The repair
candidate addresses each reported path: accepted-deck resubmission, rotation
after admission close, authoritative recovered admission state, running-client
kick detection, participant-bound kick confirmation, bounded/timeout-covered
body streaming, safe recovery-error filtering, operation-local error placement,
non-JSON 426 mapping, and private-card-name redaction.

The second audit reported `0 BLOCKER / 4 HIGH / 3 MEDIUM / 0 LOW`. The final
repair preserves the closed v3 recovery response exactly and adds a distinct
v4 recovery wire shape, filters both seat and Table credentials from recovery
errors, restores structured started-action feedback, replaces inferred kick
blame when local recovery is already cleared, moves genesis failure beside
start, cancels declared oversized bodies, and records a new final-candidate
two-tab browser session covering accepted resubmission, close/reopen, bound
kick confirmation, kicked-client error placement, overflow, targets, and zero
console errors.

The third audit reported `0 BLOCKER / 2 HIGH / 1 MEDIUM / 0 LOW`. The final-2
repair makes the outer Worker recognize exact v4 recovery as a structured
public request, binds membership-loss classification to the active room,
participant, and seat credential, and persists all five final-repair PNGs. The
saved kick artifacts were re-captured after hiding the invitation; rendered
text scans found no Room/participant identifier or invitation/seat/Table
credential marker, and the kicked join input was empty.

The fourth audit reported `0 BLOCKER / 1 HIGH / 0 MEDIUM / 0 LOW` because the
375 screenshot used a full-page capture that included private saved-deck/card
content. The final-3 evidence overwrites that artifact with a privacy crop of
only the equal Solo/Online action row from the measured 375x812 viewport. It
contains no saved-deck name, artwork, commander label, editor text, or card row.

The fifth audit reported `0 BLOCKER / 1 HIGH / 0 MEDIUM / 0 LOW` because the
evidence list still referenced the older full-page deck screenshot. Final-4
removes all three stale first-session references and overwrites the old 375px
file itself with the same privacy-safe action crop. Only the five final-repair
artifacts remain listed.

After the final evidence audit passed `0/0/0/0`, the first executable full
check stopped at the historical O4P-05C frozen-authority hash for the intended
O4P-08B `runtime.ts` change. The full-check repair changes only the exact
`runtime.ts` and `worker.ts` SHA-256 values in
`scripts/checks/verify-o4p-05c-release-gates.ts`, then updates only the exact
successor SHA-256 of that verifier in
`scripts/checks/verify-o4p-05d-production-release-closure.ts`. Both targeted
verifiers and ESLint pass. Audit these two script changes as an R0 exact-byte
reauthorization before the final full-check rerun; no wildcard, path-scope,
authority, dependency, or runtime behavior change is allowed.

The next full-check rerun passed all historical gates, lint, and Core
`227 files / 2093 tests`, then DOM found one ownership-only failure in
`review.o4p-08-roadmap-registration.test.ts`: its exact changed-path set stopped
at O4P-08A and did not yet list the authorized O4P-08B contract, prototype,
product, ordinary tests, Judge reviews, architecture review, browser evidence,
and cold-audit brief. The repair adds only those 19 literal paths. It adds no
wildcard, directory prefix, dependency/config path, or O4P-08C/D path; the
target review passes `5/5` and ESLint is green. Reauthorize this exact-path
repair before the final full-check rerun.

The repair candidate evidence is: related DOM/runtime/public tests `60/60`,
architecture `4/4`, online-room domain `23/23`, ESLint green, `tsc -b` green,
`git diff --check` green, and `ui-responsive` domain green (`103 files / 677
tests` then `204 files / 1361 tests`). Judge-owned `review.*` changes remain a
later exact-path reauthorization gate, not product acceptance.

Return every finding with `BLOCKER`, `HIGH`, `MEDIUM`, or `LOW`, exact file and
line evidence, and a concise rationale. If BLOCKER/HIGH are zero, return exactly
`AUDIT-OK-PENDING-FULL-CHECK` plus all severity counts. Do not create the audit
record; the judge records the findings.
