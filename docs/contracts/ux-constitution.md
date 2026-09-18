# OneDeck UX Constitution

Updated: 2026-09-18
Version: v6.4
Status: active upper interaction contract

This contract governs product interaction semantics for OneDeck. Product Requirements owns product WHY/WHAT; this Constitution owns the interaction semantics that make those outcomes coherent. Lower engine/UI contracts define implementation truth inside their domains; when a lower contract's UX interpretation conflicts with this document, the lower contract must be reconciled explicitly rather than silently overriding this constitution. This contract does not authorize weakening frozen engine safety, hidden-information boundaries, canonical identity, persistence, or recovery semantics.

## 1. Product thesis

<!-- clause: UX-CONST-REALITY -->
OneDeck reconstructs the shared paper Magic table for remote/digital play. Players play Magic; OneDeck follows naturally.

Voice/table conversation is a first-class interaction channel. OneDeck should externalize the parts that digital/remote play loses: shared state, causality, synchronization, continuation, memory and safe authority. Human Magic judgment remains authoritative unless OneDeck has explicitly earned a bounded automation capability.

The Magic World — cards, players, zones, battlefield, Stack and their visible relations — is the primary workspace. Application chrome must remain subordinate to it.

## 2. Human authority and automation

### 2.1 Human confirmed action wins

<!-- clause: UX-CONST-CORRECTION -->
When a human has explicitly confirmed an operation or correction, that confirmed intent is authoritative over conflicting automation. Automation must not silently overwrite a later human-confirmed state.

### 2.2 Automation is an ROI decision

<!-- clause: UX-CONST-AUTOMATION -->
Automation is permitted when repeated-game value justifies implementation and maintenance cost. High-value automation is not prohibited merely because OneDeck is not a general rules engine.

The safety model is not “automate only what can never be wrong.” OneDeck may automate bounded semantics when confidence and value justify it because Undo and Correction exist as recovery mechanisms. However, automation must remain observable, attributable and reversible where state permits.

### 2.3 Known means explicit capability, not UI inference

“OneDeck knows” means the relevant semantic fact is supplied by an explicit, reviewed capability in canonical code/data/contract — for example a supported engine primitive, reviewed card/mechanic structure, deterministic event provenance, or another bounded semantic recognizer.

Geometry, button labels, card location, incidental Oracle-string matching, or UI convenience alone do not constitute knowledge.

### 2.4 General Rules Engine is a separate architecture axis

Automation level and rules-engine architecture are independent. OneDeck may automate valuable bounded mechanics without committing to a general Oracle parser or complete Comprehensive Rules engine.

### 2.5 Trigger automation boundary

When OneDeck can safely determine that a supported Trigger actually occurred, it may automatically create/remember the pending Trigger. If occurrence cannot be established safely, human/table confirmation remains authoritative.

Frequent human confirmation is not a reason to normalize confirmation forever; it is evidence that the area may deserve future automation investment.

Trigger memory does not itself steal foreground authority or block normal progress.

### 2.6 Combat automation

High-frequency combat semantics such as first strike, double strike, trample, deathtouch and lifelink are valid automation targets when implemented as reviewed bounded capabilities. Combat sequencing must not assume a fixed single-combat-per-turn model; additional combat phases/steps are legal interaction structures the UI must be able to represent.

## 3. Manual Resolution and semantic honesty

<!-- clause: UX-CONST-MANUAL -->
Manual Resolution is a normal success path. OneDeck does not need to generate a card-specific effect wizard for arbitrary Oracle text.

The current parent Resolution owner performs that Resolution's effect application, may manipulate real Magic-world objects, records targets/associations where useful, and owns the `処理完了` lifecycle boundary. Other players retain any Magic-required Choice Authority and communicate those choices primarily through voice or lightweight choice signals; their participation alone does not transfer the parent Resolution or mutate canonical GameState.

OneDeck must not claim rules correctness merely because processing was recorded.

Finite reusable assistance surfaces — target selection, quantity, ordering, Scry/Surveil, search, multi-select and entry-state setup — are allowed when they earn their cost. General card-specific UI generation remains a non-goal unless a future architecture decision explicitly changes it.

Long-lived or unusual semantic state that is expensive to model may be supplemented by a visible player memo/notes facility. A memo is human memory, not canonical rules truth, and must never silently acquire engine authority.

## 4. Context, Cause and geometry

Geometry never manufactures Magic meaning. `Library → Hand` is not automatically Draw; `Battlefield → Graveyard` is not automatically Destroy or Sacrifice.

`Look`, `Reveal`, and `Move` are distinct interactions. Seeing a card does not itself move it, moving a card does not imply it was revealed, and UI geometry must not silently widen the intended audience.

When semantic meaning is known, preserve it. When unknown, remain honest and Manual.

Cost Work and Effect Work remain distinct even when they use the same physical verb. Target arrows represent actual recorded targets only; attachments, combat and other associations use separate relation semantics.

## 5. Direct manipulation

The Magic World remains directly manipulable. Drag/drop and context/action surfaces must converge on the same semantic operation when meaning is known.

Single click/tap is Inspect/Focus unless a visible selection task is active. Double-click may be an optional accelerator but must not be the only mutation path or a polymorphic hidden “do the likely thing” contract.

## 6. Game lifecycle

### 6.1 Before the game

The experience begins with a deck, not a rules engine.

A player chooses a deck and intent:

- solo/table practice: play, inspect and tune the deck;
- scheduled/social play: create or join a room and play against other people.

Ordinary room defaults should allow players to start without configuring a rules dashboard.

### 6.2 Solo first-player default

Solo/table-practice play defaults to the user being first player. This is a product default, not a claim about tournament procedure.

### 6.3 Pregame and turn zero

<!-- clause: UX-CONST-PREGAME -->
Pregame must support a visible human checkpoint for game-start actions that occur before the first ordinary turn/step. The paper-table grammar is effectively “0ターン目の処理ありますか？”.

Effects such as Gemstone Caverns demonstrate why Pregame cannot be modeled as only mulligan → first upkeep. OneDeck need not understand every such card; it must preserve a Manual-first opportunity to perform supported/manual game-start operations before Turn 1 begins.

### 6.4 Normal and Full Control

<!-- clause: UX-CONST-CONTROL -->
OneDeck supports two interaction attitudes analogous to paper/Arena practice without copying Arena's full rules engine:

- Normal: skip low-value empty stopping points when OneDeck can safely do so; progress naturally toward meaningful interaction.
- Full Control: stop at supported phase/step boundaries so the player can act manually before advancing.

The mode controls stopping behavior, not hidden-information authority or rules correctness.

### 6.5 Phase/step progression

The turn/progress owner normally owns the explicit progression control. In Full Control, the UI stops at supported boundaries such as upkeep/draw before progression. The player may manipulate objects/cast/activate as appropriate and then explicitly advance.

Normal mode may move through routine empty boundaries, but human HOLD/explicit action and canonical unresolved work take precedence.

## 7. HOLD and Stack conversation

<!-- clause: UX-CONST-HOLD -->
HOLD materializes “wait, I want to act now” as a safe request for foreground operation authority.

The turn/current operator owns phase progression and Stack-resolution progression. Before that progression is committed, another player may request HOLD. The current operator approves one requester. HOLD does not instantly steal authority and is not a generic pause, discussion mode or full CR priority exchange implementation.

A HOLD request is bound to the exact initiating interaction identity/context. If that context changes, the request becomes stale rather than rebinding to later work.

Granted HOLD suspends parent progress; it does not transfer turn ownership or parent Resolution ownership. Nested HOLD unwinds to the nearest still-valid parent work. If the requester misses the timing and the table agrees, ordinary Undo/Correction is used rather than inventing a hidden priority history.

An action explicitly granted by the resolving effect — for example, “B may cast a spell” during A's Resolution — is not a HOLD. The granted player performs that bounded Magic action as its actor, while the parent Resolution remains owned by its original operator and resumes after the granted action is committed.

Stack presentation should make ordering, foreground work, suspended parents, actor/controller and recorded targets spatially legible.

## 8. Cooperative participation

<!-- clause: UX-CONST-CHOICE -->
Primary Operator owns the current parent Resolution lifecycle and its effect application. This does not give that player another participant's Magic-required decisions.

When A's Resolution requires B to choose, B retains Choice Authority. Public choices normally remain voice/table conversation; lightweight highlight/selection may externalize the choice when useful. A choice signal is not itself a canonical zone move, Reveal, committed Magic operation, or transfer of parent Resolution ownership.

If a choice must remain secret from other participants, OneDeck may use the smallest privacy-preserving selection aid needed to keep the intended audience correct. It does not require a generic Participant Input state machine.

Rule-defined independent actions belong to the player whom the rules assign that action. For example, a defending player directly declares their own blockers; this is not merely a choice inside another player's parent Resolution.

<!-- clause: UX-CONST-GRANTED-ACTION -->
When a resolving effect explicitly instructs or permits another player to perform an independent Magic action such as casting a spell, that player performs the bounded action as its actor without requesting HOLD. Spell selection, modes, targets, costs and other choices belonging to that action remain with that actor. The original parent Resolution stays owned by its original operator and resumes after the granted action is committed.

Hidden-information authority remains independent from parent Resolution, foreground and HOLD authority.

## 9. Undo and Correction

### 9.1 Undo is actor-owned and chronological

<!-- clause: UX-CONST-UNDO -->
Undo walks one shared committed history strictly newest-first. It cannot surgically remove an older operation while later committed operations remain.

Normal Undo belongs to the actor who performed the current undoable operation. Foreground authority and Room Owner status do not grant general permission to erase another player's history. If that actor is unavailable in the session, the Room Owner may act only as an explicit recovery proxy once that actor's operation is the current undoable top; this exception does not create ordinary Magic operation authority.

### 9.2 One press means one undo unit

One Undo invocation reverts exactly one supported committed operation/transaction unit. It never means “rewind this whole response scope.” To go farther back, invoke Undo repeatedly.

### 9.3 Processing boundary

For Manual Resolution, operations performed before `処理完了` remain individually undoable according to their committed transaction boundaries. `処理完了` is itself a lifecycle boundary; Undo does not silently collapse the entire preceding Resolution into one mega-undo.

### 9.4 Undo cannot erase knowledge

Canonical state may be restored, but revealed/observed information cannot become unknown again. UI must not claim otherwise.

### 9.5 Correction is different

Correction means canonical shared state does not match the table's agreed reality and must be repaired. It is exceptional and explicitly labelled. Human-confirmed Correction outranks conflicting automation.

## 10. Room owner and player lifecycle

<!-- clause: UX-CONST-ELIMINATION -->
Room Owner is session-administration authority and is separate from Turn Owner, Primary Operator and foreground/HOLD authority.

The Room Owner may perform administrative actions required to keep the session viable, including removing a participant who cannot return and force-ending/dissolving the room. These actions must be explicit and attributable; they do not grant ordinary Magic operation authority.

Narrowly defined recovery proxies are exceptions, not a transfer of player authority. A Room Owner may proxy an unavailable actor's Undo only at the current shared-history top, and may advance a choice on behalf of an unavailable player only when the relevant information is public and no meaningful strategic discretion exists. Hidden or strategically meaningful choices wait for the player rather than being guessed.

When a player is eliminated/removed from the game, their owned game objects must cease participating in ordinary game zones/interaction. Implementation may represent this with a dedicated removed-from-game/eliminated-owner holding domain, but it must not masquerade as ordinary Exile and must preserve enough identity/history for recovery/inspection where required.

Temporary network disconnection is not itself elimination. Reconnect/reconciliation should restore canonical participation when possible; owner removal is a separate explicit administrative decision.

## 11. Continuation, viewing and recovery

<!-- clause: UX-CONST-INFORMATION -->
Viewing authorized information is free and does not change Current Work. Current Work/Continuation must remain visible or one semantic action away while browsing zones, cards or assistance surfaces.

Information has an intended audience. At minimum OneDeck must be able to distinguish self, specific participant(s), and the table/all players when Magic semantics require it. Primary Operator, foreground, HOLD or Room Owner status alone never widens hidden-information authority.

When an effect requires information to be shown, OneDeck must support an explicit Reveal to the intended audience rather than inferring disclosure from zone geometry. Temporary Reveal and persistent visibility are distinct semantics. `Look`, `Reveal`, and `Move` must remain separately understandable to players.

Unknown commit results reconcile before casual retry. Stale gestures, pending edits, selections and HOLD requests never silently rebind. Secret authority is never widened by reconnect, HOLD or view changes.

## 12. Trigger memory

Ready Trigger is ambient remembered obligation, not a global progression gate. Trigger detection/remembering and Trigger Stack operation authority are separate.

Anyone may inspect trigger information they are authorized to see. A non-current player who wants to manipulate/register their Trigger on the shared Stack uses the ordinary HOLD grammar when foreground authority is required.

## 13. UI hierarchy

Preserve the existing paper-table geometry where practical:

- opponent/public state on the far side;
- battlefield as the dominant contiguous region;
- lands/support/commander spatially organized without becoming a dashboard;
- hand and physical zones near the player;
- Stack as spatial conversation;
- compact Orientation and Continuation around, not instead of, the table.

Preserve density management, bundling, attachment clustering, large-hand workspace, searchable/paginated zones and board-peek/local-edit continuity.

Demote the single omnipotent Primary Action mental model, Trigger-as-next-task gating, geometry-first everyday menus, mutually exclusive Work/Stack/Zone meanings and hidden quick-mutation shortcuts.

## 14. Non-goals

R6 does not require:

- a general Oracle parser;
- a complete Magic legality/rules engine;
- mandatory all-player priority exchange;
- generic APNAP workflow;
- generic Participant Input state machine;
- a speculative general permission/audience framework beyond demonstrated player journeys;
- card-specific effect wizards by default;
- a general continuous/layer engine;
- a general replacement/prevention engine;
- Trigger-as-progress-gate;
- a second canonical R6 state machine;
- replacing the useful spatial table with a workflow dashboard.

## 15. Constitutional invariants

1. Magic World and human conversation are primary.
2. Human-confirmed intent/correction outranks conflicting automation.
3. Automation is justified by repeated-game ROI, bounded knowledge and recoverability, not by pursuit of a complete rules engine.
4. “Known” requires explicit reviewed semantic capability; geometry/UI inference is insufficient.
5. General Rules Engine architecture is independent from automation level.
6. Manual Resolution is a first-class success path.
7. Current Work survives authorized view changes.
8. Geometry never invents semantic meaning.
9. Parent Resolution Owner owns that Resolution's lifecycle and effect application; another player's Choice Authority alone does not transfer ownership or mutate canonical state.
10. HOLD is approved, identity-bound foreground interruption before progression/resolution commit.
11. HOLD does not implement mandatory full priority exchange.
12. Trigger memory does not steal authority or gate progress.
13. Supported Trigger occurrence may be auto-remembered; uncertain occurrence returns to humans.
14. High-value bounded combat semantics are valid automation targets.
15. Turn/combat representation must tolerate additional combat phases/steps.
16. Normal vs Full Control changes stopping behavior, not rules authority.
17. Pregame includes a Manual-first turn-zero opportunity before Turn 1.
18. Solo/table practice defaults to the user being first player.
19. Undo is actor-owned, follows one shared strict newest-first history, and one invocation reverts one committed unit; unavailable-actor Room Owner proxy is limited to the current undoable top.
20. `処理完了` is a lifecycle boundary, not a mega-undo grouping of all prior Resolution operations.
21. Undo cannot erase already learned information.
22. Correction remains distinct, explicit and human-authoritative.
23. Room Owner administration is separate from Magic operation authority; only explicitly defined recovery proxies are exceptions.
24. Disconnection is not elimination; explicit removal is distinct.
25. Eliminated-player objects cease ordinary game participation and are not mislabeled as ordinary Exile.
26. Long-lived human memo state never silently becomes canonical rules truth.
27. Stale work never silently rebinds.
28. Unknown persistence result reconciles before retry.
29. Hidden-information authority remains independent from parent Resolution, foreground, HOLD and Room Owner authority.
30. Existing spatial-table and pathological-state reachability are preservation requirements.
31. Effect-granted independent Magic actions belong to their acting player, require no HOLD, and do not transfer the parent Resolution.
32. Rule-defined independent actions such as blocker declaration belong to the player whom the rules assign that action.
33. `Look`, `Reveal`, and `Move` are distinct; Reveal changes audience, not zone, and learned information is not erased by Undo.

## 16. Compatibility rule

The detailed R6 v6.2 design documents remain design rationale and implementation guidance. Where they conflict with this v6.4 active contract, this contract governs R6 interaction intent. Frozen engine safety and canonical semantics are not silently rewritten by this document: collisions must be explicitly classified and resolved in the affected lower contract before implementation.