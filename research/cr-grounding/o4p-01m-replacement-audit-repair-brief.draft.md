# O4P-01M replacement-audit repair brief

Status: judge-owned repair routing for the frozen contract amendment. This file
does not change the parent milestone boundary or authorize shipment.

- Base SHA: `1d5a75a60bc6f13a4ed6fd3daf7687e2ed4a0dcf`
- Failed audit fingerprint:
  `eec93d2adc1780352016bf489694b3f489e29c7bfd42e36fc761d6ff0de1705a`
- Authority:
  `research/cr-grounding/o4p-01m-commander-combat-player-exit.contract.draft.md`
  section `replacement cold-audit adjudication`

## Repair sequence

1. `M-R2A` Commander validation hardening.
2. `M-R2B` unified combat context and player-exit pruning.
3. `M-R2C` lifecycle plus atomic CR 800.4 reconciliation.
4. `M-R2X` serial root/fixture/verifier/generated-API integration.
5. `M-R2J` judge-owned behavioral and architecture review update.
6. Targeted checks, build, freeze, and a new independent cold audit.

Only one implementer lane runs at a time. Each lane reads the frozen contract
and writes only the paths below. No lane edits `review.*`, the ledger, active
contracts, dependencies, or git state.

## M-R2A — Commander validation hardening

Owned paths are the five Commander modules and their five ordinary tests. Close
sparse/accessor/proxy-trap handling and replacement issue ordering without a
public API change. Valid physical identity, tax, damage, provenance, order,
freeze, and immutability semantics remain unchanged.

## M-R2B — unified combat context

Allowed writes:

- `src/engine/core/combat/combatContextV1.ts`
- `src/engine/core/__tests__/combatContextV1.test.ts`
- delete the provisional duplicate authority
  `src/engine/core/combat/combatAssignmentV1.ts`
- delete its ordinary test
  `src/engine/core/__tests__/combatAssignmentV1.test.ts`

Required output is the sole public `CoreCombatContextV1` authority frozen in the
contract amendment: combat ID, turn number, attacking player, defenders,
attacker controller, blocker controller, one defender per attacker, step gates,
basic participant relations, dense/trap-safe validation, and deterministic
`reconcileCoreCombatContextForPlayerExitV1`. The operation returns `null` when
the attacking player exits and otherwise preserves surviving declaration order.

The lane does not edit the Core root, fixture, verifier, review evidence, or
generated API. It reports the exact exports that the serial integration lane
must add/remove.

## M-R2C — lifecycle and atomic CR 800.4 reconciliation

Allowed writes:

- `src/engine/core/player-lifecycle/playerLifecycleV1.ts`
- `src/engine/core/player-lifecycle/playerExitReconciliationV1.ts`
- `src/engine/core/__tests__/playerLifecycleV1.test.ts`
- `src/engine/core/__tests__/playerExitReconciliationV1.test.ts`

Lifecycle entries become the frozen `{ playerId, status, exitCause }` shape,
where status is `active | exited`. Add a cause query. Keep the lower-level pure
lifecycle transition, but make the parent acceptance operation atomic across
lifecycle, the reference bundle, and the exit request. Return updated lifecycle,
surviving turn order, active/priority result, and all cleanup arrays.

Validate active/eligible/turn-order/lifecycle relations, non-card stack object
kinds, CR 800.4a category precedence, dense arrays, descriptors, and traps before
returning. SearchSession IDs remain Core rule-domain references. No connection,
Room, protocol, projection, choice-fallback, or arbitrary mutation is added.

## M-R2X — serial integration

Allowed writes are reserved until R2A–C are green:

- `src/engine/core/index.ts`
- `src/engine/core/fixtures/o4p-01m-commander-combat-player-exit-v1.json`
- `src/engine/core/__tests__/o4p01mIntegration.test.ts`
- `src/engine/core/__tests__/o4p01mClosureVerifier.test.ts`
- `scripts/checks/verify-mode-neutral-core-commander-combat-player-exit.ts`
- exact existing verifier registration tests only if names change

Remove every provisional assignment-state root export. Update the four-player
fixture and verifier for the unified context and atomic exit result. DEFER proof
must inspect public exports and exact returned shapes; a locally constructed
constant is forbidden. The generated API is synchronized later by the judge.

## M-R2J — judge review

The judge alone updates:

- `src/engine/core/__tests__/review.o4p-01m-commander-combat-player-exit.test.ts`
- `src/test/architecture/review.o4p-01m-commander-combat-player-exit-boundary.test.ts`

Review evidence must red-pin each previously reachable finding, exact root
exports, transport/automation exclusions, and machine-verifier registration.
It must fail if duplicate combat authority returns.

## Parent STOP conditions

- A repair needs typed Core commands/events, network identity, Room, protocol,
  projection, UI, Cloudflare, or Solo snapshot migration.
- A player-exit distinction cannot be represented without generic path mutation.
- Combat repair requires full 508/509 legality or automatic damage.
- A lane needs a path reserved for a later lane.
- A public error/type decision not frozen by the contract amendment is required.
