# O4P-06A Recovery Cold-Audit Brief

Milestone: `O4P-06A`
Base SHA: `39bfbc518264263675ecfd24cb32bfae5b4cfd16`
Candidate fingerprint: `15a039868cd7b7a1f8590bd3ff1c514154ce3fd16dda258292c4a0d8ded00f0f`
Profile: `STANDARD`

Audit only these candidate paths:

- `src/test/architecture/modeNeutralCoreBoundary.test.ts`
- `src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts`
- `src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts`
- `src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts`

Acceptance claims:

1. `src/online/bootstrap/catalog/catalogV1.ts` and
   `src/online/bootstrap/fourDeckBootstrapV1.ts` may import only their enumerated
   symbols from the public `src/engine/core/index.ts` barrel.
2. No other Bootstrap file, Core subpath, unlisted Core symbol, namespace,
   re-export, dynamic import, or type-query obtains this allowance.
3. `bootstrap` is the only new registered `src/online` top-level module kind.
   Unknown Online module kinds remain rejected.
4. Existing Core purity, reverse-dependency, product-runtime, stack, projection,
   protocol, room, headless, and exact-module assertions remain active.
5. No production source, ordinary test, dependency, version, workflow, contract,
   or ledger byte is changed by this candidate.

Reproduce the candidate fingerprint while excluding this brief and the audit
record:

```sh
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const excluded=new Set(['research/cr-grounding/o4p-06a-recovery-cold-audit-brief-2026-08-21.draft.md','research/cr-grounding/archive/o4p-06a-recovery-audit-record-2026-08-21.md']); const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean).filter((path)=>!excluded.has(path)); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

Required evidence (do not run `npm run check`):

```sh
npx vitest run --project dom src/test/architecture/modeNeutralCoreBoundary.test.ts src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts src/online/bootstrap/__tests__/review.o4p-06a-four-real-deck-bootstrap.test.ts
npx eslint src/test/architecture/modeNeutralCoreBoundary.test.ts src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts
npx tsc -b
git diff --check
```

Perform bounded adversarial probes for claims 1–4 without retaining mutations.
Return findings only with exact path/line evidence and
`BLOCKER/HIGH/MEDIUM/LOW` totals. Return
`AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero. Do not edit,
create records, delegate, commit, or run the release full check.
