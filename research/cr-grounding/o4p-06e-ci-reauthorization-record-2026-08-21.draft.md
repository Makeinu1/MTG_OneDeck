# O4P-06E CI reauthorization record

- Date: 2026-08-21
- Candidate head: `bc72f4e5a346f7410d0f567d1af4ab573eb70168`
- Candidate parent / resolved diff base:
  `affb28de31ab562238b74199d0469a5bacef3d73`
- GitHub Actions run: `32442658673`
- Build job: `96656245129`
- Workflow: `Deploy to GitHub Pages`

## Immutable CI result

The run checked out the exact candidate head. `npm run check
-- --build-base=/MTG_OneDeck/` passed before the ownership stop:

- Core: 227 files / 2,093 tests passed;
- DOM: 322 files / 2,174 tests passed and 1 skipped (2,175 total);
- TypeScript/Vite build passed;
- machine-check total: 743,883 ms.

The diff base resolver passed and selected the exact candidate parent. The
next step failed only at `check:forbidden`. Pages configuration, artifact
upload, and deploy were skipped; this record makes no Pages or shipment claim.

## Ownership stop

The CI scan reported exactly 6 `NEEDS-REAUTH` paths and 14 `FORBIDDEN` Judge
draft/review paths, with no twenty-first path. Current SHA-256 values are:

| Category | SHA-256 | Path |
| --- | --- | --- |
| NEEDS-REAUTH | `b16bd93d32abdecb2d66eae0ded4cc460a142cbefff71ec11ec83a6e527e82ee` | `docs/contracts/manifest.json` |
| NEEDS-REAUTH | `8d02e8cb953937a85f6b104fbf76273f9b6830d3b963a7c63998c10d56755d13` | `research/cr-grounding/archive/o4p-06e-cold-audit-record-2026-08-21.md` |
| NEEDS-REAUTH | `86767707ff37ee25963f9f2b4931fb80fe2d2a009aa98a6ada2df71cccfb121b` | `research/cr-grounding/archive/o4p-06e-full-check-repair-1-audit-record-2026-08-21.md` |
| NEEDS-REAUTH | `474ffdab0cd94fa43332657c23c66e1f3e1c0319dbc91ba7739c4b70d73561cf` | `research/cr-grounding/archive/o4p-06e-full-check-repair-2-audit-record-2026-08-21.md` |
| NEEDS-REAUTH | `95aa08491881ce96fe4b564f171dbb2b63143e8e8e6f7762c2a6426259c72900` | `research/cr-grounding/archive/o4p-06e-manifest-reanchor-audit-record-2026-08-21.md` |
| NEEDS-REAUTH | `899766c51d37ac2258ef4b62b63b5871af349cc09200a39c896f697bb967ef04` | `research/cr-grounding/o4p-06e-acceptance-brief.draft.md` |
| FORBIDDEN | `5526ee709c14861108f457d48627a22da28f5691e16822ecdbdbd6b150a70f50` | `src/components/online/__tests__/review.o4p-06e-public-online-app.test.tsx` |
| FORBIDDEN | `8e58a0d006e76d38c040afb3312fc3c7ca9cefb8603580b61b2ae843e50ec354` | `src/test/architecture/review.o4p-01h-core-boundary.test.ts` |
| FORBIDDEN | `d3722ac21eadfc85fd26997e7e7836d3e1120164fa6c93df3399425f6069e2d5` | `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts` |
| FORBIDDEN | `62563aff387a4c5505eb7d3ded511a5a75b9a5306cdceb3b91dd2b3d717f3780` | `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts` |
| FORBIDDEN | `8af7dc7cf5fe5bbfcc735eef4af17bd38ceafc8461ca44a22f2580d5615b1ec6` | `src/test/architecture/review.o4p-06e-public-online-app-boundary.test.ts` |
| FORBIDDEN | `f7a6b07355d0986c8f634cf1c1d3b65027a90cffdb65f62e18a3ad7f421ae3d3` | `research/cr-grounding/o4p-06e-browser-evidence-2026-08-21.draft.md` |
| FORBIDDEN | `3b0f2febb633ae457ccca288b2ecd372ad725a6c0e6345fb7e5a49ea63e87e02` | `research/cr-grounding/o4p-06e-cold-audit-brief.draft.md` |
| FORBIDDEN | `ace48751f2e9233e235f5b9eef1d9e112f98e09df72e86239d5e24a32c71e299` | `research/cr-grounding/o4p-06e-full-check-repair-1-cold-audit-brief.draft.md` |
| FORBIDDEN | `af755a8c18aae49783577019b6d93583ac0be8af60024dc69d08ac93cc61096b` | `research/cr-grounding/o4p-06e-full-check-repair-1.draft.md` |
| FORBIDDEN | `fb0e06a44866fbeb09ef556a7b2eba7a09080469f87022b87588d10779e08865` | `research/cr-grounding/o4p-06e-full-check-repair-2-cold-audit-brief.draft.md` |
| FORBIDDEN | `748e9ad451de88250b9f78e3cf299018b6d68eac4208d02b48fd5ad9011529b7` | `research/cr-grounding/o4p-06e-full-check-repair-2.draft.md` |
| FORBIDDEN | `3d20cf331ce871c35d6b0a6dc41d6a9fb672f55ece80d3324a619dafa39f602a` | `research/cr-grounding/o4p-06e-implementation-brief.draft.md` |
| FORBIDDEN | `221f4a4f7c129de6628c482e9de327b7643c7d3dec4e35392fdd8afdca7118d9` | `research/cr-grounding/o4p-06e-manifest-reanchor-cold-audit-brief.draft.md` |
| FORBIDDEN | `f28c083e7960b67a045e2bc6ccc16195e762b1a02fece60381ae59ad4ebe5eeb` | `research/cr-grounding/o4p-06e-public-online-app.contract.draft.md` |

## Reauthorization boundary

The product cold audit, manifest audit, both full-check repair audits, and the
fingerprint-matched final local full check remain applicable. A follow-up
commit containing only this record and its independent audit brief is a
metadata-only parent diff. It does not change product, review, policy,
workflow, package, dependency, configuration, generated output, or ledger
semantics and therefore re-owns the already-audited Judge paths without
republishing their prior candidate diff.

Status: `O4P-06E-CI-REAUTHORIZATION-PENDING-INDEPENDENT-AUDIT`
