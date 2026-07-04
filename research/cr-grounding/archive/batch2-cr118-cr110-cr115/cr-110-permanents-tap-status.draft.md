# cr-110 permanents / tap status draft

Status: implementer draft for the next plannedSequence item. Non-review code/test pins now exist
for the narrow guided tap/untap slice; no `docs/` or `review.*` changes were made.

CR source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, fixed to 2026-06-19.

## Why this is next

Ledger next item after `cr-118-costs`:

- `cr-110-permanents`
- Note: `tap-state:write 108(+ adjacent cost:tap 201)= ETB tapped / put-onto-battlefield tapped / tap another permanent`
- CR refs named by ledger: CR 110.5 / 701.26a

The current `cr-118-costs` implementation is blocked only on judge-owned `review.*` / `docs` re-ownership. This draft is safe parallel preparation for the next slice; it does not decide final priority or edit judge-owned files.

## CR grounding

- CR 110.1: A permanent is a card or token on the battlefield; it becomes a permanent as it enters the battlefield and stops being one when it moves away.
- CR 110.2a: An object put onto the battlefield enters under the instructed player's control unless stated otherwise.
- CR 110.5: A permanent's status includes tapped/untapped, flipped/unflipped, face up/down, phased in/out.
- CR 110.5b: Permanents enter the battlefield untapped unless a spell or ability says otherwise.
- CR 110.5c: A permanent retains status until a spell, ability, or turn-based action changes it.
- CR 110.5d / 403.3: Only permanents have status; permanents exist only on the battlefield.
- CR 701.26a: To tap a permanent, only an untapped permanent can be tapped.
- CR 701.26b: To untap a permanent, only a tapped permanent can be untapped.

## Current substrate inventory

Already implemented pieces relevant to this slice:

- `CardInstance.tapped` exists and is already part of battlefield state.
- Existing `GameCommand` already has `{ type:'setTapped', cardId, tapped }`; no new command type is needed for tap/untap writes.
- `playLand` supports `entersTapped?: boolean`.
- `landEntersTapped(def)` already classifies land ETB as `always | never | conditional` from English oracle text.
- Store `playLand` uses `landEntersTapped`; conditional lands ask for a tap choice.
- Fetch support already carries `entersTapped` and applies `setTapped` after moving the fetched land to battlefield.
- Guided `effect.tap` / `effect.untap` already map selected targets to `setTapped true/false`.
- Existing token creation does not expose a tapped option; tapped token creation is therefore not covered by current token substrate.

Implementer-side executable pin added:

- `src/store/__tests__/cr110TapStatus.test.ts`
  - `Tap target permanent.` prompts for one target and applies `setTapped true`.
  - `Untap target artifact or creature.` prompts for one target and applies `setTapped false`.
  - Guided `Tap target ...` warns but still resolves when the selected permanent is already tapped
    (CR 701.26a).
  - Guided `Untap target ...` warns but still resolves when the selected permanent is already
    untapped (CR 701.26b).

## MyDeck demand measurement

Input: `research/mydeck-scoring/gaps.json`, rows whose `missingReadWrite` includes `tap-state:write`.

Total rows: `108`.

| bucket | count | representative cases | draft classification |
|---|---:|---|---|
| conditional ETB tapped | 28 | Blood Crypt / Clifftop Retreat / Haunted Ridge / Luxury Suite | guided/manual boundary. Needs condition evaluation or tap-choice UI. Existing land play already has conditional tap choice for lands; spell/ability put-onto-battlefield conditional ETB remains out. |
| untap target or mass untap | 27 | Aphetto Alchemist / Ioreth / Kelpie Guide / Vizier of Tumbling Sands / Unstoppable Plan | guided leaf for single target using existing `setTapped false`; mass/all untap remains manual until selector/filter support is broader. |
| put/return onto battlefield tapped | 20 | Path to Exile / Evolving Wilds / Farseek / Rampant Growth / Terra / Skeleton Crew | partially covered for fetch flows; generic effect compiler needs `entersTapped` metadata on guided put/return actions. Depends on target/zone choice support. |
| static ETB tapped | 18 | Bojuka Bog / Path of Ancestry / Lotus Field / Xander's Lounge | already covered for playing lands via `landEntersTapped` + `playLand`. Not covered for non-land permanent spells/copies/tokens entering via other routes. |
| reads tapped/untapped state or replacement-like untapped text | 5 | Mana Vault draw-step trigger / Mystic Sanctuary / Spelunking | not a write leaf. Keep manual/defer; belongs to trigger conditions/replacement/layers, not this write slice. |
| tap target or tap another permanent | 4 | Forensic Researcher / Kelpie Guide / Thassa, Deep-Dwelling / Relic of Legends | single target tap is guided leaf already in effect compiler for simple cases; tap-as-cost of another permanent is a cost-choice slice, not pure cr-110 status write. |
| create tapped token | 3 | Tataru Taru / Tormod / Kuja | token substrate needs tapped token option or follow-up `setTapped` for created token ids; current `createToken` command lacks a stable returned id channel. Defer unless token slice reopens. |
| other event around tapping for mana | 2 | High Tide / Forbidden Orchard | event observer for "taps for mana", not status write. Defer to event/mana trigger substrate. |
| tapped and attacking | 1 | Alesha | depends on combat-attacking state plus ETB tapped; defer to combat/return leaf. |

## Draft slice recommendation

Recommended first cr-110 slice should be **narrower than the raw 108 rows**:

1. Do not add new `GameCommand` or `GameState` fields.
2. Keep `CardInstance.tapped` as the only status write for tapped/untapped.
3. Promote only deterministic/guided single-permanent status writes:
   - single target `Tap target permanent/creature/artifact...` -> existing guided target prompt + `setTapped true`
   - single target `Untap target permanent/creature/artifact...` -> existing guided target prompt + `setTapped false`
   - simple `This land enters tapped` play-land path is already implemented; review should pin it rather than reimplement it.
4. Implementer-side store code now preserves warning-only CR 701.26a/b checks during guided
   resolution, without hard-blocking the sandbox flow.
5. Treat the following as defer/manual:
   - condition evaluation (`unless`, `if you don't`, "enters untapped")
   - mass/all untap
   - tapping another permanent as a cost
   - `put/return ... battlefield tapped` until the target/zone effect envelope can preserve destination modifiers
   - tapped token creation until token creation can expose created token ids or accept an `entersTapped` option
   - "taps for mana" event observers
   - tapped and attacking

This likely captures low-risk review pins without expanding into target legality, replacement effects, token identity plumbing, or combat state.

## Candidate review/golden pins

Reviewer-owned expected values only; do not edit `review.*` from implementer seat.

Potential pins:

- Bojuka Bog / `This land enters tapped.`
  - `landEntersTapped(def) === 'always'`
  - `store.playLand(id)` moves the land to battlefield with `tapped === true`.
- Clifftop Retreat / `This land enters tapped unless you control a Mountain or a Plains.`
  - `landEntersTapped(def) === 'conditional'`
  - store returns `needs-tap-choice` without `opts.entersTapped`.
  - choosing `entersTapped:true` sets `tapped === true`; choosing false leaves it untapped.
- Aphetto Alchemist / `{T}: Untap target artifact or creature.`
  - activation cost taps source.
  - target selection is preserved in activation envelope.
  - resolution sets target `tapped === false`.
- Kelpie Guide / `{T}: Tap target permanent. Activate only if you control eight or more lands.`
  - if ability line remains parsed despite activation instruction, target prompt maps to `setTapped true`.
  - condition itself remains sandbox/manual warning boundary; do not hard-enforce.
- Relic of Legends / `Tap an untapped legendary creature you control: Add one mana of any color.`
  - defer: tapping another permanent as activation cost requires guided cost subject and filtered legality; do not promote in first cr-110 write slice.

## Open questions for judge

- Should this slice be framed as `cr-110-permanent-status-tap-state` rather than broad `cr-110-permanents`? The raw domain name is broad, but the measurable demand and existing substrate are specifically tapped/untapped status.
- Should existing `landEntersTapped` / fetch tapped behavior be reviewer-pinned as part of this slice, or treated as prior shipped behavior only?
- Judge should confirm whether warning-only CR 701.26a/b behavior is the desired contract, or
  whether a future rules-legal mode should hard-block tap/untap status mismatches. The implementer
  slice intentionally chose warning-only to match the project sandbox philosophy.
