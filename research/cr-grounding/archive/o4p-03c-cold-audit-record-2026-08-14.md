# O4P-03C cold audit record

Milestone: `O4P-03C` Capability & Abuse Control

Base SHA: `a6f4c539a977e38a6891c31fb99acf4fddfee428`

Audit authority:

- `research/cr-grounding/o4p-03c-capability-abuse-control.contract.draft.md`
- `research/cr-grounding/o4p-03c-acceptance-brief.draft.md`
- `research/cr-grounding/o4p-03c-cold-audit-brief.draft.md`

Independent read-only auditor: `/root/o4p03c_cold_auditor`.

The auditor made no file or git write, did not deploy Cloudflare, and did not
run the release full check.

## Implementer evidence

The persistent implementation session
`019ffb24-4f8a-7670-b421-ec43ec619bdc` ran through the CLI as
`gpt-5.6-luna` with reasoning effort `xhigh`, as explicitly requested by the
user. It completed two bounded correction returns. The final session report was
31,626,196 input tokens, including 30,765,056 cached input tokens, 163,974
output tokens, and 77,236 reasoning tokens. It used 194 model cycles, two
compactions, and zero release full-check invocations.

The two implementer correction returns did not close every security finding.
Under the standing bounded-surgery rule, the Sol Judge owned the final narrow
repair recorded in
`research/cr-grounding/o4p-03c-correction-3-judge-surgery.draft.md`, then
returned each repaired frozen tree to the same independent auditor.

## Audit progression

The initial frozen candidate at semantic fingerprint
`47d1c49debf11c5bef6919b6df63b73124fe8b19d97295498cbef25efd75a91b`
and context fingerprint
`241b459892af374089c40ca4441daf7dfc566cd04faf4482a5e67574a2c749af`
returned BLOCKER 1 / HIGH 4. The accepted findings covered bearer material in
non-capability fields, partial multi-clock security mutation, exhausted socket
frames loading application state, implicit schema creation over a pre-O4P-03C
database, and an invalid generation-zero protocol-token relation.

The second corrected candidate at semantic fingerprint
`5290b41682de753aaedfde344d83af0b827c47cd3d25aff299f8b33da0d2f40c`
and context fingerprint
`2c1313515f29abab13b192324336b81a3a3ed339f4b071c6492175e48ce0f904`
returned BLOCKER 1 / HIGH 3. A twice-rotated alphanumeric capability could be
reused as a lower-layer command identifier and then echoed and persisted. The
remaining HIGH findings concerned valid long identifiers, incomplete grant
cardinality on exhausted paths, and impossible audit relations.

The bounded Judge repair added a canonical private retired-token ledger,
unexpired exact-collision rejection, bounded expiry pruning, fixed grant
cardinality, property-name and value secrecy checks with the root transport
capability as the sole value exemption, canonical audit relations, and direct
SQLite/Judge evidence. Subsequent re-audits found and closed property-name
fragment and exact-expiry ordering defects before release eligibility.

## Final repaired-candidate audit

- semantic fingerprint:
  `6c005cf169bce98be2f487441364c5f3dabc8b48a03cfa079508f9b80b3c4593`
- context fingerprint:
  `8f30956e1b116409b0c396c3f1ce8fadcadfa03cf3b4f2a1ac0ab38cb4fb2612`
- context health: `ok` / `current`
- verdict: `AUDIT-OK-PENDING-FULL-CHECK`
- totals: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0

The direct real-SQLite expiry probe performed two rotations, rejected retired
reuse at `expiresAt - 1`, accepted it at exact `expiresAt` while the current
token remained valid, advanced to generation 3, pruned the expired entry, and
preserved the just-retired current entry. The independent audit also confirmed
secret-free properties and values, valid long lower identifiers, the complete
host/seat/table/spectator and root-only action matrix, grant-cardinality
fail-closed behavior, audit-generation relations, canonical ledger cap and
atomicity, CAS rollback, and unchanged dependency, configuration, and
lower-layer boundaries.

Evidence passed:

- O4P-03A/B/C registered verifiers: 3/3;
- Judge O4P-03A/B/C: 3 files, 25 tests;
- ordinary Cloudflare regressions: 4 files, 26 tests;
- architecture reviews: 3 files, 16 tests;
- machine registration: 1 file, 7 tests;
- total targeted suite: 11 files, 74 tests;
- direct exclusive-expiry probe: 1/1;
- `git diff --check`: passed.

Judge adjudication: every BLOCKER and HIGH is non-vacuously closed. The final
semantic candidate is eligible for the one fingerprint-matched release full
check after audit metadata confirmation. Cloudflare resource creation, route,
secret, migration, and actual deployment remain deferred to the separately
bounded O4P-03D milestone.

## Fingerprint-matched release full check

The Judge froze the metadata-confirmed release tree at semantic fingerprint
`cf4456cb7016cd03d05d1ad6d008a682c2386c4a758c9a20b966627022e49ec6`
and context fingerprint
`a3edcad043a3a528e444868f87424543d6395ab8dda17ea447e5569efff2910e`.
Context health and loop state were current. The independent metadata-only
confirmation returned BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0 and authorized
exactly one release full check.

That single `npm run check` passed every registered verifier, docs check, and
lint; Core 226 files / 2,086 tests; DOM 282 files / 1,987 tests; TypeScript;
and the Vite production build. Generated assets were
`assets/index-DYJZmvM4.js` and `assets/index-JeU5vEot.css`. Total machine-check
duration was 243,220 ms. The post-run semantic and context fingerprints were
unchanged, and `git diff --check` passed.

## Candidate CI and shipment

Candidate commit `4cd1a351c29baff1714a55c959acf5d7b5485a70` was pushed to
`main`. Exact-head Actions run `31750144276` passed every registered verifier,
docs, lint, Core 226 files / 2,086 tests, and 281 of 282 DOM files. Its final
Judge file did not execute on the workflow's Node 22 runtime: Vite could not
bundle the static value import of `node:sqlite` from the Judge real-SQLite
helper. Build, forbidden scan, and Pages were skipped. This was adjudicated as
a real release-gate compatibility defect; no retry was used.

The bounded repair is recorded in
`research/cr-grounding/o4p-03c-ci-node22-sqlite-repair-audit-brief.draft.md`.
Only the Judge helper changes its runtime SQLite load to
`createRequire(import.meta.url)`, while keeping the erased SQLite type import,
and only the corresponding verifier hash changes. No production, assertion,
dependency, workflow, configuration, contract, or lower-layer byte changed.

Independent repair audit at semantic fingerprint
`e96660cdb997debb4b20e5ba207b3602cec7a5ba0d3c09834a51081d80383a3e`
and context fingerprint
`4a7b8374ed77ac92a7826924a8bf832fb69253cb208b709ed61a073be513ae8b`
returned BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0 with unchanged fingerprints.
Exact Node `v22.22.0` and local Node 24 each passed the Judge file's 11 tests
against real in-memory SQLite; the O4P-03C verifier, scoped ESLint, and
`git diff --check` passed. The repair is eligible for metadata confirmation
and the governance-maximum second/final fingerprint-matched release full
check.

The metadata-confirmed repaired tree was frozen at semantic fingerprint
`5d6558c1224637ba79ab157dbf345c6c2a909004065286b6697242732498cb72`
and context fingerprint
`15231909b67fb726260e48679168cd5f79e8b81ee51248719f4dd33cda06d443`.
Independent metadata confirmation returned BLOCKER 0 / HIGH 0 / MEDIUM 0 /
LOW 0 and authorized the governance-maximum second and final release full
check.

That final `npm run check` passed every registered verifier, docs, and lint;
Core 226 files / 2,086 tests; DOM 282 files / 1,987 tests; TypeScript; and Vite
production build. Generated assets remained `assets/index-DYJZmvM4.js` and
`assets/index-JeU5vEot.css`. Total machine-check duration was 241,098 ms. The
post-run semantic and context fingerprints were unchanged, and
`git diff --check` passed. No further local release full check is authorized.

Exact-head repair commit, successful Actions, GitHub Pages evidence, and
terminal metadata remain pending. No Cloudflare deployment occurred.

## Shipment

Repair commit `369cba2fb7a1ce329db7a4374615dfef001b4278` was pushed to
`main`. Exact-head Actions run `31751514637` passed `npm ci`, the complete
Node 22 `npm run check -- --build-base=/MTG_OneDeck/`, resolved the commit-local
base `4cd1a351c29baff1714a55c959acf5d7b5485a70`, passed the forbidden scan,
configured and uploaded the Pages artifact, and deployed GitHub Pages. Both
build and deploy jobs completed successfully.

Served evidence after that deployment:

- HTML `https://makeinu1.github.io/MTG_OneDeck/`: HTTP 200;
- JS `assets/index-CyZgN26K.js`: HTTP 200;
- CSS `assets/index-JeU5vEot.css`: HTTP 200.

All three responses reported last-modified `2026-08-13 22:57:57 UTC`. Local
`HEAD` and `origin/main` both matched the repair commit and the worktree was
clean before terminal metadata. O4P-03C is eligible to be marked shipped.
Cloudflare account, route, migration, resource creation, and actual Durable
Object deployment remain wholly deferred to the separately bounded O4P-03D.
