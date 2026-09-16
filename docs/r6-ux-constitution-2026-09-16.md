# OneDeck R6 UX Constitution & Core Interaction Specification

Updated: 2026-09-16
Revision: v5
Status: R6 design baseline. No R4b Gate/Correction implementation and no R5 Trigger Memory implementation are included here.
Base audited: `3465e00cfb2c1bc76c22fc05b624b8a746b4061d`

## 0. Authority and scope

This document defines the R6 interaction direction above screen-level layout decisions and below the product WHY/WHAT.

Priority when designs conflict:

1. `docs/product-requirements.md`
2. active engine/UI contracts under `docs/contracts/`
3. frozen R2/R3/R4 semantics already implemented
4. this R6 interaction specification
5. current component/layout convenience

R6 must not create a second game-state machine or silently redesign R4b/R5. It translates the existing Stack, Resolution, Context/Cause, Formal Action, Correction and future Trigger Memory semantics into a coherent human interaction model.

v5 is grounded in an audit of the current UI, including `CardActionSheet`, target recording, library access/search, `StackBand`, `CockpitFeed`, and the existing Scry/Surveil/Mill selection tools. Existing working safety properties are assets to consolidate, not prototypes to discard.

---

## 1. Product experience goal

OneDeck should feel like:

> **Magicをしていたら、OneDeckが自然についてくる。**

The player concentrates on cards, board state, conversation and decisions. OneDeck carries bookkeeping that software is good at:

- what process is currently in progress,
- Stack ordering and response relations,
- explicit targets,
- why a mutation belongs to the current process,
- pending triggers / later obligations,
- operation authority,
- persistence / reconnect state.

OneDeck does **not** generally decide how a card effect should be resolved.

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

> **Conversation beats workflow.**

If a card asks another player to make a public-information choice, table conversation is normally sufficient. R6 must not introduce a general remote-decision state machine solely to encode that conversation.

Players' Magic judgments are trusted. Software boundaries are not. OneDeck must still prevent or recover from stale Context, duplicate commit, wrong Resolution identity, unauthorized mutation, private-information leakage, lost-response ambiguity and reconnect ambiguity.

> **Trust humans; make system boundaries strict.**

---

## 3. Optimization target

R6 optimizes the loop repeated many times per game:

```text
唱える / 起動する
  ↓
対象・コスト等を準備
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

Rare card-specific procedures should normally be absorbed by Manual Resolution + reusable assistance + generic world operations + conversation.

---

## 4. Interaction Projection

R6 presentation is derived from canonical state. It is **not** a second persisted mode machine.

Presentation has four independent axes:

1. **Continuation** — work that remains ongoing: none / Resolution / Correction where canonically representable.
2. **Foreground Interaction** — Normal / Stack Response / Resolution / Trigger Review / HOLD-Await / Recovery.
3. **View** — Battlefield / Hand / Graveyard / Exile / Library / Card Detail / Stack Detail / Trigger Detail.
4. **Commit & Authority** — actor plus idle / sending / saved / unknown / reconnecting / rejected.

A single `mode` is insufficient. Example:

```text
Continuation: Resolution A
Foreground:   response to B
View:         Graveyard
Actor:        P2
```

The UI may show:

```text
《B》への応答 — P2が操作中
↳ 《A》の解決を継続中
```

After B completes, foreground returns to Resolution A without inventing a new local state transition.

---

# 5. UX Constitution

## Article 1 — Magic First

Players play Magic, not OneDeck. With mastery, attention should move toward the Magic world and away from application chrome.

## Article 2 — World is the Workspace

Battlefield, Hand, Library, Graveyard, Exile, Stack, players and relevant game objects are the primary workspace. Effects should not normally become a form-based effect executor.

## Article 3 — Projection, not Replacement

Sheets, panels, viewers and popovers are projections of Magic-world objects for a bounded task, not a second copy of the game.

Examples: private library viewer, multi-select surface, target picker, ordering surface and finite permanent-entry setup.

## Article 4 — View ≠ Work

What the user is looking at is independent from what process is still in progress.

```text
Current Work: 《成長のらせん》を解決中
View: 墓地
```

Opening another zone, Stack view or card detail must not implicitly finish Resolution.

## Article 5 — Continuity Before Guidance

OneDeck's first job is not “tell me the next correct Magic play”. It is ensuring that the player never loses the process they are already in.

## Article 6 — Current Work Never Disappears

If work is in progress, its identity remains visible or one semantic action away across all views.

```text
《成長のらせん》解決中
[処理に戻る]
```

## Article 7 — Primary Step, not Mandatory Primary Button

There should be one clear next **interaction boundary**, but it need not always be a large button.

- Normal: board is primary; `盤面から操作` rather than a dominant Next Phase CTA.
- Stack response: `解決へ` only when this actor can progress it; otherwise show who is awaited.
- Resolution: `処理完了`.
- ready triggers: `誘発を確認`.
- HOLD / other actor: status, not a fake clickable `待機中` button.

## Article 8 — Boundary, not Micro-step

Strong calls to action are lifecycle boundaries: `唱える`, `起動する`, `解決へ`, `処理完了`, `誘発を確認`.

General card text must not be translated into an app-generated Step 1 / Step 2 / Step 3 workflow.

## Article 9 — Manual Resolution is Normal

Manual Resolution is a standard resolution model, not merely an unsupported-card fallback. Card text describes Current Work; it is not generally a completion checklist.

## Article 10 — Context is a Semantic Lens

The same geometry can mean different Magic actions by Context:

```text
hand land → battlefield
Normal      = 土地をプレイ
Resolution  = 戦場に出す
Correction  = 盤面を訂正
```

Users should not need to understand internal Cause/Context types.

## Article 11 — Semantic Before Geometry

When OneDeck knows the Magic meaning, present that meaning. `draw`, `mill`, `destroy`, `sacrifice`, `discard`, `cast` and generic zone movement are not interchangeable merely because their geometry is similar.

> **Never infer Magic meaning from geometry alone.**

Unknown meaning falls back honestly to finite Manual operations.

## Article 12 — Semantic Capability is Explicit

A visible action label does not by itself prove that the engine canonically understands the full Magic action.

R6 distinguishes:

### A. Canonical Semantic Operation
The system has a defined semantic operation and preserves its Cause/event meaning.

### B. Assisted Manual Operation
The system safely assists manipulation or selection, but does not claim to understand or adjudicate the entire card effect.

### C. Pure Manual Operation
The user resolves the Magic meaning; OneDeck only provides bounded generic mutations under the correct Context.

UI copy and Trigger semantics must not upgrade B/C into A by implication.

## Article 13 — Direct Manipulation

Frequent operations begin from Magic-world objects or meaningful destinations. Drag is an accelerator to the same semantic operation, not a separate rules path.

## Article 14 — Single Click is Safe

Default click/tap = Inspect / Focus. It does not mutate shared state.

During an explicit visible selection task only, click/tap = Select. Mutation-specific double-click is not required and should be removed as a privileged interaction path.

Right-click / `…` / long-press may accelerate access to the same semantic actions, but must not be the sole path.

## Article 15 — Assistance Surface Contract

Reusable task surfaces — target picking, Scry/Surveil arrangement, library search, multi-select, ordering, proliferate selection, entry setup — share one contract:

1. identify the parent Current Work or initiating action,
2. say what the user is choosing/manipulating,
3. show quantity/selection progress where meaningful,
4. provide Cancel/Close without finishing the parent Resolution,
5. keep local draft separate from canonical mutation until commit,
6. bind to ExpectedInteractionContext at task start when mutation depends on Context,
7. preserve relevant object identity while the draft is open,
8. invalidate stale/private candidates rather than silently rebinding,
9. never reveal unauthorized hidden information,
10. close only after a confirmed successful commit when completion depends on persistence.

The current Scry/Surveil arrangement and private library search already implement several of these safety properties; R6 generalizes them instead of replacing them.

## Article 16 — Quantity is a Common Interaction Primitive

Many actions are `Action + Quantity + Scope`:

```text
Draw 3
Mill target player 5
Select up to 3 cards
Discard 2
```

Use one quantity grammar where the number is canonically known or explicitly supplied by the human. Do not build a general Oracle parser merely to derive N.

## Article 17 — Ordering ≠ Moving

Ordering is a distinct interaction primitive. It appears in Scry, library top/bottom manipulation, trigger ordering and similar tasks.

A move operation must not implicitly claim an ordering decision that the human did not make.

## Article 18 — Batch / Simultaneous Semantics Survive UI

When multiple changes are one simultaneous semantic event, UI convenience must not turn them into unrelated sequential game events.

A board wipe may use multi-select + one semantic commit. Animation may be sequential, but semantic/event boundaries must preserve simultaneity where the underlying contract supports it.

## Article 19 — Cost Work ≠ Effect Work

The same verb can belong to different processes.

```text
Cost:       生け贄に捧げる → then activate
Resolution: 効果により生け贄に捧げる
```

UI must keep the parent process visible so Cause is not lost behind an identical button label.

## Article 20 — Authorized Viewing is Free

“Viewing is free” means navigation among information the user is authorized to view does not change Current Work.

It never means bypassing hidden-information authority. Secret projection remains strict.

## Article 21 — Spatial Causality is Rule-Honest

Spatial projection is valuable, but visual language must not lie about Magic terminology.

- **Target Arrow** is reserved for an actual recorded target relation.
- non-target choices, attachments, combat relations, source relations or generic association use a different connector/highlight/grouping treatment unless the underlying relation really is a target.

Do not use one arrow style for every “this affects that” relationship.

## Article 22 — Stable Visual Grammar

```text
Glow                → actionable candidate
Outline             → focus / selection
Target Arrow         → explicit target only
Association styling  → non-target relationship
Stack overlap        → Stack ordering
Current Work Anchor  → continuing work
Badge                → remembered later work
Motion               → lifecycle transition
```

The same visual cue must not mean unrelated things on different screens.

## Article 23 — Focus Over Clutter

Do not draw every possible relationship continuously. Reveal causality primarily for the current/focused interaction.

## Article 24 — Unknown ≠ Invalid

OneDeck is not a complete rules engine. “Cannot prove legal” is not automatically “cannot select”. Distinguish known candidate, unknown/manual candidate and known impossible when the engine has enough information to do so honestly.

## Article 25 — Trigger is Memory Before Interruption

During active Resolution, detected triggers are remembered quietly. They do not steal Current Work through a popup or automatic Feed transition. After the appropriate boundary, ready triggers may become foreground work.

R6 displays provenance supplied by R5; it does not reconstruct “why this triggered” from Oracle text.

## Article 26 — Single Operator Principle

A Resolution has one Resolution Operator who normally performs OneDeck operations from `resolve.begin` until `処理完了`. Public choices made by another player may remain voice/table conversation.

## Article 27 — Private Information Exception

Single Operator does not bypass private-information authority. Another player supplies only the minimum private input required when the operator is not entitled to see it. This is a private-input exception, not transfer of Current Work ownership.

## Article 28 — Nested Formal Actions Preserve Parent Work

A Resolution may create a new Formal Action. Stack growth must not erase the parent Resolution as Continuation.

```text
Continuation = Resolution A
Foreground   = response to B
Stack        = [B, A-or-other waiting entries]
```

`Stack top` and `Current Resolution` are distinct concepts.

## Article 29 — Return to Parent Work

After a nested Cast/Activate interaction finishes, semantic navigation returns the user to the parent work:

```text
[《A》の処理に戻る]
```

## Article 30 — Stack Entry ≠ Cast

A Stack entry may be a cast spell, activated ability, triggered ability, copy, or other permitted entry. Motion and labels must preserve the actual source semantics. A copy must not be visually narrated as “cast”.

Similarly, Stack is not the universal route for land play, mana abilities or special actions.

## Article 31 — Visual Continuity ≠ Object Identity

Animation may visually track “the same card” through a zone transition, but R6 must not preserve stale game-object identity across canonical zone-change identity boundaries.

Draft surfaces that depend on an object must invalidate when the expected object identity no longer matches.

## Article 32 — Search ≠ Shuffle

Library Search and Shuffle are separate semantic operations unless a particular canonical operation intentionally commits them atomically.

The UI must not teach “search always auto-shuffles” as a universal rule.

## Article 33 — Assistance ≠ Prescription

Reusable assistance shortens manipulation; it does not decide Magic for the user. Good examples include multi-select, select-all then exclude, quantity entry, ordering, private library projection and finite entry-state setup.

## Article 34 — Quiet Routine, Loud Danger

Ambient: `🔔 2`, `保存済み`.

Boundary: `P2の応答待ち`, `誘発を確認`.

Safety: stale Context, unknown commit result, hidden-information authority loss.

Routine gameplay avoids modal interruption; safety may demand it.

## Article 35 — Honest System

Do not claim to know what OneDeck has not established.

Prefer `処理完了が選択されました` over `効果を正しく処理しました`.

---

# 6. Core interaction grammar

## Click / tap
Default: Inspect / Focus.

## Explicit selection
Visible task state:

```text
対象を選択中
0 / 1
[キャンセル]
```

## Semantic Action Menu
Semantic Magic actions first; Manual Event below them; Correction deeper and explicitly exceptional. These are not flat peers.

## Drag
Shortcut to the same semantic operation. Capture Context at gesture start; stale gesture fails closed.

## Double click
Must not be required for shared-state mutation.

## Keyboard
Keyboard shortcuts mirror the current Primary Step. A repeated keypress must not finish A, observe a changed state, and accidentally finish B as one held-key gesture.

---

# 7. Current UI implementation audit (v5)

This section records what exists **as UI**, not merely as a type or planned semantic candidate.

## 7.1 CardActionSheet — implemented presentation primitive

**Implemented:** mobile bottom sheet / desktop popover, card identity/details, ranked primary actions, secondary `その他`, focus management, Escape close and focus restoration.

**Boundary:** `CardActionSheet` itself is presentation only; the caller supplies `onSelect` actions. It does not own ExpectedInteractionContext, Current Work or commit semantics.

**R6 reuse:** keep the component family as a semantic action surface, but feed it one action hierarchy derived from Context. Do not let every caller invent a different meaning hierarchy.

**Gap:** Current Work identity and operation provenance are not inherent to the sheet.

## 7.2 Target system — partially implemented, with two different meanings

Current `ManualTargetDialog` is a real modal UI. It can select multiple cards across Stack/Battlefield/own Hand/Graveyard/Exile/Command plus players, then records manual target selections. It explicitly states that the record is for board understanding/target lines and **not** rules adjudication.

Current `StackBand` renders recorded target chips and SVG target arrows and provides `… → 対象を手動設定/変更`.

**Strength:** manual relation recording is honest about legality; Stack visual causality already exists.

**Gap:** the dialog is not the same thing as formal target preparation for casting/activation. R6 must not flatten “record a manual target relation” and “choose required targets for a Formal Action” into one semantic operation merely because both select objects.

**v5 rule:** Target Arrow only means an actual recorded target relation. Non-target choices require another visual treatment.

## 7.3 Scry / Surveil — implemented assisted private arrangement

Current `CockpitSelectionTools` already provides a Resolution-only Scry/Surveil flow:

1. user supplies quantity,
2. ExpectedInteractionContext is captured at task start,
3. required private library range is requested when not already authorized,
4. top N cards are displayed privately,
5. each card is assigned to top/bottom for Scry or top/graveyard for Surveil,
6. rows can be reordered,
7. one `arrange` operation confirms the draft,
8. temporary library access is released after close/save,
9. changed library order, lost access or changed object identity invalidates the draft instead of reviving it.

**Classification:** Assisted Manual Operation backed by a real canonical arrangement operation. It is not evidence that OneDeck generally parses Scry/Surveil from Oracle text.

**R6 reuse:** this is the strongest existing template for Assistance Surface Contract.

**Gap:** currently hidden under generic Manual Event tools and visually disconnected from Current Work.

## 7.4 Mill — implemented quantity action, current presentation is utility-like

Current `CockpitSelectionTools` has a quantity field and `切削` action. It captures Context, obtains enough private library projection when required, selects the top N IDs and commits one move with `reason: 'mill'`, then releases temporary access.

**Classification:** semantic intent is materially stronger than a generic `library → graveyard` drag.

**R6 reuse:** preserve one quantity operation and one semantic commit.

**Gap:** target player/scope and parent effect are not expressed as one polished task surface; the action lives among many manual utility controls.

## 7.5 Library browse / generic search — implemented but split by purpose

There are two relevant interaction families:

### Private library access substrate
`CockpitLibraryAccess` explicitly models request/release and bounded top-N vs full-library visibility.

### Fetch search work panel
`CockpitFetchSearch` is a specialized, real WorkPanel for supported fetch-style land search. It:

- shows the source,
- requests private full-library access,
- filters/searches visible candidates,
- keeps the choice local until confirmation,
- preserves object identity for the selected card,
- offers tapped-entry state,
- commits movement + shuffle + resolution-specific completion as one server operation,
- supports “find nothing” explicitly,
- releases private access on completion/close.

**Strength:** excellent example of projection, private authority and atomic completion.

**Gap:** this is deliberately specialized to the supported fetch semantic; R6 must not present it as a universal library-search rules engine.

**v5 consequence:** Search and Shuffle stay conceptually separate even when a specialized canonical operation intentionally combines them atomically.

## 7.6 StackBand — strongly implemented visual substrate, not yet R6 hierarchy

Current StackBand already provides:

- compact stacked-card pile,
- expandable list,
- board-peek and semantic return,
- source/ability/X information,
- target chips,
- target arrows,
- target legality marked `未検証` where appropriate,
- manual target edit,
- exceptional stack removal,
- Manual Resolution task,
- drag disabled from Stack so generic movement cannot bypass resolution semantics.

**Strength:** it already protects Stack semantics and projects spatial causality.

**Gap:** current visual hierarchy is still primarily “pile/list”. It does not consistently answer foreground actor / who is awaited / parent Continuation. Current Resolution must never be visually inferred merely from top-of-stack position.

## 7.7 Trigger Feed — implemented lifecycle management, incomplete causal UX

Current `CockpitFeed` provides:

- pending trigger records,
- controller/status display,
- `解決後に登録` while Resolution is active,
- detail text and source snapshot zone,
- editing through `CockpitAbilityTools`,
- placement onto Stack,
- linking to manually registered trigger entries,
- dismissal with a recorded reason,
- historical timeline/status.

It blocks progression under active Resolution/HOLD or when another trigger controller has ordering priority.

**Strength:** substantial management UI already exists.

**Gap:** it does not yet provide durable human causal provenance such as “which canonical GameEvent caused this trigger” in the form R6 wants. That remains an R5 dependency. R6 must not synthesize a causal explanation from Oracle text or current zone.

**R6 change:** during active Resolution, Feed becomes secondary read-only/quiet memory; after the correct boundary, ready trigger work becomes foreground.

## 7.8 Selection / state / proliferate utilities — implemented reusable mechanics

The current selection tools also include:

- simultaneous state-based graveyard application for selected physical cards,
- counter changes,
- damage with explicit source identity,
- life changes,
- random discard,
- shuffle,
- proliferate candidate selection.

These confirm that R6 should consolidate an interaction grammar instead of creating more isolated card-specific widgets.

---

# 8. Semantic capability matrix

| Capability | Current UI maturity | v5 treatment |
| --- | --- | --- |
| Cast / play land / activate | implemented semantic paths | Canonical Semantic Operation |
| Manual target record | implemented | Assisted/manual relation record; not legality engine |
| Stack target arrows | implemented | Keep, restrict arrow meaning to target |
| Scry / Surveil arrangement | implemented with private/stale protection | Reuse as Assistance Surface exemplar |
| Mill N | implemented | Preserve semantic quantity operation |
| Fetch-style land search | implemented specialized WorkPanel | Preserve specialization; do not generalize rules claims |
| Generic private library browse | implemented access substrate | Authorized-view projection |
| Shuffle / random discard | implemented utility actions in Resolution | Re-house under Current Work/semantic hierarchy |
| Proliferate selection | implemented modal assistance | Reuse selection contract |
| Trigger Feed | implemented lifecycle UI | R6 presentation refresh depends on R5 provenance |
| Correction | implemented R4b tools | Keep exceptional; durable workspace resume depends on R4b contract |
| General Oracle→workflow parsing | not implemented, not desired | Non-goal |

---

# 9. Target and relationship visual language

Formal target preparation should remain on the Magic world when practical:

```text
対象を選択
0 / 1
```

Recorded target:

```text
《Doom Blade》 ─────────→ 《Creature A》
```

Do **not** draw a target arrow for “all creatures”, sacrifice choices, opponent public choices, or other non-target relationships merely because one object affects another.

Stack should read as a conversation among actions and actors, while preserving actual ordering:

```text
P1 Growth Spiral
P2 └ Counterspell → Growth Spiral
P1 └ Negate → Counterspell
```

The Stack surface also shows Continuation when different from foreground:

```text
《B》への応答
↳ 《A》解決中
```

---

# 10. Generic semantic world operations

Prefer excellent reusable operations before card-specific workflows:

- draw,
- discard,
- sacrifice,
- destroy,
- exile,
- return,
- battlefield entry,
- mill,
- tap / untap,
- life +/- N,
- counter +/- N,
- damage with source,
- shuffle,
- arrange/order,
- single / multi-select,
- private-zone browse/search,
- finite entry-state setup.

This list is a UX vocabulary, not a claim that every listed verb already has identical canonical engine maturity.

---

# 11. Representative journeys

## J1 Cast → Stack → Resolution

Select card → semantic action → formal preparation if needed → Stack response → `解決へ` → Current Work → world manipulation → `処理完了`.

## J2 Resolution browse and return

Resolution A → open Graveyard/Card Detail/Library authorized view → Current Work anchor remains → `[《A》の処理に戻る]`.

## J3 Resolution + remembered triggers

Resolution A → trigger count increments quietly → complete A → stabilization → `誘発を確認` → ordering/Stack registration.

## J4 Nested Formal Action

Resolution A → cast B → foreground response to B while Continuation remains A → nested interaction returns to A.

## J5 Scry / Surveil

Resolution → quantity → authorized top-N projection → partition/order local draft → one confirmed arrangement commit → return to parent Current Work.

## J6 Mill

Resolution/manual event → choose/supply N and proper player scope → one semantic Mill operation → Current Work remains until human completes Resolution.

## J7 Library search

Current Work → request authorized library projection → search/select local draft → commit the exact supported semantic operation → release private projection → return to Current Work.

## J8 Correction

Enter explicitly from exceptional tools → visible `盤面訂正中` meaning → finite absolute repair → end. R6 must not fake reload continuity if R4b does not expose durable correction-work identity.

## J9 Reconnect / unknown commit

Commit result unknown → block casual retry → reconcile receipt/canonical state → show saved or not saved → derive Current Work/Primary Step anew.

## J10 Multiplayer waiting

If canonical flow waits for P2, P1 sees `P2の応答待ち`; P1 does not see a misleading progress button.

## J11 Mobile

The same session must remain understandable at 375×812, 812×375 and 1440×900. Mobile uses a compact persistent Current Work bar/sheet architecture rather than a shrunken desktop rail.

---

# 12. Current-work presentation

Current Work is persistent but compact.

Desktop:

```text
解決中 — 《成長のらせん》
🔔 2
[処理完了]
```

While browsing:

```text
墓地を閲覧中
現在: 《成長のらせん》を解決中
[処理に戻る]
```

Mobile: sticky compact Current Work bar; Stack/Trigger/detail open as sheets while board remains the dominant surface.

---

# 13. Trigger presentation and R5 dependency

During Resolution, trigger memory is ambient. After the correct boundary, it becomes foreground.

R6 requires from R5, when available, a durable display-facing record including at minimum:

- stable pending trigger identity,
- controller,
- source snapshot,
- originating canonical GameEvent/provenance,
- remembered / ready / ordered / stacked / dismissed lifecycle,
- whether processing was deferred by current Resolution,
- ordering actor/group where applicable,
- Stack-entry correspondence when registered.

R6 displays this record. It does not re-evaluate trigger rules.

---

# 14. Feedback and recovery

Operation lifecycle must be understandable:

```text
○ 保存済み
◌ 送信中
? 結果未確認
↻ 再接続中
! 保存されていません
```

When result is unknown, do not encourage immediate retry. Reconcile first, then derive interaction state from canonical data.

Stale task drafts show why they became invalid and return the user to a safe re-selection point; they never silently bind to a newer Resolution/object.

---

# 15. Current-main gap summary

Existing strengths to preserve:

- canonical `table.resolution` and exact entry-bound lifecycle,
- R4b strict mutation gate / Context-Cause substrate,
- gesture-start Context capture,
- semantic Formal actions,
- `CardActionSheet` presentation pattern,
- real Scry/Surveil arrangement with stale/private protection,
- semantic Mill quantity operation,
- private library request/release substrate,
- specialized fetch search WorkPanel,
- StackBand + target arrows + manual target recording,
- substantial Trigger Feed lifecycle UI,
- state/bulk/proliferate selection tools,
- Manual Event / Correction separation,
- reconnect/stale-operation handling.

Main R6 gaps:

1. Current Work is distributed rather than a global anchor.
2. Existing tools look like separate utilities rather than one Assistance Surface grammar.
3. Primary/progression controls compete with board actions, especially multiplayer.
4. target, non-target association and manual target recording need clearer semantic separation.
5. Stack needs foreground actor/waiting/Continuation hierarchy on top of the existing pile.
6. Trigger Feed needs quiet-during-Resolution presentation and R5 causal provenance.
7. Scry/Surveil/Mill/Search need parent Current Work visibly retained rather than living under a generic Manual Event toolbox.
8. semantic capability level is currently implicit; labels can overstate what the engine understands.
9. double-click/quick mutation remains inconsistent with touch-safe interaction grammar.
10. multiplayer mobile still has explicit wide-screen limitations.
11. Correction cannot promise reload-resumable workspace identity unless R4b exposes it canonically.

---

# 16. R6 implementation priority

## P0 — unify the interaction shell

1. pure derived Interaction Projection,
2. persistent Current Work Anchor,
3. Primary Step hierarchy,
4. Resolution Workspace integration,
5. Stack foreground/Continuation presentation,
6. card interaction cleanup: inspect/select/action/drag converge.

## P1 — consolidate existing assistance

1. common Assistance Surface shell around existing Scry/Surveil/search/target/multi-select patterns,
2. quantity + ordering grammar,
3. semantic action hierarchy in CardActionSheet,
4. authorized private-zone projection UX,
5. feedback/recovery states,
6. mobile-native Current Work and sheets.

## P2 — R5-backed trigger UX and further accelerators

1. human causal Trigger presentation once R5 provenance exists,
2. ordering presentation,
3. further bulk semantic actions only where event semantics are preserved,
4. common entry-state setup.

## Non-goals

- card-specific effect wizards by default,
- general opponent-decision workflow,
- general Oracle parser,
- full legality engine,
- automatic effect-resolution checklist,
- a second canonical R6 context/mode machine,
- inferring trigger cause from UI text,
- pretending a candidate button implies canonical semantic support.

---

# 17. R6 design review questions

Every R6 design change should answer:

1. Does this keep Magic judgment with players?
2. Does it reduce bookkeeping rather than replace gameplay?
3. Does Current Work survive every View change?
4. Does the Magic world remain the primary workspace?
5. Is this a lifecycle boundary or unnecessary micro-step?
6. Is the interaction state derived from canonical state rather than a second local mode machine?
7. Is the operation's semantic capability level honest?
8. Does an Assistance Surface identify parent work, task, quantity, cancel, draft/commit boundary and stale behavior?
9. Is hidden information limited to authorized projection?
10. Does Target Arrow mean actual target rather than generic association?
11. Is meaning preserved rather than inferred from zone geometry?
12. Are Cost and Effect work distinguishable?
13. Are simultaneous changes kept semantically simultaneous where required?
14. Are ordering and movement separate when the player must choose order?
15. Does visual continuity avoid fabricating object identity?
16. Does Stack-entry presentation distinguish cast / ability / trigger / copy?
17. Does Trigger remain peripheral until the correct boundary?
18. Does nested Stack growth preserve parent Continuation?
19. If commit result is unknown, does the UI reconcile before retry?
20. Does the same interaction remain understandable at 375×812, 812×375 and 1440×900?
21. Are existing safe components being reused rather than replaced without reason?
22. Is any new complexity justified by repeated in-game value?

If a common journey requires a card-specific state machine, a general Oracle parser, or a second R6 canonical mode store, re-audit the interaction model before adding one.

---

# 18. v5 architecture invariants

1. R6 introduces no new canonical game state machine.
2. Interaction Projection is pure presentation derived from canonical state and bounded local task drafts.
3. View changes do not change Continuation.
4. Current Resolution is never inferred from Stack top.
5. Foreground and Continuation remain separate.
6. Normal does not require a dominant progress button; board interaction is primary.
7. Single click/tap normally does not mutate shared state.
8. No shared mutation depends on double-click-only interaction.
9. Menu, drag and shortcuts converge on the same semantic operation.
10. Multi-step tasks bind Context/object identity at their start and invalidate stale drafts.
11. Trigger cause is consumed from R5 provenance, not inferred by R6.
12. Manual Event and Correction are not flat alternatives to ordinary semantic actions.
13. Unknown commit result suppresses casual retry until reconciliation.
14. Disabled controls alone are insufficient; explain who/what/why blocks progress.
15. Authorized viewing may be freely navigated without expanding secret authority.
16. Geometry never manufactures semantic meaning.
17. UI animation never manufactures simultaneity, object identity or “cast” semantics.
18. Existing private-library safety and stale-choice invalidation are preserved as R6 general patterns.
