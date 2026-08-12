# O4P-02A fresh repair-cycle proposal

Status: authorized by explicit user ruling on 2026-08-12. The fresh repair
cycle and one exceptional third-and-absolute-final full check are authorized.
This brief does not itself authorize a fourth full check or O4P-02B work before
O4P-02A ships.

Milestone: `O4P-02A`

Candidate HEAD at proposal creation:
`a9ca9aa14bee29cefd2126ac5e658f4106f4cbc8`

Role: fresh Luna implementer with `fork_context: false`.

Frozen authority:

- `AGENTS.md`
- `research/cr-grounding/o4p-02a-solo-core-compatibility.contract.draft.md`
- `research/cr-grounding/o4p-02a-acceptance-brief.draft.md`
- `research/cr-grounding/o4p-02a-cold-audit-brief.draft.md`
- `research/cr-grounding/archive/o4p-02a-cold-audit-record-2026-08-12.md`
- audit `019ff427-0c9e-7ec0-bab2-401787fb56b4`

## Goal

Close the two HIGH and two MEDIUM findings from the post-judge-surgery audit
without changing the compatibility authority, Solo runtime, Core authority,
snapshot format, public exports, or architecture allowlist.

## Allowed writes

- `src/engine/compatibility/soloCoreCompatibilityV1.ts`
- `src/engine/compatibility/__tests__/soloCoreCompatibilityV1.test.ts`
- `src/engine/compatibility/soloCoreParityV1.ts`
- `src/engine/compatibility/__tests__/soloCoreParityV1.test.ts`

No unspecified path may change.

## Required corrections

### R1 — independent trap-safe Solo preflight

Do not let unreadable `cards`, `zones`, `zonesByPlayer`, or `turnOrder` erase
issues already collected from `activePlayerId`, `turn`, `phase`, `combat`, or
`commanders`. Do not call untrusted array methods such as `.every`, `.map`,
`.filter`, `.entries`, or an iterator before descriptor-safe validation.

Inspect independent domains even when another source field is invalid. A
domain that genuinely depends on an unreadable field may add a deterministic
domain issue and skip only that dependent projection. It may not return a
partial projected view or suppress safely inspectable sibling issues.

### R2 — exact combat turn validation

For non-null Solo combat, `combat.turn` must be a positive safe integer and
must equal the enclosing valid Solo `turn`. Reject invalid or mismatched values
at exactly `/combat/turn`. Never default an invalid value to zero and never
project a combat view after this issue.

### R3 — preserve original identity-map indices

Descriptor-safe dense-array inspection must retain each input element's
original index. An invalid/accessor/sparse entry at index N must not shift a
later entry's issue path to a smaller index. Do not sort, compact, deduplicate,
or mutate the caller array. Existing issue ordering remains UTF-16 path then
code.

### R4 — strict source-array shape

Solo `turnOrder`, every private/shared zone array, combat attacker/blocker and
blocking arrays, and commander arrays must reject sparse entries, symbols,
extra string properties, accessors, non-enumerable entries, non-ordinary
prototypes, and descriptor traps. Rejection paths must identify the exact
domain and index/property. No hostile source array may be silently normalized.

## Required adversarial tests

Add ordinary tests that independently and in combination prove:

1. hostile `zones` plus malformed active player, turn, combat step, and
   commander cast count returns every safely inspectable issue;
2. a trapping `turnOrder` array does not erase active-player, turn, combat, or
   commander issues;
3. combat turns that are a string, zero, unsafe integer, or different from the
   enclosing turn reject exactly at `/combat/turn`;
4. an invalid identity-map element followed by another invalid element keeps
   both original indices;
5. sparse and extra-property arrays reject for one private zone, one shared
   zone, combat attackers, combat blockers, blocking assignments, commanders,
   and turn order;
6. each result is deterministic across two calls, fresh, deeply frozen, and
   does not mutate or replace any caller-owned object;
7. all previously added stale attacker/blocker incarnation tests remain green.

Do not weaken existing assertions to make a new implementation pass.

## Forbidden

- No `AGENTS.md`, `docs/**`, ledger, archive, contract, acceptance, audit brief,
  `review.*`, fixture, verifier, manifest, package, lockfile, dependency, public
  barrel, architecture-test, Solo runtime, Core, Room, protocol, projection,
  network, Cloudflare, WebSocket, UI, or git changes.
- No generic JSON patch, arbitrary state mutation, hidden randomness, time,
  fallback partial success, issue suppression, input sorting, input
  compaction, or broad `try/catch` that replaces prior issues with one root
  issue.
- Do not run `npm run check`; its two-invocation cap is exhausted.
- Do not mark O4P-02A audited, shipped, or ready for O4P-02B.

## Required targeted checks

- compatibility implementation and judge tests;
- direct ESLint on both allowed files;
- `npx tsc -p scripts/checks/tsconfig.json --noEmit`;
- `npm run verify:solo-core-compatibility`;
- `npm run verify:mode-neutral-core-closure`;
- affected architecture and Solo snapshot-preservation tests;
- `git diff --check`;
- forbidden-path confirmation against the task-start fingerprint.

If `tsx` fails only because its IPC socket is sandbox-blocked, report the exact
error and let the orchestrator rerun the unchanged verifier with permission.

## STOP conditions

- A correction requires changing a frozen contract, public API, Solo runtime,
  Core authority, or an unspecified path.
- Complete sibling-domain issue collection cannot be achieved without
  returning a partial view.
- Required issue semantics conflict with existing frozen acceptance evidence.
- A new issue code or externally visible type is required.
- The task-start tree differs from the orchestrator-provided fingerprint.

## Return packet

1. changed files;
2. exact finding-to-change mapping for R1 through R4;
3. tests and commands with exact counts/results;
4. deferred clauses;
5. unresolved issues;
6. confirmation that forbidden paths and git state were untouched.

Done only when all four findings have executable adversarial regression
coverage, all required targeted checks are green, and no forbidden path has
changed. Completion remains `implemented-not-audited`; a fresh independent
Luna cold audit is still mandatory.

## Repair return 2 amendment

Fresh audit `019ff46b-3771-7f23-a4ad-e115ff8f678b` matched the frozen
fingerprint and found BLOCKER 0, HIGH 3, MEDIUM 1. The same Luna implementer
may use its second and final repair return to close only these findings:

- H-01: `readDenseArray` must require every numeric key from `0` through
  `length - 1` to be present in `Reflect.ownKeys`; a proxy that hides an
  otherwise valid element must reject with the exact index path.
- H-02: unreadable Solo `turnOrder` must not suppress descriptor-safe private
  zone inspection. Private-zone traversal uses the identity map player order
  independently while retaining the `turnOrder` rejection.
- H-03: a stale Solo combat attacker identity must be checked before an
  unsupported battle target can short-circuit the entry. Both exact issues
  must be collected.
- H-04: the parity comparator must reject structurally equal but semantically
  invalid comparable views. Closed kind/schema/phase/step/zone literals,
  positive safe turn values, non-negative safe cast counts, and non-empty ID
  values must be validated without adding a public API or Core dependency.

The two parity files are added solely for H-04. All original forbidden paths,
authority boundaries, targeted checks, STOP conditions, and the prohibition on
`npm run check` remain unchanged. This is repair return 2 of 2.
