# O4P-06A Cold Re-Audit Brief 1

Milestone: `O4P-06A`
Base SHA: `04dd0575388d3aa5a09f63ef6123f67b63933fe3`
Repaired semantic fingerprint: `3a70300908eef07d3c6f0a19ce3b0ac8d572c1fa1ef8126fef1d93bbbb19fc9c`
Profile: `NARROW` (initial HIGH/MEDIUM closure only)

Read the initial brief and inspect only the repaired candidate against the two
initial findings:

- HIGH generic failure for a valid `roomId` equal to a configured seat
  capability;
- MEDIUM caller-supplied initialize-envelope override on the exported
  production size gate.

The repaired candidate must now:

1. reuse the shipped capability-fragment detector before construction for
   Room ID, Build ID, every participant ID, and every deck ID; return complete,
   deterministic, path-specific issues without capability text or partial
   state; and keep downstream validators authoritative;
2. expose a two-argument production size gate that always constructs and
   measures the exact Cloudflare initialize envelope, while any serialized
   boundary probe remains unable to create production evidence.

Reproduce the repaired semantic fingerprint over the complete
cached-plus-untracked tree excluding the two audit briefs:

```sh
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const excluded=new Set(['research/cr-grounding/o4p-06a-cold-audit-brief.draft.md','research/cr-grounding/o4p-06a-cold-reaudit-brief-1.draft.md']); const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean).filter((path)=>!excluded.has(path)); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

Run the invalidated target evidence only; do not run `npm run check`:

```sh
npx vitest run --project dom src/online/bootstrap/__tests__/cardCatalogV1.test.ts src/online/bootstrap/__tests__/fourDeckBootstrapV1.test.ts src/online/bootstrap/__tests__/sizeGateV1.test.ts src/online/bootstrap/__tests__/review.o4p-06a-four-real-deck-bootstrap.test.ts
npx eslint src/online/bootstrap
npx tsc -b
git diff --check
```

Return findings only, with `BLOCKER/HIGH/MEDIUM/LOW` totals. State whether each
initial finding is CLOSED or OPEN. Return `AUDIT-OK-PENDING-FULL-CHECK` only
when BLOCKER/HIGH are zero. Do not edit candidate files or create records.
