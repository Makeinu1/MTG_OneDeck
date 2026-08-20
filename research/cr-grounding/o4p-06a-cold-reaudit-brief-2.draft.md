# O4P-06A Cold Re-Audit Brief 2

Milestone: `O4P-06A`
Base SHA: `04dd0575388d3aa5a09f63ef6123f67b63933fe3`
Final repaired semantic fingerprint: `60de4071b387a14ec6b8a4437a6bcbef8b63c81d5f78adde8980698a8aad164b`
Profile: `NARROW` (remaining MEDIUM closure only)

Re-audit only the remaining finding from re-audit 1. The production gate must
remain the sole creator of `o4p-06a-size-evidence-v1` and serialized artifact
output. The serialized equality/over-limit helper may remain public for AC-11,
but its successful result must be a distinct
`o4p-06a-size-probe-v1` measurement shape with neither an `evidence` field nor
a `serialized` field; failures retain the frozen production issue codes,
paths, and messages.

Reproduce the fingerprint over the complete cached-plus-untracked tree while
excluding all three audit briefs:

```sh
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const excluded=new Set(['research/cr-grounding/o4p-06a-cold-audit-brief.draft.md','research/cr-grounding/o4p-06a-cold-reaudit-brief-1.draft.md','research/cr-grounding/o4p-06a-cold-reaudit-brief-2.draft.md']); const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean).filter((path)=>!excluded.has(path)); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

Run the invalidated target evidence only; do not run `npm run check`:

```sh
npx vitest run --project dom src/online/bootstrap/__tests__/sizeGateV1.test.ts src/online/bootstrap/__tests__/fourDeckBootstrapV1.test.ts src/online/bootstrap/__tests__/review.o4p-06a-four-real-deck-bootstrap.test.ts
npx eslint src/online/bootstrap
npx tsc -b
git diff --check
```

Return findings only with `BLOCKER/HIGH/MEDIUM/LOW` totals, mark the remaining
MEDIUM CLOSED or OPEN, and return `AUDIT-OK-PENDING-FULL-CHECK` only when
BLOCKER/HIGH are zero. Do not edit candidate files or create records.
