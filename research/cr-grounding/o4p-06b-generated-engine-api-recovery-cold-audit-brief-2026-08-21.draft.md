# O4P-06B Generated Engine API Recovery — Cold Audit Brief

Milestone: `O4P-06B`
Base SHA: `53a170d6026b5aeb44ed28def2c7955552bc039d`
Semantic candidate fingerprint: `f054e8f25188239dd64c441b8fb599a12c76e132ef9f8b0944eb0b86bf83eaa5`
Risk lane: R1 generated-artifact recovery
Role: context-free cold auditor, findings only

## Allowed scope

- `docs/generated/engine-api.md` — generated only by `npm run generate:docs-api`
- this audit brief
- ignored `.claude/loop-state.md` fingerprint metadata

All product source, contracts, acceptance files, ledger files, package files,
lockfiles, configuration, tests, and release metadata are outside scope and
must remain unchanged.

## Audit evidence

Verify the base SHA, candidate fingerprint, exact diff, and generator output.
Confirm that the generated index is byte-for-byte current, lists the public
Core exports present in the frozen tree, and contains no hand-authored content.
Confirm that the prior O4P-06B product audit record remains applicable to the
unchanged product tree (`BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`).

## Required checks

```sh
git diff --name-status 53a170d6026b5aeb44ed28def2c7955552bc039d --
npm run generate:docs-api -- --check
git diff --check
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const excluded='research/cr-grounding/o4p-06b-generated-engine-api-recovery-cold-audit-brief-2026-08-21.draft.md'; const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean).filter((path)=>path!==excluded); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

Do not edit files or run the release full check. Return findings only with
`BLOCKER/HIGH/MEDIUM/LOW` counts and path/line evidence. A clean verdict is
`AUDIT-OK-PENDING-FULL-CHECK` with the verified candidate fingerprint.
