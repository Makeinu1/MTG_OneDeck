# Tier-1 Adversarial Audit — cr-120-damage (batch2-6) `dealDamage` primitive

Auditor: independent Tier-1 (cold session, no authorship of the diff under review).
Scope: uncommitted working-tree diff to `src/engine/commands.ts` + untracked
`src/engine/__tests__/cr120DealDamage.test.ts` (implementer-authored, informative only).

## Machine checks (all 4 required)

| Check | Result |
|---|---|
| `npm run lint` | PASS (no output, exit 0) |
| `npx tsc --noEmit` | PASS (no errors) |
| `npx vitest run` | PASS — **141 test files, 1282 tests, all passing.** Confirmed `src/store/__tests__/review.damage-marked.test.ts` and `src/store/__tests__/review.combat.test.ts` are included in the 141 files and green. |
| `npm run build` | PASS — `tsc -b && vite build` succeeded, `dist/` produced and then deleted (`rm -rf dist`) per instructions. |

No test failures, no type errors, no lint violations.

## Non-regression of pinned contracts

- `git diff src/engine/types.ts` is **empty** — `DamageEvent`/`EventSourceRef`/`EventTargetRef` pre-existed exactly as claimed (verified at `src/engine/types.ts:256-306`). No new persisted `GameState` field was needed.
- `applyMarkDamage` (`src/engine/commands.ts:1047-1071`) is **byte-for-byte unchanged** by this diff — the only diff hunk touching the `markDamage` region is the pre-existing type-declaration line shown as unchanged context. The new `dealDamage` creature-target path calls this exact same function (`applyMarkDamage(draft, targetCard.id, amount, cmd.deathtouch)` at `commands.ts:1097`), so marking semantics (increment, deathtouch flag OR-in, SBA-driven destruction) are shared, not reimplemented.
- Combat damage path (`applyCombatPlayerDamageTotals`, `commands.ts:1289-1305`) is unchanged. It calls `applyPlayerLifeDelta`/`applyOpponentLifeDelta` exactly as before, ignoring their (now non-void) return values — this is legal TS and behaviorally identical, since all pre-existing call sites (`commands.ts:1296`, `1298`, `3124`, `3741`, `3762`) already discard the return value as a bare statement.
- No `grammar/compile.ts` changes anywhere in the diff — confirmed via `git diff --name-only`.
- `research/cr-grounding/cr-backbone-ledger.json` untouched by this diff (correctly left for judge ownership).

## Adversarial findings

### 1. [MEDIUM] Runtime exclusivity of `targetCardId`/`targetPlayerId` is NOT enforced — silently resolved by branch priority, opposite target silently dropped

**Claim**: The type discriminant uses `?: never` to make `targetCardId`/`targetPlayerId` mutually exclusive, but `never` is a compile-time-only guarantee. A malformed command object at runtime (e.g. constructed by a future caller who doesn't go through the literal object literal, or by a bug that includes both) will NOT throw and will NOT signal anything is wrong. Instead, `applyDealDamage` (`src/engine/commands.ts:1087`) checks `cmd.targetCardId !== undefined` first and takes that branch unconditionally, silently ignoring `targetPlayerId` if both are present.

**Verified via a live runtime probe** (constructed and run in this session, then discarded — not left in the tree): dispatching
```js
{ type: 'dealDamage', sourceId, amount: 2, combatDamage: false, targetCardId: <creatureId>, targetPlayerId: 'OPPONENT_A' }
```
against a sub-lethal creature target produced:
- `damageMarked` on the creature incremented to 2 (creature branch taken)
- `opponentLife['対戦相手A']` **unchanged** at 40 (player branch silently skipped, no error, no event)
- Exactly one `DamageEvent` emitted, targeting the creature only

**Evidence**: `src/engine/commands.ts:1087-1099` (branch order + early `return`).

**Severity rationale**: MEDIUM not HIGH/BLOCKER because (a) the TS type system does prevent this from being constructed via a literal at any call site that goes through `applyCommand`'s typed signature — a caller would have to deliberately cast with `as any`/`as GameCommand` to hit this path, same as any other TS app; (b) no test in the implementer's suite exercises this malformed-input path, so it's genuinely untested, not merely "tested and passing." Still worth flagging because the engine has other "unknown command shape" guards elsewhere (e.g. `requireCard` throws on missing card) — this is the one runtime-reachable ambiguity in the new command that fails silently instead of throwing `EngineError`. Recommend (non-blocking, for a future slice): assert `cmd.targetCardId === undefined || cmd.targetPlayerId === undefined` and throw `EngineError` on violation, mirroring the existing `EngineError` thrown when neither is set (`commands.ts:1102`).

### 2. [LOW] `cr120DealDamage.test.ts` does not test the negative-amount or dual-target-set cases

**Claim**: The test file (`src/engine/__tests__/cr120DealDamage.test.ts`) has a "zero damage" test (`amount: 0`) but no explicit `amount: -5` (negative) test, and no test for the malformed dual-target case described in Finding 1. Both code paths are correctly handled by `normalizedDamageAmount` + the `amount <= 0` guard (verified: negative amounts safely short-circuit identically to zero, confirmed by reading `src/engine/commands.ts:1073-1081` — `Number.isFinite(-5)` is `true`, so `normalizedDamageAmount(-5) === -5`, and `-5 <= 0` triggers the same early return as zero), so this is not a functional defect, just an untested-but-correct edge case, and an entirely untested (and unenforced) case per Finding 1.

**Evidence**: `src/engine/commands.ts:1073-1081`; absence confirmed by reading the full test file (no `amount: -5` or dual-target literal anywhere in `cr120DealDamage.test.ts`).

**Severity rationale**: LOW — behavior is correct, only test coverage is incomplete. Test honesty is otherwise good: the existing tests do assert CR-relevant behavior (event/life linkage, marked-damage delegation, deathtouch-into-SBA, legacy `markDamage` non-regression) rather than shallow happy-path smoke tests, and none hide known-bad behavior behind TODO/skip.

### 3. [LOW] `damageResultEventIds` linkage relies on a post-hoc array splice by linear `findIndex` scan, not an in-place mutation at push time

**Claim**: `pushDamageEvent` pushes the `DamageEvent` without `damageResultEventIds` set, then after the life-change event is pushed, `setDamageResultEventIds` (`src/engine/commands.ts:1050-1071`) does a linear `findIndex` scan of the **entire** `eventLog` to locate the damage event by `eventId` and rebuilds the array via slice+spread to patch in `damageResultEventIds`. This is correct (verified via the implementer's own test assertion `damageResultEventIds: [lifeChanges[0].eventId]` and independently re-derivable from the event log dump captured during this audit's runtime probe), but is O(n) in event-log length per damage-to-player call, executed on every noncombat player-damage command. Not a correctness bug — flagging only as a potential future perf note if this primitive is called at high frequency (e.g. burn-heavy decks with long game logs).

**Evidence**: `src/engine/commands.ts:1042-1071`.

**Severity rationale**: LOW — pure performance observation, no correctness impact at current expected call volumes (single EDH playthrough, event logs in the hundreds, not millions).

## Findings NOT substantiated (adversarial questions that did NOT break the implementation)

- **CR 120.8 (zero/negative damage)**: `amount: 0` and `amount: -5` both correctly skip event emission and any state mutation. Confirmed by direct reading of `normalizedDamageAmount` + the `amount <= 0` guard, and by the implementer's own zero-damage test (`result.state` deep-equals pre-command state).
- **Life-change linking (CR 120.3a)**: exactly one `DamageEvent` and one `LifeChangeEvent` are emitted per player-damage call, correctly cross-linked both directions (`damageResultEventIds` on the damage event, `causeEventId`+`cause.eventId` on the life-change event). Verified via the implementer's test and independently via this audit's runtime probe.
- **Creature damage correctness (CR 120.3e)**: delegates to the unchanged, pinned `applyMarkDamage` — no reimplementation, no duplicated/divergent marking logic.
- **markDamage non-regression**: confirmed unchanged, both statically (diff inspection) and dynamically (`review.damage-marked.test.ts` green, all 7 pinned adversarial cases passing).
- **Purity/determinism**: `applyDealDamage` only mutates via the existing `draft`/immer-style pattern (`setCard`, `pushEvent`, direct `draft.state.eventLog` reassignment matching the pattern already used elsewhere in this file, e.g. `applyOpponentLifeDelta`). No randomness, no wall-clock reads.
- **Scope leakage**: no `infect`/`wither`/`lifelink` fields anywhere in the new type or `applyDealDamage` body. Planeswalker targets are not handled at all (no special-casing, no loyalty field touched) — since `EventTargetRef` has no planeswalker-specific kind and `targetCardId` just goes through the generic creature-marking path, a planeswalker target would currently be marked as if it were a creature (via `applyMarkDamage`, which operates on `damageMarked`/`hasDeathtouchDamage` fields any `CardInstance` has) rather than losing loyalty — this is arguably a scope gap (120.3c is explicitly out of scope per the brief) but it fails *silently plausible* rather than *loudly out-of-scope*: nothing in `applyDealDamage` distinguishes a planeswalker `CardInstance` from a creature one. No test exists for a planeswalker target either way. Flagged here as a residual note, not a new finding, since the brief explicitly says CR 120.3c is out of scope for this slice — but out-of-scope should ideally either throw or be explicitly deferred with a guard, not silently fall through to creature-damage marking semantics. This is essentially a variant of Finding 1's "silent fallback instead of explicit guard" pattern.
- **Event ref correctness**: `source`/`target` refs use real `physicalCardId`/`objectId`/`playerId` values derived from `objectSnapshotOf`, not placeholders. Verified via runtime probe event-log dump.
- **Test honesty**: no hidden TODO/skip; tests assert CR-relevant behavior, not just smoke tests.

## Summary verdict

**No BLOCKER findings.** One MEDIUM (runtime exclusivity of dual-target commands relies on branch-priority silent fallback rather than an explicit guard/throw) and two LOW findings (missing negative/dual-target test coverage; O(n) event-log rescan for result-id linkage) plus one residual scope-boundary note (planeswalker targets silently fall through to creature-marking semantics rather than being explicitly rejected, consistent with the MEDIUM finding's pattern). All four required mechanical checks pass cleanly, and all pinned/reviewer-owned contracts (`review.damage-marked.test.ts`, `review.combat.test.ts`, `markDamage` command, combat damage path, `types.ts`, ledger) are verified unchanged and green.
