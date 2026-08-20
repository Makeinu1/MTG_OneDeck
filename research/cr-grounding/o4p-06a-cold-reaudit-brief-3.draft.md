# O4P-06A Cold Re-Audit Brief 3

Milestone: `O4P-06A`
Base SHA: `04dd0575388d3aa5a09f63ef6123f67b63933fe3`
Release semantic fingerprint: `6962744adcca1557aeda20c36db151df59fbc042165b4057000549facc7cf3da`
Profile: `NARROW` (post-audit Markdown hygiene only)

After re-audit 2, `git diff --cached --check` exposed Markdown trailing spaces
and extra EOF blank lines in Judge-owned O4P-06A briefs and the audit record.
The Judge removed only that whitespace. No source, fixture, ordinary test, or
Judge review meaning was intentionally changed.

Verify that the release fingerprint change from
`60de4071b387a14ec6b8a4437a6bcbef8b63c81d5f78adde8980698a8aad164b`
to the fingerprint above is confined to non-semantic Markdown whitespace in:

- `research/cr-grounding/o4p-06a-acceptance-brief.draft.md`;
- `research/cr-grounding/o4p-06a-cold-audit-brief.draft.md`;
- `research/cr-grounding/o4p-06a-cold-reaudit-brief-1.draft.md`;
- `research/cr-grounding/o4p-06a-cold-reaudit-brief-2.draft.md`;
- `research/cr-grounding/o4p-06a-four-real-deck-bootstrap.contract.draft.md`;
- `research/cr-grounding/o4p-06a-implementation-brief.draft.md`;
- `research/cr-grounding/o4p-06a-target-lane-correction-1.draft.md`;
- `research/cr-grounding/archive/o4p-06a-cold-audit-record-2026-08-20.md`.

Reproduce the release semantic fingerprint over the complete cached-plus-
untracked tree while excluding the four audit briefs and audit record:

```sh
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const excluded=new Set(['research/cr-grounding/o4p-06a-cold-audit-brief.draft.md','research/cr-grounding/o4p-06a-cold-reaudit-brief-1.draft.md','research/cr-grounding/o4p-06a-cold-reaudit-brief-2.draft.md','research/cr-grounding/o4p-06a-cold-reaudit-brief-3.draft.md','research/cr-grounding/archive/o4p-06a-cold-audit-record-2026-08-20.md']); const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean).filter((path)=>!excluded.has(path)); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

Required evidence:

```sh
git diff --cached --check
npx vitest run --project dom src/online/bootstrap/__tests__/review.o4p-06a-four-real-deck-bootstrap.test.ts
```

Return findings only with `BLOCKER/HIGH/MEDIUM/LOW` totals. State whether the
prior `AUDIT-OK-PENDING-FULL-CHECK` remains valid for the release fingerprint.
Do not edit files and do not run `npm run check`.
