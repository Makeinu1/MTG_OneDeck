# OneDeck R6 UX Constitution & Core Interaction Specification

Updated: 2026-09-16
Status: R6 design baseline. No R4b Gate/Correction implementation and no R5 Trigger Memory implementation are included here.
Base: `3465e00cfb2c1bc76c22fc05b624b8a746b4061d`

## 0. Authority and scope

This document defines the R6 interaction direction above screen-level layout decisions and below the product WHY/WHAT.

Priority when designs conflict:

1. `docs/product-requirements.md`
2. active engine/UI contracts under `docs/contracts/`
3. frozen R2/R3/R4 semantics already implemented
4. this R6 interaction specification
5. current component/layout convenience

R6 must not create a second game-state machine or silently redesign R4b/R5. It translates the existing Stack, Resolution, Context/Cause, Formal Action, Correction and Trigger Memory semantics into a coherent human interaction model.

---

## 1. Product experience goal

OneDeck should feel like:

> **Magicをしていたら、OneDeckが自然についてくる。**

The player concentrates on cards, board state, conversation and decisions. OneDeck carries the bookkeeping that software is good at:

- what process is currently in progress,
- Stack ordering and response relations,
- explicit targets,
- why a mutation belongs to the current process,
- pending triggers / later obligations,
- operation authority,
- persistence / reconnect state.

OneDeck does **not** generally decide how a card effect should be resolved.

The main cognitive split is:

### Keep with humans

- what to cast,
- what to target,
- what optional choice to make,
- how to interpret and execute unusual card text,
- table negotiation and communication.

### Offload to OneDeck

- “what was I doing?”,
- “what is on the Stack?”,
- “what targets what?”,
- “did a trigger occur?”,
- “whose response are we waiting for?”,
- “was that operation saved?”,
- “where do we resume after reconnect?”.

**OneDeck externalizes memory, causality and synchronization, not strategic judgment.**

---

## 2. Social-play assumption

OneDeck primarily serves cooperative players communicating over voice or equivalent real-time conversation.

Therefore:

> **Conversation beats workflow.**

If a card says an opponent chooses something and the relevant objects are public, a short table conversation is normally sufficient.

Example, Emergent Ultimatum:

```text
P1: どれ戻す？
P2: B。
P1: 了解。
```

P1 then applies the chosen result in OneDeck. R6 should not introduce a general remote-decision workflow solely to encode this conversation.

This is intentional scope control, not missing automation.

### Human trust / software safety

Players' Magic judgments are trusted. Software boundaries are not.

OneDeck must still prevent or recover from:

- stale interaction contexts,
- duplicate commits,
- wrong Resolution identity,
- unauthorized mutation,
- private-information leakage,
- lost-response ambiguity,
- reconnect ambiguity.

**Trust humans; make system boundaries strict.**

---

## 3. Optimization target

R6 does not optimize for the maximum number of card-specific interfaces.

It optimizes the loop repeated many times per game:

```text
唱える
  ↓
対象を選ぶ（必要な場合）
  ↓
Stack / 応答
  ↓
解決へ
  ↓
盤面を使って処理
  ↓
誘発を覚える
  ↓
処理完了
```

A useful design question is:

> **How many times per game does this improvement pay for itself?**

Rare card-specific procedures should normally be absorbed by Manual Resolution + generic world operations + conversation.

---

## 4. Core interaction loop

```text
             NORMAL
                │
          Magic World
                │
             唱える
                ▼
        ┌──────────────┐
        │    STACK     │
        │   RESPONSE   │
        └──────┬───────┘
               │
            解決へ
               ▼
       ┌────────────────┐
       │   RESOLUTION   │
       │                │
       │  Magic World   │
       │       +        │
       │ Current Work   │
       └───────┬────────┘
               │
            処理完了
               ▼
          stabilization
               │
       ┌───────┼────────┐
       ▼       ▼        ▼
    Trigger   Stack    Normal
```

This loop is OneDeck's interaction “breathing”. R6 should reduce friction inside it rather than add a wizard around it.

---

# 5. UX Constitution

## Article 1 — Magic First

Players play Magic, not OneDeck.

With mastery, users should spend **more** attention on the Magic world and **less** attention on application chrome.

## Article 2 — World is the Workspace

The primary workspace is the Magic world:

- Battlefield
- Hand
- Library
- Graveyard
- Exile
- Stack
- Players
- relevant game objects

Effects should not normally move the user into a separate form-based “effect executor”.

## Article 3 — Projection, not Replacement

Sheets, panels, viewers and popovers are allowed, but they must be projections of Magic-world objects for a specific task, not a second copy of the game.

Examples:

- private library viewer,
- multi-select surface,
- target picker,
- ordering surface,
- finite permanent-entry setup.

## Article 4 — View ≠ Work

What the user is looking at is independent from what game process is still in progress.

A legal state is:

```text
Current Work: 《成長のらせん》を解決中
View: 墓地
```

Opening a graveyard, library, Stack view or card detail must not implicitly leave or finish Resolution.

## Article 5 — Continuity Before Guidance

OneDeck's first job is not to say “do this next”.

Its first job is to ensure:

> **the player never loses what they are currently in the middle of.**

## Article 6 — Current Work Never Disappears

If work is in progress, its identity remains reachable and visible across all views.

Example:

```text
《成長のらせん》解決中
[処理に戻る]
```

The anchor may be compact; it must not vanish.

## Article 7 — Boundary, not Micro-step

The strongest calls to action are lifecycle boundaries:

- `唱える`
- `起動する`
- `解決へ`
- `処理完了`
- `誘発を確認`

General card text must not be translated into an app-generated `Step 1 / Step 2 / Step 3` workflow.

## Article 8 — Manual Resolution is Normal

Manual Resolution is the standard effect-resolution model, not merely an unsupported-card fallback.

Card text describes the current work. It is not generally rendered as a completion checklist.

Example:

```text
解決中 — 《成長のらせん》

Draw a card.
You may put a land card from your hand onto the battlefield.

🔔 1

[処理完了]
```

The player reads the card and manipulates the Magic world.

## Article 9 — Context is a Semantic Lens

Context does more than allow/deny mutation. It changes the natural meaning shown to the user.

For the same geometric movement `hand land -> battlefield`:

```text
Normal      → 土地をプレイ
Resolution  → 戦場に出す
Correction  → 盤面を訂正
```

Users should not need to understand internal Cause/Context types.

## Article 10 — Semantic Before Geometry

When OneDeck knows the Magic meaning, present that meaning:

- 唱える
- 土地をプレイ
- 引く
- 捨てる
- 破壊する
- 生け贄に捧げる
- 切削する
- 追放する
- 手札に戻す

Do not collapse all of these into generic `move`.

When meaning is unknown, fall back honestly to finite Manual operations rather than inventing semantics.

## Article 11 — Direct Manipulation

Frequent operations should start from the Magic-world object itself:

```text
Card / Zone / Player
→ semantic action
```

or

```text
Object
→ drag
→ meaningful destination
```

## Article 12 — Spatial Causality

Important Magic relationships should be visible spatially whenever practical.

In particular:

- spell / ability → target,
- Stack ordering,
- combat relationships,
- attachment relationships.

This adopts the useful interaction lesson from MTG Arena: abstract rules relationships are easier to understand when projected back onto the play space.

## Article 13 — Stable Visual Grammar

Use a stable visual vocabulary:

```text
Glow                → actionable candidate
Outline             → focus / selection
Arrow               → explicit target / relation
Stack overlap       → Stack ordering
Current Work Anchor → continuing work
Badge               → remembered later work
Motion              → lifecycle transition
```

The same visual cue must not mean unrelated things on different screens.

## Article 14 — Focus Over Clutter

Do not draw every possible relation at all times.

Show strongly what the current interaction or focused object needs. Use hover/focus/selection to reveal additional causality.

## Article 15 — Unknown ≠ Invalid

OneDeck is not a complete rules engine.

Therefore “OneDeck cannot prove this is legal” must not automatically render as “cannot select”.

Where relevant, distinguish conceptually:

- known candidate,
- unknown / manual candidate,
- known impossible.

## Article 16 — Trigger is Memory Before Interruption

During active Resolution, newly detected triggers are remembered quietly.

Example:

```text
🔔 2
```

They do not steal Current Work through a popup, modal or automatic Feed transition.

After the current process reaches the appropriate boundary, ready triggers may become foreground work.

## Article 17 — Single Operator Principle

A Resolution has one **Resolution Operator** who normally performs OneDeck operations from `resolve.begin` until `処理完了`.

If the card text requires another player's public decision, the players communicate verbally and the Resolution Operator applies the result.

This keeps the interaction model close to paper Magic and avoids general distributed decision workflows.

## Article 18 — Private Information Exception

Single Operator does not bypass private-information authority.

If another player must make a choice using information the Resolution Operator is not allowed to see, that player supplies only the minimum private input required.

Example:

```text
P1の効果: P2が手札を3枚捨てる
Resolution Operator: P1
Private Input: P2が自分の手札から3枚選ぶ
```

This is a private-input exception, not transfer of Current Work ownership.

## Article 19 — Conversation Beats Workflow

Public card-specific decisions normally remain social interaction.

Do not build a generic “decision actor” state machine merely because some cards say “an opponent chooses”.

## Article 20 — Nested Formal Actions Preserve Parent Work

A Resolution may start a new Formal Action.

Example: Emergent Ultimatum A allows B and C to be cast during A's resolution.

After B/C are cast:

```text
Current Work = Resolution A
Stack = [C, B, ...]
```

The new Stack entries do not replace A as Current Work.

## Article 21 — Stack Growth ≠ Work Switch

`Stack top` and `Current Resolution` are distinct concepts and must remain visually distinct.

Stack entries created while a parent Resolution is active are waiting for that current process to finish; R6 derives this presentation from canonical state rather than creating a second persisted mode.

## Article 22 — Return to Parent Work

After a nested Cast/Activate completes, return the user to the parent Resolution context.

Use semantic navigation such as:

```text
[《出現の根本原理》の処理に戻る]
```

Do not leave the user stranded in a Stack/detail view.

## Article 23 — Assistance ≠ Prescription

Reusable assistance is desirable:

- multi-select,
- select-all then manually exclude,
- draw N,
- mill N,
- order objects,
- library projection,
- finite entry-state setup.

Assistance shortens manipulation. It must not pretend to be a general rules judgment about what the user ought to do.

## Article 24 — Quiet Routine, Loud Danger

Notifications are divided into:

### Ambient

No immediate response required.

```text
🔔 2
保存済み
```

### Boundary

A new game-level decision is now required.

```text
P2の応答待ち
誘発を確認
```

### Safety

Continuing would risk incorrect shared state.

```text
この操作を始めた処理は既に終了しています
操作結果を確認できません
```

Routine gameplay should avoid modal interruption. Safety may demand it.

## Article 25 — Honest System

Do not claim to know what OneDeck has not established.

Avoid:

```text
効果を正しく処理しました
```

Prefer:

```text
処理完了が選択されました
```

The human declares that effect work is complete; OneDeck then owns lifecycle finalization.

---

# 6. Core interaction grammar

## Click / tap

Default:

```text
Inspect / Focus
```

It should not mutate shared state.

## Explicit selection state

During a visible target/selection task:

```text
Click / Tap → Select
```

The UI must make the mode obvious:

```text
対象を選択中
0 / 1
[キャンセル]
```

## Semantic Action

The normal explicit route for shared-state mutation.

## Drag

A shortcut to the same semantic operation. Context is captured at gesture start and stale gestures fail closed rather than rebinding to a new process.

## Double click

Must not be required for shared-state mutation.

---

# 7. Target interaction and Stack visual language

Target selection remains on the Magic world.

```text
対象を選択
0 / 1
```

Selecting a creature immediately projects the relation:

```text
《Doom Blade》 ─────────→ 《Creature A》
```

The relation remains understandable after the spell is on the Stack.

## Stack as shared conversation

Stack should read as:

```text
P1 Growth Spiral

P2
└ Counterspell → Growth Spiral

P1
└ Negate → Counterspell
```

rather than only a numbered business-style list.

Compact visual form:

```text
┌──────── Negate ────────┐
└────────────────────────┘
            ↓
┌────── Counterspell ─────┐
└─────────────────────────┘
            ↓
┌────── Growth Spiral ─────┐
└──────────────────────────┘
```

Stack overlap communicates ordering; arrows communicate explicit relationships.

---

# 8. Generic semantic world operations

Before card-specific workflows, invest in a small set of excellent reusable operations:

- draw,
- discard,
- sacrifice,
- destroy,
- exile,
- return to hand,
- battlefield entry,
- mill,
- tap / untap,
- life +/- N,
- counter +/- N,
- move,
- shuffle,
- single / multi-select,
- private-zone browsing.

These primitives allow complex Manual Resolution without card-specific UI.

---

# 9. Representative studies

## 9.1 Growth Spiral — simple golden path

```text
P1 selects Growth Spiral
→ [唱える]
→ Hand to Stack
→ response
→ [解決へ]

Current Work: Growth Spiral

P1 opens/uses Library → draw
P1 selects a Land in Hand → [戦場に出す]
OneDeck remembers resulting triggers: 🔔1
P1 may browse another zone
Current Work remains visible
P1 → [処理完了]

Growth Spiral lifecycle finishes
Ready trigger becomes foreground
```

No Growth-Spiral-specific effect wizard is needed.

## 9.2 Single-target destruction

```text
Prepare cast
→ select target on Battlefield
→ target arrow appears
→ cast
→ Stack keeps target relation
→ Resolution
→ target permanent [破壊する]
→ [処理完了]
```

## 9.3 Board wipe

Do not make the user destroy eight permanents one-by-one if reusable multi-select can help.

```text
Resolution
→ multi-select creatures
→ select all as convenience
→ human removes exceptions if needed
→ [破壊する]
→ [処理完了]
```

Candidate assistance is allowed; a general rules engine deciding exactly what survives is not required.

## 9.4 Scry / private library manipulation

Core R6 may present:

```text
解決中 — 《Card》
Scry 2.
[処理完了]
```

The user manipulates an authorized library projection. A card-specific Scry wizard is not required for Core R6.

## 9.5 Mill

Use a reusable semantic operation where available:

```text
対象: P2
Library → [上から3枚を墓地へ / 切削]
```

Meaning should remain `mill` when OneDeck knows it, not merely `move`.

## 9.6 Emergent Ultimatum — complex stress path

Emergent Ultimatum validates the architecture because it combines:

- private library browsing,
- multi-select,
- exile,
- another player's public choice,
- shuffle,
- casting from an unusual zone,
- casting without normal mana cost,
- nested Stack growth,
- exceptional self-destination.

Expected interaction:

```text
A = Emergent Ultimatum

[解決へ]
Current Work = Resolution A

P1 opens own Library
→ chooses up to three cards
→ [追放]

P1: どれ戻す？
P2: B
P1 moves B to Library
→ shuffle

P1 selects C in Exile
→ [この効果で唱える]
→ normal Cast preparation reused if targets/modes are needed
→ C enters Stack

P1 selects D
→ [この効果で唱える]
→ D enters Stack

Current Work is still Resolution A.
Stack may now be [D, C, ...].

P1 completes A using the appropriate lifecycle finish/destination
→ [処理完了]

Only after A finishes does normal Stack/Response continue with D/C.
```

No Emergent-Ultimatum-specific wizard and no remote opponent-choice workflow are required.

This scenario is a key R6 invariant:

> **Stack may grow while Current Work remains the parent Resolution.**

---

# 10. Single-operator behavior

For public information, the Resolution Operator normally performs the mutations even when another player supplied the decision verbally.

Example:

```text
P1's effect destroys one of P2's permanents.
P1: どれ？
P2: これ。
P1 performs [破壊する].
```

For private information, do not leak the zone simply to preserve single-operator purity.

Example:

```text
P1's effect requires P2 to discard three unknown cards.
P2 selects the three cards privately.
The Resolution remains P1's Current Work.
```

R6 should optimize for **one pen on the table**, with narrow private-input exceptions.

---

# 11. Current-work presentation

Current Work is not a giant mandatory panel.

Desktop example:

```text
解決中
《成長のらせん》

🔔 2
[処理完了]
```

Expanded form may show:

- effect text,
- controller,
- source snapshot,
- targets,
- paid costs,
- exceptional finish controls.

When browsing another view:

```text
《成長のらせん》解決中
[処理に戻る]
```

Mobile should use a compact persistent bottom/ribbon representation rather than shrinking the full desktop work panel.

---

# 12. Trigger presentation

During Resolution:

```text
🔔 2
```

means:

> OneDeck remembers these; continue the current work.

Do not automatically open Trigger Feed.

After the correct boundary:

```text
処理が必要な誘発 2件
[誘発を確認]
```

R6 displays trigger provenance supplied by R5. It does not infer causal explanations from Oracle text.

---

# 13. Meaningful motion

Animation is used only when it explains semantic state transition.

Useful cases:

```text
Hand → Stack
Stack item → Current Resolution emphasis
Resolution → normal destination
Trigger count increment
```

The purpose is orientation, not spectacle.

---

# 14. Current-main gap summary

As of base `3465e00c`, the existing Cockpit already has strong substrate, but R6 still has substantial presentation/interaction gaps.

### Existing strengths to preserve

- canonical `table.resolution`,
- exact entry-bound begin/end lifecycle,
- R4b strict mutation gate and Context/Cause substrate,
- gesture-start Context capture for drag,
- semantic Formal actions such as cast/playLand,
- existing StackBand and WorkPanel foundations,
- pending trigger substrate,
- semantic Manual Event / Correction separation,
- reconnect/stale-operation handling.

### Main R6 gaps

1. Current Work is distributed across panels rather than acting as a global interaction anchor.
2. `panel = zone | work | stack` still competes perceptually with canonical game progress.
3. Stack ordering exists, but target/response causality is not yet a coherent Arena-like spatial language.
4. Single-click, quick actions and double-click/keyboard behavior are not yet one clean interaction grammar.
5. Resolution still needs a clearer “world remains the workspace” presentation.
6. Trigger memory needs quiet during-Resolution presentation and boundary-time foregrounding.
7. Context-sensitive verbs are not yet consistently projected across the world.
8. Reusable multi-select / bulk semantic operations need further UX consolidation.
9. Parent Resolution vs nested Stack growth is semantically supported but not yet visually obvious.
10. Multiplayer mobile currently has explicit wide-screen limitations and needs its own responsive interaction treatment.

R6 should improve these without replacing the frozen engine semantics beneath them.

---

# 15. R6 implementation priority

## P0 — core loop polish

- persistent Current Work continuity,
- Stack / response readability,
- target spatial language,
- Boundary Actions (`唱える`, `解決へ`, `処理完了`),
- context-sensitive semantic actions,
- trigger ambient memory,
- nested Formal Action → return-to-parent behavior,
- single-operator Resolution presentation.

## P1 — reusable manipulation assistance

- multi-select,
- bulk semantic actions,
- private-zone projection,
- semantic return navigation,
- mobile Current Work treatment,
- saved / unknown / stale / reconnect feedback.

## P2 — reusable optional accelerators

- common ordering helpers,
- common entry-state setup,
- carefully scoped draw/mill shortcuts.

## Non-goal / default Manual

- card-specific effect wizards,
- general opponent-decision workflow,
- general Oracle parser,
- full legality engine,
- automatic effect-resolution checklist,
- a second canonical R6 context state machine.

---

# 16. R6 design review questions

Every R6 design change should answer:

1. Does this keep Magic judgment with players?
2. Does it reduce bookkeeping rather than replace gameplay?
3. Does Current Work survive browsing?
4. Does the Magic world remain the primary workspace?
5. Does the UI emphasize lifecycle boundaries rather than generated micro-steps?
6. Does the same visual grammar mean the same thing everywhere?
7. Is target/Stack causality visible spatially where useful?
8. Does Context produce a natural Magic verb?
9. Does the design preserve semantic meaning rather than infer it from geometry?
10. Does a Trigger remain peripheral until the correct boundary?
11. Does one Resolution keep one operator except for narrow private input?
12. Can public opponent choices remain a conversation instead of a workflow?
13. Can nested casts grow the Stack without stealing the parent Resolution?
14. Does the system avoid treating unknown legality as invalid?
15. Is unsupported behavior honestly shown as unsupported/manual?
16. Does reconnect reconstruct the experience from canonical state rather than local fiction?
17. Does the design still work at 375x812 without turning the board into chrome?
18. Does Growth Spiral feel natural?
19. Does Emergent Ultimatum work without card-specific UI?
20. Does this improvement pay off frequently enough to justify its complexity?

If either Golden Journey requires a card-specific state machine, re-audit the interaction model before adding one.
