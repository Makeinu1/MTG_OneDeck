# O4P-02A cold audit record — 2026-08-12

## Candidate

O4P-02A adds an observational Solo/Core compatibility boundary. It validates
an explicit bijective identity map, projects the existing Solo `GameState` and
shipped `ModeNeutralCoreRootV1` into a closed comparable view, and returns
deterministic parity evidence without changing either transition authority.
Lossy, Solo-only, Core-only, unsupported, snapshot-migration, Room, protocol,
projection, network, UI, and mixed-authority behavior remain explicit DEFERs.

Base SHA: `e1a71beac93f4882827bd8138990360840363a29`.

## Initial cold audit and repair

Independent Luna auditor `019ff38b-eff8-7eb0-83bf-d35773eb76dc` recomputed and
matched initial fingerprint
`c742841111401e00eab10d670e23e48b324398000c2461da11aa3db0c006a4e7`.
It changed no files and reported two HIGH findings:

- `O4P-02A-HIGH-001`: the standalone verifier was not registered in the checks
  TypeScript project, so direct ESLint could not type-load it;
- `O4P-02A-HIGH-002`: Core combat projection copied combat player/object IDs
  without requiring every reference in the identity map.

The Sol judge added the verifier to `scripts/checks/tsconfig.json`, added exact
Core combat player/object map validation and deterministic issue paths, and
added a regression vector that removes an active combat object from an
otherwise valid map. Direct verifier ESLint, targeted tests, both affected
verifiers, lint, build, and diff check passed after repair.

## Final cold-audit verdict

Fresh-context Luna re-auditor `019ff397-2c2b-7da1-bbb5-a8447c9c94e4`
recomputed and matched replacement candidate fingerprint
`cd82724d7007c645b35b9fea58205f0edd1d8abf81c5d0c47b36dc3085fc3dd4`
before this archive record was appended. It changed no files and reported:

- BLOCKER: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 0

Final verdict: `AUDIT-CLEAR`.

The re-auditor independently reproduced distinct Solo/Core identity mapping,
the repaired Core combat omission paths, compatibility/O4P-01N/review/
architecture/snapshot suites, both verifiers, direct verifier ESLint, full
lint, build, and `git diff --check`. The existing chunk-size warning is
unchanged. The forbidden scan reported only the expected judge-owned candidate
paths requiring release reauthorization; it was not a semantic audit finding.

The release full `npm run check` was intentionally not run before this clear
verdict. The next gate is one full check on the release tree, followed by
publication metadata and git operations only under user publication authority.

## Publication re-audit and bounded repair

After the generated API refresh and documentation whitespace cleanup, fresh
Luna auditor `019ff3f1-fbc7-7be0-8ce7-e679b4794ecc` matched fingerprint
`5cfd2648f1f9ab3ee894f6b2b7eefb8ea376f5c9b8268bbccf740f3f9aa07e88`.
It reported one HIGH and two MEDIUM findings:

- `O4P-02A-HIGH-003`: an object map could cross-link a Solo physical card to
  a different Core physical card than the physical-card map;
- `O4P-02A-MEDIUM-001`: a hostile `cards` source could suppress independent
  active-player and turn issues;
- `O4P-02A-MEDIUM-002`: the checks TypeScript project exposed five new
  compatibility-verifier errors and three pre-existing closure-verifier type
  errors.

The same Luna implementer, `019ff350-84dd-7330-87af-ec5e252617ec`, performed
a bounded repair. Identity-map normalization now verifies Solo and Core object
physical identity in both directions with exact deterministic issue paths.
Solo projection inspects independent active-player and turn fields before
trap-prone card data. The compatibility verifier and closure verifier received
type-only corrections and now pass the checks TypeScript project. Ordinary
regressions cover cross-linked maps and revoked/trapping card sources.

Post-repair evidence before the replacement audit:

- compatibility implementation and judge tests: 3 files, 35 tests PASS;
- `npx tsc -p scripts/checks/tsconfig.json --noEmit`: PASS;
- `verify:solo-core-compatibility`: PASS;
- `verify:mode-neutral-core-closure`: PASS;
- generated engine API refreshed;
- `git diff --check`: PASS.

The candidate remains unshipped until a replacement cold audit clears the
changed claims and the final release full check passes.

## Replacement cold-audit verdict and candidate commit

Fresh Luna auditor `019ff403-c126-7d90-b932-9361a154a583` recomputed and
matched repaired fingerprint
`71075381d9ac02c8a2218b726d95453346355954ed12e91c5f9c1e3b2984f802`.
It independently reproduced both cross-dimension mismatch directions, the
revoked/trapping-card vectors, the checks TypeScript project, 35 compatibility
tests, 48 architecture/snapshot/Solo-preservation tests, 20 O4P-01N closure
tests, both verifiers, ESLint, generated API, and diff checks. It changed no
files and reported:

- BLOCKER: 0
- HIGH: 0
- MEDIUM: 1
- LOW: 0

Verdict: `AUDIT-CLEAR`. The sole MEDIUM was the intentionally stale
`GENERATED-ENGINE-API.lastVerifiedCommit`, which could only be closed after a
candidate commit existed. Candidate commit
`a9ca9aa14bee29cefd2126ac5e658f4106f4cbc8` was then created with the final
auditor ID, and the generated API manifest entry was updated to that exact
SHA. No product or test semantics changed while closing this publication
metadata finding.

The next gate is the second and final release `npm run check` on the
manifest-synchronized release tree.

## Final full-check finding

The second and governance-capped final `npm run check` passed every static
verifier, docs validation, Solo/Core compatibility verifier, lint, and all 226
Core files / 2010 Core tests. The DOM lane then reported one stale
judge-owned architecture expectation in
`src/test/architecture/modeNeutralCoreBoundary.test.ts`: the boundary had not
registered the frozen O4P-02A compatibility source as an exact public-Core-
barrel consumer or the new verifier as an approved verification script. DOM
results were 255 files / 1774 tests passing and one failing test; build was
skipped after the test failure.

The Sol judge added no broad engine exemption. The repair allows only
`src/engine/compatibility/soloCoreCompatibilityV1.ts` to consume exactly
`src/engine/core/index.ts`, and registers exactly
`scripts/checks/verify-solo-core-compatibility.ts`. Adversarial architecture
vectors continue rejecting direct Core submodule imports and unreviewed
compatibility consumers. This changed judge-owned acceptance evidence and
requires a focused replacement cold audit. A further release full check is not
authorized by the two-invocation governance cap.

## Post-full-check focused audit findings and bounded judge repair

Fresh read-only Luna auditor `019ff413-9397-7510-9d56-3226786a2fe4`
matched context fingerprint
`e99922b3ab15b1f60763b50f96a8836274bb3ca1e7a19cf389755ba3fc16bc31`.
It confirmed that the exact architecture allowlist repair did not weaken the
existing boundary, but found two implementation HIGHs:

- `O4P-02A-HIGH-004`: Solo combat projection trusted `cardId` and silently
  discarded a stale stored attacker/blocker `objectId` incarnation.
- `O4P-02A-HIGH-005`: a trap in a nested combat array escaped to the outer
  projection catch, replacing already collected active-player and turn issues
  with one root `INVALID_SOURCE` issue.

The existing Luna implementer had already consumed the two governed repair
returns. Under the bounded-judge-surgery clause, Sol changed only
`soloCoreCompatibilityV1.ts` and its ordinary unit test:

- attacker and blocker `objectId` values are checked against the current Solo
  card incarnation and reject at their exact deterministic paths;
- combat, zone, and commander nested inspections have local trap boundaries,
  preserve independently accumulated issues, and never return a partial view;
- new regression vectors cover stale attacker and blocker incarnations and a
  hostile combat array while checking deterministic, deeply frozen evidence.

Post-repair targeted evidence before replacement audit:

- compatibility implementation/judge tests: 3 files, 38 tests PASS;
- focused compatibility unit test: 1 file, 19 tests PASS;
- direct ESLint on the two repaired files: PASS;
- checks TypeScript project: PASS;
- Solo/Core compatibility verifier: PASS;
- `git diff --check`: PASS.

The changed implementation claims remain `implemented-not-audited` until a
fresh independent Luna cold audit reports BLOCKER/HIGH 0. The two-invocation
release full-check cap remains exhausted.

## Replacement audit verdict and governance STOP

Fresh read-only Luna auditor `019ff427-0c9e-7ec0-bab2-401787fb56b4`
matched context fingerprint
`1fbb4f5ab2636d597355f146f6997c34bfa06f9f7f9e2fcc226caa80544aa644`.
It verified the stale attacker/blocker-incarnation repair and exact
architecture boundary, but reported:

- BLOCKER: 0
- HIGH: 2
- MEDIUM: 2
- LOW: 0

The HIGH findings are:

- `O4P-02A-H-01`: hostile Solo preflight fields can still return early or
  throw while checking `turnOrder`, suppressing safely inspectable combat,
  commander, active-player, or turn issues.
- `O4P-02A-H-02`: invalid `combat.turn` is silently normalized to zero instead
  of rejecting at `/combat/turn` and proving equality with the Solo turn.

The MEDIUM findings are shifted identity-map diagnostic indices after invalid
array descriptors and silent acceptance of sparse/extra-property Solo zone
arrays.

Verdict: `AUDIT-FIX-REQUIRED`. No files were changed by the auditor and no full
check was run. Because two implementer repair returns were already consumed and
the subsequent bounded Sol judge surgery did not close BLOCKER/HIGH, AGENTS.md
requires STOP. O4P-02A remains `implemented-not-audited`; no commit, push, CI,
Pages promotion, or O4P-02B implementation is permitted until the user
explicitly reopens a fresh repair cycle. Independently, the two-invocation
release full-check cap remains exhausted and also requires explicit exception
before eventual publication.

## User-authorized fresh repair cycle

On 2026-08-12 the user explicitly approved both required exceptions:

1. reset O4P-02A to one fresh Luna implementation repair cycle for the two
   HIGH and two MEDIUM findings from audit
   `019ff427-0c9e-7ec0-bab2-401787fb56b4`;
2. after a fresh independent audit reports BLOCKER/HIGH 0, run one exceptional
   third and absolute-final `npm run check`.

The reset does not weaken any contract, test, audit, role-separation, or
publication gate. It authorizes no fourth full check. O4P-02B remains blocked
until O4P-02A is shipped.

## Fresh Luna repair-cycle implementation

Fresh Luna implementer `019ff452-bc27-7450-abca-019f560c1173`, with no prior
thread context and an exact two-file write scope, implemented R1 through R4:

- descriptor-safe independent Solo preflight preserves safely inspectable
  sibling-domain issues;
- `combat.turn` must be a positive safe integer equal to the enclosing Solo
  turn and never defaults to zero;
- dense-array validation retains original source indices after invalid entries;
- Solo turn-order, zone, combat, blocking, and commander arrays reject hostile
  sparse, extra-property, accessor, descriptor-trap, and non-ordinary shapes.

The implementer changed only
`src/engine/compatibility/soloCoreCompatibilityV1.ts` and its ordinary test.
Sol found one project-build TS7024 failure in 14 inline test-table callbacks.
Repair return 1 added only explicit `: string` return annotations; assertions
and product semantics were unchanged.

Post-repair targeted evidence:

- compatibility implementation and judge tests: 3 files, 60 tests PASS;
- architecture boundary tests: 2 files, 11 tests PASS;
- affected Solo preservation tests: 5 files, 22 tests PASS;
- machine-check registration: 1 file, 7 tests PASS;
- both compatibility and Core closure verifiers: PASS;
- direct ESLint, checks TypeScript project, repository lint, and build: PASS;
- forbidden diff scan: FORBIDDEN 0, 8 paths scanned;
- `git diff --check`: PASS.

The required O4P-01N closure suite has one environment-sensitive timing result.
With the repository default 5-second per-test limit it reports 19/20 PASS and
the deterministic four-player replay case completes after timeout at about 6.8
seconds. With only CLI timeout raised to 20 seconds and no file/configuration
change, the same file passes 10/10. No O4P-01N source or test changed. The fresh
auditor must independently classify whether this is an O4P-02A regression or
environment timing noise; the extended-timeout pass is not release evidence.

O4P-02A remains `implemented-not-audited`. The exceptional third and absolute-
final full check remains unused and may run only after fresh audit reports
BLOCKER/HIGH 0.

## Fresh-cycle cold audit

Fresh read-only Luna auditor `019ff46b-3771-7f23-a4ad-e115ff8f678b` matched
candidate fingerprint
`9ea31b5c7d0aea5cc7e7ccd34fb798c0b7a0d680f96484683f08e273f0f80737`,
made no changes, and returned `AUDIT-FIX-REQUIRED`:

- BLOCKER: 0
- HIGH: 3
- MEDIUM: 1
- LOW: 0

Findings:

- H-01: a proxy `ownKeys` trap can hide required numeric keys while
  `readDenseArray` still accepts the array as dense;
- H-02: unreadable `turnOrder` suppresses independently inspectable private
  zone findings;
- H-03: unsupported battle targets short-circuit before stale attacker
  incarnation validation, suppressing one required issue;
- H-04: the parity comparator copies structure but does not validate closed
  comparable-view semantics, so two equal invalid views can compare as
  compatible.

The auditor independently classified the unchanged O4P-01N default-timeout
failure as environment/load timing noise rather than an O4P-02A regression;
the same deterministic test passes unchanged when given a larger CLI timeout.
That extended run is not release evidence.

The same fresh Luna implementer receives repair return 2 of 2 with an exact
four-file scope. O4P-02A remains `implemented-not-audited`; the exceptional
third and absolute-final full check remains unused.

## Repair return 2 implementation

Luna implementer `019ff452-bc27-7450-abca-019f560c1173` used its second and
final repair return and changed only the four authorized compatibility source
and ordinary-test files:

- dense-array validation now rejects any numeric index hidden from
  `Reflect.ownKeys`, with exact source index evidence;
- private zones are inspected in identity-map player order independently of
  an unreadable source `turnOrder`;
- stale attacker incarnation is validated before unsupported battle-target
  classification so both findings are retained;
- parity copying now validates the closed comparable-view literals, numeric
  domains, and non-empty IDs before two views may compare as compatible.

Sol independently reviewed the diff and reproduced:

- compatibility implementation, parity, and judge tests: 3 files, 95 tests
  PASS;
- architecture boundary tests: 2 files, 11 tests PASS;
- Solo preservation: 3 files, 14 tests PASS;
- direct four-file ESLint: PASS;
- checks TypeScript project: PASS;
- `verify:solo-core-compatibility`: PASS;
- `verify:mode-neutral-core-closure`: PASS;
- repository lint: PASS;
- build: PASS with the pre-existing chunk-size warning only;
- forbidden diff scan: FORBIDDEN 0, 10 paths scanned;
- `git diff --check`: PASS.

The candidate remains `implemented-not-audited`. The next gate is a newly
spawned, context-free Luna cold audit on the frozen post-repair fingerprint.
The exceptional third and absolute-final full check remains unused.

## Repair-return-2 replacement audit and bounded Sol correction

Fresh read-only Luna auditor `019ff497-5a67-7e60-bc76-e62e7c42c267`
matched semantic fingerprint
`29fdb9c1200103c08c04c2fce612d4dabed81a5f90b3f59cccd2d24f37a45cc1`
and Codex-context fingerprint
`79f1b113fe006347436fc0181fec69109f8dbd46213f337fbe5465418aefc871`.
It changed no files and returned `AUDIT-FIX-REQUIRED`: BLOCKER 0, HIGH 1,
MEDIUM 0, LOW 0.

`O4P-02A-HIGH-COMBAT-SIBLING-001` proved that an unreadable attacker array
caused `soloCombat` to return before inspecting a readable malformed blocker
array, and vice versa. This violated complete deterministic sibling evidence.

Both Luna repair returns were exhausted. The Sol judge therefore made one
bounded surgical correction: retain the aggregate combat-array issue, process
each readable assignment array independently with a null-to-empty local
iteration, and add symmetric attacker-trap/blocker-malformed and
blocker-trap/attacker-malformed regressions. No authority, type, API, contract,
or additional file changed.

Post-correction targeted evidence:

- compatibility implementation, parity, and judge tests: 3 files, 97 tests
  PASS;
- direct affected ESLint: PASS;
- checks TypeScript project: PASS;
- `git diff --check`: PASS.

The candidate remains `implemented-not-audited`. A new context-free Luna must
re-audit the changed fingerprint before the exceptional third and absolute-
final full check can run.

## Post-bounded-surgery audit governance stop

Fresh read-only Luna auditor `019ff4a7-691f-7260-8f32-1a5c93a41cdf`
matched semantic fingerprint
`7f217eabcf0e4468a202f82aa3bb50234864b5cd1a3a60281f3c1dd7e78ef67a`
and Codex-context fingerprint
`98e02e5165beebf49e6fa1ec84cebba79b6119227bdd5ec169997b1b2ff4afe5`.
It changed no files and returned `AUDIT-FIX-REQUIRED`: BLOCKER 0, HIGH 1,
MEDIUM 0, LOW 0.

`O4P-02A-HIGH-001` demonstrated that parity `mapDenseArray` validates dense
keys but not `Array.prototype`. Two equal comparable views containing an array
whose prototype was changed to `null` were incorrectly accepted as
`compatible`. The smallest correction is a trap-safe exact prototype check and
ordinary regressions across parity array families.

The fresh Luna implementer already consumed repair returns 1 and 2, and a
bounded Sol surgical correction was followed by this new HIGH. Under the
governance cap, work stops for new user authority rather than applying another
unbounded correction. O4P-02A remains `implemented-not-audited`; O4P-02B stays
blocked. The exceptional third and absolute-final full check remains unused.

## User-authorized parity prototype repair

On 2026-08-12 the user explicitly authorized one additional repair limited to
the parity source and ordinary test, a different Luna cold audit, and—only
after audit clearance—the exceptional third and absolute-final full check and
O4P-02A shipment.

The authorized correction is limited to a trap-safe exact `Array.prototype`
check in parity `mapDenseArray` and adversarial ordinary coverage for every
parity array family. It does not authorize public API, Core, Solo, contract,
architecture allowlist, dependency, or unrelated behavior changes. O4P-02B
remains blocked until O4P-02A ships.

Sol implemented the authorized correction in only
`src/engine/compatibility/soloCoreParityV1.ts` and its ordinary test.
`mapDenseArray` now reads the prototype through a trap-safe operation and
requires exact `Array.prototype`. Tests cover top-level ordered zones,
zone-object IDs, commanders, combat defending players, attacks, blocks,
throwing prototype traps, and revoked array proxies.

Targeted evidence before replacement audit:

- compatibility implementation, parity, and judge tests: 3 files, 105 tests
  PASS;
- architecture boundary tests: 2 files, 11 tests PASS;
- Solo preservation: 3 files, 14 tests PASS;
- direct parity ESLint and checks TypeScript project: PASS;
- repository lint and build: PASS, existing chunk-size warning only;
- `verify:solo-core-compatibility`: PASS;
- `verify:mode-neutral-core-closure`: PASS;
- forbidden diff scan: FORBIDDEN 0, 10 paths scanned;
- `git diff --check`: PASS.

The candidate remains `implemented-not-audited`. A different context-free
Luna cold audit is mandatory before the exceptional final full check.

## User-authorized parity repair cold audit

Fresh read-only Luna auditor `019ff4bb-f858-7690-9e25-e3ef6ef9a031`
matched semantic fingerprint
`3db2b4faa1a74f928e1581806567b43a1da8b4d7b3d6310af80978ccac5cd6b7`
and Codex-context fingerprint
`e8ac7e50df97167edb1867c4d4bc05be4d63f15dfdeae352eba93ccfcf29ba26`.
It changed no files and returned `AUDIT-FIX-REQUIRED`: BLOCKER 0, HIGH 1,
MEDIUM 0, LOW 0.

The parity prototype finding was closed, but
`O4P-02A-HIGH-COMBAT-OPTIONALITY-01` proved an out-of-scope compatibility
defect: missing, accessor-backed, or descriptor-trapping Solo `combat` is
normalized to `combat: null` instead of rejecting at `/combat`. Only explicit
`combat: null` may mean no combat. The smallest safe correction requires
`src/engine/compatibility/soloCoreCompatibilityV1.ts` and its ordinary test,
which are outside the user's parity-source/test-only repair authorization.

The audit reproduced 116 O4P-02A/architecture tests PASS, both verifiers,
checks TypeScript, affected ESLint, and diff check PASS. The unchanged O4P-01N
default-timeout result remained environment/load timing noise. The exceptional
third and absolute-final full check remains unused. O4P-02A remains
`implemented-not-audited`; O4P-02B remains blocked pending new authority.

## User-authorized compatibility combat optionality repair

On 2026-08-12 the user explicitly authorized one additional correction limited
to `soloCoreCompatibilityV1.ts` and its ordinary test, another different Luna
cold audit, and—only after audit clearance—the exceptional third and absolute-
final full check and O4P-02A shipment.

The correction is limited to reading the Solo `combat` field exactly once
through a descriptor-safe internal result shared by turn-position and combat
projection. Only an explicit enumerable data-property value of `null` means no
combat. Missing, `undefined`, accessor, non-enumerable, and descriptor-trapping
forms must reject at `/combat` without invoking a getter or suppressing sibling
issues. No public API, Core, Solo runtime, contract, architecture allowance,
dependency, or unrelated behavior change is authorized.

Sol implemented the authorized correction in only the compatibility source and
ordinary test. A descriptor-safe `SoloCombatFieldRead` is created once and
shared by turn-position and combat projection. Explicit `null` remains the
only absent-combat representation; invalid forms add one deterministic
`/combat` issue while sibling domains continue inspection.

Targeted evidence before replacement audit:

- compatibility implementation, parity, and judge tests: 3 files, 111 tests
  PASS;
- architecture boundary tests: 2 files, 11 tests PASS;
- Solo preservation: 3 files, 14 tests PASS;
- direct compatibility ESLint and checks TypeScript project: PASS;
- repository lint and build: PASS, existing chunk-size warning only;
- both compatibility and Core-closure verifiers: PASS;
- forbidden diff scan: FORBIDDEN 0, 10 paths scanned;
- `git diff --check`: PASS.

The candidate remains `implemented-not-audited`. Another different
context-free Luna audit is mandatory before the exceptional final full check.

## Compatibility combat optionality replacement audit

Fresh read-only Luna auditor `019ff4ff-1b59-7f53-993a-a9af7287af4f`
matched semantic fingerprint
`302f4901b151dd53cc9f2297467de83f1cc2c003e1803684135fd68d35eea774`
and Codex-context fingerprint
`0f89a8b164bbb2e366e682f5b0b5be8a472bf087c6fc67915191f2a0b75b1ae0`
at HEAD `a9ca9aa14bee29cefd2126ac5e658f4106f4cbc8`. It changed no files and
returned `AUDIT-CLEAR`: BLOCKER 0, HIGH 0, MEDIUM 0, LOW 0.

The auditor independently confirmed that only explicit enumerable
data-property `combat: null` represents absent combat. Missing, `undefined`,
accessor, non-enumerable, throwing descriptor, and revoked proxy forms reject
at `/combat` without invoking getters or suppressing safely inspectable sibling
issues. It also re-ran and cleared the prior parity-prototype, sibling-array,
identity, and malformed-view claims.

Independent evidence included compatibility 3 files / 111 tests,
architecture 3 files / 14 tests, Solo snapshot/preservation 5 files / 29 tests,
O4P-01N closure 5 files / 20 tests, machine-check scripts 2 files / 12 tests,
both standalone verifiers, targeted ESLint, checks TypeScript, repository lint,
build, forbidden diff, and `git diff --check`: all PASS. The default-timeout
O4P-01N closure rerun passed 10/10. The implementer-oriented forbidden scan
reported only judge-owned `NEEDS-REAUTH` paths and no semantic finding.

O4P-02A is now `AUDIT-OK-PENDING-FULL-CHECK`. This is not ship approval. The
next gate is candidate commit, manifest synchronization, release-tree freeze,
and the user-authorized exceptional third and absolute-final `npm run check`.

The Sol judge then created replacement candidate commit
`66084e9332838f7da475fbfea34ea00d86242d5e` from the audited semantic tree,
including regenerated public API documentation and the audit evidence. The
manifest and ledger are synchronized to that candidate before release freeze.

## Absolute-final full-check result and governance STOP

The release tree was frozen at Codex-context fingerprint
`94c66147d58c175bbc848ffbf566c54190614f353b8bf48e036071390ade1676`.
The first sandbox invocation stopped before meaningful product verification
because `tsx` could not create its IPC socket (`listen EPERM`); CR verification
passed and every later lane was skipped. The same frozen command was therefore
run in the permitted host environment as the effective absolute-final check.

That effective check passed the pinned CR, versions, docs, every registered
Core and O4P-02A verifier, and repository lint. The core Vitest lane then
stopped at 225/226 files and 2085/2086 tests because the existing O4P-01N
`repairWave1.test.ts` four-player replay case exceeded its fixed 5-second test
timeout. No assertion failed and build was skipped after the test lane failed.

An isolated default-timeout diagnostic reproduced the timing failure at 7.92
seconds. The identical assertion then passed with a 30-second diagnostic limit
in 2.34 seconds. This is evidence of runtime timing variance, not a green full
check and not authority to weaken the test or silently rerun the release gate.

The user-authorized absolute-final full-check budget is exhausted. O4P-02A
remains `implemented-not-audited` despite its clean semantic audit. No final
commit, push, CI, Pages verification, or O4P-02B work is permitted without a
new explicit user ruling.

## User-authorized release-timeout stabilization

On 2026-08-12 the user explicitly reopened O4P-02A when necessary to remove
the current shipment obstacle and authorized shipment through CI and Pages.
The bounded repair changed only the local timeout on the existing O4P-01N
deterministic four-player replay test from Vitest's default 5 seconds to
`30_000` milliseconds. Its setup, commands, assertions, expected values,
tamper vectors, product source, and global test configuration remain unchanged.

Implementer `/root/o4p_timeout_implementer` ran the exact file at repository
defaults: 1 file / 10 tests PASS in 2.79 seconds. The judge independently reran
the same file: 1 file / 10 tests PASS in 2.89 seconds.

Fresh read-only cold auditor `/root/o4p_timeout_cold_auditor` audited candidate
file SHA-256
`27de298ec9886a418bdf14a56115fae36b232f798c444b21351b218f8dade284`
and reported BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0. Its independent default
core-project run passed 1 file / 10 tests. The auditor confirmed that the base
diff is exactly `});` to `}, 30_000);` on the named expensive case and that no
skip, retry, concurrency change, failed-test allowance, or conditional exit was
introduced.

O4P-02A is `AUDIT-OK-PENDING-FULL-CHECK`. The next gate is one newly
user-authorized, fingerprint-matched `npm run check`; no silent rerun is
permitted if it finds another defect.
