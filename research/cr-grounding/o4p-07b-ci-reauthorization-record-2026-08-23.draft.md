# O4P-07B CI reauthorization record

Date: 2026-08-23
Candidate HEAD: `02c3bf9b9575774b26bc65bae23b7b15ba603ef1`
Candidate direct parent: `ead2ed875e84b932fb56e04055dd9621a6cecb39`
Resolved workflow diff base: `a650c5edc09afc03b59e3da9f55950485eec140d`
GitHub Actions run: `32588291754`
Build job: `97067900155`
Deploy job: `97069630947` (`skipped`)

## Immutable exact-head result

The workflow checked out exact candidate HEAD `02c3bf9`. Its full
`npm run check -- --build-base=/MTG_OneDeck/` step passed before the ownership
stop:

- Core: 227 files / 2,093 tests passed;
- DOM: 336 files / 2,262 passed + 1 skipped = 2,263 tests;
- every verifier, docs check, lint, TypeScript, and Vite build passed;
- machine-check total: 769,685 ms;
- built assets: `index-m9P-2onj.js` and `index-DB7TO263.css`;
- diff-base resolution selected the exact resolved workflow base above.

The next step failed only at `check:forbidden`. Pages configuration, artifact
upload, and deployment were skipped. This record makes no Pages or Worker
deployment claim.

## Exact ownership stop

The executable classifier reported exactly nine `NEEDS-REAUTH` Judge records
and eleven `FORBIDDEN` Judge-owned reviews, with no twenty-first path:

| Category | SHA-256 at candidate HEAD | Path |
| --- | --- | --- |
| NEEDS-REAUTH | `2b9164d913d4d6821d93d900cd8f884658478e7adb231795020748ff19b5699c` | `research/cr-grounding/archive/o4p-07b-cold-audit-record-2026-08-22.md` |
| NEEDS-REAUTH | `32dd62e64cf3a16500d50d873f9e12d1440b9de969fc3cd8c9954d1cd8e6466d` | `research/cr-grounding/o4p-07b-acceptance-brief.draft.md` |
| NEEDS-REAUTH | `066e74e038ed7988363cef35d9290e50600391f9a6b7bc778c92345431482096` | `research/cr-grounding/o4p-07b-arbitrary-deck-ui-dynamic-genesis.contract.draft.md` |
| NEEDS-REAUTH | `ba2b161ff430422607c056d7b278363603aa758b9fc055eb3c375e9eef08d5e6` | `research/cr-grounding/o4p-07b-cold-audit-brief.draft.md` |
| NEEDS-REAUTH | `0958f3085f20ab11121f7fc7ebd167c5e9665a1d7f5ef071cf4dc5d2e17a6573` | `research/cr-grounding/o4p-07b-full-check-repair-1-cold-audit-brief.draft.md` |
| NEEDS-REAUTH | `1ddfea24fed5bdff19363dc169c489416caafa133d74a7a8338db570de946c80` | `research/cr-grounding/o4p-07b-full-check-repair-1.draft.md` |
| NEEDS-REAUTH | `6fe1c300624d4297018a7644953f12326e645c83ceba6571fcfc5e3ab0d38244` | `research/cr-grounding/o4p-07b-full-check-repair-2-cold-audit-brief.draft.md` |
| NEEDS-REAUTH | `fd40f76d9889a2d8f03beb769702254d539f95708172edff1221136153dbd24f` | `research/cr-grounding/o4p-07b-full-check-repair-2.draft.md` |
| NEEDS-REAUTH | `0e1dbde8d04b1f414aa696b4e4efb88dd7d57d25a0ccd2b0c8fa48e48546eb50` | `research/cr-grounding/o4p-07b-implementation-brief.draft.md` |
| FORBIDDEN | `d3ab2be1f0f275a52fe5db1cf01113771c634ec05eca707d1c591fbe3507dd13` | `src/components/online/__tests__/review.o4p-06e-public-online-app.test.tsx` |
| FORBIDDEN | `9b785fd49c44b13308efe44f86ad71e6fe8a73ed424bfbc53b019fe3a1ba9bc8` | `src/online/cloudflare/__tests__/review.o4p-07b-dynamic-start.test.ts` |
| FORBIDDEN | `9f9f30368bc70fc676da631c7bf10671a3ae2dd55a94ba5becda7f61f7096807` | `src/online/genesis/__tests__/review.o4p-07b-dynamic-genesis.test.ts` |
| FORBIDDEN | `d46331f3831cb8ae5be034e09d87344a17ca9d41e591d7e3eb68dbe96efa0f92` | `src/online/publicApp/review.o4p-07b-public-online-v2.test.ts` |
| FORBIDDEN | `ee3cc63f04c21bc1318f43a204b5b8dbeb903ef9c62e6a111a6ec63568604160` | `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts` |
| FORBIDDEN | `6bcc40772523267bba44aaa4a8c311682bc1f1451af5d61cc9dd1460f86c2b8c` | `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts` |
| FORBIDDEN | `c7af6d63c217ab1cad259b06aaceeb36f7ccd5fc32d6db803272e8d71632aed5` | `src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts` |
| FORBIDDEN | `50aa37814a2e8d16a19a044b8c51558f086209a08b6cf5b8d596328baf96bc74` | `src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts` |
| FORBIDDEN | `5f2f488001997102e8d30617e86b116745e2a4454856954db11aae9a0a43e397` | `src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts` |
| FORBIDDEN | `34ee460553c60d61741f74277be4d1a8a8a4bf3580039747fc96565d6370654a` | `src/test/architecture/review.o4p-07a-dynamic-card-resolution-boundary.test.ts` |
| FORBIDDEN | `5b1b948951096024632b7c8b3befb10183cff15e04eb81302815d19468184c09` | `src/test/architecture/review.o4p-07b-dynamic-catalog-boundary.test.ts` |

## Reauthorization boundary

The product audit, correction audits, same-fingerprint local full check, and
exact-head CI full check remain applicable. A follow-up commit may contain only
this record, its adjacent cold-audit brief, and an append-only CI entry in the
existing O4P-07B audit record. It may not alter product, review, test, ledger,
policy, workflow, dependency, configuration, generated, CR, catalog, or
acceptance bytes. Its exact-head CI and Pages deployment must independently
pass before release or transition claims are made.

## Auditor authorization

Independent read-only auditor `/root/o4p07b_luna_cold_auditor`
(`gpt-5.6-luna`, xhigh) verified the exact three-file metadata candidate at
canonical fingerprint
`315ff8e646b716d94e79c0ba688e442c53143d94c5a1caefb3d2b33d8a83e4a9`.
All twenty candidate hashes, immutable CI identities and results, the exact
nine-plus-eleven classifier result, skipped deployment boundary, and unchanged
product/review bytes matched. Findings were BLOCKER/HIGH/MEDIUM/LOW =
0/0/0/0.

`O4P-07B-CI-REAUTHORIZATION-APPROVED`

This approval authorizes only the three-file metadata commit/push and its
exact-head CI/Pages closure. It does not itself authorize shipment, Worker
deployment success, or O4P-07C implementation.
