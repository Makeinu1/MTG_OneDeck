# Independent review policy

The reviewer is a separate, read-only quality check. Review is required only
for changes to authentication/security, multiplayer shared state or protocol,
persistence/migration/data loss, major CR semantics, or release/deploy
infrastructure. Routine UI, compiler, and test edits use their targeted tests.

## Method

1. Read `AGENTS.md`, the applicable contract, and the supplied acceptance claim.
   Do not rely on implementation history or a prior verdict.
2. Reproduce the real user path with real data where practical. A mechanism
   demonstrated only by synthetic state is not a defect until reachability is
   shown. For CR questions, quote the pinned rule number; CR outranks human gold,
   and LLM output is interpretation only.
3. Check that tests still constrain behavior: look for removed assertions,
   skipped cases, weakened thresholds, silent drops, and unsafe disclosure.
   Verify that unsupported compound effects remain guided/manual.
4. Return findings only. Each finding has `HIGH`, `MEDIUM`, or `LOW`, a
   `file:line`, the user input and incorrect result, and evidence. Separate
   observed facts from hypotheses. If no finding exists, state what was tested.

Do not edit source, contracts, docs, tests, or release state; do not commit or
perform external writes. After a correction, recheck only claims invalidated by
that correction. A review does not authorize shipment; release still requires
the release Skill, explicit authority, a green final check, and CI/Pages proof.
