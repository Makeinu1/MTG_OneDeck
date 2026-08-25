# O4P-09 roadmap registration cold-audit record

Date: 2026-08-25
Candidate base: `629de59eb244e6c9eeb78c3bdab29cfd15596b48`
Auditor: `/root/o4p09_registration_cold_audit` (`gpt-5.6-sol`, high, fresh context)
Risk: R3 / BROAD

## Initial findings and repair

The first audit rejected the candidate with
`BLOCKER 1 / HIGH 2 / MEDIUM 1 / LOW 0`.

- Dispatch used the `codex:context` checkpoint fingerprint instead of the
  canonical `scripts/checks/fingerprint.mjs` tree fingerprint.
- The takeback-vote and pre-O4P-09E hidden-zone guards matched
  negation-insensitive substrings.
- The executable guard did not freeze the complete A-J ledger meaning.
- A future audit-record path was allowlisted without validating its bytes.

The Judge repaired all four findings in one correction wave: canonical and
context fingerprints now have separate roles, the two negative clauses are
matched with their required negation, every O4P-09 domain entry is frozen by an
exact SHA-256 over all fields, and no absent audit-record path is pre-allowed.

## Semantic candidate verdict

The repaired registration candidate at canonical tree fingerprint
`f7432d16a590969a5996fcb48aaeac66f378da2956cc9c302bf897606d02e11d`
was independently re-audited with:

`BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`

`AUDIT-OK-PENDING-FULL-CHECK`

The candidate preserves the user-authorized Shared Table Playable MVP,
including the single GameScreen/Core path, Pregame, safe tabletop primitives,
secret-safe Look/Reveal/Choose, assisted priority with universal HOLD and
steward-only Resolve/Advance/UNDO, voice-consensus takeback without voting UI,
shared checkpoints, full-match E2E, and a separate public-projection spectator
surface. It appends synchronized pending O4P-09A-J entries, leaves O4P-08 and
`GOV-CODEX-56R2-2026-08` unchanged, and claims no product implementation,
release, deployment, or external write.

## Evidence-closure boundary

This record and its exact evidence references are terminal registration
metadata derived from the immutable auditor verdict above. Their bytes must be
hash-checked by the registration review and the complete record-bearing
candidate must retain BLOCKER/HIGH zero under a final read-only integrity
re-audit. No commit, push, Pages publication, or Worker deployment is
authorized by this record.
