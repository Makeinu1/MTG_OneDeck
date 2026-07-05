# cr-400-408 linked-exile / LKI substrate — Tier-1 adversarial audit

Auditor: independent Tier-1 session (not the implementer). Scope: uncommitted
slice implementing `docs/engine-spec.md` §34.21 design-lock, per
`research/cr-grounding/cr-400-408-implementation-brief.draft.md`.

Design authority read in full: `docs/engine-spec.md` §34.21 (lines
2475-2496), `research/cr-grounding/cr-400-408-linked-exile.draft.md` (living
design draft this section promotes from).

## Summary verdict

**1 BLOCKER.** The other three frozen pillars (state shape, command-surface
discipline, object-identity guard, snapshot forward-compat, draft
immutability) hold under adversarial testing. The compiler leaf added in
`src/engine/grammar/compile.ts` has a scope-discipline defect that lets a
same-resolution linked-exile record get created and immediately consumed for
an oracle-text pattern that the design explicitly declares out of scope this
slice (delayed/future-turn return), because a real card's actual delay clause
never gets checked.

---

## BLOCKER: compiler leaf accepts delayed-return phrasing as same-resolution

- **Adversarial claim**: §34.21 point 4 and the "本スライスのスコープ確定"
  paragraph (engine-spec.md:2495) freeze that `temporary-return` this slice is
  **same-resolution only**; a pattern like "Exile target creature. Return
  that card to the battlefield ... **at the beginning of the next end
  step**" requires a delayed-turn/phase scheduler that "現状ゼロ" (does not
  exist) and is explicitly deferred. The new leaf must stay `manual` for such
  delayed variants (task item 7).

- **Evidence**: `src/engine/grammar/compile.ts:485-489`

  ```ts
  function isSameResolutionBattlefieldReturn(raw: string): boolean {
    return /^return\s+that\s+card\s+to\s+the\s+battlefield(?:\s+under\s+its\s+owner['’]s\s+control)?\b/i.test(
      raw.trim(),
    );
  }
  ```

  This regex is anchored at `^` but has **no `$` anchor**, and the
  `(?:...control)?` group is optional. Anything appearing after "battlefield"
  (or after "...control") in the same clause — including a genuine delay
  clause such as "at the beginning of the next end step" — is silently
  ignored by the match. The caller, `guidedTemporaryReturnPrompt`
  (`compile.ts:431-459`), only calls this predicate plus
  `isTemporaryReturnExileClause` on the exile clause; neither function
  inspects the return clause for delay language.

- **Reproduction** (ran directly against the actual compiler on the
  uncommitted tree, not against the brief's claims):

  Input oracle text:
  `"Exile target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step."`

  `compileAbilityIR` output:

  ```json
  {
    "decision": "guided",
    "prompts": [{
      "atom": "effect.exile",
      "kind": "target",
      "linkedExile": { "purpose": "temporary-return" },
      "raw": "Exile target creature then Return that card to the battlefield under its owner's control at the beginning of the next end step."
    }]
  }
  ```

  This is `decision: 'guided'` with a `temporary-return` linked-exile prompt
  — i.e., exactly the same-resolution leaf. Following the guided path (as the
  new `src/store/__tests__/cr400LinkedExileSubstrate.test.ts` Thassa test
  does) would exile the target and **immediately return it in the same
  `moveCard` dispatch**, silently discarding the "next end step" delay. This
  is a rules violation for the real card pattern this text represents (e.g.
  the "exile ... return it at the beginning of the next end step" family) —
  it plays as if the delay clause were never printed, and does so silently
  (no warning, no `manual` fallback), which is worse than doing nothing
  because it produces confidently wrong game state.

- **Contrast — correctly excluded patterns** (same probe session):
  - Multi-card variant ("Exile up to two target creatures, then return
    those cards...") → correctly falls back to `decision: 'manual'`
    (`targetMatches.length === 1` check in `isTemporaryReturnExileClause`
    rejects it, `compile.ts:475-482`).
  - Non-battlefield return ("...then return that card to its owner's
    hand.") → correctly `decision: 'manual'` (`isSameResolutionBattlefieldReturn`
    requires "to the battlefield" as prefix, which this text lacks).
  - Skyclave-style separate leaves-the-battlefield linked ability (no
    `effect.return` clause in the same ability at all) → correctly does not
    reach `guidedTemporaryReturnPrompt` (no `effect.return` found after the
    exile effect, `compile.ts:433-439`), stays a plain `effect.exile` guided
    prompt with no `linkedExile` field, not the leaf under audit.

  So the false-positive is narrowly scoped to the "delayed-return" exclusion
  specifically, not a wider break — but it is exactly the boundary the brief
  and §34.21 called out by name as needing to stay `manual`.

- **CR / design-doc reference**: `docs/engine-spec.md:2495-2496` ("本スライスのスコープ確定" — "real delayed scheduling requires new scheduling infra... out of scope"),
  `docs/engine-spec.md §34.21` point 4 (temporary-return same-resolution
  only), CR 603.10a / 608.2h (delayed return needs a due trigger point, not
  immediate resolution).

- **Suggested minimal fix direction** (not applied — audit is findings-only):
  reject the return clause (force `manual`) if it contains delay language
  matching the same `/\bthe next\b[^.]*\b(?:turn|end step|upkeep)\b/i`
  pattern already used by `classifyAbilityShape` in
  `src/engine/grammar/index.ts:194`, or equivalently require the full clause
  to end at the battlefield/control phrase with a proper `$`/sentence
  boundary and treat any trailing timing clause as disqualifying.

---

## Adversarial checks that HELD (no defect found)

1. **Command-surface discipline (pillar 2)**: `git diff src/engine/commands.ts`
   confirms `GameCommand`'s `moveCard` variant gained only
   `linkedExileWrite?: LinkedExileWrite` (`commands.ts:63`). No new union
   member was added — `GameCommand` still has exactly the same variant count
   plus the same optional-field pattern used for `sbaApplied`/
   `replacementApplied`/`simultaneousGroupId`. Confirmed by reading the full
   union (`commands.ts:53-` through its end) and grepping for new `type:`
   literals in the diff — the only additions are internal helper calls
   (`applyMoveCardCommand`), not command variants.

2. **Record-write correctness**: `writeLinkedExileRecordFromEvent`
   (`commands.ts:857-887`) requires `event.toZone === 'exile'`, `event.after`,
   `event.newObjectId`, and `currentCardMatchesObject(...)` (physical id +
   objectId match against the just-moved card) before writing anything;
   otherwise it pushes a warning and returns `null` without touching
   `state.linkedExiles`. Verified directly: dispatching `moveCard` to
   `'graveyard'` with a `linkedExileWrite` payload set (caller-error
   scenario) produces `state.linkedExiles === {}` and a warning message, not
   a bogus record.

3. **exiled-with-source identity guard**: `consumeLinkedExileForSource`
   (`commands.ts:3423-3445`) requires **both**
   `source.id === record.sourcePhysicalId` **and**
   `objectIdOf(source) === record.sourceObjectId`. Verified via the
   implementer's own test (`cr400LinkedExileSubstrate.test.ts:100-112`, and
   the store-level equivalent) that moving the source physical card to a new
   zone (which bumps `zoneChangeCounter`, changing `objectIdOf`) and then
   attempting to consume by physical id alone is rejected with a warning
   containing "source object", and the record survives (`toBeDefined()`).

4. **Same-resolution return atomicity**: the exile-write and the
   temporary-return move happen inside one `applyMoveCardCommand` call,
   sourced from the same `zoneChangeEvent` returned by the single
   `moveCardInternal` invocation that performed the exile
   (`commands.ts:928-944`). `stabilizeBeforePriority` (which runs
   `performStateBasedActionsOnce` in a loop) is called exactly once, at the
   very end of `applyCommand` (`commands.ts:3733`), **after** the switch
   statement returns — confirmed by reading `applyCommand` end-to-end
   (`commands.ts:3446-3736`). This means no SBA pass can run between the
   exile-write and the return-move within a single `moveCard` dispatch;
   they are non-interruptible with respect to this engine's SBA scheduling.
   (Whether a *future* refactor moves SBA checks mid-command is a structural
   risk to watch, not a current defect.)

5. **No blind physical-id move**: `returnTemporaryLinkedExileInDraft`
   (`commands.ts:889-919`) re-checks `currentCardMatchesObject(draft,
   physicalCardId, 'exile', exiledObjectId)` immediately before calling
   `moveCardInternal(... 'battlefield' ...)`. The implementer's own test
   (`cr400LinkedExileSubstrate.test.ts:138-163`) constructs exactly the
   adversarial case (card manually moved to graveyard before the return
   step executes) and confirms: warning pushed containing "現在の追放オブジェクト"
   ("not the current exile object"), record deleted, and — critically —
   `noOp.state.cards.c2.zone` stays `'graveyard'` (not moved). No blind move
   occurs.

6. **Snapshot forward-compat**: `initGame` sets `linkedExiles: {}`
   (`src/engine/init.ts:112`). `normalizeSnapshotState` in
   `src/store/gameStore.ts` backfills via `normalizeLinkedExiles`, which
   returns `{}` for missing/non-record input and drops individual malformed
   records rather than throwing (`gameStore.ts:343-379`). `makeDraft` in
   commands.ts shallow-clones with `linkedExiles: { ...(state.linkedExiles ??
   {}) }` (`commands.ts:265`). Verified directly with a probe: calling
   `applyCommand` twice against the same input `state` object left
   `state.linkedExiles` reference-equal (`toBe`) to its original value both
   times — the input was never mutated.

7. **Compiler leaf scope discipline (partial pass, see BLOCKER above)**:
   multi-card, non-battlefield-return, and Skyclave-style
   exiled-with-source patterns are all correctly excluded and fall back to
   `manual` or a plain (non-linked) `effect.exile` prompt. Only the
   delayed-return exclusion is broken.

8. **Regression check (priority.test.ts)**: `git diff
   src/engine/__tests__/priority.test.ts` is a single-line addition,
   `linkedExiles: {},`, inside `stateWithPendingTriggers`'s returned
   synthetic `GameState` object. No assertions in that file were touched.
   Confirmed by reading the diff in full context — it is exactly the claimed
   trivial fixture update.

---

## Required machine checks (run directly by this audit, not trusted from implementer)

| Check | Result |
| --- | --- |
| `npm run lint` | **PASS** (no output, exit 0) |
| `npx tsc --noEmit` | **PASS** (no output, exit 0) |
| `npx vitest run` | **PASS** — 138 files, **1266 tests**, 0 failures |
| `npm run build` | **PASS** — `tsc -b && vite build` succeeded, `dist/` produced and removed after |

## Residual notes (not blockers)

- The `linkId` generation in the compiler leaf
  (`linkedExileLinkId`, `compile.ts:1120-1126`) hashes `prompt.raw` with a
  simple 31-multiplier rolling hash for collision avoidance across
  same-source/same-slot repeats. Not adversarially probed for collisions in
  this audit; low risk given it's combined with `sourceObjectId`, line index,
  slotId, and `cardId`, but worth a note if a future slice reuses this
  pattern for higher-cardinality linkId generation.
- `judgment point A` (linkId generation source = effect-instance bound) and
  `judgment point C` (no record GC) are followed as specified; not
  separately re-litigated here since they were not in the adversarial
  question list.
- The BLOCKER above is narrow: it only affects same-clause "exile ... return
  ... at the beginning of the next end step / next turn / next upkeep"
  phrasing reaching the guided leaf. It does not affect any currently
  review-green behavior, and no existing `review.*` test exercises this
  exact phrasing (none was found under `src/**/review.*` referencing "next
  end step" combined with exile/return in this repo).
