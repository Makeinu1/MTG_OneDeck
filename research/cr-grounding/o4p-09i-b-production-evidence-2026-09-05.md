# O4P-09I-B production reliability evidence — 2026-09-05

Scope: B only. Human comprehension (C), complete match, four-player continuity,
three-viewport certification, and Arena scores (I) are not certified here.

## Exact production candidate

- SHA: `53afcf3eead5cce6519d1ea555bf825ff0d2ee7a`
- Inspect fingerprint: `c98fc754c219c1d0d2a52ca21d05faa24e1c24ec6444327a8d880caab7f1df9a`
- Clean isolated checkout, HEAD = origin/main; no injected browser/deck seams.
- CI: https://github.com/Makeinu1/MTG_OneDeck/actions/runs/33933337614
  `check:release`, build (10m10s), deploy (10s): success.
- Pages HTML: HTTP 200. Its actual `/MTG_OneDeck/assets/index-DLpzZL1w.js`: HTTP 200.
  Each was requested once after deployment.

Commands, in order after CI/Pages:

```sh
npm run journey:loop -- --journey O4P-09I-B --phase inspect --base origin/main
npm run journey:loop -- --journey O4P-09I-B --phase live --base origin/main --allow-external-write --expected-fingerprint c98fc754c219c1d0d2a52ca21d05faa24e1c24ec6444327a8d880caab7f1df9a
```

Observed secret-free harness result: exit 0, `status: passed`,
`completedStages: [production-reliability]`, `failure: null`,
`nextAction: RUN_INDEPENDENT_REVIEW`. One live execution for this fingerprint.

The pinned CLI calls `runO4p09iReliabilityEvidenceV1`, rejects injected seams,
and validates the measured summary before returning success. That validation
requires accepted shared progress, disconnect observation, explicit recovery,
unchanged authoritative revision/public digest/private hand across recovery,
post-reconnect accepted mutation and convergence, privacy separation,
zero console errors/warnings/secret violations, two contexts and three pages
closed, and profile removal. The harness does not retain the child summary;
this record preserves the observed harness result, not invented revision values.
An additional process/profile check found no orphan production Chrome or profile.

## Preceding stop and smallest repair

- SHA: `d1cb2b07076e4b6b9efce437f6d35cc6b55a4639`
- Fingerprint: `9260604e5bb75f760320f6016f759138602e8375a1e529aa5fe3ee00b76600c4`
- One live execution: `IMPLEMENTATION / PLAYER_JOURNEY_STAGE_FAILED /
  reconnect/convergence-00000`; cleanup verified.
- CI: https://github.com/Makeinu1/MTG_OneDeck/actions/runs/33932217953
  `check:release`, build (13m6s), deploy (10s): success.
  Pages HTML and the same actual hashed JS each returned HTTP 200 once.

Source diagnosis supersedes the generic failure class: the UI requires an
explicit `online-recover` click; opening the online entry does not call
`controller.recover()`. The runner omitted that click. Recovery data uses
localStorage and survives the replacement page in the same browser context.
This is an evidence-driver targeting defect, not an established runtime defect.

The repair adds one existing `clickVisible` call on the replacement page only.
The existing fake now requires that click instead of automatically claiming
recovery on observation. The existing reliability test failed before the
one-line repair with `recovery action missing`, then passed. Targeted validation:
two files / 119 tests passed; ESLint, online-script TypeScript, diff check passed.
No new test case, product/runtime change, timeout relaxation, retry, sleep
increase, dependency, or assertion removal. These tests are synthetic evidence,
separate from the exact-fingerprint production success above.

Only the driver and its existing test changed for this repair. The subsequent
ledger update records B only; C and I remain pending. No Arena scores are inferred.

Read-only claim-to-evidence review (`/root/digest_divergence_trace`) found no
HIGH/BLOCKER or overclaim: B-only shipped is justified by the matching contract,
registry profile, runner validation, observed result, and mirrored ledger entries.
This is a bounded evidence review, not the fresh-context final Arena review.
Ledger-only validation passed: B mirror parity, unchanged other entries/C/I,
`npm run check:docs`, and `git diff --check`.
