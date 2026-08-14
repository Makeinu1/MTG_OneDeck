# O4P-04D CI Judge reauthorization

Milestone: `O4P-04D`

Published candidate HEAD: `7207073b3ef88edcc3549f6cf4f7b39fdb63b066`

GitHub Actions run: `31812534014`

The exact-head candidate run passed
`npm run check -- --build-base=/MTG_OneDeck/`, including every verifier, docs,
lint, Core 226 files / 2,086 tests, DOM 300 files / 2,079 passed + 1 skipped =
2,080 tests, TypeScript, and Vite build. It produced
`assets/index-CyZgN26K.js` and `assets/index-JeU5vEot.css`. The run then
stopped only at the governance ownership scanner; Pages was therefore skipped.

All `NEEDS-REAUTH` paths are Judge-owned contract, audit, brief, repair, or
design-evidence records. The nine hard `FORBIDDEN` paths below are
Judge-authored, Judge-surgically updated, or the independently audited
timeout-only predecessor repair rather than unauthorized implementer writes.
The design HTML is separately a Judge-owned `NEEDS-REAUTH` evidence path.

| Path | SHA-256 |
| --- | --- |
| `src/components/online/__tests__/review.o4p-04c-display-pairing.test.tsx` | `814e179277f1c9f30bbb5fd3fdea766de70738089d208e503280b18178bc322a` |
| `src/components/online/__tests__/review.o4p-04d-guided-actions.test.tsx` | `35d1115f1033102ade70b6a77fc3b8746620b7bcf3ad39f44cef6ec62695494b` |
| `src/online/cloudflare/__tests__/review.o4p-03d-cloudflare-production-gate.test.ts` | `3771acdf221e50f3609cbacec70b52993bdadfa9f961c017fa53f7ea7f8ef0a1` |
| `src/test/architecture/review.o4p-01h-core-boundary.test.ts` | `c188b2ea1f3ebd8652a0f9465876d5978130e5f8f3c698a87f1e10010efac546` |
| `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts` | `b144c43a372a62d55b4d69b9b177141f914e63c29f7863e4fde71270d188bee7` |
| `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts` | `20987958bb8cbda80e26b3db8e7c3526dba4ef3c738ce222bc298a3257749510` |
| `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts` | `7f7e4687f9f12e36321243ccd42e9f24ba6731a889bd6048f2e5821a25f70496` |
| `src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts` | `514e1ab03d98fe249fd4e8d899bfdf677a9c2c6a73da96fced78ca0c6981a39b` |
| `src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts` | `6aa0b17e0c40e33d81d48d59d00ccf2bc39bb3cc52babca5073af6daf877cc23` |
| `research/design/display-pairing/index.html` | `8112ee6ea229a54c95e75ae5ec95f0b8428323aa4b1ae3dc11f11a20bbdcd3ee` |

The same independent auditor must verify the candidate run/head identity, the
successful complete check, all ten listed hashes, and absence of any unlisted
hard forbidden path. After that confirmation, the Judge may commit only this
authority evidence, its audit brief, and the cold-audit-record append. Product,
review, test, contract, ledger, workflow, package, script, and design bytes
remain frozen. The next Actions diff must use the published candidate as its
base.
