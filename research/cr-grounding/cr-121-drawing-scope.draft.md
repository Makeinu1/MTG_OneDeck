# cr-121-drawing scope draft

Status: SCOPING ONLY. Judge-owned specification and tests are unchanged. This draft is grounded in CR 121.1--121.4, 104.3c, and 704.5b (the supplied brief says 703.4d, but the pinned 2026-06-19 CR text has 703.4d as the draw-step turn-based action; the empty-library loss SBA is 704.5b).

## One-line conclusion

**縮小した。ただし genuine gap 有り**: fixed-N self draw (including ETB/attack/upkeep-triggered effects) is already shipped end-to-end; the remaining CR-121-sized work is not a new draw-N guided catalog but an adversarial guard against mixed/cross-player clauses being partially auto-compiled (demonstrated by Tataru Taru). Variable-count and opponent draw execution remain explicitly deferred.

## Existing implementation map

| Layer | Evidence | What already works |
|---|---|---|
| Command vocabulary | `src/engine/commands.ts:138` | Existing `{ type: 'draw'; count: number }`; no new `GameCommand` is needed. |
| Draw substrate | `src/engine/commands.ts:696-720`, `2114-2130` | `drawCards` loops once per requested card, moves library top to hand, and emits one linked `DrawEvent` per individual draw. This implements CR 121.1 and 121.2 rather than an aggregate zone move. |
| Empty-library attempt | `src/engine/commands.ts:2104-2121`, `1766-1797` | Each unavailable draw emits `result:'empty-library-attempt'`, records the per-player flag, and the next SBA pass adds the defeat advisory. This is already the required CR 121.4/104.3c/704.5b behavior; do not reimplement it. |
| Grammar count leaf | `src/engine/grammar/ir.ts:53-63`, `221-239`; `src/engine/grammar/compile.ts:616-628`, `842-846`, `967-972`, `1118-1125` | `a/an`, number words two--ten, and digits resolve to a fixed count; supported self-subject draw produces the existing draw command. X/for-each/unknown remain variable/manual. |
| Trigger-independent compilation | `src/engine/grammar/ir.ts:69-93`, `175-208`; `src/engine/grammar/compile.ts:338-380` | The effect span is separated from a triggered prefix before leaf compilation. Therefore the draw leaf is not limited to sorceries: `At the beginning of your upkeep, draw two cards.` and `Whenever this creature attacks, draw two cards.` both currently compile `decision:'auto'`, `commands:[{type:'draw',count:2}]` (direct runtime probe on 2026-07-12). |
| Trigger discovery | `src/engine/triggers.ts:225-226`, `400-407`, `458-480` | Upkeep and attack trigger candidates already exist. ETB trigger resolution is also covered by existing store tests, e.g. `src/store/__tests__/triggerEventSubscriptions.test.ts:162` and numerous ETB goldens in `crGroundingGoldenCases.test.ts`. No trigger-origin-specific draw leaf is missing. |
| Store execution | `src/store/gameStore.ts:1969-1971`, `1261-1298`, `2782-2800` | Direct draw dispatch and auto/guided stack resolution ultimately apply command lists through the same substrate. Mixed guided effects preserve deterministic commands until prompts are answered. |
| Existing executable evidence | `src/engine/__tests__/cr121DrawCompiler.test.ts:28-53`; `src/store/__tests__/cr121DrawAuto.test.ts:36-108` | Fixed self draw 1/2 is auto, target/each-player and X are manual; stack resolution emits individual events and empty-library advisory. Engine-spec §32.8 (`docs/engine-spec.md:1681-1690`) already says this is shipped. |

Consequently, ETB/attack/upkeep are not three missing draw implementations. Once their trigger is placed/resolved, each uses the already-general effect compiler. Adding a “draw-N guided leaf catalog” would duplicate shipped behavior and is out of scope unless a concrete syntax counterexample is first demonstrated.

## Golden-candidate reality check

Oracle text was checked against the repository's 2026-06-19 Scryfall snapshot for the three recent cards; Blue Sun's Zenith predates that snapshot's date window, so its established Oracle wording is recorded as a judge-verification item before spec ownership: “Target player draws X cards. Shuffle Blue Sun's Zenith into its owner's library.” English `oracleText` is authoritative.

| Card | Relevant Oracle text | Current classification / behavior | Actual residual |
|---|---|---|---|
| Tataru Taru | `When Tataru Taru enters, you draw a card and target opponent may draw a card.` | **Incorrectly auto** in a direct compiler probe: one `{draw,count:1}` for P1. `hasSupportedPlayerSubject` accepts `you draw`, while the same raw clause's target/opponent/optional tail is not made a blocker. This silently executes only part of the instruction. Its second ability reads opponent draw events and creates a tapped Treasure; it is not a draw-producing leaf. | **Genuine safety gap**: mixed self + target-opponent draw must be honest manual (or otherwise reject auto) under this slice. Do not implement opponent draw. CR 121.2c is additional reason not to pretend multi-player draws are a P1-only command. |
| Fear of Missing Out | `When this creature enters, discard a card, then draw a card.` | **Already guided**, not missing: the comma/`then` split yields guided discard plus deterministic `{draw,count:1}`, carried until confirmation (`gameStore.ts:1279-1298`). The attack ability untaps and creates an extra combat; it contains no draw. | No CR-121 gap. A golden should lock in “guided discard then exactly one draw,” not request a new draw leaf. CR 121.1. |
| Banon, the Returners' Leader | `Whenever you attack, you may pay {1} and discard a card. If you do, draw a card.` | **Manual** in a direct compiler probe (`optional`, `needs-choice`, `needs-parse`). The draw is conditional on optional payment+discard, so auto draw would be wrong. | No standalone draw-N gap. Keep manual until conditional optional-cost effect execution is separately modeled; that is not a CR-121 draw substrate problem. |
| Blue Sun's Zenith | `Target player draws X cards. Shuffle Blue Sun's Zenith into its owner's library.` | Draw clause is variable and target-player; current `Draw X cards.` already returns manual/`variable-count`, and target-player fixed draw is also pinned manual by `cr121DrawCompiler.test.ts:41-53`. | Explicit variable-count + opponent/target-player defer boundary. Golden must assert manual and zero emitted draw commands, including when X could be chosen as a concrete value in UI. The self-shuffle clause does not make partial execution acceptable. |

## True residual gap

The only demonstrated residual inside the requested slice is **partial-auto prevention for a clause that combines supported self draw with unsupported target/opponent draw**. The current subject predicate (`compile.ts:967-972`) asks whether a supported self subject occurs, not whether it is the *only* affected player. Tataru Taru proves that the existing general compiler can return `auto` despite IR status `partial`/`construct.target` and despite an unsupported remainder.

This should be scoped as an honesty guard, not as opponent-draw support:

1. A draw effect may auto-emit the existing P1 `draw` command only when the complete draw clause is exclusively an unconditional self draw of a fixed count.
2. A raw draw clause containing `target player`, `target opponent`, `opponent`, `each player`, `each opponent`, `that player`, or multiple draw recipients must remain manual in this slice, even if it also contains `you draw`.
3. Optional/conditional draw remains manual unless the surrounding already-supported guided flow deterministically establishes the condition. No partial command may survive a manual decision.

CR grounding: CR 121.1 defines the affected player's library-to-hand action; CR 121.2 requires individual draws; CR 121.2c defines ordering when more than one player is instructed. The current command is P1-specific (`pushDrawEvent`, `commands.ts:703-706`), so it cannot faithfully encode the unsupported recipient portion.

## Proposed minimal engine-spec section draft

> **CR 121 fixed draw leaf -- residual honesty boundary.** Fixed-count, unconditional self draw is already auto and composes to the existing `{type:'draw', count:N}` command; triggered origin (ETB, attack, upkeep) does not change classification (CR 121.1--121.2). No new command or state is introduced. A clause is eligible only when its complete draw instruction affects P1 alone. Mixed self/opponent, target-player, each-player/opponent, optional, conditional, for-each, “that many,” and X forms are manual; the compiler must not emit the supported self subset of an unsupported multi-recipient clause (CR 121.2c). Empty-library attempts reuse the existing DrawEvent + SBA advisory path (CR 104.3c, 121.4, 704.5b).

This is smaller than a new §32 catalog: it is a clarification/adversarial pin on the existing §32.8 contract. Existing command composition is sufficient. No `GameState`, `PlayerId`, zone, prompt kind, or `GameCommand` addition is justified.

## Golden and adversarial test draft

Judge-owned test names/locations are suggestions only; this draft does not alter `review.*`.

- Existing-positive fixed N: direct `Draw a card.` and `Draw two cards.` remain auto with exactly one draw command carrying count 1/2. On execution with enough library cards, assert N individual `DrawEvent(result:'drawn')`, ordinal 1..N, each linked to its own library-to-hand `ZoneChangeEvent` (CR 121.1--121.2).
- Trigger-origin parity: compile/resolve representative ETB, attack, and upkeep `draw two cards` effects and assert the same command/event result. This is a regression pin for already-working behavior, not acceptance evidence for new catalog code.
- Guided composition: Fear of Missing Out remains guided for discard; before confirmation no draw occurs, and after choosing the discarded card exactly one draw occurs after discard. This guards ordering without adding a draw prompt (CR 121.1).
- Empty library: request two draws with one card remaining. Assert first is `drawn`, second is `empty-library-attempt`, drawn counter increments once, no fabricated card identity exists for the failed attempt, and the existing defeat advisory appears at the SBA checkpoint (CR 104.3c, 121.2, 121.4, 704.5b). Also retain zero-card coverage already in `cr121DrawAuto.test.ts:74-108`.
- Tataru adversarial: full ETB line must classify manual with `commands:[]`; it must never auto-draw only for P1. This is the sole demonstrated code gap in this scope (CR 121.2c).
- Cross-player adversarial: `You draw a card and each opponent draws a card.`, `You draw two cards and target opponent draws a card.`, and `Target player draws two cards.` all manual with zero commands. This prevents substring-based partial auto.
- Optional/conditional adversarial: Banon's full attack line remains manual with zero commands; resolving the trigger manually must not auto-draw before “if you do” is established.
- Variable boundary: Blue Sun's Zenith full line and isolated `Draw X cards.` remain manual with zero draw commands. A fixed numeral substituted by a test harness is not evidence that Oracle X has become fixed.
- Non-draw boundary: moving the top card of a library to hand without the word “draw” must not emit `DrawEvent` (CR 121.5; adjacent regression guard, although 121.5 is outside this slice's implementation claim).

## Scope boundary / defer

- **Defer variable-count draw**: X, for-each, that-many, hand-size-derived, and other runtime counts. Blue Sun's Zenith is the explicit negative golden.
- **Defer opponent/target-player forced draw execution**: no opponent hand/library mutation, APNAP multi-player draw sequencing, or new player-target prompt/command. Mixed-recipient clauses become manual; they are not partially executed (CR 121.2c).
- Defer draw replacement/prevention and “can't draw” restrictions (CR 121.2a-b, 121.3, 121.6--121.9); they require their own substrate scope.
- Reuse, do not reopen, the empty-library DrawEvent/flag/SBA advisory implementation (CR 104.3c, 121.4, 704.5b).
- No new `GameCommand`, state field, player zone, event type, or guided leaf catalog is proposed. The minimal future implementation, if approved, is a compiler eligibility guard plus executable regression tests.

## Judge verification notes

- Correct the brief/ledger citation from `703.4d` to `704.5b` for the empty-library loss SBA. In the pinned CR, 703.4d is the normal draw-step draw; `commands.ts:247` and `gameStore.ts:110` already correctly map `emptyLibraryDraw` to 704.5b.
- Verify Blue Sun's Zenith's current Oracle text against live Scryfall before promoting this draft because it lies outside the repository snapshot's `date>=2021-06-19` window. Its classification boundary is unaffected: both target-player and X are independently deferred.
