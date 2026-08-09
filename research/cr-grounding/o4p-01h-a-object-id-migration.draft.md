# O4P-01H-A: Universal Object ID V2 migration analysis

- Status: `analyzed-not-integrated`
- Role: Architecture Analyst
- Scope: compare V2 identity encodings and V1/V2 migration risks only.
- Decision boundary: this is not a final ID contract and does not authorize code,
  registry, command, fixture, ledger, or integration changes.

## Current identity surfaces

There are two materially different V1 surfaces:

1. Core V1 (`src/engine/core/ids.ts:6-35`) brands IDs as strings and permits a
   card object ID only as `physicalCardId:incarnation`. Base IDs match
   `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`; `:` is therefore unavailable inside a
   base ID. The validator parses the final colon and requires
   `String(Number(text)) === text` plus a non-negative safe integer
   (`identityZoneValidation.ts:550-565`).
2. The legacy Solo `GameState` (`src/engine/types.ts:30-81,676-714`) stores
   every entry in `cards` as `CardInstance`. `objectIdOf` formats
   `${card.id}:${card.zoneChangeCounter}` without validating the ID or object
   kind. Tokens, copies, and stack abilities are distinguished by flags and
   allocation prefixes, not by a closed ID schema.

The Core V1 encoding is injective for its accepted input pair, but it is not a
universal namespace. A legacy `PC1` card can produce the same `PC1:0` text as a
Core V1 card, and a legacy card whose ID happens to use `a`, `k`, or `t` can
share the convention used by synthetic allocation. The larger correctness
failure is temporal: `nextAbilityId`, `nextCopyId`, and `nextTokenId` scan only
currently live cards (`commands.ts:3718-3735,6529-6537`). After deletion,
`a1:0`, `k1:0`, or `t1:0` can be allocated again while old events, snapshots, or
LKI references still contain the earlier text. `zoneChangeCounter` protects
ordinary card reincarnation, but synthetic objects are created at counter 0
(`commands.ts:3744-3785,6389-6447,6734-6755`) and the legacy increment path has
no overflow guard.

The V2 registry must distinguish the following closed synthetic taxonomy while
keeping the allocation namespace globally unique:

- physical-card object/incarnation;
- token object;
- card spell versus non-card spell copy (whether card spell is a role of the
  card object or a separate kind remains a contract choice);
- activated ability on the stack;
- triggered ability on the stack.

An ability ID must not be derived solely from its source, ability line, or
trigger text: repeated activations/triggers are different stack objects. The
source object ID and source snapshot are relationships, not replacement
identities. This follows CR 109.1, CR 112.1/112.1a, CR 113.1c and CR 113.7a.

## Candidate comparison

| Candidate | Shape (illustrative only) | Strengths | Compatibility and failure risks |
| --- | --- | --- | --- |
| A. Tagged readable tuple | `v2/card/<physical>/<decimal>`; `v2/token/<decimal>`; analogous ability/copy tags | Human-readable logs, direct kind inspection, simple V1 card aliasing | Requires a reserved separator and an escaping rule for legacy IDs; a parser that splits naively is not injective. Every component and the complete key still need validation. A card spell role must not accidentally create a second identity on entering the stack. |
| B. Tagged length-prefixed tuple | `v2/<kind>/<length>:<component>/<decimal>` or an equivalent canonical escaped form | Injective even for legacy IDs containing delimiters; one string remains usable in zone arrays and record keys | Longer and less readable; canonical encoding, length calculation, Unicode/UTF-8 policy, and malformed-prefix failures must be frozen. It still needs a separate V1 alias because its bytes cannot equal `PC1:0`. |
| C. Registry-issued per-kind serial | `v2/<kind>/<canonical-decimal-serial>`, with physical/incarnation/source fields in the registry record | Allocation never depends on a source ID grammar; synthetic kinds are naturally separated; serial can be monotonic and tombstone-aware | Requires persistent allocator state or consumed-ID history, including undo/redo branch semantics. A V1 snapshot cannot reconstruct historical serial state. Opaque IDs make downgrade and diagnostics depend on an explicit legacy alias. |
| D. Structured value identity | `{ kind, physicalCardId, incarnation }` or `{ kind, serial }`, with a separately encoded map key | Strongest type-level separation and no delimiter ambiguity in the value | Breaks V1 string-valued zone, runtime, attachment, target, event, and snapshot contracts unless every consumer gets an adapter. Object identity by structural equality is also unsafe for map/set and JSON consumers. This is the highest migration cost. |

No candidate is selected here. A final choice must separately adjudicate
readability, arbitrary legacy-ID compatibility, persistent allocation, and the
cost of preserving string-valued V1 APIs.

## Encoding invariants

### Canonical decimal

For every candidate that puts an incarnation or allocation ordinal in an ID,
the text should be ASCII canonical decimal: `0` or a non-zero digit followed by
digits. Reject empty text, leading zeroes, `+`, `-`, exponent notation, decimal
points, whitespace, Unicode digits, and values outside the chosen numeric
domain. V1 already rejects `1e3` and `01` through the `Number`/`String`
round-trip check, but V2 should not parse unbounded serials through `Number`.
A decimal string avoids `Number.MAX_SAFE_INTEGER` exhaustion; a numeric field
must instead report overflow before `+1` loses precision. `BigInt` is not a
wire-format escape hatch because ordinary JSON serialization cannot encode it.

The encoding must be injective before record-key ordering is considered. Numeric
comparison and code-unit sorting are different concerns; a serial such as
`10` must not be ordered as if it were `2` merely because it is numeric.

### Synthetic namespaces and reuse

The full V2 key must carry or be paired with a closed kind tag. `token`,
`spell-copy`, `activated-ability`, and `triggered-ability` must not fall back to
an arbitrary caller-supplied namespace. A registry entry must reject a key/tag
mismatch, duplicate live keys, and a key already present in retired/tombstone
history.

The no-reuse rule must apply after token cease, copy removal, ability removal,
and any other deletion. A live-map max scan is insufficient. The contract must
choose one explicit source of monotonicity: a persisted allocator watermark,
consumed-ID set, or command/replay allocation record. It must also define
whether an undo that abandons a branch retains consumed IDs; allowing the
branch to reuse them is only safe if IDs are scoped to a branch and that scope
is part of every reference. Reusing globally visible object text is unsafe.

### Unsafe record keys

The V1 validator rejects `__proto__`, `prototype`, and `constructor` in dynamic
record keys (`ids.ts:11-18`, `identityZoneValidation.ts:228-255`). V2 must retain
that fail-closed rule even if it uses `Object.create(null)`. A tagged full key
such as `v2/card/constructor` must not bypass validation merely because the
full string is not exactly `constructor`; the decoded component must be
validated too. Reject symbols, accessors, non-enumerable dynamic properties,
and non-plain records consistently with the V1 boundary.

## Byte and JSON compatibility

The following are byte-sensitive V1 contracts and must remain untouched:

- `identity-zone-slice-v1.json` contains `PC1:0` through `PC7:0` in
  `cardObjects` and the same IDs in ordered zone arrays.
- `card-runtime-slice-v1.json` keys `byObject` with those IDs and contains an
  attachment reference to `PC1:0`.
- `card-zone-transition-slice-v1.json` pins the raw identity/runtime fixture
  SHA-256 values and expects transitions such as `PC3:0 -> PC3:1`.
- `CoreObjectId`, `coreCardObjectIdOf`, V1 validators, and the V1 runtime and
  transition APIs expose the old strings.

An additive adapter may read those bytes and produce a separate V2 value. It
must not rewrite a V1 fixture, replace its `kind`, or make a V2 ID appear in a
V1 `byObject`, attachment, target, event, or zone array. A V2 fixture requires
its own version tag and byte/hash metadata. V1 alias preservation is necessary
even if the authoritative V2 key is opaque.

V1 canonicalization (`identityZoneCanonicalization.ts:72-225`) sorts dynamic
definition/physical/object records by JavaScript code unit, preserves
`turnOrder` for player records, and never sorts zone arrays. It uses a proxy
`ownKeys` order so numeric-like keys such as `10` and `2` survive both
`Object.keys` and `JSON.stringify`; the existing tests assert this. V2 must
specify the same rule or an equally explicit canonical serializer, must never
use `localeCompare`, and must keep stack/library/graveyard/zone order as data.
If V2 permits numeric-like dynamic keys, a plain object is not sufficient for
byte-stable ordering without the existing proxy/null-prototype technique.

## Upgrade and downgrade boundary

### Core V1 to V2

The lossless path maps each V1 `(physicalCardId, incarnation)` to a V2 card
entry, copies owner/base-controller data, and copies every zone array without
reordering. It should retain an explicit `legacyObjectId` alias (or an
equivalent reversible mapping) because a new V2 key cannot be recovered from
V1 bytes alone. Runtime `byObject` and attachment references must be adapted by
that mapping, not by string heuristics.

Core V1 has exactly one live card object per physical card. It has no token,
copy, or ability entries, so it cannot supply a complete V2 allocator history.
An upgrade can guarantee non-collision against the imported live set; it cannot
claim historical no-reuse without an additional migration watermark.

### Legacy Solo GameState to V2

The adapter must not treat every `state.cards` entry as a physical card. The
legacy map contains `isToken`, `isCopy`, and `isAbility` entries, and uses
`CardInstance.id` as both map/zone identity while `objectIdOf` derives a second
string. Classification must use validated object metadata/flags and reject
ambiguous or inconsistent entries; prefixes `c*`, `t*`, `a*`, and `k*` are only
current allocation conventions, not a contract.

### V2 to V1

Downgrade is lossless only for a registry containing supported card objects,
one live object per physical card, V1-supported zones/controllers, and no
V2-only fields. It must regenerate the exact V1 object ID from retained
physical ID plus incarnation, then validate the complete V1 state and runtime.
If any token, spell copy, activated ability, triggered ability, retired-only
record, or unsupported relationship is present, fail with a structured loss
report. Never drop it, coerce it to a card, or reuse a physical-card ID.

## Deterministic seed and command ID boundaries

`initGame` uses the supplied seed for library shuffling; the golden replay also
stores an initial seed. The store may obtain a seed from `Math.random` for a
new game/restart/mulligan, while `createRng` is deterministic once a seed is
fixed. V2 object identity must not depend on `Math.random`, wall-clock time,
deck order, a hash of mutable state, or a hidden PRNG draw. A fixed seed and
fixed command payload should yield the same object IDs; changing only a shuffle
seed must not rename already specified objects.

`GameCommand` currently has no command-ID field. `applyCommand` derives event
IDs as `e${sequence}` from the current event log and accepts an optional
`causeCommandId` in event shapes, but it does not establish a command identity
boundary. `applyResolutionCommands` may apply several commands in one
resolution. Therefore an event ID, event sequence, `pendingTriggerId`, or
future command ID must not be used implicitly as the universal object ID. A
future command ID may be recorded as provenance (`createdByCommandId`) only if
it is optional and does not determine object identity; any allocator ordinal
must remain deterministic in the object/registry contract itself.

## Property and fixture strategy

The implementation lane should add independent properties after the contract
is frozen:

1. Generate valid mixed registries containing card objects, tokens, spell
   copies, activated abilities, and triggered abilities. Assert global key
   injectivity, kind/key agreement, one live zone location, source-reference
   validity, and stack-array order.
2. Generate legal decimal boundaries and malformed variants. Assert canonical
   round-trip, rejection of leading zeroes/exponents/overflow, and deterministic
   issue ordering.
3. Generate hostile record inputs: `__proto__`, `prototype`, `constructor`,
   numeric-like keys, symbols, accessors, non-enumerable fields, delimiter-rich
   legacy IDs, and unknown kinds. Assert no mutation, no prototype pollution,
   and fail-closed results.
4. Run create/delete/recreate sequences and undo/redo branch sequences. Assert
   no object ID reuse under the chosen scope rule, including same source,
   repeated trigger, token cease, and spell-copy removal.
5. Assert fixed seed plus identical command stream gives identical V2 bytes;
   assert object allocation does not consume hidden randomness. Keep command
   IDs/events in separate assertions.
6. Assert Core V1 fixture bytes and SHA-256 metadata are unchanged, canonical V1
   fixtures round-trip through V2 byte-equivalently for card-only states, and V2
   to V1 returns a structured
   failure for every synthetic kind. Adapt runtime/attachment aliases in the
   same property rather than testing only registry entries.
7. Permute input record insertion order and assert canonical V2 JSON is stable
   while all zone and stack arrays remain byte-for-byte ordered.

Use fresh fixture copies for each generated case. A property must not pass by
sharing the same generated ID map with the validator or by silently normalizing
the input before the adversarial assertion.

## Failure conditions

Fail the migration/adapter if any of the following occurs: ambiguous V1 kind;
duplicate live or retired ID; cross-kind collision; noncanonical decimal;
serial overflow; missing allocator history where no-reuse is promised; unsafe
record key; unknown field/kind; accessor/symbol/non-plain input; registry/zone
mismatch; physical card with more than one live incarnation; a V1 runtime or
attachment reference with no reversible alias; a V2 synthetic object presented
as a V1 card; or a byte/hash change to an existing V1 fixture.

## CR grounding

- CR 109.1, 109.3-109.5: object taxonomy, characteristics, ownership and
  controller distinction.
- CR 110.1-110.2: card/token permanents and controller on the battlefield.
- CR 111.1-111.8: token identity, token ownership, and token cease/return
  limits.
- CR 112.1-112.2: a card on the stack is a spell; a copy of a spell has no
  associated card and has its own owner/controller rules.
- CR 113.1c, 113.7a-113.9: activated/triggered stack abilities are objects,
  remain independent of their source, and have distinct controllers.
- CR 400.1, 400.5, 400.7, 400.7e-400.7j, 400.8 and 400.10: zones, ordered
  objects, new-object identity, public-zone/LKI tracking, and same-zone new
  objects.
- CR 405.2-405.6: stack order and the last-added object that resolves.
- CR 601.2a-601.2c and CR 107.3a: the card becomes a spell on the stack and
  announced choices belong to the spell/ability, not to an ID allocator.
- CR 707.1-707.3 and 707.10-707.10g: copy identity, copied choices, spell and
  ability copies, and permanent-spell copies becoming token permanents.

## DEFER

- Final V2 grammar and whether card spell is a card kind or a separate role.
- Final allocator/tombstone/undo-branch policy and command provenance schema.
- V2 registry/runtime implementation, exports, and V1 adapter code.
- Object creation commands, priority/APNAP, trigger detection, resolution,
  targeting, modes, X announcement, cost payment, copyable-values derivation,
  token/copy cease automation, projection, online protocol, and UI.
- Independent cold audit, full check, CI, Pages publication, and release.
