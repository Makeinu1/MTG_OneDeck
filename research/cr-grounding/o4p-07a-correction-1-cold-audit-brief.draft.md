# O4P-07A Correction 1 Context-Free Re-Audit Brief

Date: 2026-08-22
Milestone: `O4P-07A`
Base SHA: `55fe011700bd6bb10a699e1bd431f0bf12cc40cb`
Pre-brief corrected tree fingerprint:
`29b100414ba7dab6bb8b1b7378bc7db9c98cb101575ee21871538caa67fa03fb`
Profile: `BROAD` (R3 correction re-audit)

Read `AGENTS.md`, the development skill/governance reference, the frozen
O4P-07A contract and acceptance brief, the initial cold-audit brief, and
`research/cr-grounding/o4p-07a-judge-surgery-1.draft.md`. Audit the corrected
frozen candidate read-only. Do not edit files, stage/commit, run `npm run
check`, deploy, push, or use network/secrets.

Reproduce the pre-brief fingerprint while excluding only this correction brief:

```sh
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const excluded='research/cr-grounding/o4p-07a-correction-1-cold-audit-brief.draft.md'; const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean).filter((path)=>path!==excluded); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

Re-run the original adversarial proofs for all initial findings:

- hold v2 resolution, submit v1 on the same seat, release v2, and prove the
  old completion is write-free/stale while v1 metadata survives;
- persist digest-consistent invalid optional `CardDef`, noncanonical history,
  and out-of-range issue index rows and prove projection/replay fails closed;
- submit v2 after `started` and prove no state mutation or resolver call;
- feed wrong-typed optional Scryfall fields and prove
  `SCRYFALL_UNAVAILABLE`, not a sanitized snapshot;
- delete/alter the expected head or history before completion/invalidation and
  prove exact-one CAS failure rolls back head, history, snapshot, and lobby.

Also inspect the complete corrected diff for new regression, data leakage,
overbroad language/card rejection, replay inconsistency, missing-row acceptance,
or v1 behavior drift. O4P-07A must still leave UI, fixed catalog, start/genesis,
dependencies, configuration, deployment, ledger, and O4P-07B/C untouched.

Required bounded evidence remains the exact command set in
`research/cr-grounding/o4p-07a-cold-audit-brief.draft.md`, with the Judge review
now expected at 8 cases and the combined target lane at 59 tests. Do not run
the release full check.

Return consolidated `BLOCKER/HIGH/MEDIUM/LOW` totals, exact executed evidence,
the pre-brief and final tree fingerprints, and
`AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero and all initial
findings are closed. Do not create or edit the audit record.
