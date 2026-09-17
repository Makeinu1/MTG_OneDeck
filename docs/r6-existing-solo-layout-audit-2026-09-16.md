# OneDeck R6 Existing Solo Layout Audit

Updated: 2026-09-16
Status: R6 design input. This document audits the existing one-player/local table layout and identifies what R6 should preserve, repair, and remove. It does not authorize implementation changes by itself.

## 1. Purpose

R6 should not redesign the table from a blank canvas. The existing solo/local layout already contains several strong paper-table spatial ideas, density-management techniques, and direct-manipulation patterns. The goal is to preserve those strengths while removing interaction patterns that conflict with the R6 v6.1 product thesis:

> Reconstruct the shared paper Magic table with a digital Magic World + voice, and digitize only the interaction capabilities lost by remote play.

The audit therefore asks:

1. What already feels like a Magic table rather than application chrome?
2. What helps the player orient spatially without reading UI instructions?
3. What safely scales when the battlefield/hand becomes large?
4. What currently competes with the Magic World for attention?
5. What incorrectly conflates View, Current Work, progression, Trigger memory, or mutation shortcuts?

---

# 2. Existing solo composition — conceptual map

The current local table is approximately organized as:

```text
          opponent identity / far-side public board

                   FAR SIDE
              opponent permanents

   -------------------------------------------------

                 HOME BATTLEFIELD
            creatures / visible relations

         lands / support / commander region

                    HAND
          library / graveyard / exile cluster

        turn / phase / mana / life / trigger

             undo  PRIMARY  next  tools
```

Additional surfaces appear around this table:

- StackBand,
- WorkPanel,
- zone viewers/search,
- hand workspace,
- CardActionSheet/context menu,
- Feed,
- Scry/Surveil/search/selection modals.

The core spatial idea is strong: own hand is near the player, battlefield is central, opponent/public state sits on the far side, and secondary zones live near the hand rather than replacing the table.

---

# 3. PRESERVE — strong existing layout ideas

## 3.1 Board-first spatial composition

The central battlefield is structurally dominant. `CockpitTableSurface` renders the own board as a dedicated central `Board`, opponent/public battlefields on the far side, a lower support row, and hand near the player. This resembles a physical Magic table more closely than a dashboard/list layout.

**R6 principle extracted:**

> Preserve the near-side / battlefield / far-side spatial metaphor. R6 orientation chrome must wrap the table, not replace it.

Do not turn R6 into a three-column work application simply because Current Work / Stack / Trigger need clearer semantics.

## 3.2 Physical zone locality

`HandRibbon` spatially groups Hand with Library, Graveyard and Exile. Library is an actual table object with draw interaction rather than only a menu item. This is a strong translation of physical Magic into digital space.

**Preserve:**

- Library remains a visible Magic object/zone.
- Graveyard/Exile remain spatially reachable from the hand/table.
- Zone browsing expands a physical zone rather than making zones disappear into navigation menus.

## 3.3 Battlefield categorization without abandoning physicality

The existing battlefield separates creature-like board presence from lands/support/commander while keeping them all spatially on the table. `Board` and `SupportRow` avoid a single unstructured card wall.

This is useful because paper players also naturally organize lands, creatures, commanders, equipment/enchantments, and tokens into recognizable table regions.

**Preserve:** semantic spatial grouping is good when it follows common paper-table organization and does not pretend to enforce rules.

## 3.4 Adaptive density is excellent substrate

The current layout already handles large states rather than assuming a clean demo board:

- responsive card sizing,
- multiple rows,
- dense-overview fallback,
- token bundling,
- land bundling,
- attachment clustering,
- large-hand collapse/workspace,
- searchable/paginated zone views.

The tests explicitly cover 100 permanents and 100 hand cards while keeping every object reachable. That is valuable engineering and should not be thrown away for a visually cleaner but fragile redesign.

**R6 invariant:**

> Any redesigned shell must retain reachability under pathological real Magic states.

A beautiful six-card mockup that collapses at 30 permanents is a regression.

## 3.5 Token/land bundling is cognitively appropriate

Visual token bundling and land grouping reduce screen consumption without deleting the underlying objects. Expansion remains available.

This matches R6's principle of projection rather than replacement: the bundle is a presentation projection, not new game state.

**Preserve:** bundle identical/compatible visible objects where the user can expand to physical identities.

## 3.6 Attachments remain physically associated with hosts

Attachments are rendered beside/under their host via attachment clusters, and become loose cards again when detached. This is a good example of spatial causality embedded in the Magic World rather than described by a side list.

**R6 implication:** attachment relation should remain spatial, but should use non-target association styling rather than Target Arrow semantics.

## 3.7 Hand identity survives browsing and work surfaces

Existing tests deliberately ensure that opening another opponent, WorkPanel, zone search, or hand workspace does not replace the local hand instance unnecessarily. Draft work can survive board peeking without committing hidden work.

This aligns strongly with:

- View != Work,
- Continuation Before Guidance,
- Projection not Replacement.

**Preserve:** opening a projection should not reconstruct the whole table or destroy the user's spatial memory.

## 3.8 Board peek during modal/local draft is a strong pattern

Several task surfaces allow the board to remain visible while the draft stays local and protected. That is much better than modal workflows that make the Magic World disappear.

**Generalize:** Assistance Surfaces should increasingly behave like transparent task overlays/projections that let users consult the table without losing draft identity.

## 3.9 StackBand is already spatial rather than purely textual

StackBand uses overlapping cards, compact/expanded states, board peek, target chips and target arrows. This is closer to paper/Arena spatial causality than a generic activity log.

**Preserve and extend** rather than replacing StackBand with a conventional sidebar list.

## 3.10 Quiet local interactions already exist in places

Examples include hover/focus detail, collapsed commander metadata, expandable attachment/token bundles, and compact zones. These show that the current design can support progressive disclosure instead of always-visible controls.

R6 should apply this discipline more consistently.

---

# 4. REPAIR — strong substrate with wrong interaction hierarchy

## 4.1 The giant Primary Action is over-authoritative

The current solo footer has a large central `primary-action` whose meaning changes among:

- 処理,
- 誘発,
- 解決,
- 戦闘,
- 開始,
- 次へ.

`runPrimaryAction()` arbitrates Resolution, Trigger, Stack, Combat and phase progression.

This was useful while making the app navigable, but it conflicts with v6.1:

> The table should be understandable first; the next button should appear only where a lifecycle boundary actually needs explicit commitment.

Problems:

1. It teaches the user to look at application chrome rather than the Magic World.
2. Different semantic boundaries are collapsed into one changing button.
3. Trigger memory becomes progression work rather than peripheral memory.
4. Stack resolution and phase advancement visually become peers even though their table meaning differs.
5. The button can become the user's mental model of the game instead of the board.

**Repair:** keep explicit boundary controls, but project them next to the relevant work/orientation instead of one global omnipotent button.

## 4.2 Trigger handling currently behaves like a gate

Current `advancePhase()` and `resolveTop()` first check `triggersReady` and open Feed instead of progressing. The primary button can become `誘発`.

This directly contradicts the agreed v6 principle:

> Ready Trigger is ambient memory, not a progress gate.

**Repair:** preserve the bell/count/Feed, remove Trigger from normal progression arbitration at the UI-design level. Trigger information should be noticeable but not automatically steal foreground.

## 4.3 `panel = zone | work | stack` conflates View and Work

The current local UI stores one mutually exclusive `panel` value. Opening a zone, Work, or Stack changes this local panel state.

That is convenient implementation state, but perceptually it encourages:

```text
I am looking at the graveyard
=> therefore I left Work
```

or

```text
Stack view and Work view are alternative application screens
```

R6 explicitly says these axes are independent.

**Repair:** retain existing components but change the shell semantics:

- Current Work remains persistent regardless of browse surface.
- Stack remains visible/available independently of a zone projection where practical.
- browse views are projections layered over the table, not navigation destinations that own game progress.

Do not necessarily rewrite component internals first; fix the presentation hierarchy.

## 4.4 The status band contains too many manipulators for an orientation strip

The solo status band combines:

- turn,
- current phase,
- phase timeline,
- mana total,
- six color-specific +/- controls,
- life +/- controls,
- Trigger Feed.

This mixes **orientation** with **manual mutation controls**.

Turn/phase/life/mana totals are useful orientation. Six mana steppers and hover life mutation are tools.

**Repair:** Orientation should answer “where is the table now?” at a glance. Detailed adjustment tools should be nearby but secondary/progressive.

Suggested hierarchy:

```text
Turn / phase     life     mana total     🔔
```

with detailed mana/life/manual adjustment opened deliberately.

## 4.5 Double-click quick mutation is inconsistent with R6 interaction grammar

`handleCardDoubleClick` routes to `quick()`, which may generate mana, activate an ability, toggle tap, play a land, or cast depending on the card/state.

This is fast for an expert solo user but semantically dangerous:

- the same gesture has many meanings,
- it is difficult to discover,
- it is poor on touch,
- it can mutate where single click is meant to Inspect/Focus,
- it competes with the explicit semantic action model.

**Repair:** keep speed through action sheets, context menu, drag, keyboard, or visible quick affordances that all converge on the same semantic operation. Double-click may remain an optional accelerator only if it is never the privileged/required mutation path and its meaning is sufficiently stable.

## 4.6 Generic D&D remains too geometrically permissive

The drag handler correctly special-cases Cast and `playLand`, but otherwise falls back to generic `move` between zones.

This is useful for sandbox/manual play, but R6 now distinguishes semantic operations strongly.

**Repair:** keep D&D because physical manipulation is one of the strongest parts of the table. But D&D should increasingly resolve to the context-appropriate semantic action when known, and make generic Manual movement clearly secondary when meaning is unknown.

Do not remove drag in favor of menus; repair the semantic interpretation behind drag.

## 4.7 The generic “操作” WorkPanel is too toolbox-like

Current selection/manual tools expose many powerful operations in a generic toolbox. This gives reachability but creates the feel of an admin/debug console rather than manipulating a Magic table.

**Repair:** preserve every safe operation, but surface frequent semantic actions from their natural Magic objects first. Keep the generic toolbox as an escape hatch/deeper layer.

This is where CardActionSheet should absorb much of the everyday interaction vocabulary.

## 4.8 Current Work is not yet a global spatial anchor

Resolution exists canonically, but the UI currently asks users to open Work or press the global primary button to return to it.

This is weaker than the paper-table equivalent of leaving the resolving card visibly on the table.

**Repair:** add a compact persistent Continuation anchor. It should survive:

- graveyard browse,
- library browse,
- card inspection,
- Stack expansion,
- hand workspace,
- nested formal action.

The existing board-peek/draft-preservation work proves the application can preserve state while changing view; R6 should expose that continuity visually.

## 4.9 Solo opponent representation is useful but semantically odd

The solo screen renders a “仮想の対戦相手” and far-side board. Spatially, this is useful because it gives the table a true near/far orientation and prepares the same geometry for multiplayer.

However, the word “virtual opponent” can imply simulated agency when the product is actually a one-person/manual table.

**Repair:** preserve far-side seat/board geometry, but consider presentation that communicates “other seat / opponent side” rather than pretending OneDeck is playing an AI opponent.

## 4.10 Decorative ambient layers must remain subordinate

The table uses `TabletopSurface`, `AmbientBackdrop`, `DanceFloorLights`, playmat textures, gradients and motion. These can make the table feel physical and pleasant.

But R6 should treat decoration as conditional polish. It must never reduce card readability, target/selection clarity, persistence feedback, or dense-board usability.

**Repair invariant:** semantic overlays always outrank decorative animation/lighting.

---

# 5. REMOVE OR DEMOTE — patterns inconsistent with v6.1

## 5.1 Trigger-as-next-step arbitration

Remove from the R6 target interaction model. Trigger remains visible memory and inspectable Feed, not a mandatory “next task”.

## 5.2 A single omnipotent Primary Action mental model

Demote. Explicit boundaries still exist, but no universal button should become the primary way to understand Magic progression.

## 5.3 Work/Stack/Zone as mutually exclusive meanings

Demote as a user-facing concept. These can remain implementation containers temporarily, but UX must make View / Foreground / Continuation independent.

## 5.4 Geometry-first everyday menus

Demote generic `move to zone` from common interaction surfaces when a semantic verb is known.

## 5.5 Hidden mutation shortcuts as core interaction

Double-click/implicit quick mutation must not be part of the required interaction language.

---

# 6. Existing solo layout mapped to R6 UI hierarchy

The current layout can evolve without abandoning its spatial skeleton.

## 6.1 Magic World — PRESERVE

Use the existing near/far table:

```text
far side: opposing seat/public battlefield
center:   own battlefield
lower:    lands/support/commander
near:     hand + library/graveyard/exile
```

This should remain the dominant screen area.

## 6.2 Orientation — REPAIR

Convert the status/footer chrome into a compact orientation layer:

```text
Turn / Phase      Life      Mana total      🔔
Foreground actor / HOLD state when relevant
```

Detailed manual adjustment belongs behind secondary interaction.

## 6.3 Conversation — EXTEND StackBand rather than replace it

StackBand becomes the primary visualization for:

- response ordering,
- current foreground Stack work,
- target arrows,
- suspended parent responses,
- HOLD actor/request indicators near the relevant conversation.

Do not create a separate full-screen “Response Mode”.

## 6.4 Continuation — ADD persistent anchor around existing Work semantics

Current Work becomes a compact horizontal/edge anchor such as:

```text
解決中 — 《Growth Spiral》      🔔1      [処理完了]
```

When browsing:

```text
墓地を閲覧中
継続: 《Growth Spiral》解決中   [処理へ戻る]
```

The existing WorkPanel remains useful as expanded detail/assistance, but the panel itself is no longer synonymous with whether Work exists.

## 6.5 Memory — preserve Feed, weaken its visual authority

Keep the existing bell/count and Feed lifecycle management. Trigger is not automatically part of primary progression.

## 6.6 Assistance — preserve powerful existing workspaces

Keep and normalize:

- hand workspace,
- zone search/list,
- battlefield overview,
- Scry/Surveil arrangement,
- library search,
- selection/bulk tools.

They should all clearly project from the table and preserve Current Work.

---

# 7. Visual-space strengths to make explicit R6 invariants

## Invariant A — the board owns the largest contiguous region

No persistent R6 panel should reduce the Magic World to a small center viewport.

## Invariant B — hand remains physically near the player

Hand is not a generic sidebar list. Even when collapsed or expanded, its spatial relation to the player's side should remain obvious.

## Invariant C — opponent/public state stays spatially opposite

Do not flatten all players into equivalent dashboard cards if the screen can preserve table orientation.

## Invariant D — dense states degrade by projection, not deletion

Bundle, resize, scroll, overview and search are acceptable. Hiding canonical objects with no recovery path is not.

## Invariant E — relation visualization happens on/around Magic objects

Targets, attachments, blockers and Stack relations should remain spatial wherever practical.

## Invariant F — projections preserve table identity

Opening a workspace/viewer should not reconstruct a separate visual copy of the game that loses the relationship to the underlying table.

---

# 8. Why the existing solo layout sometimes feels confusing

The central problem is not that there are too many features. It is that **several different concepts currently compete for the same UI hierarchy**.

The application asks the user to understand simultaneously:

- physical card layout,
- status band,
- a changing global primary button,
- Work panel,
- Stack panel,
- Feed,
- quick/double-click behavior,
- generic operation toolbox,
- semantic card actions.

This creates ambiguity about where the “real” game lives.

R6 should resolve that ambiguity by asserting:

1. **The Magic World is the game.**
2. **Orientation explains the table but rarely mutates it.**
3. **Stack/HOLD visualize conversation.**
4. **Continuation remembers unfinished work.**
5. **Trigger remembers obligations.**
6. **Assistance Surfaces temporarily magnify a physical task.**
7. **Semantic actions mutate; generic utilities are escape hatches.**

The existing layout already provides most of the physical substrate required for this hierarchy.

---

# 9. Recommended R6 redesign stance

Do **not** start by redrawing the screen.

Start by preserving the existing physical composition and changing semantic hierarchy in this order:

1. Remove Trigger from progression arbitration at the presentation level.
2. Stop treating the central Primary Action as the table's main orientation mechanism.
3. Add persistent Continuation/Current Work orientation independent of panels.
4. Separate orientation readouts from manual adjustment controls.
5. Reframe StackBand + HOLD as conversation without changing the underlying board composition.
6. Move frequent semantic operations toward cards/zones/CardActionSheet.
7. Keep generic Work/manual tools as deep escape hatches.
8. Normalize selection/focus/actionable visual grammar across Board/Hand/Stack/workspaces.
9. Preserve adaptive density, bundling, search and board-peek safety.
10. Only then revisit spacing/aesthetics.

This sequence minimizes rewrite risk and protects the strongest current layout qualities.

---

# 10. Acceptance tests for future R6 layout work

A future R6 layout should be rejected if any of these regress:

1. The battlefield is no longer the largest/clearest shared surface.
2. Hand loses its near-player spatial identity.
3. Far-side/opponent public state loses table orientation without a strong responsive reason.
4. Opening a zone/workspace makes Current Work disappear.
5. Stack/HOLD requires leaving the board for a separate response screen.
6. Trigger badge turns into a mandatory task queue.
7. A six-card demo looks good but 30+ permanents become unreachable.
8. Attachments/tokens/lands lose expandable physical identity.
9. Mobile/compact presentation solves space by hiding the current Work or relevant Stack without a persistent return anchor.
10. Generic movement becomes easier to discover than the correct semantic operation.
11. Decorative layers obscure selection/target/persistence semantics.
12. A user must learn double-click-only mutation to play efficiently.

---

# 11. Consolidated conclusion

The existing solo layout is **not a failed layout that R6 should replace**.

Its strongest idea is already aligned with R6:

> The screen looks and behaves primarily like a Magic table.

The weak layer is the application-control hierarchy placed around that table. The global Primary Action, Trigger gating, mutually exclusive panel semantics, generic toolbox prominence and polymorphic quick interactions pull the user away from the table and toward application-state management.

Therefore the R6 target is:

> **Preserve the physical table; replace the control hierarchy.**

More precisely:

> Keep the existing spatial Magic World, density management and direct manipulation substrate. Rebuild only the orientation, conversation, continuation, memory and semantic-action hierarchy around it.
