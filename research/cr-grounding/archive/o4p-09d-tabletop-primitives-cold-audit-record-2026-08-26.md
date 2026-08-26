# O4P-09D tabletop primitives cold-audit record

Date: 2026-08-26
Milestone: `O4P-09D`
Risk: R3 / BROAD
Base SHA: `9adc0851cd520aa09f1c50cfa266d6dbc610d9a5`
Semantic commit: `d11a54a54bb3f3ad3dcb624132f3ea3e23de1fd2`

## Audit trail

The fresh-context cold auditor `/root/o4p09d_cold_audit` audited the public
tabletop candidate through successive correction waves. Early findings covered
outer-frame exactness, player-exit reconciliation, missing browser evidence,
token snapshot and application-ID bounds, and aggregate projection size.

The final frozen semantic fingerprint was
`bd549b3dfadab08557bf5da9025e3c34890d278f3012d14c3f6e45387b8132f1`.
The auditor returned `BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`, verdict ACCEPT.

## Resolution evidence

- The public request and HTTP/WebSocket outer frames are exact, versioned, and
  reject unknown or descriptor-hostile fields without mutation.
- Structured Manual and Freeform Manual share one Core reducer and preserve
  distinct provenance through replay.
- Token definitions, Note IDs, Manual Stack IDs, collection sizes, and complete
  audience projection frames are bounded before persistence.
- Variable-room HTTP, WebSocket, Pregame completion, and repository commit paths
  reject an over-budget projection atomically for every player and observer in
  both v2 and v3 projection generations.
- Two- and four-player journeys cover every public primitive family, replay,
  reconstruction, authorization, hidden-zone rejection, and projection
  validation.
- Solo preservation, the four Cloudflare predecessor verifiers, lint,
  TypeScript, the production build, generated API verification, and release
  preflight passed.

## Browser evidence

The Judge used one in-app Browser session on the production `GameScreen` visual
fixture. The 375x812, 812x375, and 1440x900 viewports each had zero horizontal
overflow, zero uncovered controls below 44px, and zero console warnings or
errors. The record contains no Room ID, invite material, capability, hidden card
identity, journal, raw Core root, or private error.

Detailed screenshot hashes and interaction probes are recorded in
`research/cr-grounding/o4p-09d-browser-evidence.draft.md`.

## Release successor and bounded repair

The same fresh-context successor auditor
`/root/o4p09d_terminal_successor_audit` first accepted the synchronized
manifest, ledger, and this archive record at canonical fingerprint
`4b3b5ae40e3b149938f10260cf5b4b56d58380fce2adeab98e833b5350696bda`
with `BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0`.

The first host-authorized release full check then passed through O4P-03D and
exposed only the stale historical hash chain in O4P-05C. Repair 1 changed no
product or review bytes: it re-pinned the four already audited O4P-03 verifier
hashes and two already audited Cloudflare production hashes in O4P-05C, then
re-pinned the resulting O4P-05C hash in O4P-05D. All six focused historical
verifiers, scoped ESLint, and `git diff --check` passed.

The repair authority and audit scope are recorded in
`research/cr-grounding/o4p-09d-full-check-repair-1.draft.md` and
`research/cr-grounding/o4p-09d-full-check-repair-1-cold-audit-brief.draft.md`.
The successor auditor independently accepted repair fingerprint
`2bbc624a1522ea0186c2c065857e1277d5bca609b962e9930560072539548602`
with `BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0` and verdict
`O4P-09D-FULL-CHECK-REPAIR-AUDIT-OK`.

The final local full check then passed the repaired O4P-03A through O4P-05D
chain, docs, and lint. Core Vitest passed 227 files and 2111 tests; its only
failure was the named note/manual-stack boundary test taking 31.325 seconds
against its explicit 30-second timeout. Correction 2 changes only that literal
to 60 seconds. The unchanged focused test passed in 25.05 seconds, and scoped
ESLint plus `git diff --check` passed. Authority and audit scope are recorded in
`research/cr-grounding/o4p-09d-full-check-repair-2.draft.md` and
`research/cr-grounding/o4p-09d-full-check-repair-2-cold-audit-brief.draft.md`.
The same successor auditor accepted canonical fingerprint
`bcba51a63b27871c7aeae5e584dd2a9312ae7a76a8e49a78a81ebeed8eeae088`
with `BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0` and verdict
`O4P-09D-FULL-CHECK-REPAIR-2-AUDIT-OK`.

## Exact-head architecture-guard repair

Exact-head Actions run 32981379929, build job 98218614567, then exposed only
nine stale legacy Judge-owned architecture guards: eleven assertions had not
registered the already accepted O4P-09D projection-budget file, tabletopManual
directory and public barrel, exact stack consumer, exact CSS ownership, or the
file-target-symbol Core import surface.

On 2026-08-27 the user explicitly authorized a new repair candidate, correction
wave 3, Judge reownership of those exact nine guards, and an additional commit,
push, and CI cycle. The repair preserves cumulative counters and changes no
product byte, ordinary product test, dependency, config, contract, acceptance
meaning, or O4P-09E byte. It uses fixed file, directory, target, import-kind,
and symbol entries; it adds no wildcard, prefix, or regex exemption.

The exact nine guard files pass 49/49 focused tests. Scoped ESLint and
git diff --check pass. Authority and cold-audit scope are recorded in
research/cr-grounding/o4p-09d-full-check-repair-3.draft.md and
research/cr-grounding/o4p-09d-full-check-repair-3-cold-audit-brief.draft.md.

The first fresh-context repair audit at semantic fingerprint
d4850c970cddd2f984206ebd9b110fdf9c25b385c92b6e0f8e31945d2e00adc0
returned BLOCKER/HIGH/MEDIUM/LOW = 0/1/0/0 because the new mode-neutral map
pinned source, resolved target, and symbols but not import versus import-type.
The Judge closed that finding inside correction wave 3 by making import kind
part of every new O4P-09D map key, including the two Cloudflare runtime imports.
The same nine files remain green at 49/49 with scoped ESLint and
git diff --check passing.

The fresh-context replacement audit matched semantic fingerprint
efbc605410de2b748df6cd0f400f4302c98f15c64bff0f1394ac4128fb162f11
and returned BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0 with verdict
O4P-09D-FULL-CHECK-REPAIR-3-AUDIT-OK.

Final exact-byte successor re-audit, replacement exact-head CI, Pages served
assets, and terminal metadata remain pending.

## Release status

The user explicitly authorized end-to-end O4P-09D shipment on 2026-08-26. The
generated engine API manifest is re-anchored to the semantic commit above. This
record and the synchronized audited ledger remain pending final exact-byte
successor re-audit, replacement exact-head CI full check, Pages served assets,
and terminal shipped metadata.
