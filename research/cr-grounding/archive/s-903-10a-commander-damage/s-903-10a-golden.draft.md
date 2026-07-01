# S-903.10a Commander Damage Golden / Adversarial Test Draft

CR source: Magic: The Gathering Comprehensive Rules, effective 2026-06-19. Relevant CR refs: 104.3j, 104.5, 117.5, 702.124d, 704.3, 903.10, 903.10a.

This is a draft for `golden-cases.json` entries and a reviewer-owned `review.903-10a` acceptance suite. It must not be copied into `docs/` or `review.*` until Fable approves the contract.

## Expected Metadata Shape

All positive cases expect the existing defeat-advisory event shape, extended with the fourth reason and rule ref (CR 903.10a, CR 704.3):

```ts
{
  type: 'defeatAdvisory',
  reason: 'sba',
  sbaApplied: '903.10a',
  simultaneousGroupId: expect.stringMatching(/^sba-/),
  playerRef: 'P1',
  defeatReason: 'commanderDamage',
  advisory: true,
}
```

The event is not a `ZoneChangeEvent` and must not imply game-ending enforcement (CR 903.10a, CR 104.3j).

## Golden Cases

### cr-903-10a-commander-damage-twenty-no-advisory

CR refs: 903.10a, 104.3j, 704.3.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 20 });

const state = store().state!;
expect(state.commanderDamage['Opp Commander A']).toBe(20);
expect(state.defeat.P1?.reasons ?? []).not.toContain('commanderDamage');
expect(defeatEvents('903.10a')).toHaveLength(0);
```

Expected observations:

- 20 is below the CR 903.10a threshold and must not create a commander-damage defeat advisory (CR 903.10a).
- The app may show a UI danger threshold only at 21, but engine defeat state remains absent at 20 (CR 903.10a).

### cr-903-10a-commander-damage-twenty-one-p1-advisory

CR refs: 903.10a, 104.3j, 117.5, 704.3.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 21 });

const state = store().state!;
expect(state.commanderDamage['Opp Commander A']).toBe(21);
expect(state.defeat.P1?.reasons).toContain('commanderDamage');
expect(state.defeat.P1?.ruleRefs.commanderDamage).toBe('903.10a');
expect(defeatEvents('903.10a')).toContainEqual(expect.objectContaining({
  type: 'defeatAdvisory',
  reason: 'sba',
  sbaApplied: '903.10a',
  playerRef: 'P1',
  defeatReason: 'commanderDamage',
  advisory: true,
}));
```

Expected observations:

- A single label at 21 creates a `P1` commander-damage advisory because current `commanderDamage[label]` is the app's coarse "same commander/source label" counter (CR 903.10a).
- `ruleRefs.commanderDamage` is exactly `903.10a` (CR 903.10a).
- No card moves zones and no fake zone-change event is created (CR 903.10a, CR 704.3).

### cr-903-10a-commander-damage-crosses-boundary

CR refs: 903.10a, 704.3.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 20 });
expect(store().state!.defeat.P1?.reasons ?? []).not.toContain('commanderDamage');

store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 1 });

expect(store().state!.commanderDamage['Opp Commander A']).toBe(21);
expect(store().state!.defeat.P1?.reasons).toContain('commanderDamage');
expect(defeatEvents('903.10a')).toHaveLength(1);
```

Expected observations:

- The advisory appears when the same label reaches 21, not before (CR 903.10a).
- The event is emitted once for the newly added reason (CR 704.3).

### cr-903-10a-commander-damage-labels-do-not-aggregate

CR refs: 903.10a, 702.124d, 704.3.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 10 });
store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander B', delta: 11 });

expect(store().state!.commanderDamage['Opp Commander A']).toBe(10);
expect(store().state!.commanderDamage['Opp Commander B']).toBe(11);
expect(store().state!.defeat.P1?.reasons ?? []).not.toContain('commanderDamage');
expect(defeatEvents('903.10a')).toHaveLength(0);
```

Expected observations:

- The app must not sum separate commander-damage labels to reach 21 (CR 903.10a).
- This is the label-model equivalent of keeping partner commanders separate (CR 702.124d).

### cr-903-10a-commander-damage-independent-label-threshold

CR refs: 903.10a, 702.124d, 704.3.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 20 });
store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander B', delta: 21 });

const state = store().state!;
expect(state.commanderDamage['Opp Commander A']).toBe(20);
expect(state.commanderDamage['Opp Commander B']).toBe(21);
expect(state.defeat.P1?.reasons).toContain('commanderDamage');
expect(defeatEvents('903.10a')).toHaveLength(1);
```

Expected observations:

- One label at 21 is sufficient even if another label is below threshold (CR 903.10a).
- The below-threshold label does not block the above-threshold label and does not contribute to it (CR 903.10a, CR 702.124d).

### cr-903-10a-commander-damage-idempotent-no-reemit

CR refs: 903.10a, 704.3, 117.5.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 21 });
expect(defeatEvents('903.10a')).toHaveLength(1);

store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 1 });
store().dispatch({ type: 'adjustLife', delta: 0 });

expect(store().state!.commanderDamage['Opp Commander A']).toBe(22);
expect(store().state!.defeat.P1?.reasons.filter((r) => r === 'commanderDamage')).toHaveLength(1);
expect(defeatEvents('903.10a')).toHaveLength(1);
```

Expected observations:

- A held-over value above 21 does not repeatedly emit commander-damage defeat events in the advisory sandbox (CR 704.3, CR 903.10a).
- The fixed-point SBA loop terminates because only new advisory reasons count as performed actions for this branch (CR 704.3, CR 117.5).

### cr-903-10a-commander-damage-simultaneous-with-life-zero

CR refs: 903.10a, 104.3j, 704.5a, 104.3b, 704.3.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);
useGameStore.setState({
  state: {
    ...store().state!,
    life: 0,
    commanderDamage: { ...store().state!.commanderDamage, 'Opp Commander A': 21 },
  },
});

store().dispatch({ type: 'adjustLife', delta: 0 });

const events = store().state!.eventLog.filter((event) =>
  event.type === 'defeatAdvisory' &&
  event.playerRef === 'P1' &&
  (event.sbaApplied === '704.5a' || event.sbaApplied === '903.10a')
);
expect(events).toHaveLength(2);
expect(new Set(events.map((event) => event.simultaneousGroupId)).size).toBe(1);
expect(store().state!.defeat.P1?.reasons).toEqual(expect.arrayContaining([
  'lifeZero',
  'commanderDamage',
]));
```

Expected observations:

- Commander-damage defeat and life-zero defeat detected in one SBA check share a `simultaneousGroupId` (CR 704.3).
- Each reason keeps its own rule ref: `704.5a` for life and `903.10a` for commander damage (CR 704.5a, CR 903.10a).

### cr-903-10a-commander-damage-advisory-does-not-hard-enforce

CR refs: 903.10a, 104.3j, 104.5.

Pseudocode:

```ts
store().newGame(makeDeck(20), 1);

store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 21 });
expect(store().state!.defeat.P1?.reasons).toContain('commanderDamage');

store().dispatch({ type: 'draw', count: 1 });
store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: -1 });

expect(store().state).toBeTruthy();
expect(store().state!.commanderDamage['Opp Commander A']).toBe(20);
expect(store().state!.defeat.P1?.reasons).toContain('commanderDamage');
```

Expected observations:

- The app remains playable after the advisory and does not apply CR leave-game consequences (CR 104.3j, CR 104.5, CR 903.10a).
- Reducing the manual counter after the advisory does not erase the append-only defeat advisory record in this slice (CR 903.10a).

### cr-903-10a-commander-damage-no-opponent-player-ref

CR refs: 903.10a.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustCommanderDamage', label: '対戦相手A', delta: 21 });

const state = store().state!;
expect(state.defeat.P1?.reasons).toContain('commanderDamage');
expect(state.defeat['opponent:対戦相手A']?.reasons ?? []).not.toContain('commanderDamage');
```

Expected observations:

- Current `commanderDamage[label]` is not a target-player-keyed opponent defeat counter (CR 903.10a).
- Per-opponent-exact commander damage remains out of scope until a target-player keyed model exists (CR 903.10a).

### cr-903-10a-commander-damage-manual-counter-only

CR refs: 903.10a.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustLife', delta: -21 });

expect(store().state!.commanderDamage['Opp Commander A'] ?? 0).toBe(0);
expect(store().state!.defeat.P1?.reasons ?? []).not.toContain('commanderDamage');
expect(defeatEvents('903.10a')).toHaveLength(0);
```

Expected observations:

- Ordinary life adjustment, even for 21 points, is not commander combat damage and must not synthesize `commanderDamage` state (CR 903.10a).
- Automatic combat-source attribution is deferred; this slice observes only `state.commanderDamage[label]` (CR 903.10a).

### cr-903-10a-forward-compat-preserves-fourth-reason

CR refs: 903.10a, 704.3.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);
store().dispatch({ type: 'adjustCommanderDamage', label: 'Opp Commander A', delta: 21 });

const snapshot = store().exportSnapshot();
store().importSnapshot(snapshot);

const state = store().state!;
expect(state.defeat.P1?.reasons).toContain('commanderDamage');
expect(state.defeat.P1?.ruleRefs.commanderDamage).toBe('903.10a');
```

Expected observations:

- Snapshot normalization treats `commanderDamage` as a known defeat reason and preserves its `903.10a` rule ref (CR 903.10a).
- Unknown malformed reasons are still dropped by the normalizer; only the fourth known reason is added (CR 903.10a).

## Reviewer-Owned `review.903-10a` Enemy Pins Draft

These are proposed acceptance pins for Fable to author in a `review.*` file. This draft does not create or edit that file.

1. `DefeatReason` and `DefeatRuleRef` contract: property I13 recognizes exactly four reasons and maps `commanderDamage -> 903.10a` (CR 903.10a).
2. 20-point boundary: `adjustCommanderDamage(label, +20)` does not create a defeat advisory (CR 903.10a).
3. 21-point boundary: one label at 21 creates `defeat.P1.reasons += commanderDamage`, `ruleRefs.commanderDamage = 903.10a`, and one `DefeatAdvisoryEvent` (CR 903.10a, CR 704.3).
4. Same-label transition: 20 then +1 emits exactly once when the same label reaches 21 (CR 903.10a).
5. No label aggregation: 10 on one label plus 11 on another label does not lose; labels model separate commander sources (CR 903.10a, CR 702.124d).
6. Idempotence: after `commanderDamage` is already recorded, more SBA checks and more damage on that label do not re-emit `903.10a` (CR 704.3, CR 117.5).
7. Simultaneity: if `lifeZero` and `commanderDamage` are both first observed in the same SBA pass, their events share one `simultaneousGroupId` (CR 704.3, CR 704.5a, CR 903.10a).
8. Advisory sandbox: a commander-damage defeat advisory does not null state, end the game, block draw/phase/adjust commands, or move cards (CR 104.3j, CR 104.5, CR 903.10a).
9. Current model boundary: `commanderDamage[label] >= 21` creates a `P1` advisory, not `opponent:${label}`, because current counters are not target-player keyed (CR 903.10a).
10. Manual-counter boundary: life loss, opponent life loss, and combat resolution without an `adjustCommanderDamage` value do not synthesize a `903.10a` advisory (CR 903.10a).
11. Snapshot compatibility: legacy snapshots missing `defeat` still backfill cleanly, and snapshots containing the fourth known reason preserve `903.10a` while malformed reasons are dropped (CR 903.10a).
12. No fake zone event: the `903.10a` advisory is a `defeatAdvisory` event only and contains no physical-card zone-change fields (CR 903.10a, CR 704.3).

## Scope Boundary Pins

- Per-opponent-exact commander damage remains a negative pin: the current model must not claim to know which modeled opponent received commander damage (CR 903.10a).
- Exact commander object attribution remains a negative pin: labels are user-controlled source labels, not card identities or object ids (CR 903.10a).
- Partner/background source exactness remains a boundary beyond the label model, while label non-aggregation is required now (CR 702.124d, CR 903.10a).
- Automatic combat damage aggregation into `commanderDamage` is not part of this advisory slice (CR 903.10a).
- Actual game ending, winner determination, player leaving the game, and multiplayer draw outcomes remain outside this advisory contract (CR 104.3j, CR 903.10a).
