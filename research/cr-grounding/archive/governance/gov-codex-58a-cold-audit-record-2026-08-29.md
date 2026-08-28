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
