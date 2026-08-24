# O4P-08D Fresh-Context Cold Audit Brief

Milestone: `O4P-08D`
Risk: `R3 / BROAD`

Audit only the frozen candidate fingerprint supplied by the Judge. Read the D
contract and acceptance brief, inspect source and Judge reviews, and run bounded
tests as needed. Do not edit files and do not infer intent from implementation
history.

Adversarially verify:

- exact create v5 and variable recover v5 without legacy byte drift;
- immutable configuration and exact 2/4 lobby/start blockers;
- complete player/table projection with v1-equivalent privacy and no P3/P4 in
  a two-player room;
- Personal Workbench, Table Display, Display Pairing, Guided Actions, action
  binding, focus/correction/combat targets, and four-player regression;
- recovery/kick/invite/error secret safety and browser persistence boundaries;
- 375x812, 812x375, 1440x900 accessibility/overflow/console evidence;
- no Duel Commander, legality gate, account, matchmaking, ban, team, dependency,
  governance, or unrelated product widening.

Return findings only, classified BLOCKER/HIGH/MEDIUM/LOW, with file and line.
BLOCKER/HIGH must be zero before release.

## Exact-head CI ownership addendum

Semantic candidate `2ed98c1bf857786266d9e14f42e346716712b2ab` was
published to `main`. GitHub Actions run `32684809615`, build job
`97307842471`, checked that exact HEAD, passed the canonical
`npm run check -- --build-base=/MTG_OneDeck/` step and exact diff-base
resolution from `bfedd42099d1d315ba13d9ace7da2498f47909fe`, then stopped only
at `check:forbidden`. Pages configuration and artifact upload were skipped.

The authoritative classifier partition was exactly five `NEEDS-REAUTH`
research paths and nine `FORBIDDEN` Judge review paths:

| Category | Path | SHA-256 at `2ed98c1` |
|---|---|---|
| NEEDS-REAUTH | `research/cr-grounding/o4p-08d-acceptance-brief.draft.md` | `42b24c5ebe12181ca0f4b5d2ab29a9f6d0bfa2a04b8ae1f53ad26f0a757f50f9` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08d-browser-evidence-2026-08-24.draft.md` | `300a4a391484d2d8711faa538f6ac85446ce125051c6247182804cab64e3af20` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08d-cold-audit-brief.draft.md` | `891a6fe601a716d0ccced5a3dbb01554d38298f775528525bf1f2350582f239a` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08d-implementation-brief.draft.md` | `fa928bbfacfb7dedcafd3a1945d101abd6d98035c3a607e53f6cd4efab43f589` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08d-two-player-surfaces-release.contract.draft.md` | `3b2652b634df5e52b8d5044dce198a4a4e63c89d883a9de624fe7dc86d79eee4` |
| FORBIDDEN | `src/components/online/__tests__/review.o4p-06e-public-online-app.test.tsx` | `630a6e5d860df278f46e14c3776b38a2ac3fc0a52b8e2ab5bee667625ed58f92` |
| FORBIDDEN | `src/online/projection/__tests__/review.o4p-08d-full-variable-surfaces.test.ts` | `f611658db32fdc8e541e6e0496216cccb887bbb983c3ce36f77834899def623e` |
| FORBIDDEN | `src/online/publicApp/review.o4p-08d-variable-public-client.test.ts` | `523f4fadbd776d524c849dfcd863c6996a496e03027641e210cf2fea06557b38` |
| FORBIDDEN | `src/test/architecture/review.o4p-06d-browser-websocket-recovery-boundary.test.ts` | `025bec15d77d04bda4b137a0c41de97b4ea8d2070d7db7482891e0198d1f8341` |
| FORBIDDEN | `src/test/architecture/review.o4p-07b-dynamic-catalog-boundary.test.ts` | `ad7b81b2cf4dd0a852a0cdcab4b12fb39f63f0b6ac9421857c8ac4731ea14f07` |
| FORBIDDEN | `src/test/architecture/review.o4p-08-roadmap-registration.test.ts` | `d4b0f77464c12d0456710e04f6f10850a84f1ee6f673edc163ba9222a5e5c401` |
| FORBIDDEN | `src/test/architecture/review.o4p-08b-public-online-journey-boundary.test.ts` | `d74debb5af9d410ee1699acd9c2c542e909ef8f6e9f10d76024fbd73076b63af` |
| FORBIDDEN | `src/test/architecture/review.o4p-08c-variable-roster-boundary.test.ts` | `06b16d17e6fe87c9864ac811a57e9f8447aaa1cf94e47e7ab71ff84735f334ca` |
| FORBIDDEN | `src/test/architecture/review.o4p-08d-program-completion-boundary.test.ts` | `b20779920f3dc0ca639979355e37b6e58c34fc6c11884a16c2a31536eb562f9d` |

The same fresh-context cold auditor independently recomputed all fourteen
commit blobs, confirmed the exact classifier partition and successful
exact-head full-check step, and returned
`BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0` plus
`O4P-08D-EXACT-BYTE-JUDGE-REAUTHORIZATION-APPROVED`.

This approval authorizes only the exact bytes above and this parent-only
metadata follow-up. It does not change semantic candidate bytes and is not
shipment evidence; replacement exact-head CI and Pages verification remain
required.
