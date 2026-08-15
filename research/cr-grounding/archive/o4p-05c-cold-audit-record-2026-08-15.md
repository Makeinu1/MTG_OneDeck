# O4P-05C cold audit record

Milestone: `O4P-05C` Release Gates

Base SHA: `7dc41384bf6763986a47151d69f78f31021976fe`

Independent findings-only auditor: `/root/o4p05c_cold_auditor`

Profile: `BROAD` / R3

## Frozen candidate

- semantic fingerprint:
  `fbfa2ae079b4615d55aed30834ad981acd349b86b4aa6d32b20c1dd55e21dce2`
- context tree fingerprint:
  `f3335273e104b24a29c78ab469ad1896c2bde51e4c4a597da214131952875f41`
- context: health `ok`, selected `O4P-05C`, loop state `current/COLD_AUDIT`
- verdict: `AUDIT-OK-PENDING-FULL-CHECK`
- totals: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0

The auditor edited no file, made no git mutation, ran no release full check,
used no network/Cloudflare/GitHub, and delegated no work. Temporary adversarial
mutations were restored byte-identically.

## Executable evidence

- O4P-03A/B/C/D frozen verifiers: 4/4 PASS;
- O4P-05C frozen verifier: PASS, seven gates, local
  `mtg-cr-2026-06-19`, no production drift, test-only boundary;
- targeted DOM: 8 files / 50 tests PASS;
- machine-check registration: 1 file / 7 tests PASS;
- `git diff --check`: PASS;
- release `npm run check`: not run by the auditor.

Sandboxed `tsx` launches encountered the known local IPC `listen EPERM`; the
same offline verifiers were rerun outside that restriction and passed. No
external service was contacted.

The forbidden scan returned the expected pre-reauthorization ownership report:
`package.json` and five Judge research drafts were `NEEDS-REAUTH`, while the
two new `review.o4p-05c-*` paths were `FORBIDDEN`. The acceptance brief and
bounded-surgery record assign all of those paths to the Judge; no implementer
authority was inferred.

## Adversarial evidence

1. Removing per-observation fingerprint correlation made both ordinary and
   Judge reviews red because the expected mismatch issue disappeared.
2. Drifting the frozen O4P-03C verifier byte made the O4P-05C verifier red with
   the exact expected/actual SHA-256 mismatch.
3. Importing the test helper from the production Cloudflare barrel made the
   architecture review red on both import detection and protected drift.

Restored hashes:

- validator:
  `ffa54e7cbd66c6c07364ab752681a525cf2aceb930e72d15320830fe3729b655`;
- O4P-03C verifier:
  `a2d7b7dc8753be5edaa9944bc5fc7e03413776b06d573bd9230912cb440b64a8`;
- production Cloudflare barrel:
  `daa892e79cc07192d62a70921cc21c03b5bc1dad3dac7b474fed938ecd86c7f3`.

No assertion deletion, skip conversion, threshold relaxation, predecessor
sequence removal, production/barrel/Cloudflare/config/dependency/version/Core/
UI/protocol/projection/CR drift, or release-boundary overclaim was found. The
03C/03D records, predecessor reviews, evidence harness, four predecessor
verifiers, Wrangler configuration, and production files are SHA-256 bound.

The Qwen record consistently identifies exact model
`qwen-cloud/qwen3.8-max`, session
`01a00367-f677-7c92-9509-ca30865ca5aa`, two consecutive zero-write returns,
no substituted implementer, and the resulting bounded Judge ownership.

Judge adjudication: every release-gate claim is non-vacuously closed. Shipment
is not yet authorized; first freeze the audit-record metadata, confirm it with
the same independent auditor, then run the single fingerprint-matched release
full check.
