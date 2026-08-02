# Cold Audit Findings: cr-309-dungeons

Auditor: Codex cold auditor (019fc085)
Date: 2026-08-02
Verdict: AUDIT-FAIL

## Summary

| Severity | Count |
|---|---|
| BLOCKER | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 2 |

## Findings

### HIGH-1 — SBA 704.5t path loses completedCount (CR 309.7 violation)

`completeDungeonBySba` (commands.ts:2319) calls `removeDungeon` (commands.ts:2312),
which deletes the player's `DungeonState` entry entirely. The `completedCount`
stored inside that entry is destroyed. When the player next ventures, Case 1 in
`applyVentureIntoDungeon` (commands.ts:2340) reads
`existing?.completedCount ?? 0`, which yields 0 because the entry no longer
exists.

CR 309.7: "A player completes a dungeon as that dungeon card is removed from the
game." The SBA removal IS a completion, so `completedCount` must be incremented
and preserved. The 309.5b path (commands.ts:2408) correctly does
`existing.completedCount + 1`, but the SBA path does not.

The JSDoc on `removeDungeon` (commands.ts:2311) claims "incrementing
completedCount (309.7)" but the function body only deletes the entry — it never
increments anything.

**Adversarial proof:** Enter a 2-room linear dungeon, advance to bottommost,
clear pending triggers, run SBA → dungeon removed. Venture into a new dungeon →
`completedCount` is 0 (should be 1).

**Impact:** The SBA path is the primary dungeon completion mechanism in normal
gameplay (room ability resolves → SBA fires). Any future consumer of
`completedCount` (cards like Underdark Explorer, stats, achievements) will see
an incorrect value. The 309.5b path (venturing while already on bottommost) is
the less common path and works correctly.

**Suggested fix:** Either (a) store `completedCount` outside `DungeonState`
(e.g., a separate `Record<PlayerId, number>` on `GameState`), or (b) have
`completeDungeonBySba` write back a ghost entry or increment before deleting,
so the next venture can read the prior count.

### MEDIUM-1 — hasPendingDungeonRoomTrigger checks controllerId only, not source dungeon (CR 309.6 scope)

`hasPendingDungeonRoomTrigger` (commands.ts:2290) filters pending triggers by
`triggerId === DUNGEON_ROOM_TRIGGER_ID && trigger.controllerId === playerId`.
It does not check whether the trigger's source matches the player's *current*
dungeon.

CR 309.6: "If a player's venture marker is on the bottommost room of a dungeon
card, and **that dungeon card** isn't the source of a room ability that has
triggered but not yet left the stack…" The rule scopes the check to the current
dungeon card, not to any dungeon trigger controlled by the player.

**Adversarial proof:** Enter dungeon A, advance to bottommost, complete via
309.5b into dungeon B (old triggers from A remain pending). Advance B to its
bottommost, resolve only B's triggers. SBA does NOT remove B because A's stale
triggers still satisfy `hasPendingDungeonRoomTrigger`.

**Mitigating factors:** In normal play, room ability triggers resolve before the
next venture, so stale triggers from a previous dungeon are unlikely to persist.
The current slice treats room effects as manual/guided, so trigger resolution is
explicit. No current gameplay path produces this scenario organically.

**Suggested fix:** Add a source check:
`trigger.sourceId === \`dungeon:${dungeon.dungeonDefId}\`` alongside the
controllerId check.

### LOW-1 — removeDungeon JSDoc is misleading

The comment on `removeDungeon` (commands.ts:2311) says "incrementing
completedCount (309.7)" but the function only deletes the dungeon entry. The
increment happens in the caller (`applyVentureIntoDungeon` Case 3, line 2408)
or not at all (SBA path). The comment should describe what the function actually
does.

### LOW-2 — Empty rooms array creates a permanently stuck dungeon

A `DungeonDef` with `rooms: []` passes the `dungeonDefOf` lookup and creates a
`DungeonState` at `currentRoomIndex: 0`. Since `rooms[0]` is undefined:
- `isBottommostRoom` returns false (room is undefined), so SBA never removes it.
- Venture advance warns "ダンジョンの部屋が無効です" but the dungeon persists.
- No room ability trigger is created (`appendDungeonRoomTrigger` returns early).

No real dungeon has empty rooms, and `DungeonDef` data comes from curated
definitions, so this is a data-validation concern rather than a reachable
gameplay bug. A defensive guard in Case 1 (reject defs with `rooms.length === 0`)
would close the gap.

## Verified correct

- 309.2a: First venture creates DungeonState at room 0 with PendingTrigger. ✓
- 309.3: Only one dungeon per player; venture with different defId advances existing. ✓
- 309.4c: Each room transition creates exactly one room ability trigger with correct
  triggerId, sourceSnapshot (zone=command, typeLine=Dungeon), controllerId. ✓
- 309.5a: Branch without roomChoice → warning, marker unchanged. Invalid roomChoice →
  warning, marker unchanged. Valid roomChoice → advances. ✓
- 309.5b: Venture on bottommost completes old dungeon, starts new one at room 0,
  increments completedCount, sets completedDungeonDefId on VentureEvent. ✓
- 309.6/704.5t: SBA removes dungeon at bottommost with no pending trigger; preserves
  dungeon with pending trigger. ✓ (modulo MEDIUM-1 source scope)
- VentureEvent: pushed to eventLog with correct playerId, roomIndex, dungeonDefId,
  eventId, sequence. ✓
- restoreGame backfill: legacy snapshot without dungeons/dungeonDefs → empty defaults. ✓
- Immutability: original state not mutated by venture or SBA. makeDraft shallow-clones
  the dungeons record; applyVentureIntoDungeon creates new DungeonState objects via
  spread. ✓
- Concurrent players: P1 and OPPONENT_A have independent dungeon state. ✓
- dungeonDefs undefined: venture warns and creates no dungeon. ✓
- recentCueModel: exhaustive switch handles 'venture' (returns null, log-surfaced). ✓
- All 18 review + implementer tests pass. ✓
