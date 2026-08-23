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

## Exact-head CI ownership evidence

Semantic candidate HEAD and `origin/main`:
`46b3a52aa67e8e746306409a899a7ba936445619`

Workflow diff base:
`2cde9a6d69eaa12c54ca60ef1c63444c24486b1a`

Actions run `32664162807`, build job `97254862165`, checked out the exact
semantic candidate and passed the complete canonical
`npm run check -- --build-base=/MTG_OneDeck/` step plus exact diff-base
resolution. It then stopped only at the Judge ownership scan. Pages
configuration, artifact upload, and deployment were skipped.

The classifier reported exactly nine NEEDS-REAUTH research/design paths and
seven FORBIDDEN Judge-review paths. All other changed paths were unclassified.

| Category | Path | Semantic candidate SHA-256 |
| --- | --- | --- |
| NEEDS-REAUTH | `research/cr-grounding/archive/o4p-08b-cold-audit-record-2026-08-24.md` | `8e7360ea2c64dc0be30f38915583ae9e2f464ff89b6cd40d43f3d9eabd2917cc` |
| NEEDS-REAUTH | `research/cr-grounding/archive/o4p-08b-completion-packet-2026-08-24.md` | `65a310d5e53b8a6117e549e01d1beade15c85b198ea0ef61a89929683f9e3fa7` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08b-acceptance-brief.draft.md` | `d9ef1d688cbb4710def2e69ffe373b07cdd92614d7a54c7686e7de96106f4bfe` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08b-browser-evidence-2026-08-24.draft.md` | `0936fb7170fd74338b20b20fd6d6b64133714d5e750832c004c3ec54862ab017` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08b-cold-audit-brief.draft.md` | `0330c460c86ab1c6f51015dd6d9610ea1bfbd15480a35334a7f30db40532c3b8` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08b-production-implementation-brief.draft.md` | `2a7c4c15b25b42cca5e0f448ece8a496a08b65193f8c28b8b3ef78c7cff94da5` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08b-prototype-implementation-brief.draft.md` | `b9e48ca62cbb98effb90404ea6506e0590bb41b05518e8b0be20ee1b44397227` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-08b-public-online-journey.contract.draft.md` | `c1210c6bc75c78e7dbeb8d97f668d53c0127c5cf29b5763a35676b37b84b88ab` |
| NEEDS-REAUTH | `research/design/online-lobby-prototype/index.html` | `df02c831b365a0911b5d512caf2e6ccf9fb53dfb1f43e2d3da20be8f25cdf6d8` |
| FORBIDDEN | `src/components/online/__tests__/review.o4p-06e-public-online-app.test.tsx` | `b99c8543dd7bd7b198448fbb0fafd5833ed55ac07cbdc2b26598d7715d0a50ba` |
| FORBIDDEN | `src/online/cloudflare/__tests__/review.o4p-08a-membership-runtime.test.ts` | `baa5ed725ae8c1187ed47eae14d725b7160be9ca93b675bea5dc71a6db326082` |
| FORBIDDEN | `src/online/publicApp/review.o4p-07b-public-online-v2.test.ts` | `67655d90ec89482d223c3e48eaa98dfbb9e7f7f2d30f8d25400b460d58e5a1b5` |
| FORBIDDEN | `src/online/publicApp/review.o4p-08a-recovery-client.test.ts` | `84cb6de77c45507bb5458de63beca59b2723f8adb232a063ac9c29b4dbbe6313` |
| FORBIDDEN | `src/online/publicApp/review.o4p-08b-production-journey.test.ts` | `25893bb8b765745e91472b1f3a84cfd2a59cda08389e4c695908b9ccf43607cb` |
| FORBIDDEN | `src/test/architecture/review.o4p-08-roadmap-registration.test.ts` | `487c8b640c457c7c9dfd7f78e2b28a9dd476a4de50fe8d97736ae9430023bd4a` |
| FORBIDDEN | `src/test/architecture/review.o4p-08b-public-online-journey-boundary.test.ts` | `7957393bdadb160b00012decf67abbb4bb6d96cc9d8049cb5fedbb97ee42f340` |

The fresh-context auditor independently recomputed the exact partition and
hashes, verified privacy and scope, and returned
`BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`.

`O4P-08B-CI-OWNERSHIP-REAUTH-OK`

This authorization applies only to the exact base, HEAD, paths, and SHA-256
bytes above. The proposed follow-up changes only this record and the adjacent
completion packet; it changes no semantic candidate, source, ledger,
`review.*`, dependency, configuration, workflow, or generated byte. A
replacement exact-head CI/Pages flow remains required; this authorization is
not shipment evidence.
