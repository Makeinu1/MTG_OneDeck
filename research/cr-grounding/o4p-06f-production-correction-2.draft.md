# O4P-06F production correction 2

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `6a12b8e0f139547a2d1f336c2f612ec0db20aed3`
Risk: R3 bounded Cloudflare persistence/recovery correction

## Production finding

After the audited O4P-06E/F Worker source was deployed with pinned Wrangler
`4.122.0`, the four-real-deck Chrome scenario reached an active Room and
accepted commands through revision 3. Workers Logs then reported
`outcome=exceededCpu` and reset the Durable Object while its normal load path
replayed the checkpoint suffix. The same exact checkpoint-0 recovery replay is
currently repeated in the constructor and again for ordinary WebSocket
messages, presence writes, and status/command paths. With four 100-card real
decks, replaying and validating the expanding full state on every hibernation
event crosses the production CPU ceiling before revision 5.

This is a product defect found by executable evidence. The release stays
closed until corrected and independently re-audited.

## Goal

Preserve the existing checkpoint/journal recovery proof while eliminating
same-version repeated replay. Persist one closed recovery-verification marker
that is valid only for the exact canonical Cloudflare Worker version identifier
and exact stored revision and exact SHA-256 digest of the bounded serialized
checkpoint bytes. Room initialization and every accepted command may
atomically mark the resulting revision as produced by that same canonical
version. A normal load may skip `validateCheckpoint` only when the marker,
current canonical Worker version, room identity, stored revision, and journal
relation all match after the existing closed state/journal validation, and the
marker digest matches the current checkpoint bytes exactly.

When the Worker version changes, the marker is missing/malformed/stale, or the
revision differs, the normal load must run the complete existing checkpoint
replay and state comparison. Only after that replay succeeds may it atomically
replace the marker and emit the existing successful recovery fact. Therefore
the required identical-code second deployment still produces one real
`checkpointRevision=0/currentRevision=5/replayCount=5/outcome=ok` fact, while
ordinary same-version hibernation events do not repeatedly replay the suffix or
fabricate recovery facts.

## Constraints

- Implementer write scope is only `src/online/cloudflare/persistence.ts` and
  ordinary non-`review.*` tests under `src/online/cloudflare/__tests__/`.
  Change `runtime.ts` only if a narrowly required public-free wiring change is
  unavoidable and report it before editing.
- Do not change protocol/Core/room/public response shapes, capability handling,
  checkpoint cadence, journal bytes/order, Worker routes, Wrangler, version
  constants, dependencies, package/lock/workflow, docs, generated files,
  manifests, ledgers, Judge reviews, research records, or git state.
- The marker schema and validator are closed: exactly one singleton at most,
  canonical version ID only, exact room/revision relation, bounded serialized
  checkpoint SHA-256 digest, no secret/capability fields. Missing/malformed/duplicate marker fails
  to full replay, never to skip and never to a public detail leak.
- The checkpoint digest uses only the public Core barrel's pure SHA-256 helper.
  Its architecture allowance is exact to `src/online/cloudflare/persistence.ts`,
  that one symbol, and that public barrel; no broader Core dependency is allowed.
- Marker update for initialize/accepted commit is in the same SQLite transaction
  as the room/checkpoint/journal mutation. A replay-success marker replacement
  is compare-and-set/transactional and cannot make a failed replay green.
- No successful `recovery-verification` fact may be emitted on a marker hit.
  Existing failure facts remain generic and existing repository APIs remain
  deterministic.
- Add ordinary tests proving: same-version committed revisions skip repeated
  replay; a distinct version performs exact suffix replay and emits the fact;
  stale/malformed/missing markers replay or fail closed; commit rollback does
  not advance the marker; same-room/same-revision but byte-different valid
  checkpoint JSON cannot hit the marker; and the unchanged revision-5 four-real-deck-like
  state remains replayable within the bounded test lane.
- Run only affected ordinary/review tests, `npx tsc -b`, affected ESLint,
  relevant architecture/release verifiers, docs/generator check, and diff
  checks. Do not run full `npm run check`, Chrome, network, deploy, git, ledger,
  or self-audit.

## Judge correction after cold-audit probe

The cold auditor reproduced a same-room/same-revision, semantically valid but
byte-different checkpoint that the relation-only marker accepted. The Judge
therefore added a lowercase SHA-256 of the exact serialized checkpoint string
to the marker and its compare-and-set relation, plus an ordinary hostile
regression. The pure hash function is imported from the public Core barrel and
is authorized only for `src/online/cloudflare/persistence.ts` through an exact,
non-vacuous architecture registration in
`src/test/architecture/modeNeutralCoreBoundary.test.ts`. This Judge-owned
surgery does not change Core implementation, protocol, Worker routes, or any
public response.

## Done when

The frozen correction has no public/protocol semantic change, all bounded gates
pass, and a context-free Luna xhigh cold audit reports BLOCKER/HIGH zero before
the production Chrome scenario is restarted from a fresh Room.
