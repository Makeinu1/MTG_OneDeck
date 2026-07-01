# S-903.10a Commander Damage Defeat Advisory Engine-Spec §34.16 Draft

CR source: Magic: The Gathering Comprehensive Rules, effective 2026-06-19. Local pin: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` / metadata sha256 in `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json`. Relevant CR refs: 104.3j, 104.5, 117.5, 702.124d, 704.3, 903.10, 903.10a.

## Current State Survey

- `docs/engine-spec.md` §34.15 already defines the S-SBA defeat-state substrate as advisory-only. Current state is `defeat: Partial<Record<DefeatPlayerRef, DefeatAdvisoryRecord>>`; reasons are append-only advisory facts, not hard game-ending enforcement (CR 704.3, CR 104.3j).
- `src/engine/types.ts` currently has `DefeatReason = 'lifeZero' | 'emptyLibraryDraw' | 'poison'` and `DefeatRuleRef = '704.5a' | '704.5b' | '704.5c'`; `DefeatAdvisoryEvent.sbaApplied` is typed from `DefeatRuleRef` and carries `playerRef`, `defeatReason`, `simultaneousGroupId`, and `advisory: true` (CR 704.3).
- `src/engine/types.ts` defines `commanderDamage: Record<string, number>` with the code comment `key: 対戦相手統率者のラベル(自由文字列)`. The key is a free text commander-damage label, not a `DefeatPlayerRef`, not a commander `cardId`, and not an object identity (CR 903.10a).
- `src/engine/init.ts` initializes `commanderDamage` as `{}`. `src/components/playmat/PlaymatHud.tsx` builds commander-damage rows from `['対戦相手A', ...Object.keys(state.opponentLife), ...Object.keys(state.commanderDamage)]`, and `src/store/gameStore.ts` `addOpponent(label)` seeds both `opponentLife[label]` and `commanderDamage[label]` with no target-player object. Current labels are therefore UI counter labels shared with dummy opponent labels, not CR-exact player/source tuples (CR 903.10a).
- `src/engine/commands.ts` `adjustCommanderDamage` reads `state.commanderDamage[cmd.label] ?? 0`, applies `Math.max(0, current + cmd.delta)`, writes the same label key back, and logs `統率者ダメージ(${cmd.label})を${next}にしました。`. This command is the current numeric truth source for commander-damage advisory checks (CR 903.10a).
- The current combat engine does not auto-attribute combat damage to a commander source label. This slice must not infer commander damage from zone state, attacking objects, or dummy opponent data; it only observes the existing manual `commanderDamage[label]` counters (CR 903.10a, CR 702.124d).
- `src/engine/commands.ts` `applyDefeatStateBasedActions` currently adds `lifeZero`, `emptyLibraryDraw`, and `poison` via `addDefeatAdvisory`, which de-duplicates an already registered reason and emits `DefeatAdvisoryEvent` only for a new reason. `performStateBasedActionsOnce` gives all actions in the pass the same `simultaneousGroupId = sba-${nextEventSeq}` and repeats to a fixed point (CR 704.3, CR 117.5).

## Proposed §34.16 Text

### 34.16 S-SBA commander-damage defeat advisory(CR 903.10a) - draft

**Positioning**: This slice adds the fourth defeat advisory reason on top of §34.15. It is not a new defeat substrate. It extends the existing advisory record, event metadata, and SBA fixed-point loop with one reason, one rule ref, and one commander-damage branch (CR 903.10a, CR 104.3j, CR 704.3).

**CR basis**:

- CR 903.10a core text: "A player who’s been dealt 21 or more combat damage by the same commander over the course of the game loses the game." The same rule states that this is a state-based action and points to CR 704.
- CR 104.3j repeats the Commander loss condition and classifies it as a state-based action in the general losing-the-game rules (CR 104.3j).
- State-based actions are checked before a player gets priority, all applicable actions in a check are performed simultaneously, and the process repeats until no state-based actions are performed (CR 704.3, CR 117.5).
- Partner commanders are considered separately for the 21-damage check, so two labels below 21 must not be added together (CR 702.124d, CR 903.10a).

**1. Type contract (`src/engine/types.ts`)**:

```ts
type DefeatReason = 'lifeZero' | 'emptyLibraryDraw' | 'poison' | 'commanderDamage';
type DefeatRuleRef = '704.5a' | '704.5b' | '704.5c' | '903.10a';
type DefeatPlayerRef = 'P1' | `opponent:${string}`;

interface DefeatAdvisoryRecord {
  reasons: DefeatReason[];
  ruleRefs: Partial<Record<DefeatReason, DefeatRuleRef>>;
  advisory: true;
}

interface GameState {
  // Existing numeric truth source. Do not add a duplicate field.
  commanderDamage: Record<string, number>;
  defeat: Partial<Record<DefeatPlayerRef, DefeatAdvisoryRecord>>;
}
```

- `commanderDamage` is the only numeric truth source for this advisory. Do not add `commanderDamageDefeat`, per-label defeat state, commander object identity state, or per-opponent damage matrices in this slice (CR 903.10a).
- `DefeatReason['commanderDamage']` maps exactly to `DefeatRuleRef['903.10a']`; I13 and snapshot normalization must treat the reason as the fourth known defeat advisory reason, not an unknown value (CR 903.10a).
- Current `commanderDamage[label]` is interpreted as a coarse "same commander/source label" counter for damage dealt to `P1` by an opposing commander label. Because current state has no target-player keyed commander-damage map, this slice creates `defeat.P1` advisories only (CR 903.10a).
- CR-exact per-opponent counters, commander `cardId` attribution, partner source identity, and dummy opponent player objects are deferred. Advisory-level threshold detection is still zone-independent because the existing label counter already stores the value to compare against 21 (CR 903.10a, CR 702.124d).

**2. Event metadata contract (`src/engine/types.ts`)**:

```ts
interface DefeatAdvisoryEvent {
  type: 'defeatAdvisory';
  reason: 'sba';
  sbaApplied: DefeatRuleRef; // includes '903.10a'
  simultaneousGroupId: string;
  playerRef: DefeatPlayerRef;
  defeatReason: DefeatReason; // includes 'commanderDamage'
  advisory: true;
}
```

- Commander-damage defeat uses the same non-zone-change event shape as §34.15: `type: 'defeatAdvisory'`, `reason: 'sba'`, `sbaApplied: '903.10a'`, `playerRef: 'P1'`, `defeatReason: 'commanderDamage'`, `advisory: true` (CR 903.10a, CR 704.3).
- Do not fabricate a `ZoneChangeEvent`, do not move any card, and do not attach commander-damage advisory metadata to a physical card object in this slice (CR 903.10a, CR 704.3).
- Same-pass defeat reasons, for example `lifeZero` and `commanderDamage`, must share a single `simultaneousGroupId` because state-based actions in one check are simultaneous (CR 704.3).

**3. SBA contract (`performStateBasedActionsOnce`)**:

- Extend the existing `DEFEAT_RULE_REFS` map with `commanderDamage: '903.10a'` and the Japanese reason label with a concise warning string such as `統率者ダメージ21点以上` (CR 903.10a).
- Extend `applyDefeatStateBasedActions(draft, simultaneousGroupId)` with one branch: if any `state.commanderDamage[label] >= 21` and `defeat.P1.reasons` does not already include `commanderDamage`, call `addDefeatAdvisory(draft, 'P1', 'commanderDamage', simultaneousGroupId)` (CR 903.10a, CR 104.3j).
- Commander-damage labels are checked independently. Values from different labels must not be summed to reach 21; a single label must be `>= 21` (CR 903.10a, CR 702.124d).
- The branch is idempotent under the existing §34.15 rule: if `commanderDamage` is already present for `P1`, later SBA checks do not re-emit another `903.10a` event solely because a counter remains `>= 21` (CR 704.3, CR 903.10a).
- `performStateBasedActionsOnce` returns `true` for this slice only when a new `commanderDamage` advisory reason is added. A held-over numeric value `>= 21` with an already registered reason must not create an infinite fixed-point loop (CR 704.3, CR 117.5).
- If `commanderDamage` is added in the same pass as `lifeZero`, `emptyLibraryDraw`, or `poison`, all new defeat advisory events share the same `simultaneousGroupId` and each reason stores its own `ruleRefs` entry (CR 704.3, CR 903.10a).

**4. Sandbox / advisory policy**:

- This slice is advisory only. It must not end the game, null state, block commands, block phase or turn movement, remove a player, choose a winner, clear libraries or battlefields, or force any CR 104.5 leave-game consequence (CR 104.3j, CR 903.10a).
- The app may warn or display a defeat marker. The engine state remains operable and undo/redo remains a store-level concern exactly as in §34.15 (CR 704.3, CR 903.10a).
- If the user later reduces a commander-damage counter below 21, the advisory record remains append-only unless a future explicit "clear advisory" command is designed. CR would already have the player lose; this app records "would lose under CR" and continues (CR 104.3j, CR 903.10a).

**5. State invariants**:

- I13 expands from three defeat reasons to four: `lifeZero`, `emptyLibraryDraw`, `poison`, and `commanderDamage` (CR 704.5a, CR 704.5b, CR 704.5c, CR 903.10a).
- Each recorded reason has exactly its matching rule ref: `lifeZero -> 704.5a`, `emptyLibraryDraw -> 704.5b`, `poison -> 704.5c`, `commanderDamage -> 903.10a` (CR 704.5a, CR 704.5b, CR 704.5c, CR 903.10a).
- `defeat.P1.reasons` may contain `commanderDamage` only after an SBA check observed at least one `commanderDamage[label] >= 21` under the current label counter model (CR 903.10a, CR 704.3).
- `defeat['opponent:${label}'].reasons` must not receive `commanderDamage` in this slice because current `commanderDamage` is not target-player keyed (CR 903.10a).
- Snapshot forward compatibility must backfill missing `defeat` as `{}` and must update `normalizeSnapshotDefeat` reason validation so a stored `commanderDamage` advisory with rule ref `903.10a` is preserved; malformed unknown reasons remain dropped (CR 903.10a).

**6. Golden / test contract**:

- Add golden cases for 20-point negative boundary, 21-point positive boundary, 20 to 21 transition, no aggregation across labels, advisory continuation, idempotent no re-emit, simultaneous grouping with an existing §34.15 reason, and snapshot forward compatibility (CR 903.10a, CR 702.124d, CR 704.3).
- Acceptance review should be a reviewer-owned `review.903-10a` suite. It must pin that `commanderDamage` is now implemented at advisory level, while per-opponent-exact and source-object attribution remain negative boundary pins (CR 903.10a).
- Existing `review.sba-defeat` scope-boundary pin that expected 903.10a to be deferred must be replaced by the new reviewer-owned acceptance only after Fable approves this contract. This draft does not modify review files.

**7. Scope boundaries / defer**:

- Per-opponent commander-damage matrices, exact "which player was dealt damage by which commander" state, and multiple dummy opponents with target-player-specific counters are deferred (CR 903.10a).
- Automatic attribution from combat damage events to commander-damage counters is deferred; this slice observes only explicit `adjustCommanderDamage` state (CR 903.10a).
- Partner/background exact source identity is deferred beyond the label model, but labels must be independent and never summed (CR 702.124d, CR 903.10a).
- Actual game end, winner determination, player leaves game, and multiplayer simultaneous-loss/draw details remain outside the advisory defeat substrate (CR 104.3j, CR 903.10a).
- Two-Headed Giant and other team variants remain out of scope for this one-deck EDH sandbox slice (CR 903.10a).
