# O4P-06B Cold Audit Record — 2026-08-21

Milestone: `O4P-06B`
Base SHA: `a0c33741f5a2bde35f5e9a621671f5908a6b1284`
Implementer: `/root/o4p06b_luna_implementer` (`gpt-5.6-luna`, xhigh)
Cold auditor: `/root/o4p06b_luna_cold_auditor` (`gpt-5.6-luna`, xhigh)

## Initial audit

Initial frozen fingerprint:
`81b13a938aec24b1dfcaf957c2ed315fae35121d381b3a88eaa787fdf357a551`.

Initial counts after the complete adversarial pass:

- BLOCKER: 0
- HIGH: 1
- MEDIUM: 3
- LOW: 0

Accepted findings:

1. HIGH: the shared Core command array reader iterated caller-supplied array
   length without a bound, so a legal sparse array with `length=0xffffffff`
   could cause validation denial of service.
2. MEDIUM: decision-context `turnNumber: -0` passed as a safe nonnegative
   integer and preserved noncanonical negative zero.
3. MEDIUM: a table zone destination accepted unsafe record-key controller IDs
   because the nested destination validator did not apply the closure guard.
4. MEDIUM: drawing reincarnated the library object but did not clear another
   object's attachment to the old object ID, causing an otherwise valid draw to
   reject during rebuilt-root validation.

The auditor also identified that raw table zone movement to `stack` cannot
compose with the shipped stack-announcement contract. The Judge adjudicated it
as an explicit O4P-06B rejection/DEFER; the existing typed stack-commit command
remains authoritative.

## Corrections

- command arrays above 10,000 reject before any length-proportional loop, with
  a `0xffffffff` sparse-array Judge regression;
- negative-zero turn numbers reject;
- battlefield/stack destination controller IDs pass the closure unsafe-key
  guard;
- draw clears attachments targeting every old reincarnated library object;
- raw table-to-stack movement is explicit in the frozen contract DEFER; and
- the Judge separated full-capability identifier checks from the new
  eight-character command-graph fragment scan, restoring the existing
  Headless privacy-layer test without weakening command secrecy.

The same implementer used both permitted correction returns. The final
attachment/validator/privacy-layer changes were bounded Judge surgery after the
repair budget was exhausted.

## Final re-audit

Re-audited fingerprint:
`b838279c661be407e430c46103a50840be1f4f4c6f4f2a7e76084a2cb432d189`.

The same independent cold auditor reproduced every accepted finding and the
correction. Evidence at that fingerprint:

- Core targeted: 25 files / 95 tests PASS;
- Online targeted: 8 files / 94 tests PASS;
- architecture targeted: 2 files / 13 tests PASS;
- `npx tsc -b`: PASS;
- affected ESLint: PASS;
- `git diff --check`: PASS;
- context health/fingerprint: PASS;
- negative zero, unsafe IDs, 4,294,967,295-length sparse array, and draw
  attachment hostile reproductions: PASS.

Final counts:

- BLOCKER: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 0

Verdict: `AUDIT-OK-PENDING-FULL-CHECK`.

## Full-check budget note

Before the cold audit, `npm run check:fast` escalated unknown Judge draft paths
to the release lane and unintentionally invoked `npm run check`. It stopped at
the second verifier because sandboxed `tsx` could not create its IPC pipe
(`EPERM`); no semantic lane ran after that point. This is conservatively counted
as the first full-check invocation. The refreshed audited release candidate has
one final full-check invocation remaining, to be run outside that sandbox IPC
restriction. This audit verdict is not itself ship approval.
