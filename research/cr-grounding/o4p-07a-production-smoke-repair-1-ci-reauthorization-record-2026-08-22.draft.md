# O4P-07A Production Smoke Repair 1 CI Reauthorization Record

Date: 2026-08-22
Candidate HEAD: `f099bd52f483f59f25f89b6696c62fa4e17f4863`
Candidate parent / resolved workflow diff base:
`3d2cc04f77cb4db1fd9ed0caa47e26b95d936f32`
GitHub Actions run: `32566560220`
Build job: `97015902640`
Deploy job: `97017217564` (`skipped`)

## Immutable exact-head result

The workflow checked out the exact candidate HEAD. Its full `npm run check --
--build-base=/MTG_OneDeck/` step passed before the ownership stop:

- Core: 227 files / 2,093 tests passed;
- DOM: 330 files / 2,236 passed + 1 skipped = 2,237 tests;
- every verifier, docs check, lint, TypeScript, and Vite build passed;
- machine-check total: 710,267 ms;
- built assets: `index-B8jI0XI3.js` and `index-DNaejTHC.css`;
- diff-base resolution selected the exact candidate parent above.

The next step failed only at `check:forbidden`. Pages configuration, artifact
upload, and deployment were skipped. This record makes no Pages, Worker, or
shipment claim.

## Exact ownership stop

The executable classifier separates the candidate from its exact parent into
exactly three `NEEDS-REAUTH` Judge records and one `FORBIDDEN` Judge-owned
review, with no fifth classified path:

| Category | SHA-256 at candidate HEAD | Path |
| --- | --- | --- |
| NEEDS-REAUTH | `8980cf0c829bb5012f37553d7cf8b9bf157a8e0babc48ad01e83ee0fe76a790c` | `research/cr-grounding/archive/o4p-07a-production-smoke-repair-1-cold-audit-record-2026-08-22.md` |
| NEEDS-REAUTH | `095983cca1c7a0f44c2f33b12f0af0e2032b48ecb6315e24c30674c3c166ca7a` | `research/cr-grounding/o4p-07a-production-smoke-repair-1-cold-audit-brief.draft.md` |
| NEEDS-REAUTH | `0e473d251417b68630e13c674ffd41d5d67774c760521ca7de8e0bee965df7a6` | `research/cr-grounding/o4p-07a-production-smoke-repair-1.draft.md` |
| FORBIDDEN | `de6d5936080eec3a16705f3efdce7d474acc87ad6552fb7ddedb561473b78f5b` | `src/online/cloudflare/__tests__/review.o4p-07a-dynamic-card-resolution.test.ts` |

The other two candidate paths are the audited one-line product repair and its
ordinary regression test; the classifier correctly assigns neither to a
Judge-only category.

## Reauthorization boundary

The product audit, same-fingerprint local full check, and exact-head CI full
check remain applicable. A follow-up commit may contain only this record, its
adjacent cold-audit brief, and the append-only release/CI evidence in the
archived repair audit record. It may not alter or reauthorize product, review,
policy, workflow, dependency, configuration, generated, ledger, CR, catalog,
or acceptance bytes, weaken the classifier, or claim skipped Pages/Worker
deployment as success.

## Auditor authorization

Independent read-only auditor `/root/o4p07a_luna_cold_auditor`
(`gpt-5.6-luna`, xhigh) verified the exact staged metadata candidate at
fingerprint
`36032ca431bcc921867bc83be3b8595149b0c75c874b27a61decab85ff69070a`.
The staged diff was exactly the three declared metadata files; all four
candidate hashes matched; classification was exactly three `NEEDS-REAUTH`, one
`FORBIDDEN`, and two non-Judge source/test paths; and findings were BLOCKER 0 /
HIGH 0 / MEDIUM 0 / LOW 0.

`O4P-07A-PRODUCTION-SMOKE-REPAIR-1-CI-REAUTHORIZATION-APPROVED`

This is ownership-only approval. It authorizes only this three-file metadata
commit/push and the subsequent exact-head CI/Pages closure. It does not itself
authorize shipment or Worker deployment.
