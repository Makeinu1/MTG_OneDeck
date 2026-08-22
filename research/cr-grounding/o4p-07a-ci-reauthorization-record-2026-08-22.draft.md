# O4P-07A CI reauthorization record

Date: 2026-08-22
Candidate HEAD: `c3b2ba4981b57f00a184dc47fce644a4b823e793`
Candidate parent / resolved workflow diff base:
`55fe011700bd6bb10a699e1bd431f0bf12cc40cb`
GitHub Actions run: `32563744907`
Build job: `97009205018`
Deploy job: `97010643389` (`skipped`)

## Immutable exact-head result

The workflow checked out the exact candidate HEAD. Its full `npm run check --
--build-base=/MTG_OneDeck/` step passed before the ownership stop:

- Core: 227 files / 2,093 tests passed;
- DOM: 330 files / 2,234 passed + 1 skipped = 2,235 tests;
- every verifier, docs check, lint, TypeScript, and Vite build passed;
- machine-check total: 757,228 ms;
- built assets: `index-B8jI0XI3.js` and `index-DNaejTHC.css`;
- diff-base resolution selected the exact candidate parent above.

The next step failed only at `check:forbidden`. Pages configuration, artifact
upload, and deployment were skipped. This record makes no Pages, Worker, or
shipment claim.

## Exact ownership stop

The executable local classifier separates the CI log's interleaved stdout and
stderr into exactly 14 `NEEDS-REAUTH` Judge records and 10 `FORBIDDEN`
Judge-owned reviews, with no twenty-fifth path:

| Category | SHA-256 | Path |
| --- | --- | --- |
| NEEDS-REAUTH | `9f3b93d2715039b4d3aef9a3273e47f62e8fec7f3425e776d22a0e28278684fc` | `research/cr-grounding/archive/o4p-07a-cold-audit-record-2026-08-22.md` |
| NEEDS-REAUTH | `b27e79e532377c589845782798def4fe7958411536ffd3fda2e14bfe9408916e` | `research/cr-grounding/o4p-07a-acceptance-brief.draft.md` |
| NEEDS-REAUTH | `9c06d0d24dae9eab3b7641484391cd3b30b342b7c90283791ba62347f49b498c` | `research/cr-grounding/o4p-07a-cold-audit-brief.draft.md` |
| NEEDS-REAUTH | `9666efc1dabeee763edd959d8edd723870208c698111f70b2fe704a92f2456c8` | `research/cr-grounding/o4p-07a-correction-1-cold-audit-brief.draft.md` |
| NEEDS-REAUTH | `b10387626bb1b0448d9ad526f4e15deb887ab2a77f2058b2d6cbac07c2b3ea90` | `research/cr-grounding/o4p-07a-correction-2-cold-audit-brief.draft.md` |
| NEEDS-REAUTH | `f7a29ccdd668ece78a9841d53d2074dea6b9199306d50f832d8b8522fa92150f` | `research/cr-grounding/o4p-07a-dynamic-card-resolution.contract.draft.md` |
| NEEDS-REAUTH | `0bf93383277048d79e5415305e6b7bc322999797ee7668f7a7fe05cdf7ec2c1a` | `research/cr-grounding/o4p-07a-full-check-repair-1-cold-audit-brief.draft.md` |
| NEEDS-REAUTH | `6ae5e980a35e6afc7462498dfbdf8ca686ed555aa7ba3e0e7e4d956304c2e221` | `research/cr-grounding/o4p-07a-full-check-repair-1.draft.md` |
| NEEDS-REAUTH | `5945a861aa8d9a8807b65996c2dfcaa9c41c0db2c5ed1ec3edc77345e9a0c18a` | `research/cr-grounding/o4p-07a-full-check-repair-2-cold-audit-brief.draft.md` |
| NEEDS-REAUTH | `5313f67b9b800466106e561e0ee942404b778c3414c30d991b092c5025df70c8` | `research/cr-grounding/o4p-07a-full-check-repair-2.draft.md` |
| NEEDS-REAUTH | `e3009e50efb904cbc87127555eb4df1e94a2049c1b8a3d48721b4425a6b7f2bb` | `research/cr-grounding/o4p-07a-implementation-brief.draft.md` |
| NEEDS-REAUTH | `8ea7e41f19536882f48567f3ef7490f58f54ba9d99e5c8832fa3c431e198edd6` | `research/cr-grounding/o4p-07a-judge-surgery-1.draft.md` |
| NEEDS-REAUTH | `d291561eefdfa74bda4ca07587fa5723b64737e5ecfa18f3d15d7f93fdcfffd8` | `research/cr-grounding/o4p-07a-verifier-reauthorization-cold-audit-brief-2026-08-22.draft.md` |
| NEEDS-REAUTH | `872987328ac19bed5371dc1e15e22246c3da40ff4b49b128dafcdc1c21074cf8` | `research/cr-grounding/o4p-07a-verifier-reauthorization-record-2026-08-22.draft.md` |
| FORBIDDEN | `4c8043575d9d2652d1bf46fd94df73b5a1d24c10c3afa285c204e79f01c01b62` | `src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts` |
| FORBIDDEN | `b359f507a8743e6ebde9eb2497205b5b9b185b79bfed663d40a583c2a9b94601` | `src/online/cloudflare/__tests__/review.o4p-07a-dynamic-card-resolution.test.ts` |
| FORBIDDEN | `af951d057aa17dc4af5a5c14d9b357a42e4e7254e16022b9bb1737dd378e3a90` | `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts` |
| FORBIDDEN | `4d434e16a1736c51c4fe8c3b51b5a4333714ed2fe4d31705c3d3c6016fb1ae43` | `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts` |
| FORBIDDEN | `0e624b80a476f1b876e80c0eb3d38fb5dbc3712ea557b2e521bd8ebc6cddcab9` | `src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts` |
| FORBIDDEN | `b22bea7d1a2275a4e2fab43779f66c7f8c9e9868e5287a91abaebdb020c531c4` | `src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts` |
| FORBIDDEN | `cf3212f0c3f319b14fb0cab23c165ffc9fab02647c509d2be8fae051b04dc5a2` | `src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts` |
| FORBIDDEN | `e3e06a3e7e0257337755ceff6dfad433f5cda5f6ce22663aed4521684ab341a3` | `src/test/architecture/review.o4p-03d-cloudflare-production-gate.test.ts` |
| FORBIDDEN | `5ece5e790a98ba933e173fb918e87018210a7becfa0c04d8aaf991f8833427ce` | `src/test/architecture/review.o4p-07-roadmap-registration.test.ts` |
| FORBIDDEN | `e2b20b253ef55e7884f8443f984cc90fa372a82bf778087c9017f4ee126e3119` | `src/test/architecture/review.o4p-07a-dynamic-card-resolution-boundary.test.ts` |

## Reauthorization boundary

The product audit, all correction audits, repair-2 re-audit, same-fingerprint
local full check, and exact-head CI full check remain applicable. A follow-up
commit containing only this record, its adjacent cold-audit brief, and the
append-only repair-2/CI evidence in the archived audit record is parent-only
metadata. It does not alter or reauthorize product, review, policy, workflow,
dependency, configuration, generated, or ledger bytes; weaken the classifier;
or claim skipped Pages/Worker deployment as success.

## Auditor authorization

Independent read-only auditor `/root/o4p07a_luna_cold_auditor`
(`gpt-5.6-luna`, xhigh) verified the exact staged metadata candidate at
fingerprint
`46d430a94aba859cc1e32118301424a8a1d536a8edbbab27fd22e2630ede1717`.
All 24 candidate hashes matched, the immutable candidate classification was
exactly 14 `NEEDS-REAUTH` plus 10 `FORBIDDEN`, the parent diff contained only
the three declared metadata files, and findings were BLOCKER 0 / HIGH 0 /
MEDIUM 0 / LOW 0.

`O4P-07A-CI-REAUTHORIZATION-APPROVED`

This is ownership-only approval. It authorizes only this three-file metadata
commit/push and subsequent exact-head CI/Pages closure; it does not itself
authorize shipment or Worker deployment.
