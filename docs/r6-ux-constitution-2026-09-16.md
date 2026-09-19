# OneDeck R6 UX Constitution & Core Interaction Specification

Updated: 2026-09-16
Revision: v6.2
Lifecycle: SUPPORTING / NON-CURRENT
Authority: NONE
Current authority: docs/contracts/ux-constitution.md
Status: R6 design baseline. Documentation/design only. No R4b Gate/Correction implementation and no R5 Trigger Memory implementation are included here.
Base audited: `3465e00cfb2c1bc76c22fc05b624b8a746b4061d`

> Companion audit: [`r6-existing-solo-layout-audit-2026-09-16.md`](r6-existing-solo-layout-audit-2026-09-16.md). The audit is normative design input for what R6 should preserve, repair and remove from the existing solo/local table composition.

## 0. Authority and scope

This document defines the R6 interaction direction above screen-level layout decisions and below the product WHY/WHAT.

Priority when designs conflict:

1. `docs/product-requirements.md`
2. active engine/UI contracts under `docs/contracts/`
3. frozen R2/R3/R4 semantics already implemented
4. this R6 interaction specification
5. current component/layout convenience

R6 must not create a second game-state machine, a general Oracle parser, a full Magic rules engine, or a parallel authority model that silently replaces frozen engine contracts. It translates existing canonical semantics into a human interaction model.

v6 supersedes the interaction philosophy in v5 where they conflict. In particular:

- HOLD is not a generic pause or a social escape hatch.
- ready Triggers are ambient memory, not an automatic progress gate or forced foreground task.
- one Current Work has a Primary Operator, but other players are not excluded from manipulating their own authorized Magic-world objects.
- Participant Input is not a new canonical mode/state machine.
- Magic lifecycle families are used primarily as negative constraints so R6 does not accidentally force every action into Cast → Stack → Resolution.
- the existing solo/local physical table composition is an asset to preserve; R6 primarily replaces the control hierarchy around it, not the spatial Magic World itself.

---

# 1. Product thesis — reconstruct the paper Magic table

OneDeck should feel like:

> **Magicをしていたら、OneDeckが自然についてくる。**

OneDeck is not primarily digitizing the Magic rules engine. It is digitizing the **shared paper table** on which people play Magic while talking to each other.

A paper Magic game is sustained by three channels.

## 1.1 Physical channel

Players physically manipulate game objects:

- play cards,
- draw cards,
- tap and untap,
- move cards between zones,
- place counters,
- arrange Stack objects,
- point at targets.

OneDeck replaces this with direct manipulation of the **Magic World**.

## 1.2 Verbal channel

Players communicate:

- 「これ唱えます」
- 「対応あります？」
- 「あります」
- 「対象これ」
- 「どれ選ぶ？」
- 「これ」
- 「この誘発積みます」
- 「その処理でOK」

OneDeck does not attempt to replace this channel. Voice/table conversation remains a first-class part of the product model.

## 1.3 Bookkeeping channel

Players otherwise have to remember:

- what is currently being processed,
- Stack order,
- explicit targets,
- who interrupted whom,
- pending triggers,
- whether an operation was saved,
- where play resumes after reconnect.

This is where OneDeck should be strongest.

> **OneDeck externalizes memory, causality, shared state and synchronization — not human Magic judgment.**

---

# 2. Paper-table translation test

Every new R6 feature should first answer three questions.

1. **How is this handled naturally at a paper table?**
2. **What is lost when the table becomes remote + digital?**
3. **Can OneDeck restore only the lost part instead of replacing the whole interaction?**

Examples:

| Paper table | What remote play loses | OneDeck replacement |
| --- | --- | --- |
| point at a target | shared physical pointing | target arrow / focus |
| physically pile responses | common physical Stack | shared Stack visualization |
| 「待って、対応ある」 | safe shared mutation authority | HOLD request + approval |
| leave card visibly being resolved | shared physical continuation | Current Work / Continuation |
| someone remembers a trigger | reliable shared memory | Trigger Memory badge/feed |
| 「今の俺の操作なし」 | safe reversible shared state | actor-owned Undo |
| fix a misplaced card | shared physical correction | Correction |
| manipulate unusual card text manually | same physical objects available | Manual world operations + voice |

This translation test is above individual screen patterns.

---

# 3. Social-play assumption

OneDeck primarily serves cooperative players communicating through voice or equivalent real-time conversation.

> **Conversation beats workflow when conversation already solves the human problem.**

If a card asks an opponent to choose one of three public cards, the default interaction is still:

```text
P1: どれ？
P2: B。
P1: 了解。
```

R6 should not turn every such exchange into request → remote modal → submit → acknowledge.

This is intentional scope control.

### Human trust / software safety

Players' Magic judgments are trusted. Software boundaries are not.

OneDeck still protects against:

- stale interaction context,
- duplicate commit,
- wrong Resolution identity,
- unauthorized hidden-information access,
- lost-response ambiguity,
- reconnect ambiguity,
- accidental rebinding of an old gesture/task/HOLD request to new work.

> **Trust humans; make system boundaries strict.**

---

# 4. Five core interaction concepts

R6 can be understood through five user-facing concepts.

## 4.1 Magic World — what exists where

Battlefield, Hand, Library, Graveyard, Exile, Command, Stack, players and game objects.

## 4.2 Spatial Causality — what relates to what

Targets, Stack response relationships, combat relationships and other explicit associations.

## 4.3 Continuation — what remains unfinished

The process that still needs to continue after temporary viewing or nested work.

## 4.4 Remembered Obligation — what should not be forgotten

Primarily Trigger Memory and other future obligations.

## 4.5 Boundary — when shared game work commits or changes lifecycle

Examples: `唱える`, `起動する`, `解決へ`, `処理完了`.

These concepts are more important than any single panel layout.

---

# 5. Interaction Projection, not another state machine

R6 presentation is derived from canonical state plus bounded local drafts. It is not a second persisted mode machine.

Useful independent axes are:

1. **Continuation** — unfinished parent work, such as Resolution A.
2. **Foreground Work** — the work currently receiving table attention, such as response C.
3. **View** — what the user is looking at.
4. **Authority / Actor** — who may progress or perform the foreground operation.
5. **Commit state** — idle / sending / saved / unknown / reconnecting / rejected.

Example:

```text
Continuation:  《出現の根本原理》 Resolution — A
Foreground:    Counterspell C — C
View:          Graveyard
```

After C finishes, the UI resumes the nearest still-valid parent work. If an intermediate parent Stack entry was removed, it is skipped rather than resurrected.

---

# 6. UX Constitution

## Article 1 — Magic First

Players play Magic, not OneDeck. Expertise should move attention toward the Magic world and away from application chrome.

## Article 2 — World is the Workspace

The primary workspace is the Magic world. Effects should not normally become form-based effect executors.

## Article 3 — Projection, not Replacement

Sheets, panels, viewers and popovers are bounded projections of Magic-world objects for a task, not a second copy of the game.

Examples:

- private library viewer,
- Scry/Surveil ordering surface,
- target picker,
- multi-select,
- finite entry-state setup.

## Article 4 — Authorized Viewing is Free

Viewing information the user is authorized to see does not change Current Work.

```text
Continuation: 《成長のらせん》解決中
View: 墓地
```

Viewing freedom never expands hidden-information authority.

## Article 5 — Continuity Before Guidance

OneDeck's first job is not to tell players the next correct Magic action. Its first job is to ensure they do not lose the process they are already in.

## Article 6 — Current Work Never Disappears

If work remains unfinished, its identity stays visible or one semantic action away.

```text
《成長のらせん》解決中
[処理に戻る]
```

## Article 7 — Boundary, not Micro-step

OneDeck strongly presents lifecycle boundaries, not generated card-text steps.

Good boundaries:

- `唱える`
- `起動する`
- `解決へ`
- `処理完了`

General Oracle text should not become Step 1 / Step 2 / Step 3 unless a specifically supported interaction justifies it.

## Article 8 — Manual Resolution is Normal

Manual Resolution is a normal resolution strategy, not a failure mode.

Card text explains the current Magic work. The player manipulates actual Magic-world objects and declares `[処理完了]` when they judge the necessary effect work complete.

OneDeck does not claim the effect was rules-correct merely because `[処理完了]` was pressed.

## Article 9 — Context is a Semantic Lens

The same geometry may have different Magic meaning.

```text
hand land → battlefield
Normal      = 土地をプレイ
Resolution  = 戦場に出す
Correction  = 盤面を訂正
```

Context/Cause must remain semantically meaningful even when UI wording stays natural.

## Article 10 — Never Infer Meaning from Geometry

`Library → Hand` is not automatically Draw.

`Library → Graveyard` is not automatically Mill.

`Battlefield → Graveyard` is not automatically Destroy or Sacrifice.

When meaning is known, preserve it. When unknown, remain honest and Manual.

## Article 11 — Semantic Capability is Explicit

A visible action label does not imply full rules understanding.

### Managed

OneDeck strongly supports a finite, reusable semantic path.

### Assisted

OneDeck safely assists manipulation while humans retain card/effect judgment.

### Human/Table Resolved

Voice + Manual world operations are the intended solution for expensive, rare or semantically uncertain effects.

The product should not present Human/Table Resolved as failure.

## Article 12 — Communication First

Public card-specific choices normally remain table conversation. Software workflow is added only when the digital medium creates a real coordination, secrecy or persistence problem.

## Article 13 — Primary Operator Principle

A Current Work has one **Primary Operator** who owns its lifecycle boundary, such as `[処理完了]` for a Resolution.

This does **not** mean other players are prohibited from manipulating their own authorized Magic-world objects during that work.

## Article 14 — Cooperative World Manipulation

During shared work, players may directly manipulate objects they are normally authorized to manipulate, based on cooperative play and voice communication.

Example during A's Resolution:

```text
A: 「3枚捨てて」
B: 自分の手札から3枚を選択して捨てる
```

OneDeck does not need a card-text-derived permission workflow for that operation.

When the operation belongs to the Current Resolution, its Cause should bind to that Resolution according to canonical Context rules. An explicitly different Manual Event/Correction path is used when the operation means something else.

## Article 15 — Participant Input is not a mode

Blocker declaration, self-discard, secret choice and similar participation do not require a generic Participant Input state machine.

The player simply manipulates the relevant objects they control/own/are authorized to view.

The Current Work Primary Operator remains responsible for the parent lifecycle boundary.

## Article 16 — Selection can be communication

Selection state may be shared as lightweight visual communication when doing so does not reveal hidden information.

Examples:

- defender's selected blockers may be visibly highlighted,
- opponent may see “B: 3 cards selected” while card identities remain hidden,
- target selection may be spatially projected.

Selection is not automatically canonical mutation.

## Article 17 — HOLD bridges table conversation to digital authority

At a paper table:

```text
A: 「対応あります？」
B: 「あります」
```

is enough to shift attention and practical control to B.

A digital shared state needs explicit authority. HOLD is that bridge.

> **HOLD materializes “wait, I want to act now” as a safe operation-authority request.**

## Article 18 — HOLD is not a generic pause

HOLD is not used merely because:

- the rule is difficult,
- players want to discuss something,
- APNAP ordering is complex,
- a card is unusual.

Those remain voice/table conversation and Manual processing.

HOLD is used when a non-current operator wants to perform an operation at the current Magic priority/response opportunity.

## Article 19 — HOLD does not implement full CR priority passing

OneDeck does not require every player to press Pass at every priority window.

The current table operator progresses naturally. A player who wants to interrupt requests HOLD.

This intentionally models human paper-table priority practice rather than a full Arena-style priority engine.

## Article 20 — HOLD requires approval and chooses one requester

A HOLD press creates a request; it does not instantly steal authority.

The current foreground operator may approve **one** requester.

If multiple players request HOLD, only one is selected. Other requests do not carry across the resulting state change; they become stale and must be requested again if still relevant.

## Article 21 — HOLD requests are identity-bound

A HOLD request belongs to the ExpectedInteractionContext / foreground work that existed when it was requested.

If that work changes or disappears before approval, the request becomes stale. It must never silently apply to a later Stack entry or later game boundary.

## Article 22 — HOLD suspends parent progress; it does not transfer ownership

If A owns a turn/Combat/Resolution and grants HOLD to B:

- A's parent Progress/Resolution ownership is suspended,
- B receives foreground operation authority for their response work,
- B does not become turn owner or parent Resolution owner.

## Article 23 — HOLD response work remains with its actor until it ends

After B is granted HOLD and creates response work B, B remains foreground operator until that work resolves or is removed.

B does not return authority immediately after merely putting the Spell/Ability on the Stack.

If B is granted HOLD but creates no response work, B owns the release/Undo of that granted response authority. The approving player does not need to retract B's unused HOLD on B's behalf.

## Article 24 — Nested HOLD unwinds to the nearest valid parent

Example:

```text
A Spell
└ B HOLD → Spell B
  └ C HOLD → Spell C
```

If C resolves normally and B still exists, foreground returns to B.

If C's effect removes/counters B, B's response work is no longer valid; the UI skips B and resumes the nearest valid parent, e.g. A.

This is identity-based continuation, not a blind player-stack pop.

## Article 25 — Nested Formal Action by the current operator needs no HOLD

If A is resolving Emergent Ultimatum and its effect lets A cast B, A does not HOLD themselves.

```text
Continuation: Emergent Ultimatum — A
Foreground:   Spell B — A
```

If C wants to respond to B, C requests HOLD. A's parent Resolution remains suspended Continuation.

## Article 26 — Trigger Memory never steals authority

A Trigger being detected or remembered does not automatically move operation authority to its controller.

If a non-current operator wants to place/manage their Trigger on the Stack, they use the same HOLD request/approval grammar used for other voluntary priority actions.

Trigger generation and Trigger operation authority are distinct.

## Article 27 — Ready Trigger is ambient memory, not a progress gate

Trigger Memory's job is to remember, not enforce.

A ready Trigger may be shown prominently enough to be noticed:

```text
🔔 未処理 2
```

but it does not automatically:

- disable phase progression,
- force Trigger Review foreground,
- steal Current Work,
- transfer authority.

Players use voice/table practice to decide when to act on it.

## Article 28 — Trigger viewing is free; Trigger mutation needs authority

Anyone may inspect trigger information they are authorized to see without HOLD.

Actually registering/manipulating a Trigger on the shared Stack requires the appropriate current operation authority; a non-current player obtains it through HOLD.

## Article 29 — Private information uses existing authority, not a new workflow by default

A player may manipulate their own hidden-zone objects without exposing them to the Primary Operator.

Example:

```text
A Resolution
A: 「3枚捨てて」
B selects three private Hand cards
B discards them
```

No generic Private Input transfer mode is required.

Hidden-information projection remains strict.

## Article 30 — Direct Manipulation

Frequent operations begin from Magic-world objects or meaningful destinations. Drag is an accelerator to the same semantic operation, not a separate rules path.

## Article 31 — Single click is safe

Default click/tap = Inspect / Focus.

During an explicit visible selection task, click/tap = Select.

Shared-state mutation must not require double-click as its only path.

## Article 32 — Assistance Surface Contract

Reusable bounded task surfaces — Scry/Surveil, search, target selection, ordering, multi-select, entry setup — follow one safety pattern:

1. identify parent/initiating work,
2. explain the local task,
3. show quantity/selection progress where meaningful,
4. Close/Cancel does not finish parent work,
5. draft stays local until commit,
6. ExpectedInteractionContext is captured when needed,
7. relevant object identity is retained,
8. stale/hidden candidates invalidate rather than rebind,
9. secret authority is never widened,
10. completion waits for confirmed commit when persistence matters.

Existing Scry/Surveil and private search flows are assets to reuse.

## Article 33 — Quantity and Ordering are reusable primitives

Many interactions are `Action + Quantity + Scope`.

Ordering is distinct from movement.

Do not introduce a general Oracle parser merely to derive N or order rules.

## Article 34 — Batch / simultaneous semantics survive UI

If multiple changes are one semantic event, UI convenience should not fragment them into unrelated game events where the underlying engine contract can preserve simultaneity.

Animation may still be sequential.

## Article 35 — Cost Work ≠ Effect Work

The same verb may mean different things depending on parent process.

```text
activation cost: sacrifice
resolution effect: sacrifice
```

UI must preserve enough parent identity/Cause to distinguish them.

## Article 36 — Spatial Causality is rule-honest

Target Arrow is reserved for a recorded target relationship.

Do not use target arrows for:

- “all” effects,
- generic choices,
- sacrifice decisions,
- non-target attachment/combat/source association.

Use distinct association styling where useful.

## Article 37 — Stable Visual Grammar

```text
Glow                → actionable candidate
Outline             → focus / selection
Target Arrow         → explicit target relation
Association styling  → non-target relationship
Stack overlap        → Stack ordering
Current Work Anchor  → unfinished continuation
Badge                → remembered obligation
Motion               → semantic lifecycle transition
```

The same cue should not mean unrelated things on different screens.

## Article 38 — Unknown ≠ Invalid

OneDeck is not a complete legality engine.

Where relevant, distinguish:

- known candidate,
- unknown/manual candidate,
- known impossible.

Lack of proof must not automatically become prohibition.

## Article 39 — Stack Entry ≠ Cast

A Stack entry can represent:

- a cast spell,
- activated ability,
- triggered ability,
- copy,
- another supported Stack object.

Visual language and history must preserve the real semantic source. Copies/triggers are not visually narrated as “cast”.

## Article 40 — Not everything uses the Stack

R6 lifecycle taxonomy is primarily a set of negative constraints.

Do not accidentally force these into Cast → Stack → Resolution:

- land play,
- mana abilities where rules define immediate resolution,
- special actions,
- turn-based actions,
- state-based actions,
- static/continuous effects.

This taxonomy does **not** require OneDeck to fully implement every category.

## Article 41 — Static / continuous / rule-changing effects are Manual-first

Human/Table Resolved is the default when automation would be expensive, brittle or low-value.

Safe finite helpers may be added when frequency, reuse and semantic certainty justify them.

## Article 42 — Replacement / prevention is not Correction

If players judge an event is replaced/prevented, they should record the correct resulting semantic/manual mutation rather than first recording the wrong event and “fixing” it via Correction.

OneDeck need not implement a general replacement engine to preserve this distinction.

## Article 43 — Actor-owned minimal Undo

Undo is not a global “rewind the whole response scope” command.

The player who performed an operation owns the normal Undo of that operation, at the minimum supported operation granularity.

A current operator does not gain permission to Undo another player's earlier action merely by holding foreground authority.

## Article 44 — Undo cannot erase knowledge

Canonical state can sometimes be restored; information already observed cannot be made unknown again.

If Undo follows a reveal/peek/hidden-information exposure, UI must not imply the information leak was reversed.

Where useful, warn:

```text
状態は戻りましたが、公開された情報は取り消せません。
```

## Article 45 — Undo ≠ Correction

Undo means “my recent recorded operation should be reverted.”

Correction means “the canonical shared state does not match the agreed real table and must be repaired.”

Correction remains exceptional and explicitly labelled.

## Article 46 — Search ≠ Shuffle

Search and Shuffle are distinct semantic operations unless a supported canonical operation intentionally commits them atomically.

Do not teach users that every search universally auto-shuffles.

## Article 47 — Visual continuity ≠ object identity

Animations may visually follow the same physical card through zone changes, but drafts/relations must not preserve stale canonical game-object identity across zone-change identity boundaries.

## Article 48 — Quiet routine, loud danger

Ambient:

- trigger badge,
- saved indicator.

Boundary:

- current actor / HOLD request,
- `解決へ`,
- `処理完了`.

Safety:

- stale context,
- lost secret authority,
- unknown commit result,
- reconnect reconciliation.

Routine Magic should not be dominated by modals.

## Article 49 — Honest System

Never claim OneDeck has proven Magic correctness when it has only recorded player action.

Prefer:

```text
処理完了が選択されました
```

over:

```text
効果を正しく処理しました
```

---

# 7. Authority model

The UX needs a small conceptual authority vocabulary. These concepts need not each become new persisted canonical fields if existing state can derive them.

## 7.1 Turn / Progress ownership

The turn owner normally controls normal progression: phase/turn/combat progression and their own normal game actions.

## 7.2 Primary Operator

The player who owns the current Current Work lifecycle boundary.

For Manual Resolution, this is normally the player resolving that Spell/Ability.

## 7.3 Foreground response operator

A player granted HOLD temporarily becomes foreground operator for the response work they create.

Parent ownership remains suspended, not transferred.

## 7.4 Cooperative participant

Other players may still manipulate their own authorized objects as part of the parent's requested processing without acquiring HOLD.

## 7.5 Hidden-information authority

Visibility remains independent from Progress/Foreground authority. HOLD does not grant access to another player's secrets.

---

# 8. HOLD reference journey

## 8.1 A → B → C normal unwind

```text
A casts Spell A
A: 「対応あります？」

B HOLD request
A approves B
B casts Spell B
B: 「対応あります？」

C HOLD request
B approves C
C casts Spell C
```

Stack:

```text
[C] C — foreground
[B] B — suspended parent response
[A] A — suspended root work
```

If C resolves and B still exists:

```text
C finishes
→ B resumes
B resolves
→ A resumes
```

## 8.2 C removes B

```text
[C → B]
[B → A]
[A]
```

C resolves and removes B.

B is no longer a valid parent work, so B's foreground scope is cancelled and the system resumes A.

## 8.3 multiple HOLD requests

If B/C/D request HOLD simultaneously, the current operator approves one. Once state changes, the other requests expire rather than silently carrying forward.

## 8.4 HOLD but no response

If B receives HOLD but does not create response work, B releases/Undoes that granted response authority. The approval is not treated as A-owned history that A must unwind on B's behalf.

If B performs additional operations and then regrets them, Undo remains actor-owned and minimal; R6 does not add a broad “return HOLD and rewind everything” command.

---

# 9. Trigger model

Trigger Memory is deliberately weaker than a rules-enforcement system.

## Trigger lifecycle principle

```text
Game event
→ Trigger remembered
→ badge/feed available
→ table conversation
→ non-current trigger controller uses HOLD if they want shared Stack authority
→ Trigger Stack registration
```

A ready Trigger remains ambient until a player chooses to act on it.

OneDeck may visually distinguish remembered/ready/stacked/dismissed states if R5 supplies those canonical semantics, but R6 does not block unrelated progression merely because a ready Trigger exists.

R6 consumes R5 provenance when available. It does not invent causal explanations from Oracle text.

---

# 10. Cooperative processing examples

## 10.1 Cruel-Ultimatum-style discard

A is Primary Operator for Resolution A.

Voice:

```text
A: 「クリーチャー1体サクって、3枚捨てて」
```

B may directly:

- sacrifice B's own permanent,
- select B's own hidden Hand cards,
- discard them.

No HOLD is needed because B is participating in the requested parent processing rather than voluntarily interrupting it.

A still owns `[処理完了]` for Resolution A.

Selection may be visible to A only as privacy-safe metadata such as “B: 3 cards selected.”

## 10.2 Combat blocker declaration

A owns the turn/combat progress.

Defender B directly declares blockers using B's creatures. This is cooperative/rule-defined participation, not HOLD.

If B wants to cast a spell/activate an ability at a priority opportunity, that voluntary interruption uses HOLD.

---

# 11. Representative Golden/Stress journeys

## J1 — Land play: no Stack

```text
A turn
Forest in Hand
→ [土地をプレイ]
→ Battlefield
```

No Response/Resolution journey is fabricated around ordinary land play.

## J2 — Cast + target + HOLD

```text
A casts Doom Blade
→ target arrow to Creature X
A asks for responses
B HOLD
A approves
B casts Counterspell
```

HOLD is identity-bound to the relevant current interaction.

## J3 — Activated ability

```text
A activates Sakura-Tribe-Elder-like ability
→ pay sacrifice cost
→ ability Stack entry
→ response grammar as usual
```

Cost and effect remain semantically distinct.

## J4 — Mana ability

Known supported mana generation is an embedded immediate action rather than a fake Stack journey.

R6 must not classify “produces mana” using naive UI inference when engine/rules semantics are uncertain.

## J5 — Growth Spiral

```text
Cast
→ Stack
→ Resolution
→ draw using library operation
→ hand land [戦場に出す] under Resolution Context
→ Trigger Memory may increment quietly
→ A [処理完了]
```

No Growth-Spiral effect wizard.

## J6 — Emergent Ultimatum

```text
Continuation: Ultimatum Resolution — A
A searches/selects/exiles using authorized projection
Voice: opponent publicly chooses which card returns
A performs return/shuffle
A casts B by current effect — no HOLD

C wants to respond to B
C HOLD → A approves
C casts C
```

If C ends and B remains, B/A's foreground nested work resumes. If C removes B, B is skipped and Ultimatum Continuation resumes.

No Emergent-Ultimatum-specific state machine is required.

## J7 — Trigger

```text
B Trigger remembered
🔔1
```

It does not gate A's phase progression.

If B wants to put/manage it on the Stack while B is not current operator:

```text
B voice: 「誘発積みます」
B HOLD
current operator approves
B registers Trigger
```

## J8 — Board wipe

Use reusable multi-select/batch semantics where safe. Do not require one unrelated event commit per permanent merely because the UI processes many objects.

## J9 — Scry/Surveil

Use the existing private top-N projection, partition/order local draft, stale/object-id validation and one confirmed arrangement commit.

## J10 — Undo after hidden information

Undo may restore zones/state but cannot restore ignorance. UI must not represent information exposure as fully reversible.

---

# 12. Existing UI implementation audit to preserve

v6 retains the v5 implementation inventory.

## 12.1 CardActionSheet

Implemented mobile sheet / desktop popover with ranked actions and secondary actions. Reuse as an action presentation primitive; Context/authority/commit semantics remain caller/canonical concerns.

## 12.2 Manual target recording + StackBand

ManualTargetDialog records target relations for board understanding without pretending to be a complete legality engine. StackBand already renders target chips/arrows, compact/expanded Stack views and protects Stack movement from generic D&D bypass.

Formal target preparation and manual target recording remain semantically distinct even if presentation is later unified.

## 12.3 Scry / Surveil

Existing CockpitSelectionTools already provides:

- quantity,
- ExpectedInteractionContext capture,
- bounded private library access,
- top-N projection,
- partition to top/bottom or top/graveyard,
- ordering,
- local draft,
- object identity validation,
- stale/private invalidation,
- one arrangement commit,
- access release.

This is a strong Assistance Surface exemplar.

## 12.4 Mill

Existing quantity-based Mill captures Context, obtains necessary private projection, moves top N with semantic `mill` reason and releases temporary access.

## 12.5 Library Search

CockpitLibraryAccess provides request/release and bounded/full private projection.

CockpitFetchSearch demonstrates a specialized supported search WorkPanel with local draft, object-id validation, explicit “find nothing”, optional tapped entry and atomic supported commit.

Do not generalize this specialized support into a universal search rules engine.

## 12.6 Trigger Feed

Existing Feed already provides candidate review, Stack placement, manual-linking, dismissal reason and history. R6 changes its attention policy: Feed remains available, but ready Triggers do not automatically become forced foreground work.

Human causal explanation remains an R5 provenance dependency.

## 12.7 Selection/state/proliferate/mana utilities

Existing reusable mechanics confirm the R6 direction: consolidate a coherent grammar rather than proliferating card-specific widgets.

## 12.8 Existing solo/local spatial composition

The current one-player/local layout already expresses a useful paper-table geometry:

- opponent/public state on the far side,
- own battlefield in the center,
- lands/support/commander below the main permanent region,
- hand and Library/Graveyard/Exile near the player,
- Stack as a spatial overlay rather than a detached log.

R6 should preserve this near-side / center / far-side composition unless a responsive constraint makes it impossible.

The existing adaptive board is also an implementation asset: token/land bundling, attachment clustering, density-aware card sizing, dense overview, large-hand workspace, searchable/paginated zone projections, and draft-preserving board peek already handle pathological real Magic states. R6 layout work must not regress this reachability merely to simplify a mockup.

The companion solo-layout audit defines the detailed Preserve / Repair / Remove assessment.

---

# 13. Lifecycle taxonomy as negative constraints

R6 should know enough Magic structure to avoid false UI semantics, without turning the taxonomy into an implementation mandate.

| Family | UX constraint |
| --- | --- |
| Cast Spell | may require prepare/cost/target, then Stack |
| Activated Ability | may share prepare/cost/target/Stack skeleton; not called Cast |
| Triggered Ability | event-driven memory/registration; not Cast |
| Land Play | immediate game action; do not fabricate Stack |
| Mana Ability | immediate where canonically supported; do not fabricate Stack |
| Special Action | no fabricated Stack when rules say immediate |
| Turn-based Action | not user Cast/Activate work |
| State-based Action | stabilization semantics, not voluntary Cast |
| Static/Continuous | no fake Resolution session |
| Replacement/Prevention | correct resulting event/manual action; not post-hoc Correction |

This table is primarily a protection against semantic drift.

---

# 14. Feedback and recovery

Operation lifecycle should be understandable:

```text
○ 保存済み
◌ 送信中
? 結果未確認
↻ 再接続中
! 保存されていません
```

Unknown commit result suppresses casual retry until reconciliation.

Stale task/HOLD drafts explain that their initiating work changed and require re-selection/re-request rather than silently rebinding.

---

# 15. UI Translation Principles

R6.1 changes the visual center of gravity from:

> **“Make the one next Primary Action obvious.”**

into:

> **“Make the current table state obvious; surface the next action only where a real boundary requires it.”**

The existing solo/local table audit strengthens this further:

> **Preserve the physical table; replace the control hierarchy.**

## 15.1 Screen hierarchy

The UI is ordered conceptually as:

1. **Magic World** — the cards/zones/players themselves; dominant screen area.
2. **Orientation** — turn/phase/progress/foreground actor; compact and mostly descriptive.
3. **Conversation** — Stack + HOLD + response relation.
4. **Continuation** — unfinished Current Work that must survive browsing/nested work.
5. **Memory** — Trigger badge/feed and other remembered obligations.
6. **Persistence/Safety** — saved/unknown/reconnecting/stale only when relevant.

No persistent R6 chrome should reduce the battlefield to a small center viewport.

## 15.2 Preserve near/far paper-table composition

Where screen size permits, retain the existing spatial metaphor:

```text
far side    = opponent/public battlefield
center      = own battlefield
lower       = lands/support/commander
near side   = hand + Library/Graveyard/Exile
```

Do not flatten all seats/zones into equivalent dashboard cards merely for layout regularity.

## 15.3 Orientation, not control dashboard

Orientation answers:

- whose turn/progress is this,
- current phase/step at the product's supported fidelity,
- who is the foreground operator,
- whether parent work is suspended,
- high-value totals such as life/mana/Trigger count.

It should not permanently expose every manual mutation tool. Fine-grained mana/life/manual adjustment is secondary interaction, not core orientation chrome.

## 15.4 HOLD is visible conversation, not a mode screen

A non-current player may see a compact `HOLD / 待って` affordance.

After request:

```text
Aに応答を要求中…
```

Current operator sees a lightweight request such as:

```text
Bが応答を希望
[Bに操作を渡す]
```

After approval, the table/Stack stays visible and foreground actor changes to B.

Do not open a full-screen `Response Mode` that hides the board.

## 15.5 Stack visualizes nested conversation

Stack uses spatial ordering and focus to show:

- foreground Stack work,
- suspended parent responses,
- actual target relation,
- actor/controller.

Example:

```text
[C] C ← foreground
[B] B ← suspended parent response
[A] A
```

If parent B disappears, visual continuation skips B and returns to the nearest valid parent rather than preserving a dead UI layer.

## 15.6 Continuation is separate from Stack top

For nested Resolution:

```text
Stack:
[C]
[B]

Continuation:
《出現の根本原理》 — A
```

Continuation should normally be a compact persistent edge/bottom anchor rather than a large always-open panel.

Expanded WorkPanel remains useful for text, targets, source detail, assistance and exceptional finish controls.

## 15.7 Browsing uses semantic return, not navigation history

While viewing Graveyard/Library/Card detail:

```text
墓地を閲覧中
継続: 《Growth Spiral》解決中
[処理へ戻る]
```

Prefer this over an ambiguous generic `Back` when the important concept is resuming unfinished Magic work.

## 15.8 Trigger remains ambient

Default:

```text
🔔 3
```

Opening the badge shows remembered Trigger information. Ready Trigger does not become a giant CTA, blocking dialog, forced task queue, or automatic foreground.

## 15.9 Cooperative participation is table activity, not workflow

When B selects/discards their own cards or declares blockers during A's parent work, do not replace the table with `Waiting for B input` unless a real safety boundary requires blocking.

Privacy-safe activity may be visible:

```text
B: 3 cards selected
```

without revealing hidden card identities.

## 15.10 Selection visual grammar

Keep at least these meanings separate:

- **Focus** — what is being inspected/attended to.
- **Selected** — object explicitly chosen for the current local/shared operation.
- **Actionable** — known convenient candidate/affordance.

Do not encode these distinctions only by hue. Use shape/border/icon/position/label support for accessibility and dense boards.

## 15.11 Target vs association

Target Arrow is reserved for recorded actual target relationships.

Combat blocks, attachments and other non-target associations use distinct connectors/grouping/placement.

The existing attachment clustering is a good example of embedding relation into the Magic World without target-arrow misuse.

## 15.12 CardActionSheet is semantic-first

Promote natural Magic verbs where known:

- 唱える,
- 土地をプレイ,
- 能力を起動,
- マナを出す,
- 破壊する,
- 生け贄に捧げる,
- 捨てる,
- 追放する.

Demote generic geometry:

```text
その他…
  手動で移動
  Manual Event…
  盤面を訂正…
```

Do not remove generic paths; make them escape hatches instead of everyday vocabulary.

## 15.13 Direct manipulation stays first-class

Drag/drop is a valuable digital analogue of physically moving a card. R6 should not replace it with menus.

When semantic meaning is known, D&D should route to the same semantic operation as menu/action-sheet interaction. Generic move remains the honest fallback when meaning is unknown.

## 15.14 Avoid polymorphic hidden quick mutation

Single click/tap remains Inspect/Focus unless a visible selection task is active.

Double-click may be an optional accelerator only where its meaning is stable and discoverable; it must not remain the conceptual shortcut for “whatever the most likely mutation is”.

Keyboard/context-menu/drag/visible affordances should converge on the same semantic operation.

## 15.15 Manual Resolution uses progressive disclosure

Normal compact form:

```text
解決中 — 《Growth Spiral》
Draw a card...
🔔1                 [処理完了]
```

Show target/source detail when relevant; keep cost history, exceptional finish, provenance and advanced tools behind expansion.

The resolving card/work should feel like a card left visibly on the paper table, not an effect-execution form.

## 15.16 Existing density management is a preservation requirement

R6 must retain or improve reachability under real pathological states:

- responsive card sizing,
- token bundling,
- land bundling,
- attachment clustering,
- dense overview,
- large-hand workspace,
- searchable/paginated zones,
- board peek without destroying local drafts.

Do not optimize only for six-card mockups.

## 15.17 Feedback hierarchy

Successful routine mutation is quiet and local.

```text
✓ 保存済み
```

Uncertainty/safety is loud:

```text
? 保存結果を確認中
! この操作を始めた仕事は変わりました
↻ 再接続中
```

Do not use large success toasts that compete with the table.

## 15.18 Actor-owned Undo is visible only to the actor

History/activity may show another player's operation, but normal Undo affordance belongs to the operation actor.

This prevents foreground authority from visually implying ownership of other players' history.

## 15.19 Mobile is not a shrunken desktop

Mobile prioritizes:

```text
Board
+ compact Orientation
+ sticky/compact Continuation
```

Stack/HOLD/Feed/Detail open as temporary sheets/projections while preserving a return anchor to the table.

The existing adaptive Board/Hand density logic is reusable, but multiplayer's current wide-screen-only notice is not an R6 target state.

## 15.20 Limited visual vocabulary

Prefer a small stable set:

| Visual | Meaning |
| --- | --- |
| card/object itself | Magic object |
| weak affordance | actionable |
| strong outline | selected |
| Target Arrow | target |
| connector/grouping | non-target relation |
| Stack overlap | response/order |
| edge/bottom anchor | unfinished Continuation |
| player indicator | foreground actor |
| HOLD indicator | wants operation authority |
| 🔔 badge | remembered Trigger |
| motion | semantic lifecycle transition |
| ✓ / ? / ! | persistence certainty |

Do not add decorative states that compete with this grammar.

---

# 16. Existing solo layout — Preserve / Repair / Remove summary

The companion audit's central conclusion is:

> **The existing solo layout is not a failed layout that R6 should replace. Its physical Magic-table skeleton is one of the strongest parts of the product.**

## Preserve

- central board-first composition,
- near-side hand and zone locality,
- far-side opponent/public board orientation,
- creature vs lands/support spatial organization,
- Commander table locality,
- adaptive dense-board sizing,
- token/land bundling,
- attachment clustering,
- large-hand workspace,
- searchable/paginated zone projections,
- board peek and local-draft preservation,
- StackBand's spatial substrate.

## Repair

- global Primary Action as the main mental model,
- status band mixing orientation with detailed mutation controls,
- `panel = zone | work | stack` user-facing semantics,
- generic `操作` toolbox prominence,
- generic D&D meaning when semantic action is known,
- Current Work being something users must reopen rather than a persistent anchor,
- polymorphic double-click/quick mutation,
- “virtual opponent” wording where it implies simulated agency,
- decorative lighting if it competes with semantics.

## Remove/demote from the R6 target UX

- Trigger-as-progression-gate,
- forced Trigger-as-next-task CTA,
- one omnipotent changing Primary Action button,
- geometry-first everyday action menus,
- Work/Stack/Zone as mutually exclusive game meanings,
- double-click-only or hidden mutation as a required efficient path.

The redesign stance is therefore:

> **Preserve the physical table; replace the control hierarchy.**

---

# 17. Feedback and recovery

Operation lifecycle should be understandable:

```text
○ 保存済み
◌ 送信中
? 結果未確認
↻ 再接続中
! 保存されていません
```

Unknown commit result suppresses casual retry until reconciliation.

Stale task/HOLD drafts explain that their initiating work changed and require re-selection/re-request rather than silently rebinding.

---

# 18. R6 implementation direction

## P0 — protect the table while fixing control hierarchy

1. preserve existing near/center/far Magic World composition,
2. derive compact Orientation independently from mutation tools,
3. add persistent Continuation / Current Work anchor,
4. remove Trigger from progression arbitration in target UX,
5. clarify foreground actor / HOLD request / approval without response-mode takeover,
6. extend StackBand presentation for foreground vs suspended parents,
7. converge card/menu/drag/keyboard on semantic operations.

## P1 — consolidate existing assistance

1. common Assistance Surface shell,
2. quantity + ordering grammar,
3. semantic-first CardActionSheet,
4. authorized private-zone UX,
5. selection-as-communication without secret leakage,
6. cooperative participant interaction such as blocker declaration,
7. mobile-native Board + Orientation + Continuation.

## P2 — R5-backed Trigger presentation and further safe acceleration

1. human causal Trigger provenance when R5 provides it,
2. improved ambient trigger memory,
3. further bulk semantic actions where event meaning is preserved,
4. common finite entry-state helpers.

## Non-goals

- full priority-pass UI,
- generic APNAP workflow,
- general Oracle parser,
- full legality engine,
- general continuous/layer engine,
- general replacement/prevention engine,
- card-specific effect wizards by default,
- generic remote-decision workflow for public conversation,
- generic Participant Input state machine,
- Trigger-as-progress-gate,
- second canonical R6 mode/context state machine,
- full-screen replacement of the existing spatial table merely to simplify implementation.

---

# 19. Adversarial review — attack v6.2 from both directions

## 19.1 Failure mode A — becoming Arena / a rules engine

### Attack: HOLD becomes a full priority engine

Rejected. HOLD only materializes a voluntary interruption when a non-current player wants shared operation authority. There is no mandatory all-player Pass loop.

### Attack: Trigger Memory enforces rules progression

Rejected. Ready Trigger remains ambient/soft reminder. R6 does not block normal progression merely because a Trigger is ready.

### Attack: participant choices become distributed workflow

Rejected. Public choices remain voice; players directly manipulate their authorized world objects. There is no generic Decision Actor/Participant Input state machine.

### Attack: static/replacement effects require engine automation

Rejected. These are Human/Table Resolved by default unless finite automation has clear value and semantic certainty.

### Attack: Scry/Search existing helpers imply Oracle execution

Rejected. They are Assistance Surfaces, not evidence of general card-text understanding.

**Result:** v6.2 does not require a full rules engine to be coherent.

## 19.2 Failure mode B — becoming an unsafe free-form sandbox

### Attack: cooperative manipulation destroys Context/Cause

Mitigation: mutations still travel through canonical semantic/Manual Event/Correction paths and ExpectedInteractionContext. Cooperative freedom does not mean raw unbound mutation.

### Attack: HOLD requests accidentally apply to later work

Mitigation: request is identity/Context-bound and becomes stale on work change.

### Attack: a child response disappears but authority returns to a dead parent

Mitigation: resume nearest still-valid parent work, then Continuation.

### Attack: hidden information leaks through shared selection

Mitigation: shared selection metadata must be privacy-safe; identities remain visible only to authorized viewers.

### Attack: Undo allows current operator to rewrite another player's history

Rejected. Normal Undo is actor-owned and minimal.

### Attack: Undo falsely claims secret knowledge was erased

Rejected. Knowledge is irreversible and UI must say so where relevant.

### Attack: Human/Table Resolved means every mutation is arbitrary

Rejected. Context/Cause, semantic operations, hidden-information projection, stale safety, commit/recovery and Correction boundaries remain strict.

**Result:** v6.2 preserves a controlled shared table rather than a raw sandbox.

## 19.3 Failure mode C — redesign destroys the good existing table

### Attack: R6 becomes a work-dashboard rewrite

Rejected. Existing near/far battlefield, hand locality, density management, bundling, attachments and workspaces are explicit preservation targets.

### Attack: persistent Current Work consumes the battlefield

Rejected. Continuation is compact by default and expands only when the user needs text/tools.

### Attack: semantic menus kill direct manipulation

Rejected. Drag remains first-class and converges on semantic actions where known.

### Attack: cleaner mocks regress extreme board states

Rejected. Pathological-state reachability is now an explicit acceptance condition.

### Attack: existing UI components are discarded because their hierarchy is wrong

Rejected. CardActionSheet, StackBand, HandRibbon, Board/SupportRow, Scry/Surveil/Search surfaces and Feed are integration assets; R6 changes hierarchy/meaning before considering replacement.

**Result:** R6 targets evolutionary restructuring rather than visual reset.

---

# 20. Final v6.2 design tests

Every future R6 design change should answer:

1. How would players naturally do this at a paper table?
2. What specifically is lost by remote/digital play?
3. Is OneDeck restoring only that lost capability?
4. Is this human Magic judgment or bookkeeping/synchronization?
5. Can voice solve the human choice without software workflow?
6. Does the battlefield remain the dominant contiguous screen surface?
7. Does the hand retain near-player spatial identity?
8. Does opponent/public state retain table orientation where practical?
9. Does Current Work survive every authorized View change?
10. Is Primary Operator being confused with exclusive object ownership?
11. Is HOLD being used only for voluntary foreground interruption?
12. Is the HOLD request bound to the exact initiating interaction identity/context?
13. Does a nested response unwind to the nearest still-valid parent?
14. Is a Trigger remembering something without stealing authority or blocking progress?
15. Can another player manipulate their own authorized object without unnecessary permission ceremony?
16. Does shared selection avoid leaking private identities?
17. Is Focus distinct from Selected and Actionable?
18. Is the operation's semantic capability level honest?
19. Does geometry avoid inventing Magic meaning?
20. Are target arrows reserved for actual targets?
21. Are non-Stack actions protected from Stack-shaped UI assumptions?
22. Does Manual/Human-Table-Resolved remain a first-class success path?
23. Is Undo actor-owned and honest about irreversible information?
24. Is Correction still visibly exceptional?
25. Is reconnect/recovery derived from canonical state rather than local fiction?
26. Are existing safe UI primitives being consolidated rather than discarded?
27. Does the design still reach every card under large hand/battlefield states?
28. Does the design still work on mobile without replacing the Magic world with chrome?
29. Is decorative UI subordinate to selection/target/persistence semantics?
30. Does the implementation add enough repeated-game value to justify its complexity?

If a proposed feature fails the paper-table translation test, requires a general rules engine merely for convenience, creates a second canonical R6 state machine, or destroys the useful existing table geometry, stop and re-audit before implementing it.

---

# 21. v6.2 architecture invariants

1. OneDeck reconstructs a remote paper Magic table; it does not attempt to become Arena.
2. Voice is a first-class interaction channel.
3. Magic judgment remains with humans by default.
4. R6 creates no second canonical game-state/mode machine.
5. View changes do not change Continuation.
6. Primary Operator owns the parent lifecycle boundary, not every object operation.
7. Cooperative participants may manipulate their own authorized Magic-world objects during shared work.
8. Participant Input is not a generic state machine.
9. HOLD is an approved, identity-bound request for voluntary foreground operation authority.
10. HOLD is not generic pause, APNAP workflow or rules-discussion mode.
11. Only one simultaneous HOLD requester is approved; remaining requests expire after state change.
12. Parent Progress/Resolution ownership is suspended, not transferred, during HOLD response work.
13. HOLD actor retains foreground ownership until their response work resolves or is removed.
14. Nested response completion resumes the nearest valid parent; removed parents are skipped.
15. The current operator may create nested Formal Actions without HOLD.
16. Trigger detection/remembering never automatically transfers authority.
17. Ready Trigger is ambient memory, not a progress gate.
18. Trigger Stack mutation by a non-current player uses ordinary HOLD authority.
19. Authorized viewing never expands secret authority.
20. Shared selection may communicate count/state without exposing hidden identities.
21. Context/Cause remain strict even under cooperative manipulation.
22. Stale gestures, drafts and HOLD requests never silently rebind.
23. Geometry never manufactures semantic meaning.
24. Target Arrow means target, not generic association.
25. Land play / immediate mana / special/automatic actions are not forced through Stack-shaped UI.
26. Static/continuous/replacement complexity is Manual-first unless finite automation earns its cost.
27. Undo is actor-owned and minimal.
28. Undo cannot erase knowledge already revealed.
29. Undo and Correction remain separate concepts.
30. Unknown commit results reconcile before casual retry.
31. Existing private-library and stale-choice safety patterns are preserved.
32. Manual Resolution + voice is a product strategy, not a fallback embarrassment.
33. Existing near-side/center/far-side table geometry is a preservation target.
34. Existing density, bundling, attachment and large-zone reachability are preservation targets.
35. Orientation chrome remains subordinate to the Magic World.
36. Trigger is not promoted into the global primary progression control.
37. Work/Stack/Zone projections do not erase each other's semantic axes.
38. Direct manipulation remains first-class; semantic menus complement rather than replace it.
