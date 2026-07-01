# S-SBA Defeat-State Golden / Adversarial Test Draft

CR source: Magic: The Gathering Comprehensive Rules, effective 2026-06-19. Relevant CR refs: 104.1, 104.3b, 104.3c, 104.3d, 104.5, 117.5, 121.1, 121.2, 121.4, 121.5, 122.1f, 704.1, 704.3, 704.5a, 704.5b, 704.5c.

## Expected New Metadata Shape

All positive cases expect a non-zone-change event with this audit shape, because defeat is an SBA but does not move a card between zones (CR 704.1, CR 704.3, CR 704.5a, CR 704.5b, CR 704.5c):

```ts
{
  type: 'defeatAdvisory',
  reason: 'sba',
  sbaApplied: '704.5a' | '704.5b' | '704.5c',
  simultaneousGroupId: expect.stringMatching(/^sba-/),
  playerRef: 'P1' | `opponent:${string}`,
  defeatReason: 'lifeZero' | 'emptyLibraryDraw' | 'poison',
  advisory: true,
}
```

The test suite must assert that this event is advisory metadata and not a game-ending side effect (CR 104.1, CR 104.5, CR 704.5a, CR 704.5b, CR 704.5c).

## Golden Cases

### cr-sba-defeat-life-zero-p1

CR refs: 704.5a, 104.3b, 117.5, 704.3, 104.5.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustLife', delta: -40 });

const state = store().state!;
expect(state.life).toBe(0);
expect(state.defeat.P1.reasons).toContain('lifeZero');
expect(state.defeat.P1.ruleRefs.lifeZero).toBe('704.5a');
expect(state.eventLog).toContainEqual(expect.objectContaining({
  type: 'defeatAdvisory',
  reason: 'sba',
  sbaApplied: '704.5a',
  playerRef: 'P1',
  defeatReason: 'lifeZero',
  advisory: true,
}));
```

Expected observations:

- `lifeZero` is set when `state.life <= 0` is observed by the SBA loop (CR 704.5a, CR 104.3b, CR 704.3).
- No card is moved and no `ZoneChangeEvent` is fabricated for the defeat advisory (CR 704.1, CR 704.5a).
- The app state remains available after the advisory instead of applying player-leaves-game processing (CR 104.5, CR 704.5a).

### cr-sba-defeat-life-zero-opponent-label

CR refs: 704.5a, 104.3b, 117.5, 704.3, 104.5.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustOpponentLife', label: '対戦相手A', delta: -40 });

const state = store().state!;
expect(state.opponentLife['対戦相手A']).toBe(0);
expect(state.defeat['opponent:対戦相手A'].reasons).toContain('lifeZero');
expect(state.eventLog).toContainEqual(expect.objectContaining({
  type: 'defeatAdvisory',
  reason: 'sba',
  sbaApplied: '704.5a',
  playerRef: 'opponent:対戦相手A',
  defeatReason: 'lifeZero',
  advisory: true,
}));
```

Expected observations:

- Opponent life labels are evaluated independently for `lifeZero` advisories (CR 704.5a, CR 104.3b).
- The advisory does not remove the opponent label or block later opponent-life adjustment (CR 104.5, CR 704.5a).

### cr-sba-defeat-empty-library-draw

CR refs: 704.5b, 121.1, 121.2, 121.4, 104.3c, 117.5, 704.3, 104.5.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);
useGameStore.setState({
  state: {
    ...store().state!,
    zones: { ...store().state!.zones, library: [] },
  },
});

store().dispatch({ type: 'draw', count: 1 });

const state = store().state!;
expect(state.zones.library).toEqual([]);
expect(state.drawnThisTurn).toBe(0);
expect(state.emptyLibraryDrawAttemptedSinceLastSba.P1).toBeUndefined();
expect(state.defeat.P1.reasons).toContain('emptyLibraryDraw');
expect(state.defeat.P1.ruleRefs.emptyLibraryDraw).toBe('704.5b');
expect(state.eventLog).toContainEqual(expect.objectContaining({
  type: 'defeatAdvisory',
  reason: 'sba',
  sbaApplied: '704.5b',
  playerRef: 'P1',
  defeatReason: 'emptyLibraryDraw',
  advisory: true,
}));
```

Expected observations:

- The draw path records an attempted draw before the SBA loop consumes the interval flag (CR 121.1, CR 121.2, CR 121.4, CR 704.5b).
- The public post-command state has `emptyLibraryDrawAttemptedSinceLastSba.P1` cleared because the flag is "since the last SBA check" state (CR 704.5b, CR 121.4, CR 704.3).
- `drawnThisTurn` remains `0` because no card was drawn, proving the defeat advisory does not rely on a successful draw count (CR 121.1, CR 121.4, CR 704.5b).
- The app warns/advises but remains playable after the empty-library defeat advisory (CR 104.5, CR 704.5b).

### cr-sba-defeat-empty-library-draw-partial-multidraw

CR refs: 704.5b, 121.2, 121.4, 104.3c, 704.3.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);
const onlyCard = store().state!.zones.library[0];
useGameStore.setState({
  state: {
    ...store().state!,
    zones: { ...store().state!.zones, library: [onlyCard] },
  },
});

store().dispatch({ type: 'draw', count: 2 });

const state = store().state!;
expect(state.zones.hand).toContain(onlyCard);
expect(state.drawnThisTurn).toBeGreaterThanOrEqual(1);
expect(state.defeat.P1.reasons).toContain('emptyLibraryDraw');
expect(state.eventLog).toContainEqual(expect.objectContaining({
  type: 'defeatAdvisory',
  sbaApplied: '704.5b',
  playerRef: 'P1',
  defeatReason: 'emptyLibraryDraw',
}));
```

Expected observations:

- The remaining card is drawn first, and the following unavailable individual draw creates the empty-library advisory (CR 121.2, CR 121.4, CR 104.3c, CR 704.5b).
- This case prevents an implementation that only checks `library.length === 0` before a multi-draw and misses running out mid-instruction (CR 121.2, CR 704.5b).

### cr-sba-defeat-poison-threshold

CR refs: 704.5c, 122.1f, 104.3d, 117.5, 704.3, 104.5.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustPlayerCounter', kind: 'poison', delta: 10 });

const state = store().state!;
expect(state.poison).toBe(10);
expect(state.defeat.P1.reasons).toContain('poison');
expect(state.defeat.P1.ruleRefs.poison).toBe('704.5c');
expect(state.eventLog).toContainEqual(expect.objectContaining({
  type: 'defeatAdvisory',
  reason: 'sba',
  sbaApplied: '704.5c',
  playerRef: 'P1',
  defeatReason: 'poison',
  advisory: true,
}));
```

Expected observations:

- Poison `10` creates a poison defeat advisory for `P1` (CR 704.5c, CR 122.1f, CR 104.3d).
- The app does not clear poison counters or end the game after recording the advisory (CR 104.5, CR 704.5c).

### cr-sba-defeat-poison-nine-boundary

CR refs: 704.5c, 122.1f, 704.3.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({ type: 'adjustPlayerCounter', kind: 'poison', delta: 9 });

const state = store().state!;
expect(state.poison).toBe(9);
expect(state.defeat.P1?.reasons ?? []).not.toContain('poison');
expect(state.eventLog.some((event) =>
  event.type === 'defeatAdvisory' && event.sbaApplied === '704.5c',
)).toBe(false);
```

Expected observations:

- Poison `9` is below the CR 704.5c threshold and must not create a poison defeat advisory (CR 704.5c, CR 122.1f).

### cr-sba-defeat-simultaneous-reasons-share-group

CR refs: 704.3, 704.5a, 704.5c, 104.3b, 104.3d.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);
useGameStore.setState({
  state: {
    ...store().state!,
    life: 0,
    poison: 10,
  },
});

store().dispatch({ type: 'adjustLife', delta: 0 });

const events = store().state!.eventLog.filter((event) =>
  event.type === 'defeatAdvisory' &&
  event.playerRef === 'P1' &&
  (event.sbaApplied === '704.5a' || event.sbaApplied === '704.5c')
);
expect(events).toHaveLength(2);
expect(new Set(events.map((event) => event.simultaneousGroupId)).size).toBe(1);
expect(store().state!.defeat.P1.reasons).toEqual(expect.arrayContaining([
  'lifeZero',
  'poison',
]));
```

Expected observations:

- Multiple applicable defeat advisories from one SBA pass share a `simultaneousGroupId` (CR 704.3).
- The app records both advisory reasons instead of choosing one and hiding the other (CR 704.5a, CR 704.5c).

## Adversarial Cases

### cr-sba-defeat-advisory-does-not-hard-enforce

CR refs: 104.1, 104.5, 704.5a, 704.5b, 704.5c.

Pseudocode:

```ts
store().newGame(makeDeck(20), 1);
store().dispatch({ type: 'adjustLife', delta: -40 });
expect(store().state!.defeat.P1.reasons).toContain('lifeZero');

store().dispatch({ type: 'nextPhase' });
expect(store().state!.phase).toBe('upkeep');

store().dispatch({ type: 'adjustLife', delta: 1 });
expect(store().state!.life).toBe(1);

store().dispatch({ type: 'draw', count: 1 });
expect(store().state).toBeTruthy();
```

Expected observations:

- The engine does not set `state` to `null`, clear zones, block `nextPhase`, block `draw`, or throw solely because a defeat advisory exists (CR 104.5, CR 704.5a).
- `lifeZero` may remain in advisory history even if later manual life adjustment moves life above zero, because this app records the earlier CR loss condition as advisory rather than rewinding the SBA fact (CR 104.5, CR 704.5a).

### cr-sba-defeat-no-duplicate-event-fixed-point

CR refs: 704.3, 704.5a, 104.5.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);
store().dispatch({ type: 'adjustLife', delta: -40 });
const firstCount = store().state!.eventLog.filter((event) =>
  event.type === 'defeatAdvisory' && event.sbaApplied === '704.5a',
).length;

store().dispatch({ type: 'adjustLife', delta: 0 });
const secondCount = store().state!.eventLog.filter((event) =>
  event.type === 'defeatAdvisory' && event.sbaApplied === '704.5a',
).length;

expect(firstCount).toBe(1);
expect(secondCount).toBe(1);
```

Expected observations:

- Re-running the SBA loop while `life <= 0` does not repeatedly append identical advisory events, because CR would remove the player but the app continues advisory-only (CR 704.3, CR 104.5, CR 704.5a).
- This case detects infinite-loop risks in `performStateBasedActionsOnce` after defeat becomes advisory rather than terminal (CR 704.3, CR 104.5).

### cr-sba-defeat-nondraw-empty-library-does-not-trigger

CR refs: 121.1, 121.5, 704.5b.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);
useGameStore.setState({
  state: {
    ...store().state!,
    zones: { ...store().state!.zones, library: [] },
  },
});

store().dispatch({ type: 'mill', count: 1 });

const state = store().state!;
expect(state.defeat.P1?.reasons ?? []).not.toContain('emptyLibraryDraw');
expect(state.eventLog.some((event) =>
  event.type === 'defeatAdvisory' && event.sbaApplied === '704.5b',
)).toBe(false);
```

Expected observations:

- Empty library plus a non-draw action does not create an empty-library draw defeat advisory (CR 121.1, CR 121.5, CR 704.5b).

### cr-sba-defeat-snapshot-forward-compat

CR refs: 704.5a, 704.5b, 704.5c.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);
const base = store().state!;
const legacy = { ...base } as Partial<GameState>;
delete legacy.defeat;
delete legacy.emptyLibraryDrawAttemptedSinceLastSba;

const snapshot: GameSnapshot = {
  version: SNAPSHOT_VERSION,
  state: legacy as GameState,
  deck: makeDeck(12),
  autoAdvanceToMain: false,
};

expect(() => store().restoreGame(snapshot)).not.toThrow();
expect(store().state!.defeat).toEqual({});
expect(store().state!.emptyLibraryDrawAttemptedSinceLastSba).toEqual({});
```

Expected observations:

- Missing defeat fields from old snapshots are backfilled to empty advisory state rather than crashing or falsely asserting a CR loss condition (CR 704.5a, CR 704.5b, CR 704.5c).
- Restored old snapshots can still run subsequent SBA checks normally (CR 704.3, CR 704.5a, CR 704.5b, CR 704.5c).

### cr-sba-defeat-commander-damage-deferred

CR refs: 903.10a, 704.6c, 104.3j, 704.5a, 704.5b, 704.5c.

Pseudocode:

```ts
store().newGame(makeDeck(12), 1);

store().dispatch({
  type: 'adjustCommanderDamage',
  label: '対戦相手統率者',
  delta: 21,
});

const state = store().state!;
expect(state.commanderDamage['対戦相手統率者']).toBe(21);
expect(Object.values(state.defeat).flatMap((record) => record.reasons)).not.toContain(
  'commanderDamage',
);
expect(state.eventLog.some((event) =>
  event.type === 'defeatAdvisory' && event.sbaApplied === '704.6c',
)).toBe(false);
```

Expected observations:

- Commander-damage loss is not claimed in this 704.5a/b/c slice and remains a separate future slice (CR 903.10a, CR 704.6c, CR 104.3j).
- This case prevents accidental scope creep from being reported as PASS for the life/empty-library/poison substrate (CR 704.5a, CR 704.5b, CR 704.5c, CR 903.10a).
