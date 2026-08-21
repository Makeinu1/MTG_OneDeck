# O4P-06F CI reauthorization record

Date: 2026-08-21
Milestone: `O4P-06F`
Candidate commit: `fc15775184d8c23c8193e0505c91018396591809`
GitHub Actions run: `32456019180`
Build job: `96693346056`
Workflow: `Deploy to GitHub Pages`

## Clean-checkout evidence

The run's exact `headSha` is the candidate commit. Step 5, `npm run check
-- --build-base=/MTG_OneDeck/`, succeeded in a clean checkout:

- Core: 227 files / 2,093 tests passed;
- DOM: 324 files / 2,185 tests passed and 1 skipped (2,186 total);
- TypeScript/Vite production build passed;
- machine-check total: 458,933 ms.

The diff-base resolver succeeded with base
`8810ed2e6db69fdc93c131f6abc195af6a763066`. The workflow then stopped only at
the expected Judge-ownership gate. Its output was exactly 13 `NEEDS-REAUTH`
paths followed by 4 `FORBIDDEN` Judge review paths; there was no eighteenth
path. Pages configure, artifact upload, and deployment were skipped. This
record does not claim Pages or production deployment.

## Exact ownership paths and candidate hashes

`NEEDS-REAUTH`:

| SHA-256 | Path |
|---|---|
| `866493eca0b1f9f5c70e56d21a0587bfd2b4095f8961151d191a823042bb89ad` | `package.json` |
| `e64d30958b2576d3767bedb19e1280409aa4918d2a87229bd264b61d643ddb55` | `research/cr-grounding/archive/o4p-06f-cold-audit-record-2026-08-21.md` |
| `5f62fff5e411ae1f04bf11d3ddb4c2f6cad503d2cd6b09d84a22767afbb80863` | `research/cr-grounding/archive/o4p-06f-full-check-repair-1-audit-record-2026-08-21.md` |
| `39b5030d29298a807fdc761546418406437800ad31ee1ae8a451fa515deda0df` | `research/cr-grounding/archive/o4p-06f-recovery-cold-audit-record-2026-08-21.md` |
| `d1567250b66b6d8133e2cbe8f9a545ae6431e5bb52f1385c0f17f49294d11f35` | `research/cr-grounding/o4p-06f-acceptance-brief.draft.md` |
| `33c3dfad634b38639480d21dec1251148cc4b1e2b1f6da0d152deb1351dfb28d` | `research/cr-grounding/o4p-06f-build-repair-1.draft.md` |
| `8e55f9f653495c7ce0539abc9310f48eef602602190fe04d811af6f7f3157cb6` | `research/cr-grounding/o4p-06f-cold-audit-brief.draft.md` |
| `ec39ffb0a5464996cc6879c23aa8c24e669529a8fd5f4ece019348cc3bda09a1` | `research/cr-grounding/o4p-06f-four-browser-production-release.contract.draft.md` |
| `0c996aea9ded55653baccb9d6df1b68833624e32c7ca32cc1f91cb3d1eb4c316` | `research/cr-grounding/o4p-06f-full-check-repair-1.draft.md` |
| `1a84949606ac2e47aeaa7ed90ef456afad601b3ea237bcdb2e30b15cfa997d67` | `research/cr-grounding/o4p-06f-full-check-repair-2.draft.md` |
| `8ddae9b72f080fa6ad302a8b4122e0c0db6073d56f6c72416ff80eb20c5b9b30` | `research/cr-grounding/o4p-06f-implementation-brief.draft.md` |
| `588286d68d82cadafcfab9a94d265fabdf24cfcbe0b023eda41e0b15f62d22e8` | `research/cr-grounding/o4p-06f-judge-surgery-1.draft.md` |
| `4fca7df5e508e9fd3efa720b052a2c6abff0b9a74c4a131e19b980927633411f` | `research/cr-grounding/o4p-06f-recovery-cold-audit-brief.draft.md` |

`FORBIDDEN` Judge-owned reviews:

| SHA-256 | Path |
|---|---|
| `52b1f7255734ef7d6ced86396a8f93e2ef9d3f3fc9d6cd9f67ca880059ea6e1e` | `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts` |
| `77ab16c255b5eff0cc72e018bfb8b1a35b477e4a1a0c001801d4e1b145c0df5c` | `src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts` |
| `c3fd6abf5cd2011552c1980ebb3a0e1e8db3ea220107ede01293ff575793069c` | `src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts` |
| `9cdb8576238fb3592ec563ad8a2c320498258fcc180ca5bb5eca7115315b9f77` | `src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts` |

The candidate commit carries the product cold-auditor and recovery-auditor
identities and their applicable zero-finding records. The next commit may
contain only this record and its context-free audit brief. Relative to the
candidate parent it therefore contains no prior implementation, Judge review,
verifier, package, policy, or runtime change; `check:forbidden` may reauthorize
those two metadata paths without weakening ownership rules.

This is CI ownership reauthorization, not production evidence or shipment.
