# O4P-01E: Core Canonicalization & Main-Branch Verification Closure V1

> **draft only**. This document is not a formal specification, active contract,
> or shipped feature declaration. It records the O4P-01E implementer handoff and
> verification boundary.

## 1. Milestone scope

O4P-01E closes the O4P-01D carried MEDIUM concerning deterministic record
enumeration for the Mode-Neutral Core identity/zone slice. It also closes the
GitHub Pages verification gap by making `npm run check` and
`npm run check:forbidden` mandatory build-job gates before the Pages artifact is
created.

The Core state shape, public Core export surface, validation issue vocabulary,
array meanings, Solo runtime, Online architecture, fixtures, and version
values remain unchanged. This is record canonicalization and CI gate closure,
not a new state slice or a rules-semantic change.

Base commit at implementation start: `c9d9c94b160c715b693ad6873e21fcde727d02de`.

## 2. O4P-01D carried finding

The O4P-01D cold audit identified one MEDIUM: successful validator output
preserved input record insertion order, while the factory normalized selected
records. Therefore semantically equivalent valid states could have different
`JSON.stringify` results depending on construction order.

O4P-01E supersedes the O4P-01D behavior statement that successful validator
output preserves input record order. The input non-mutation rule is retained.
O4P-01D draft and its cold-audit record are historical handoff/audit evidence
and are not modified by this milestone.

## 3. Canonical validation-output decision

Validation still runs against the original input without mutation. Only after
validation has produced no issues does the validator clone into the Core
canonical representation and deep-freeze it. Failure issue code, path, message,
and deterministic ordering are unchanged.

The successful result is a separately allocated, JSON-stringifiable,
deep-frozen state. It does not repair invalid input, fill defaults, trim,
deduplicate, change IDs, move zones, change values, or execute accessors.

## 4. Canonical record ordering

The single internal implementation is
`src/engine/core/identityZoneCanonicalization.ts`. It is not exported from the
Core index and is not a new runtime API.

Root order is `kind`, `players`, `turnOrder`, `activePlayerId`,
`cardDefinitions`, `physicalCards`, `cardObjects`, `zones`.

`players` and `zones.byPlayer` follow `turnOrder`. `cardDefinitions`,
`physicalCards`, and `cardObjects` use JavaScript code-unit ascending key order.
Nested records use the fixed field orders: PlayerState, manaPool,
CoreCardDefinitionSnapshotV1, source, CardFace, PhysicalCard, CardObject,
player-scoped zones, and shared zones. Comparison is performed with `<` and
`>`; `localeCompare` is not used. Proxy own-key ordering preserves the result
even for numeric-like keys such as `1`, `10`, `2`.

## 5. Preserved array ordering

The canonicalizer copies arrays but never sorts or otherwise changes them:

- `turnOrder`
- `colorIdentity`
- `producedMana`
- `keywords`
- `faces`
- every `library`, `hand`, `graveyard`, `battlefield`, `stack`, `exile`, and
  `command` array

The validator continues to reject invalid order where O4P-01D already required
an order constraint. Canonicalization does not convert an invalid array into a
valid one.

## 6. Factory/validator single source

The validator applies the canonicalization helper after successful validation
and then deep-freezes the result. The factory calls the validator and returns
that success value directly. The former factory-only `orderValidatedState`
sorting path is removed. Consequently, factory output and direct validator
output for the same candidate have byte-for-byte identical JSON strings.

## 7. Main-branch verification gap

The prior Pages build job ran direct `npm run lint` and `npm test`, but did not
run the repository's eight-step `npm run check` machine gate or
`npm run check:forbidden`. This allowed Pages verification to omit the CR,
version, Solo, architecture, Core, and forbidden-file checks that were already
part of the local release contract.

## 8. GitHub Pages gate decision

The build job now runs, in order: checkout, setup-node, `npm ci`,
`npm run check`, `npm run check:forbidden`, the base-path Pages build,
`configure-pages`, and `upload-pages-artifact`. The deploy job continues to
`needs: build`. Since both checks are ordinary fail-fast steps, a failed check
or forbidden-file scan prevents the artifact upload and therefore prevents the
dependent deploy job.

Direct workflow-level lint/test duplication is removed. `workflow_dispatch` and
pushes to `main` remain enabled.

## 9. Version decision

No ruleset, engine semantics, state schema, event schema, protocol, projection,
contract, or snapshot version changes are required. The root shape and field
meaning are unchanged; only deterministic successful-output record enumeration
and the CI verification gate are closed.

## 10. Verification strategy

Ordinary tests cover fixture canonicality, reverse insertion order for all
top-level records, nested field order, numeric-like keys through
`Object.keys`/`Reflect.ownKeys`/JSON, factory-validator parity, input
non-mutation, deep freezing, array preservation, invalid-input strictness,
accessor/non-enumerable rejection, and JSON round trips.

Fast-check covers valid states with one through six players, simultaneous
permutations of players, player zones, definitions, physical cards, and card
objects, unchanged arrays, repeated validation, and JSON round trips. Fixed
seeds are reported by fast-check on failure.

The Pages workflow test identifies jobs and step fields from indentation-aware
YAML subset parsing without adding a YAML dependency. It verifies gate order,
artifact placement, deploy dependency, retained triggers, and absence of direct
lint/test duplication or failure suppression.

The Core machine verifier emits `canonicalValidation=ok` after its permutation,
numeric-like key, parity, repeat-validation, and array-order checks.

## 11. Inputs for O4P-01F

Future milestones may build dynamic Core state, commands, events, zone changes,
tokens/copies/abilities, control effects, projections, persistence, or Online
envelopes on top of this deterministic structural substrate. They must not
interpret this canonical record enumeration as a replacement for state
semantics, viewer projection, migration, revision, command identity, or
protocol versioning.

## 12. DEFER

- Core dynamic object state, tokens, copies, abilities, stack commands, zone
  change commands, and Core events.
- Room, revision, commandId, Projection, Cloudflare, WebSocket, Online runtime,
  persistence, and migration.
- UI, Solo runtime changes, CR updates, version changes, and O4P-00B.
- Formal contract promotion, ledger ownership, cold-audit findings record, git
  commit/push, CI run, and GitHub Pages deployment remain judge/release-lane
  responsibilities.

This draft is not a formal specification, not an active contract, and not a
shipped declaration. O4P-01D draft/audit remain unchanged. The Core state shape
and MTG rule meaning are unchanged; Online runtime and Solo runtime are
unchanged; the CI gate is strengthened; and the carried MEDIUM is closed by
the implementation candidate pending independent cold audit and release
verification.
