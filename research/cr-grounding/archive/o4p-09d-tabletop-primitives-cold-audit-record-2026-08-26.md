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

The final exact-byte successor re-audit matched fingerprint
e1d8b86b92a57813e20dd2088726f749003604ca04491ebfd0ab7e440eda8ba3
and returned BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0 with verdict
FINAL-EXACT-BYTE-AUDIT-OK. The Judge committed and pushed that candidate at
785a5315d77f287767c121dd553890537bf8aa61.

Fresh workflow-dispatch run 33021844744, build job 98353857805, reached the
canonical full check and stopped only at the historical O4P-03A verifier's
pre-reownership hash for its Judge guard. The transitive frozen chain is exact:
the changed 03A/03B/03C guard pins flow into their three verifiers, those three
verifier hashes flow into O4P-05C, and the resulting O4P-05C hash flows into
O4P-05D. The other six reowned guards have no executable frozen-hash consumer.
Correction wave 3 therefore reanchors only those five verifier literal files;
it changes no assertion, accepted path, product byte, review byte, dependency,
or acceptance meaning.

The fresh-context successor auditor then matched semantic fingerprint
bbe785fc4a5dbc37ffcc83673d5a0bcb664b5d7434aead6745f2c066be80cc55
and returned BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0 with verdict
O4P-09D-FULL-CHECK-REPAIR-3-REANCHOR-AUDIT-OK. All six affected historical
verifiers, the nine guards at 49/49, scoped ESLint, docs validation,
git diff --check, and release preflight passed.

The final exact-byte reanchor audit matched fingerprint
64986d11c72130a04136c97a97585edb8e86bae8e91dba5f519e06b0c2e525c4
and returned BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0 with verdict
FINAL-EXACT-BYTE-REANCHOR-AUDIT-OK. The audited reanchor was committed and
pushed at a95c9b2177bd1e33d8438ff3f6f7dc4bb7895657.

## Core/projection parity and successor-guard repair

Exact-head Actions run 33023118482, build job 98358061795, passed the complete
historical verifier chain, docs validation, and lint. Its DOM project then
exposed five bounded failures. The unchanged O4P-02D review proved that Core
accepted the keyword Alpha\rBeta while O4P-09D projection validation rejected
the same projected keyword. Four historical architecture guards also lacked
the now-shipped D successor paths and tabletopManual type/barrel ownership.

On 2026-08-27 the user explicitly authorized correction wave 4: a fresh-context
Luna/xhigh implementer changes only the keyword predicate in
src/online/projection/validation.ts, the Judge reowns exactly four guards,
repair records and independent cold audit are required, and one additional
commit, push, and CI cycle is authorized. All counters remain cumulative.

The product repair removes only carriage-return rejection from projected token
keywords. NUL, nonempty, length, trim, unique, sorted, and serialized-size
checks remain, and every non-keyword text field still rejects carriage return.
The O4P-02D review remains byte-unchanged. Projection validation passes 3 files
and 42 tests.

The Judge registers the complete literal O4P-09D successor path set in the 09C
guard, the exact tabletopManual index/type surfaces in 06D/07A, and excludes
only OnlineTabletopManual.tsx and tabletopManualViewTypes.ts from the legacy
04A aggregate. The four guards pass 4 files and 19 tests. Scoped ESLint and
git diff --check pass. No wildcard, prefix, regex weakening, dependency,
contract, UI, or O4P-09E change is present.

The first fresh-context repair-4 audit matched semantic fingerprint
ca7451544bf2c240b4e336c53bbdc615abba97b34fd552070187f6d367a1f5f5 and
returned BLOCKER/HIGH/MEDIUM/LOW = 0/2/0/0. It found that the 04A basename
suffix filter was broader than the required two exact files and that the
successful context projection exceeded its 12 KiB output ceiling by 381
bytes. The Judge closes both findings inside correction wave 4: the 04A
exclusions now compare the two complete absolute file paths, and newly
duplicated repair-3-final/repair-4 evidence strings are retained in this
archive and terminal evidence rather than duplicated in the compact domain
evidence list. No previously committed history, product byte, acceptance
assertion, dependency, contract, UI, or O4P-09E byte is removed.

The replacement fresh-context audit independently matched semantic
fingerprint
a078a026bc2f69a540437327976e6f4010910856e2673d61072ff3c4fcb879d4,
returned BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0, and issued verdict
O4P-09D-FULL-CHECK-REPAIR-4-AUDIT-OK.

Authority and audit scope are recorded in
research/cr-grounding/o4p-09d-full-check-repair-4.draft.md,
research/cr-grounding/o4p-09d-full-check-repair-4-implementation-brief.draft.md,
and research/cr-grounding/o4p-09d-full-check-repair-4-cold-audit-brief.draft.md.
Cold audit, replacement exact-head CI, Pages served assets, and terminal
metadata remain pending.

## Release status

The user explicitly authorized end-to-end O4P-09D shipment on 2026-08-26. The
generated engine API manifest is re-anchored to the semantic commit above.

Repair-4 final exact-byte audit matched fingerprint
983f4eb0587534870e48dfa6fccc6f2a30c240805a47a6bd4d3016492b5718de at
BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0. The Judge committed and pushed that exact
candidate at 34dfbc7714d450fdfbd2043bbd208da5590997db. Exact-head Actions run
33026459916 / build job 98368853021 passed the canonical full check, then
stopped only at the generic scanner's expected classification of the four
explicitly user-authorized Judge review files and five Judge research records.
No product, test, build, or acceptance failure remained.

The Judge recorded exact reownership without changing semantic bytes at
terminal head c9cf348e457c201ef4f60c1ea5b639baa8050c44. Run 33027684130 / build job
98372755718 passed terminal-metadata and forbidden checks. Its artifact and
deploy jobs were skipped by design because terminal lanes do not publish
semantic assets. The bounded release bridge changes only this record, the
existing repair-4 cold-audit brief, and synchronized ledger terminal fields;
product, ordinary tests, all review files, contracts, dependencies, workflow,
generated API, and O4P-09E remain byte-identical to c9cf348e. A fresh-context
audit and semantic exact-head CI/Pages remain required before terminal shipped
metadata.

The release-bridge cold audit independently matched semantic fingerprint
495af7ddfa4e61dc932dd0a9202c1150f336d448203247f0fc932310cee0cac4,
returned BLOCKER/HIGH/MEDIUM/LOW = 0/0/0/0, and issued verdict
O4P-09D-REPAIR-4-RELEASE-BRIDGE-AUDIT-OK.
