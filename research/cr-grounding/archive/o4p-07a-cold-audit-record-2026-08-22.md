# O4P-07A Cold Audit Record

Date: 2026-08-22
Base SHA: `55fe011700bd6bb10a699e1bd431f0bf12cc40cb`
Auditor: `/root/o4p07a_luna_cold_auditor` (`gpt-5.6-luna`, xhigh,
fresh-context, read-only, R3/BROAD)

## Candidate and findings

The initial candidate fingerprint
`8954729c0b0c5f6257651484e2e61af3ed53c22886012184584f9a7d75e70407`
returned BLOCKER 0 / HIGH 4 / MEDIUM 3 / LOW 0. Executable hostile probes
proved stale v2 completion after v1 replacement, digest-consistent optional
`CardDef` corruption, post-start lobby rewind, malformed Scryfall optional-field
acceptance, noncanonical history acceptance, out-of-range issue indices, and
missing exact-one head/history update checks.

The Judge accepted all seven findings and applied the bounded correction in
`research/cr-grounding/o4p-07a-judge-surgery-1.draft.md`. Correction-1 at
fingerprint
`31e8f89ac5fcb113b86dd1c72d8b38fe9d5e9ea9d45725e84f95f446e26a5cc7`
closed every BLOCKER/HIGH finding and left one MEDIUM nullish Oracle-ID
compatibility defect. Correction-2 restored the frozen `oracle_id ?? id`
normalization and retained wrong-type rejection.

## Independent evidence

- O4P-07A target lane: 10 files / 59 tests PASS
- final Judge review: 1 file / 8 tests PASS
- TypeScript, affected ESLint, docs, staged/unstaged diff checks: PASS
- sequential 75-card batching, DFC/identity/outage behavior, restart/CAS,
  v1/v2 invalidation, lifecycle, canonical corruption, issue bounds, missing
  history, capability secrecy, and projection privacy: PASS
- correction-2 independent wrong-type Oracle-ID probe: PASS
- `check:forbidden`: only the expected Judge-owned drafts and `review.*`
  reauthorization boundary; no product finding

Final audited candidate fingerprint:
`05c7e8c35892e73c60d473e56e77c5265e0c7854dd2473dc4e7b1bb609d422c9`

## Verdict

BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0

`AUDIT-OK-PENDING-FULL-CHECK`
