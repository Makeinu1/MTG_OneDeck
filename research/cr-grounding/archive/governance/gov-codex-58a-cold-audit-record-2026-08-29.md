# GOV-CODEX-58A candidate 3 cold-audit record

- Base SHA: `74d24c0311e0d58112b15c58d6f8546449a5b01a`
- Audited tree fingerprint: `d6c9abcd442c6c0ef94f4914039110550595a7f060e66914cff82f244f5d6a1c`
- Tracked authority event hash: `b8ecc6aca0b132fbf1c04dc5c3c54dbec8dcab8847f9c45777eab2d598881f4b`
- Audit envelope: `a28e08cde8436e03e1f9c7ae4643d9c877e4751a65207542871bdd6dd058fd4b`
- Auditor: `/root/gov58a_cold_audit`
- Verdict: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 1

The LOW finding is a non-executable historical ledger note that still groups
the full-check count with structural limits. The frozen acceptance, operative
workflow, executable supervisor, and review tests instead make excess
full-check attempts cumulative watchdog advisories while still requiring a
final exact-tree green `npm run check`. The finding does not weaken authority,
role/wait/push structural limits, audit quality, or the final release gate.

The Judge accepts this recorded LOW for the immutable candidate rather than
changing its frozen acceptance fingerprint. The affected audit reported no
BLOCKER, HIGH, or MEDIUM finding.

## Candidate 4 post-commit release finding

- Audited tree fingerprint: `78fa7cca369b8062b5a92be68d23f4c93f685bfc2dae9db4da8b020e14bc3085`
- Semantic release commit: `15faac0528a20471314a8c19253d30053d2ecf69`
- Observed command: `record-replacement-push`
- Observed result: `CANDIDATE_BASE_SHA_MISMATCH`
- Independent triage: BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 1

The HIGH is a ship-blocking executable defect: the candidate required its
declared diff base to equal HEAD even after the authorized semantic commit, so
push recording, CI wait, deploy, and ship were unreachable. The same triage
also found that the 3,005,843-byte HEAD authority exceeded Node's default
buffer and was silently treated as having no predecessor, and that a valid
post-commit event append could not enter the terminal lane. Candidate 5 is the
same-scope repair; it must bind a separate exact release head, fail closed on
HEAD authority read errors, and verify the exact authority append before ship.

## Candidate 5 cold-audit findings

- Base SHA: `15faac0528a20471314a8c19253d30053d2ecf69`
- Audited tree fingerprint: `6b3c56489a1857813b2c110cf16efc3720bd00e7901bfbc5fa456676e0a48fde`
- Tracked authority event hash: `f7daca8a801ca51e36af7c841fa85c6396aa72e51bf78fe312b0a4cc3f98a649`
- Audit envelope: `ae5be2ccd4fb9b24b4bfc8dd3e54992187b0e2f85f0b29089078a94fccae6789`
- Auditor: `/root/gov58a_cold_audit`
- Verdict: BLOCKER 0 / HIGH 2 / MEDIUM 1 / LOW 1
- Ship gate: FAIL

HIGH 1: the terminal-only offline verifier checked the event chain and receipt
shape but not the complete live candidate invariants. It could accept malformed
candidate keys, missing lineage/audit/full-check/CI evidence, structural excess,
an arbitrary release head, or a receipt fingerprint that did not bind the
candidate tree.

HIGH 2: live post-commit and guard checks treated every path below
`research/cr-grounding/supervisor-events/` as harmless. Only the exact active
domain authority path may be excluded; another-domain drift, a rewrite, or an
extra authority path must stop push, CI, deploy, and ship.

MEDIUM 1: the terminal predecessor reader failed closed but labeled every read
failure as absence. It must distinguish a genuinely absent predecessor from an
oversized, malformed, or otherwise unreadable tracked authority.

LOW 1: the duplicated ledger `nextGate` prose still describes an earlier pair
of HIGH findings. The Judge will synchronize this terminal prose only after the
executable repair is audited and shipped.

Candidate 5 remains the same bounded repair. Closure requires negative fixtures
for every rejected terminal candidate/HEAD/path case above, plus exact diagnostic
coverage for terminal predecessor read failures. No player product, CR, external
authority, dependency, or release scope changes.

During pre-freeze integration, the Judge also exercised the repository's real
terminal route. The semantic ledger honestly remains
`implemented-not-audited` until the independent audit, and GitHub verifies a
terminal successor `T` with `base=S, head=T`, where `S` is the already checked
and deployed release head. The correction therefore permits the direct status
promotion only with a fully verified same-domain shipped authority proof and
keeps `releaseHeadSha=S`; it does not pre-claim `audited`, rebind the release to
`T`, or relax any live pre-ship exact-HEAD gate.

## Candidate 5 replacement-audit findings

- Audited tree fingerprint: `7c08ed3f2dbb00ee2c8c68d9ff7f7ad55b934413d7196b6462f104e2075fb3bb`
- Tracked authority event hash: `42c977cc90ddcbfc22fd83db949d442152525b8916169eb2f14a612a04902760`
- Audit envelope: `8f47e29f3d6eeed1c60c3660f06cda362d519cf858d9c1e36a62ce3c5a860e28`
- Verdict: BLOCKER 0 / HIGH 1 / MEDIUM 1 / LOW 1
- Ship gate: FAIL

The remaining HIGH is a receipt-prefix continuity gap. For one verified
session, a later event could reuse the same byte length with a different valid
SHA-256, or regress to a shorter prefix, then recompute the outer event hash.
Offline verification must require nondecreasing prefix lengths and identical
hashes at identical lengths before a terminal append can be accepted.

The MEDIUM is diagnostic but remains fail closed: an execution/integrity error
from the predecessor existence probe was still labeled as absence. Only a
confirmed missing object/path may produce `MISSING_TERMINAL_AUTHORITY_PREDECESSOR`;
all other probe or read failures must be explicit integrity errors.

## Candidate 5 final-replacement audit finding

- Audited tree fingerprint: `31fa841be3763b7e78ad1d2b562e8c719adcf55db9cc5d60e656246495dc448b`
- Tracked authority event hash: `e4c6d16512c815cc55ff3660c7969aece45ea6bb346ec105ae7a091c31946025`
- Audit envelope: `ab91207d63bf3a5ad5803bdb50bb988595479bb6a8555bcd8470a29a272c8c7e`
- Verdict: BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 1
- Ship gate: FAIL

Receipt prefix continuity and the terminal-specific predecessor reader passed.
The remaining HIGH is one application gap: the live HEAD-authority reader still
mapped every predecessor probe failure to bootstrap absence. The shared strict
absence/error classification must also protect context and every program-step,
with corrupt-object/probe-failure fixtures through both public paths.

## Candidate 5 final audit and release-CI finding

- Audited tree fingerprint: `b9ec85ee625490614b0d396f48e7b39db967e180ea0548b1b678d78518127772`
- Tracked authority sequence: `69`
- Tracked authority event hash: `d1b67a5c6eb0e3c153c65c5c3a1fff6c99fcd21ef60e78bf27d09d4698aa8779`
- Audit envelope: `90b853351510f6823d494394362a9b99f86fea5d45214208bf18391c5375d810`
- Auditor: `/root/gov58a_cold_audit`
- Verdict: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 1
- Semantic release commit: `1d7e9eff1b37a0bf8829835d48a349086189556e`
- Exact-head CI: run `33203050695`, build job `98957049543`, FAIL before Pages

The final candidate-5 audit closed every executable finding. Its sole LOW was
the already recorded stale duplicated ledger `nextGate`, reserved for terminal
metadata synchronization. The canonical local full check passed Core 229 files
/ 2119 tests and DOM 382 files / 2618 tests plus docs, lint, TypeScript, Vite,
and all verifiers on the audited tree.

The exact-head GitHub run then passed the verifiers, Core suite, and 380 of 382
DOM files, but two architecture reviews observed `codex:context` exit 2. A
clean reproduction at the release commit proved the cause: ignored
`.claude/loop-state.md` was absent, so context synthesized no candidate and
reported both `MISSING_ACTIVE_CANDIDATE_RECORD` and
`MISSING_TRACKED_SUPERVISOR_AUTHORITY` even though the exact tracked authority
was present at HEAD. This is a clean-checkout recovery defect, not a product,
CR, dependency, acceptance, or authority change.

Candidate 6 is the same-acceptance `ci-environment` repair at base
`1d7e9eff1b37a0bf8829835d48a349086189556e`. It may recover a loop packet only
from a clean checkout's fully verified tracked authority at HEAD; local live
state and every dirty/corrupt/missing/mismatched case remain fail closed. The
failure also demonstrated that a hard one-replacement-push quota would turn a
different release root cause into the numeric human loop this milestone exists
to remove. The initial semantic push, explicit external authority, one logical
CI wait chain, audit, full check, and append-only counters remain mandatory;
additional same-acceptance replacement pushes are cumulative watchdog
advisories rather than permission questions.

## Candidate 6 clean-recovery cold audit

- Audited tree fingerprint: `7bc294e6c3394eea9d544c23cda1b2a1d2569f9ac594347d33074c9ee8144e0c`
- Tracked authority sequence: `81`
- Tracked authority event hash: `fbb498383573f7e1ef5dd93da7db9b3b46ebbbf4510283a199bf26762d29eb6d`
- Audit envelope: `cbd69b9c6b0a3701cf4758ca65d06ea53e9ee433ccf3497609226ca6c3121e62`
- Auditor: `/root/gov58a_cold_audit`
- Verdict: BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 1

The HIGH is confined to clean-checkout recovery. Its offline authority verifier
proved event hashes, receipts, deltas, and transitions, but did not apply the
full candidate shape and state-evidence validator to every historical event. A
historical `audit-failed-stop` candidate could lose `usageSnapshot`, have the
remaining chain rehashed, and still yield a green latest-candidate projection.
Candidate 6 therefore remains the same acceptance and authority while adding
full-history candidate validation plus rehashed malformed-shape, incomplete
STOP, and state-evidence fixtures. The LOW remains the terminal-only duplicated
ledger prose and does not alter the repair scope.

## Candidate 6 final audit and release-full-check finding

- Audited tree fingerprint: `2df7bf9a2dc5b0d2ae99d325bee5132f2a9638fbebe17c018ee57872dfdf921a`
- Tracked authority sequence: `85`
- Tracked authority event hash: `d88f0fbee016aa4e072d034b01b808fbb1ceca8b86cefb5580fc63f21b266201`
- Audit envelope: `0ee31659358650104ff1ae673c78ceba89b9a45ec9d9dae5343604a0344a4d0b`
- Auditor: `/root/gov58a_cold_audit`
- Verdict: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 1

The audit closed the executable clean-checkout finding. The release full check
then passed Core 229 files / 2119 tests and 381 of 382 DOM files / 2621 of 2622
tests. The sole failure was a Judge-owned GOV-CODEX-56R2 review assertion that
still required the obsolete prose `one replacement push`; the executable and
current contract now define one replacement-push objective with cumulative
advisory crossings. Candidate 7 is the same-acceptance `release-full-check`
repair and changes only that stale review expectation plus this evidence record.

## Candidate 7 final audit and exact-head CI finding

- Audited tree fingerprint: `8c59ece8ac970d0d3ebba605dc3750cfa1fe1c27c77b087f494c49ed0c2cc736`
- Tracked authority sequence: `91`
- Tracked authority event hash: `7646d68e0cd6c3904425e8bc2ad02d2ed24cd5ee79e3b2eefa7c61d684609fe9`
- Audit envelope: `ba859bf5f948545972a445c401e679e010db51093881555f410f434ae0237b65`
- Auditor: `/root/gov58a_cold_audit`
- Verdict: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 1
- Semantic release commit: `0ce4b3173fc1ed83e03ebd314e63458800f07264`
- Exact-head CI: run `33209280527`, build job `98978213569`, FAIL after full check

GitHub's exact-head `npm run check` passed, including the corrected Judge review,
then the legacy forbidden-file scan rejected the two Judge-owned `review.*`
paths by name. The scanner never consumed the already verified tracked guard
acknowledgement, although research paths were correctly informational only.
Candidate 8 is the same-acceptance `ci-environment` repair at base
`0ce4b3173fc1ed83e03ebd314e63458800f07264`: it connects the default scanner to
the existing exact tracked proof without adding a caller owner, allowlist,
manifest, workflow exception, or new authority source.

## Candidate 8 final audit and release-full-check finding

- Audited tree fingerprint: `ec7996d7eb7f9b5e4c78010a713a10795bb6d18bb480db3097fa5930658b9354`
- Tracked authority sequence: `104`
- Tracked authority event hash: `7037ddbdbedcafca945f65ef5f7d7ccd5edc033e7bd3f5bac30df2832938f9c2`
- Audit envelope: `53fa4c2dcf130e4ade31c0fab477a02c49f28853e1008bcc169f153495096864`
- Auditor: `/root/gov58a_cold_audit`
- Verdict: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 1

The exact tracked Judge reauthorization closed the scanner finding. The
release full check then passed Core 229 files / 2119 tests and 381 of 382 DOM
files / 2637 of 2638 tests. The sole failure was the older O4P-09C frozen-path
review, which did not yet recognize the new
`scripts/__tests__/forbidden-policy.test.mjs` Judge verification path.
Candidate 9 is the same-acceptance `release-full-check` repair at base
`0ce4b3173fc1ed83e03ebd314e63458800f07264`; it adds only that exact path to the
existing Judge set and records this evidence. It does not expand product,
review, authority, dependency, or release scope.
