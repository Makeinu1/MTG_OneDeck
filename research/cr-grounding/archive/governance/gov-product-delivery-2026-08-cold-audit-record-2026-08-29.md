# GOV-PRODUCT-DELIVERY-2026-08 cold-audit record

## First authority-routing R3/BROAD audit

- Base SHA: `8b906a888facc49213f51071d660f42098cc174c`
- Audited tree fingerprint: `8a7c91bd2033392a11eea045f7c9521dc08d3b82102dc901fb8f09b8eb0b8162`
- Auditor: `/root/product_delivery_cold_audit`
- Verdict: BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 0
- Ship gate: FAIL

The HIGH finding was duplicate authority routing in `docs/README.md`. The
index correctly named `docs/product-requirements.md` and `delivery-policy.md`
as the product WHY/WHAT and delivery HOW authorities, but also described
`docs/contracts/ui/` as owning generic “WHY, WHAT, HOW.” That made product and
delivery changes ambiguously routable and contradicted the required
single-authority split.

The Judge accepted the finding. The bounded correction changed only that index
entry so `docs/contracts/ui/` owns executable UI design, architecture,
responsive, and audiovisual boundaries rather than product or delivery
authority. The same cold-auditor lineage re-audited fingerprint
`1546b41ca0836f14e21de59206e0386de12dfd784af3006ddc507a2d827afd01`
and returned BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0. `npm run check:docs`
passed for both the failed candidate and the correction.

## Reauthorization R3/BROAD audit

- Base SHA: `8b906a888facc49213f51071d660f42098cc174c`
- Audited tree fingerprint: `c01b2682210df3d274a2aea8781d53996d5ddeb2bcec1de8c8c4fae21fa9f005`
- Tracked authority event hash: `93ed15ecf82c2e9745b45666c2f9544a4215116bb759e3e92ad4605c3446cdc4`
- Auditor: `/root/product_delivery_cold_audit`
- Verdict: BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 0
- Ship gate: FAIL

The HIGH finding was an executable authority-provenance gap. The normal
`user-reauthorize` write path required the event reason and candidate
`authoritySource` to be identical, but the tracked-chain verifier accepted two
different strings when both began with `user-ruling:`. Because the tracked
authority file is excluded from the candidate tree fingerprint, an attacker
could change the event reason, rehash the remaining chain, and retain the
frozen candidate fingerprint.

The Judge accepted the finding. The same implementer lineage corrected the
verifier so a `user-reauthorize` history transition requires exact equality
between `event.reason` and `current.authoritySource`. A regression fixture now
rewrites only the event reason to another `user-ruling:` value, rehashes the
chain, and requires `TRACKED_CANDIDATE_SCOPE_CHANGED`.

Bounded repair verification passed:

- governance supervisor tests: 44 passed;
- `npm run check:docs`: passed;
- targeted ESLint: passed;
- `git diff --check`: passed.

This record preserves the failed audit and its repair; it does not claim final
audit closure. Shipment still requires the same independent cold-auditor
lineage to inspect the final frozen fingerprint and return zero BLOCKER/HIGH.

## Release full-check repair

- Audited tree fingerprint: `f8fe680fd042b68514a341e5a1da50151502cc6ab7c3e5686918ec393743afda`
- Cold-audit verdict before the check: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0
- Full-check attempt: 1
- Result: FAIL before lint, test, and build
- Failed gate: `verify:o4p-05d-production-release-closure`

The executable O4P-05D closure verifier and its historical roadmap reviews
accepted the O4P-09 sequence with no governance checkpoint or with only
`GOV-CODEX-58A-2026-08`. They did not yet recognize the synchronized,
user-authorized `GOV-PRODUCT-DELIVERY-2026-08` checkpoint immediately before
O4P-09F. The live ledger, both ledger collections, and O4P-09F dependency were
internally consistent; this was stale protected verification, not a product,
runtime, CR, dependency, acceptance, or authority defect.

Candidate 2 is the same-acceptance `release-full-check` repair. The Judge
synchronized only the exact active-program expectations in the O4P-05D
verifier and affected historical `review.*` guards, updated the verifier's
frozen hash for the intentionally changed O4P-05D review, and restored the
existing no-numeric-permission-question phrase in `AGENTS.md`. Product and
runtime source remain unchanged. This section records the failed full check
and bounded repair; it does not pre-claim the replacement audit or final full
check result.

## Candidate 2 replacement-audit finding

- Audited tree fingerprint: `a3954cc118b8b5a82c0bee1f339683ef42b09ccd975ac3a4f642ef64955ad4d5`
- Auditor: `/root/product_delivery_cold_audit`
- Verdict: BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 0
- Ship gate: FAIL

The replacement repair made the current candidate green by hardcoding
`GOV-PRODUCT-DELIVERY-2026-08` as the active supervised domain in two
historical governance reviews. That would recreate the same stale-guard
failure immediately after this checkpoint ships and O4P-09F becomes active.

The Judge accepted the finding. The bounded correction derives the active
domain, its authority source, and permission projection from the live ledger,
and compares historical-domain rejection against that derived next domain.
It preserves the exact active-program sequence checks that protect the current
ledger while removing the transition-sensitive current-ID pins. This section
records the finding and correction; it does not pre-claim final audit closure.

## Candidate 2 second full-check finding

- Audited tree fingerprint: `a88fd3590c9060d220d67bf51b76faa3261d645f669314105397b771a66e5317`
- Final replacement audit before the check: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0
- Full-check attempt: 2
- Core: 229 files / 2119 tests passed
- DOM: 381 of 382 files and 2644 of 2645 tests passed
- Failed review: `review.o4p-09c-pregame-lifecycle.test.ts`

The remaining failure was another historical fixed-list guard. Its frozen
O4P-09C scope check knew earlier successor and governance paths but did not
classify the current product/delivery authority documents and release entry.
The first reported path was `.claude/commands/ship.md`; the same category also
covered the new canonical documents, Skill, briefs, archive, and tracked
authority. Product, Core, runtime, lint, and all other tests passed.

Candidate 3 is the same-acceptance `release-full-check` repair. The frozen
review retains every explicit product path set and its online-source negative
checks. Already committed history uses the central ownership classifier only
for Judge-owned paths. Current-candidate Judge paths require an exact green
guard-impact report whose candidate ID, tree fingerprint, report fingerprint,
path, owner, and bytes are bound to verified supervisor context; the active
tracked-authority path is bound by that same verified context. Unacknowledged
current paths and non-Judge product paths remain rejected. This section does
not pre-claim final audit or full-check closure.

## Candidate 3 archive-completeness finding

- Audited tree fingerprint: `91f25b13909fea9bfaf87ec9c9de11dd43ec47a5c0381fd0e02d653e5e7d8eee`
- Auditor: `/root/product_delivery_cold_audit`
- Verdict: BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 0
- Ship gate: FAIL

The candidate-3 audit confirmed the frozen fingerprint, tracked supervisor
hash chain, exact guard acknowledgement and all acknowledged bytes, current
versus historical path classification, negative-path fail-closed behavior,
targeted tests, document validation, closure verification, Skill validation,
ESLint, and diff integrity. It nevertheless found this archive incomplete:
the tracked chain preserved the earlier `duplicate-authority-routing` failure
for fingerprint `8a7c91bd…` and the successful re-audit of `1546b41c…`, while
the archive began only with the later reauthorization audit at `c01b2682…`.

The Judge accepted the finding and added the missing first failure, bounded
correction, and successful re-audit above. This is an evidence-only correction;
it changes no product, runtime, CR, acceptance, authority, or release behavior.
It does not pre-claim closure: the same cold-auditor lineage must verify the
new frozen fingerprint and return zero BLOCKER/HIGH before the full check.

## Candidate 3 final full check and candidate 4 pre-commit repair

- Candidate-3 audited tree fingerprint: `6737be19936381a5dcda1fec451360e00c452aa7add459bdb15f0eedfaf399b6`
- Final cold audit: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0
- Full-check attempt: 3
- Core: 229 files / 2119 tests passed
- DOM: 382 files / 2645 tests passed
- Lint, typecheck, production build, and O4P-07C runtime verification: passed

The exact candidate-3 full check passed every release gate. Before the
semantic commit, `git diff --cached --check` then exposed one extra blank line
at the end of the newly added delivery policy. Candidate 4 was derived as the
same-acceptance `release-full-check` repair and removed only that final LF;
the document body and every product, runtime, CR, authority, and acceptance
meaning remained unchanged. `git diff HEAD --check` and `check:docs` passed.

## Candidate 4 guard-report finding

- Audited tree fingerprint: `d8f8330280794455d043149c741887f67c409e815bf2549baec0753aa97cf1f3`
- Auditor: `/root/product_delivery_cold_audit`
- Verdict: BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 0
- Ship gate: FAIL

The candidate-4 audit confirmed that its only candidate-3 byte difference was
the final LF and that identity, base, acceptance, authority/source, lineages,
waits, structural counters, and acknowledged path bytes were preserved. It
found the stored guard report stale, however: the report recorded at freeze
included the active tracked supervisor-event JSON as a source of path and hash
references while that file was below the two-megabyte text-scan limit. A later
append pushed the same event file above the limit, silently removed it from the
scan universe, and changed the deterministic report without changing the
candidate tree.

The Judge accepted the finding. The bounded correction excludes all
`research/cr-grounding/supervisor-events/` paths from both current and base
guard-reference scans; those append-only state records remain independently
verified by their hash chain and are never candidate changed paths. A
regression covers small and over-limit event files while preserving detection
of ordinary executable guards. This section records the finding and planned
correction; it does not pre-claim the replacement audit or exact-tree full
check.

## Candidate 4 clean-CI pre-push finding and candidate 5 repair

- Candidate-4 audited tree fingerprint: `1687b6dfaea148a0ab926d0d5115bceb421ff9a1dc7f36a3564aa39743eb9e98`
- Final candidate-4 cold audit: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0
- Full-check attempt: 4
- Core: 229 files / 2119 tests passed
- DOM: 382 files / 2646 tests passed
- Semantic commit: `1e948c1cf4c50463ba2ec55987003b46fce7b962`
- Clean-checkout forbidden result: `NON_REVIEW_FORBIDDEN_PATH`

The audited candidate and final local full check were green. Before push, the
Judge reproduced the workflow's explicit-base forbidden scan in a temporary
clean checkout. It rejected the exact acknowledged `AGENTS.md` byte because
the existing CI bridge admitted only `review.*`; the next unreachable branch
also required the active domain's supervisor record to exist at the diff base,
although this first semantic commit introduces that record itself.

Candidate 5 is the same-acceptance `ci-environment` repair at base
`1e948c1cf4c50463ba2ec55987003b46fce7b962`. It adds only a narrow first-commit
verification path: a clean checkout must prove the complete supervisor-authored
bootstrap chain, the newly inserted synchronized governance successor, exact
guard acknowledgement, and the single retained user-ruling authority epoch
before `AGENTS.md` can pass. `CLAUDE.md`, `eslint.config.js`, caller-supplied
ownership, another authority path, wrong bootstrap/base history, stale bytes,
and malformed proof remain hard failures. This section records the defect and
repair scope; it does not pre-claim replacement audit, full-check, CI, or Pages
closure.

The same pre-push reproduction also established that the repair candidate's
immutable base is the unpublished semantic commit while GitHub's eventual
single-push diff base remains the original `origin/main`. Candidate 5 therefore
retains candidate-base ancestry but binds its guard acknowledgement to the
cumulative original-base diff only while the exact `ci-environment`
predecessor, zero push counters, null release heads, unchanged scope/roles,
and current unpublished HEAD all hold. Any first push or mismatch disables
creation or expansion of that acknowledgement; after the one exact release
head is bound, later gates may only re-verify the frozen cumulative proof. This
closes the cumulative-diff gap without
rewriting history, sending an intentionally red intermediate push, or changing
the release artifact binding.

## Candidate 5 conflicting-predecessor audit finding

- Audited tree fingerprint: `38939d6fabc5862ec6831f12d99dc96034f01ae90cd8993403c4ef2b5b66e13b`
- Tracked sequence/event hash: `61` /
  `c691be1e5e47204d56332d72fdb9c7c6c301e8770973acea8f9cda25920a4aaa`
- Auditor: `/root/product_delivery_cold_audit`
- Verdict: BLOCKER 0 / HIGH 1 / MEDIUM 0 / LOW 0
- Ship gate: FAIL

The first-commit bootstrap, user-ruling gate, cumulative original-base guard,
clean positive and actor/base-ledger/extra-authority/stale-byte negatives, 92
targeted tests, protected review, docs, Skill, lint, and diff checks passed.
The remaining HIGH was confined to volatile predecessor recovery: when a
same-ID `repair-required` predecessor was already present in loop state, the
helper returned it without byte-comparing it to the hash-chained tracked
snapshot. Changing only its `fullChecks`, `correctionWaves`, and usage counters
therefore left cumulative-base admission green.

The accepted correction always derives the unique repair-required predecessor
from verified tracked history, then requires any loop copy to be byte-identical
in stable JSON. A missing loop copy is restored from the tracked snapshot;
duplicate, conflicting, or counter-modified loop copies fail closed. This is a
single-root-cause correction inside candidate 5 and does not change product,
acceptance, authority, release base, or the audited first-commit boundaries.
It does not pre-claim replacement audit or full-check closure.

## Candidate 5 final audit, full check, and semantic CI finding

- Frozen tree fingerprint:
  `f9e19c015a907894d65830ad1c4a80e90c31ca864accfd200c53145a47cdd12b`
- Final cold audit: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0
- Full-check attempt: 5
- Local result: PASS; Core 229 files / 2119 tests, DOM 382 files / 2649
  tests, lint, TypeScript, production build, static verifiers, and O4P-07C
  runtime all green
- Release commit: `465316ac8669101de510fcb2928518c24494dd51`
- Clean-checkout cumulative forbidden scan: PASS with `JUDGE-REAUTHORIZED`
- Semantic CI: run `33248563800`, FAIL in the protected O4P-09C review

The exact audited tree and local release check were green, and the clean
forbidden scan accepted the original-base release diff. GitHub CI then exposed
one clean-checkout guard-proof defect. `liveCandidatePathScope` invoked
`guard-impact.mjs`; the volatile `.claude/loop-state.md` was absent, so the
compact context candidate did not provide the raw acknowledgement stored in
the verified tracked supervisor event. The report fingerprint also correctly
changed when the semantic commit fixed a new `headSha`. The review therefore
received a nonzero guard result even though acknowledged paths, owners, bytes,
guard references, predecessor references, candidate identity, and tree
fingerprint were unchanged. Product, runtime, CR, dependency, authority, and
acceptance behavior were not implicated.

Candidate 6 is the same-acceptance `guard-impact` repair at base
`465316ac8669101de510fcb2928518c24494dd51`. It keeps `headSha` in the report.
When volatile loop state cannot provide the raw acknowledgement, guard
verification may recover it only from a fully verified tracked authority whose
latest candidate, sequence, and event hash exactly match healthy context. It
may then accept only the existing exact-equivalence case already used by the
program-step release path. Missing acknowledgement, wildcard, rewritten or
truncated authority, mismatched candidate identity/state, and any acknowledged
byte, path, owner, guard, or predecessor-reference drift remain failures. This
section records the CI finding and bounded repair; it does not pre-claim the
replacement audit, final full check, CI, or Pages closure.
