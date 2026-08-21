# O4P-06F Judge surgery 1

Date: 2026-08-21
Milestone: `O4P-06F`
Base SHA: `8810ed2e6db69fdc93c131f6abc195af6a763066`
Authority: Judge-owned bounded surgery after two implementer correction returns

## Authorized correction

Change only the additive O4P-06F evidence harness and its additive ordinary
test to close the final round-2 cold-audit findings without changing product,
protocol, Worker, UI, dependencies, configuration, contracts, ledgers, or the
frozen Judge review:

1. consume the shipped `OnlineProjectedZoneV1 { count, entries }` shape,
   require the exact current ordered player set, and reject malformed or
   identity-bearing opponent hand/library entries;
2. route CLI operator timeouts through the runner so timeout rejection reaches
   its `finally` cleanup instead of abandoning a live run promise;
3. reject Chrome spawn errors, malformed `Target.getTargets` responses, and
   missing or duplicate context/target/session identifiers;
4. require successful close results and relate measured target cleanup to
   exactly four distinct scenario pages and at most one measured startup page;
5. detect generic capability-like values in early console/exception events
   before the complete runtime fragment set is available; and
6. add ordinary regressions for the real zone shape, omitted groups, hostile
   entries, legacy array shape, and fabricated cleanup totals.

The cold auditor must re-audit the resulting exact fingerprint. No full check,
Chrome, network, deployment, or release action is authorized by this surgery.
