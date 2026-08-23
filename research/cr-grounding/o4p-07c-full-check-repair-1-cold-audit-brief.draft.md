# O4P-07C Full-Check Repair 1 Cold-Audit Brief

Date: 2026-08-23
Base SHA: `039f888923b21445cba60c811e2735284314d5a6`
Risk: R3 / BROAD correction audit
Authority: `research/cr-grounding/o4p-07c-full-check-repair-1.draft.md`

Read only. Do not edit files, run the release full check, commit, push, deploy,
or publish records. Return BLOCKER/HIGH/MEDIUM/LOW findings and the staged
candidate fingerprint supplied by the Judge.

## Audit scope

The approved O4P-07C product commit is immutable. Verify that the repair delta
contains only:

- the exact `../room/validationSupport` import admission and required hash
  replacements in the O4P-03A through O4P-03D Cloudflare verifiers;
- the derived hash chain in
  `scripts/checks/verify-o4p-05c-release-gates.ts` and
  `scripts/checks/verify-o4p-05d-production-release-closure.ts`;
- this brief and its authority repair record.

Independently recompute every pinned target. Confirm no executable assertion,
allowlist, import/source admission, timeout, dependency, production behavior,
UI/protocol meaning, ownership rule, or release requirement changed. Confirm
the first exact-head CI failure was the recorded O4P-03A frozen hash stop and
that all six repaired historical verifiers remain non-vacuous.

## Targeted commands

```sh
npm run verify:online-cloudflare-runtime-persistence
npm run verify:online-cloudflare-websocket-recovery
npm run verify:online-cloudflare-capability-abuse-control
npm run verify:online-cloudflare-production-gate
npm run verify:o4p-05c-release-gates
npm run verify:o4p-05d-production-release-closure
npx eslint scripts/checks/verify-online-cloudflare-runtime-persistence.ts scripts/checks/verify-online-cloudflare-websocket-recovery.ts scripts/checks/verify-o4p-05c-release-gates.ts scripts/checks/verify-o4p-05d-production-release-closure.ts
git diff --check
```

Return `O4P-07C-FULL-CHECK-REPAIR-AUDIT-OK` only when
BLOCKER/HIGH/MEDIUM/LOW are all zero. Full check and live release evidence remain
out of scope.
