# O4P-02B cold-audit record — 2026-08-12

## Candidate and boundary

O4P-02B adds a pure local four-seat Online Room envelope around the shipped
Mode-Neutral Core. It owns application participants, seat capabilities,
readiness, host start, activation, disconnect/rejoin, and reconciliation of
accepted Core concession/defeat state. It stores no Core root, does not call
the Core reducer, does not place connection metadata in Core, and adds no
protocol, projection, network, Cloudflare, UI, persistence, clock, or RNG.

Base SHA: `62fd41918590de90165fdd3b982efe0032dd6ddb`.

Frozen authority:

- `research/cr-grounding/o4p-02b-four-seat-room.contract.draft.md`
- `research/cr-grounding/o4p-02b-acceptance-brief.draft.md`
- `research/cr-grounding/o4p-02b-cold-audit-brief.draft.md`

## Independent audit and corrections

Read-only cold auditor `/root/o4p_02b_cold_auditor` received only the audit
brief, changed no files, and inspected each frozen replacement candidate.

The first audit matched semantic fingerprint
`1dd0d287187e792c3c932d15973bdcdac629c43bced69d87e53a01d9a7b8a80c`
and context fingerprint
`44db8aba7b50dee022a3e9b25927a6361da2e746341a9ce4b053386f2359dc49`.
It reported BLOCKER 0 / HIGH 1 / MEDIUM 1 / LOW 0:

- capability literals could enter typed issue paths through dynamic unknown
  keys and forwarded Core diagnostics;
- the Room architecture evidence used a bypassable import denylist and omitted
  unexpected executable extensions.

The same implementer used its second and final return to add a centralized
diagnostic redaction boundary and ordinary creation/validation/operation/Core
forwarding regressions. The judge replaced the architecture denylist with an
exact production inventory and module allowlist.

Re-audit matched semantic fingerprint
`4b04856280642e82a3e0f37ed85792957a96f67e2253e2fbd156c7d9f9b4860e`
and context fingerprint
`7890d2734f0340720508e506b0f44acb8e94919d581288c5b83786d38be1c05e`.
It retained HIGH 1 / MEDIUM 1: capability runs embedded in aliases still leaked
when extraction was unavailable, and import-type plus indirect require forms
escaped the architecture walker.

With both implementer returns exhausted, bounded judge surgery changed only
the redaction boundary, capability-bearing operation parsing, one judge review,
and the judge architecture review. Every capability-shaped run is now removed
from diagnostic code/path/message independent of extraction; readable attempted
capabilities are carried to typed errors; import-type and indirect require
forms fail closed.

Final semantic re-audit matched fingerprint
`d6793c5f29d67e21419ccf6e20e9b563e3bc297a0a12a6d325ae8838aa114b68`
and context fingerprint
`8a7ce1e438e17c31eed0da4228d3f9b82797a5eef55a8cd98f8b4fee6c0aed81`.
It reported BLOCKER 0 / HIGH 0 / MEDIUM 1 / LOW 0 and verdict
`AUDIT-OK-PENDING-FULL-CHECK`. The capability disclosure HIGH was closed.

The recorded MEDIUM is future fail-closed hardening: a constant-computed
`require` key is not recognized by the judge-only architecture extractor.
The exact six current Room production files contain no such reference or
forbidden dependency.

## Release full-check finding and focused audit

The first audited `npm run check` passed all registered verifiers, docs, lint,
and Core 226 files / 2086 tests. DOM then exposed two stale closed architecture
expectations: the exact Room public-Core consumers/verifier were not registered,
and the historical Online-root guard allowed only `architecture`. DOM finished
258/260 files and 1812/1814 tests; build was correctly skipped.

The judge changed only those two existing architecture tests. The mode-neutral
boundary now registers exactly `operations.ts`, `types.ts`, and `validation.ts`
as public-Core-barrel consumers and exactly the Room verifier; direct Core
submodules and unreviewed consumers remain rejected. The Online-root guard now
allows exactly `architecture` and `room`.

Focused read-only re-audit matched semantic fingerprint
`030fa52848791739dfaa30304e38ae3d656dac15590ec5a71fcd17d7f07d8611`
and context fingerprint
`d6c524bcd02723edb3ec96072e77093a70912d04ab7e7b676c293bda4b0a8105`.
It reported BLOCKER 0 / HIGH 0 and verdict
`AUDIT-OK-PENDING-FULL-CHECK`. It added one recorded MEDIUM: a future aliased
public-barrel reducer call could evade the combined judge gates. Current Room
source imports no reducer and makes no reducer call.

## Final local evidence

- `npm run check:domain -- online-room`: 4 files / 23 tests PASS;
- ordinary Room tests: 2 files / 15 tests PASS;
- affected architecture evidence: 2 files / 11 tests PASS;
- Room, O4P-01N Core closure, and O4P-02A compatibility verifiers: PASS;
- checks TypeScript project, scoped and repository ESLint, machine-check
  registration, and `git diff --check`: PASS;
- governance-authorized second and final `npm run check`: PASS;
- final Core: 226 files / 2086 tests PASS;
- final DOM: 260 files / 1815 tests PASS;
- TypeScript production build: PASS; only the existing chunk-size warning.

O4P-02B is locally `audited`, not yet `shipped`. Candidate commit, push,
GitHub Actions, Pages HTTP/asset evidence, and final clean-worktree proof remain
release gates. The two MEDIUM architecture-hardening findings remain recorded;
neither describes a forbidden dependency or reducer call in the frozen source.

## Candidate publication and judge re-ownership

The audited release tree was committed as
`eeaf141c961652903bb5b8fd179436ca573f109a` and pushed to `main`. GitHub
Actions run `31601060466` independently passed `npm ci` and the complete
`npm run check` on that exact head. It then stopped at the forbidden-file lane
before Pages because the pushed O4P-02B range contains the two judge-authored
acceptance files:

- `src/online/room/__tests__/review.o4p-02b-four-seat-room.test.ts`
  SHA-256 `dba4cabae2fa1eb390e6e8d6e5d6329e30aca2ac934f7edeec672bf28bf7771b`;
- `src/test/architecture/review.o4p-02b-four-seat-room-boundary.test.ts`
  SHA-256 `f8aa29753e32cc97712abb9bdf682db0e2113d46e7f95beeb5036b8e0c448b4f`.

The Sol judge explicitly re-owns those frozen acceptance files. They are the
same files covered by the clean O4P-02B cold audits; no source file, assertion,
workflow, or forbidden-file protection is changed. A metadata-only commit may
advance the push diff base to
`eeaf141c961652903bb5b8fd179436ca573f109a` and retry CI/Pages under the
established O4P-01N and O4P-02A precedent.

## Metadata retry and Pages evidence

Judge re-ownership commit
`c6bb60f5d5edcc17fd6b159467197c351fb2b81e` changed only this audit record and
the ledger. GitHub Actions run `31602084451` resolved diff base
`eeaf141c961652903bb5b8fd179436ca573f109a` and passed every required gate:
`npm ci`, the complete `npm run check`, ancestor-safe diff-base resolution,
forbidden scan, Pages artifact build, and Pages deploy.

Served evidence after deployment:

- `https://makeinu1.github.io/MTG_OneDeck/`: HTTP 200;
- served JS `assets/index-CyZgN26K.js`: HTTP 200;
- served CSS `assets/index-JeU5vEot.css`: HTTP 200;
- HTML and both assets report deployment `Last-Modified` 2026-08-12 13:42:23
  UTC.

The pure Room substrate has no visible UI interaction to exercise; the served
asset and CI evidence close publication. O4P-02B may now be marked `shipped`;
one final metadata push records that terminal state and must itself pass
CI/Pages with a clean worktree.
