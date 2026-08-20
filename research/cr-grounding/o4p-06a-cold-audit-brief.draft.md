# O4P-06A Pre-Release Cold-Audit Brief

Milestone: `O4P-06A`
Base SHA: `04dd0575388d3aa5a09f63ef6123f67b63933fe3`
Semantic candidate fingerprint: `45490e546083701af542442517e2ca84f8b0eb62b2374bdfb4e9fba0f265725d`
Profile: `BROAD` (R3 Core/Room/Protocol genesis and production-size meaning)

Audit the frozen candidate against:

- `research/cr-grounding/o4p-06a-four-real-deck-bootstrap.contract.draft.md`;
- `research/cr-grounding/o4p-06a-acceptance-brief.draft.md`;
- `research/cr-grounding/o4p-06a-target-lane-correction-1.draft.md`;
- `src/online/bootstrap/__tests__/review.o4p-06a-four-real-deck-bootstrap.test.ts`.

The semantic fingerprint was recorded immediately before this audit brief was
added. Reproduce it over the complete cached-plus-untracked tree while
excluding only this brief:

```sh
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const excluded='research/cr-grounding/o4p-06a-cold-audit-brief.draft.md'; const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean).filter((path)=>path!==excluded); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

Audit-specific priorities:

1. Prove the committed catalog is exactly the frozen 336-name offline set,
   with 308/11/17 provenance, strict routing, no duplicate live source IDs,
   the full Malakir modal DFC, valid Core definitions, and no raw-corpus or
   network dependency.
2. Adversarially inspect input validation, issue completeness/order/secrecy,
   exact-once deck parsing, preservation of all 100/100/104/100 cards,
   seat/owner/definition/object/zone isolation, and fresh deep freeze.
3. Verify complete revision-0 Core defaults, lifecycle, Room activation,
   Protocol validation, canonical determinism, and empty-journal replay. Look
   for partial-state, identity-crossing, hidden mutation, generic-error,
   validator-bypass, or fake-automation paths.
4. Verify the three exact UTF-8 measurements, canonical Protocol round trip,
   exact initialize envelope, equality acceptance, complete over-limit
   failure, and absence of truncation/compression/fallback.
5. Confirm scope is additive: no existing source/barrel, version, dependency,
   parser, Core/Room/Protocol/Cloudflare semantic, UI, workflow, or deployment
   change; O4P-06B through F remain deferred.

Required target evidence (do not run `npm run check`):

```sh
npm run check:forbidden -- --diff 04dd0575388d3aa5a09f63ef6123f67b63933fe3
npx vitest run --project dom src/online/bootstrap/__tests__/cardCatalogV1.test.ts src/online/bootstrap/__tests__/fourDeckBootstrapV1.test.ts src/online/bootstrap/__tests__/sizeGateV1.test.ts src/online/bootstrap/__tests__/review.o4p-06a-four-real-deck-bootstrap.test.ts
npx eslint src/online/bootstrap
npx tsc -b
git diff --check
```

Return findings only. Include severity totals as
`BLOCKER/HIGH/MEDIUM/LOW`, exact evidence actually executed, and
`AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER and HIGH are both zero. Do not
edit candidate files and do not create an audit record; the Judge owns it.
