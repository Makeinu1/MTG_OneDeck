# O4P-05C Release Gates contract

Status: Judge-frozen implementation contract

Milestone: `O4P-05C`

Base SHA: `7dc41384bf6763986a47151d69f78f31021976fe`

Risk / audit lane: `R3 / BROAD`

Authority: repository-local shipped O4P-03C/O4P-03D evidence and the
repository-local CR pin `mtg-cr-2026-06-19`. No remote or "latest" CR lookup is
authorized.

## Goal

Close one fail-closed release decision over the seven required gates:

1. `privacy`;
2. `recovery`;
3. `load`;
4. `security`;
5. `observability`;
6. `information-leakage`; and
7. `long-room`.

O4P-03C remains the semantic authority for privacy, security, and
information-leakage. O4P-03D remains the semantic authority for recovery,
load, observability, and long-Room behavior. O4P-05C must compose those shipped
claims without duplicating Cloudflare runtime, protocol, projection, Core, UI,
or deployment behavior.

## Evidence aggregator boundary

Add one test-only strict-data aggregator at:

`src/online/cloudflare/__tests__/releaseGateEvidenceV1.ts`

It is not a product API, network endpoint, persisted record, log format, CI
attestation service, or source of truth. It accepts only evidence produced by
the Judge-owned O4P-05C review after the predecessor suites have run. It must
not be exported from `src/online/cloudflare/index.ts` or imported by production
code.

The closed input contains:

- `kind: "o4p-05c-release-gate-evidence-v1"`;
- `schemaVersion: 1`;
- one lowercase 64-hex `semanticFingerprint`;
- `rulesetId: "mtg-cr-2026-06-19"`;
- exactly seven gate observations in the order above.

Every observation repeats the exact semantic fingerprint, has
`outcome: "passed"`, has the exact predecessor authority, and has only its
closed quantitative facts:

| Gate | Authority | Required facts |
| --- | --- | --- |
| privacy | O4P-03C | 4 Player audiences, 1 Table audience, 0 cross-audience leaks |
| recovery | O4P-03D | checkpoint 64, current revision 96, replay suffix 32, 0 writes on rejected recovery |
| load | O4P-03D | 96 accepted commands, seat counts `[24,24,24,24]`, 0 unexpected errors |
| security | O4P-03C | exact authorities `[host,seat,table,spectator]`, expired/retired/cross-role/lease-conflict rejects all observed |
| observability | O4P-03D | positive tail and recovery-fact counts, 0 error/exception/parse/schema-or-secret violations |
| information-leakage | O4P-03C+O4P-03D | 0 capability, capability-fragment, cross-audience-private, or forbidden-log-field leaks |
| long-room | O4P-03D | revision 96, 70,000 ms idle, hibernation observed, distinct deployment version observed, post-close HTTP 200 |

Validation is exact and fail-closed. Unknown/missing/reordered/duplicate gates,
unknown keys, accessors, symbols, sparse arrays, cycles, aliases, wrong scalar
types, non-safe integers, fingerprint drift, authority drift, or any failed
threshold returns a deterministic complete issue list. The validator must not
trim, sort, deduplicate, merge, coerce, or mutate input. Success returns a fresh
deep-frozen canonical graph; failure returns fresh deep-frozen issues and no
partial value.

## Judge integration evidence

The Judge owns:

- `src/online/cloudflare/__tests__/review.o4p-05c-release-gates.test.ts`;
- `src/test/architecture/review.o4p-05c-release-gates.test.ts`;
- `scripts/checks/verify-o4p-05c-release-gates.ts`;
- package/machine-check registration, contracts, briefs, audit record, ledger,
  git, CI, Pages, and shipment.

The review must create one canonical passing aggregate only after asserting the
current predecessor authorities. It must red-probe every gate fact, every
fingerprint correlation, ruleset drift, authority drift, missing/extra/order/
duplicate cases, hostile descriptors/symbols/sparse arrays/cycles/aliases, and
input/output immutability. Each red probe must fail for its intended reason.

The targeted gate includes the complete current O4P-03C and O4P-03D Judge
reviews, their architecture reviews, the ordinary Cloudflare security,
persistence, hibernation, and evidence-harness suites, and all four registered
O4P-03 verifiers. Historical Cloudflare production evidence is reusable only
while the production/configuration/evidence-harness bytes it certified remain
unchanged or a later independently audited predecessor repair is explicitly
bound by the O4P-05C verifier.

## Honest boundary / DEFER

- O4P-05C performs no Cloudflare deploy, rollback, resource mutation, PITR,
  secret access, live tail, or external production write.
- O4P-05D owns the final Cloudflare/Pages production release closure.
- Passing the aggregator never substitutes for the predecessor executable
  tests, independent cold audit, fingerprint-matched full check, or exact-head
  CI/Pages evidence.
- Account-wide Sybil/cost control, WAF, custom-domain Access, cross-Room quota,
  and 24-hour wall-clock soak remain outside the shipped bounded MVP claim.
- No version, dependency, runtime, protocol, Core, projection, UI, or CR pin
  changes in O4P-05C.
