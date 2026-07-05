# cr-111-tokens batch2-7 scoping draft

Status: implementer-lane draft only. J0 mode is not active, so this file does not update
`docs/`, `review.*`, or `research/cr-grounding/cr-backbone-ledger.json`.

CR source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, metadata
`effectiveAsOf: 2026-06-19`, sha256 `e99cd70e...81386f79b`.

Scryfall source note: live `curl` to `api.scryfall.com` failed in this sandbox with DNS error
(exit 6). Card examples below are therefore backed by the local Scryfall snapshot
`research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json`,
whose manifest records Scryfall API search data created on 2026-06-19. If this draft becomes a
spec-changing Scryfall integration task, judge should refresh the named cards against live API.

## Planned slice

Ledger plannedSequence[0]:

`cr-111-tokens`: batch2-7. `token:create` residual 32 = tapped token / custom creature token /
copy token. Predefined leaf in engine-spec §32.8 is shipped for fixed Clue/Food/Blood and existing
Treasure. Classify the remaining surface honestly as auto/guided/manual on the existing token
substrate. Golden candidates named by ledger: Liliana, Dreadhorde General / Ragavan.

This draft is intentionally scoping-only. It does not claim implementation.

## CR grounding

- CR 110.5 / 110.5a / 110.5b: tapped/untapped is permanent status, not a characteristic; permanents
  enter untapped unless an effect says otherwise. This is why "tapped token" is not part of the
  token's copiable characteristics, but must still be applied as entry status.
- CR 111.2: the player who creates a token is its owner, and the token enters under that player's
  control. Existing `createToken` hard-codes P1 owner/controller, so non-P1 token creation is not
  represented by the current command surface.
- CR 111.3: the creating spell/ability may define token characteristics; those defined values are
  the token's text and copiable values. A token has no undefined characteristics.
- CR 111.4: the creating spell/ability sets token name and subtype(s); if no name is specified, the
  name is subtype(s) plus "Token".
- CR 111.6: tokens are affected as permanents and by their card type/subtype, but are not cards.
- CR 111.7: a token outside the battlefield ceases to exist as an SBA; existing token-zone invariant
  and SBA handling already match this.
- CR 111.10: predefined tokens use the listed definitions. Current §32.8 covers Treasure via the
  old path and fixed Clue/Food/Blood via `createToken`; other predefined kinds remain demand-defer.
- CR 111.12: creating a token copy of a nonexistent object creates no token, except LKI cases.
- CR 111.13 / 608.3f / 707.10f: a copy of a permanent spell becomes a token as it resolves, but it
  is not "created" for token-creation triggers/replacements. Existing `copyStackItem`/resolve path
  already models this separate stack-copy route and should not be conflated with "create a token
  that's a copy".
- CR 701.7a: creating tokens means putting the specified number of tokens with specified
  characteristics onto the battlefield.
- CR 706 in the pinned 2026-06-19 CR is "Rolling a Die"; copy rules are CR 707. If older notes say
  "706/707 copy", this slice should cite CR 707 for copying.
- CR 707.1 / 707.2 / 613.1 / 613.2c: token-copy effects copy copiable values, which are derived
  from printed/defined characteristics plus layer-1 copy effects, face-down status, and certain
  as-enters/as-turned-face-up choices; other effects, status, counters, and stickers are not copied.
- CR 707.3 / 707.9a-g: copied information becomes the copy's copiable values, and "except"/"gains"
  clauses can alter those copiable values. This is the main reason full copy-token support is larger
  than the existing `copyPermanent` helper.
- CR 707.10a: copies in illegal zones cease to exist as SBA; existing `isCopy` stack invariant covers
  spell/card copies but not battlefield token-copy creation semantics.

## MyDeck demand measurement

Input exists: `research/mydeck-scoring/gaps.json`.

Measured rows where `missingReadWrite` includes `token:create`: 32.

Representative rows:

| bucket | count | representatives | notes |
|---|---:|---|---|
| explicit tapped token | 3 | Tataru Taru; Tormod, the Desecrator; Kuja, Genome Sorcerer | `create a tapped ... token`. Forbidden Orchard also has `tap-state:write`, but that is the land tapping for mana, not token entry status. |
| custom creature token candidate | 19 | Liliana; Field of the Dead; Swan Song; Pongify; Rapid Hybridization; Fable chapter I | Fixed P/T creature-token text is common, but many rows also need target/controller, mode, or ability-text support. |
| copy token text | 5 | Fable/Reflection of Kiki-Jiki x2; Ardyn; Devastating Onslaught; Springheart Nantuko | All MyDeck copy rows include extra complexity: target, exception/gain, delayed sacrifice/exile, variable X, LKI/exile, or attachment. |
| predefined/resource residual | 7 | Ragavan; Professional Face-Breaker; An Offer You Can't Refuse; Tataru Taru; Tireless Provisioner; Glacier Godmaw | Treasure/Food pieces partly overlap §32.8, but mixed/choice/other predefined kinds remain outside that shipped leaf. |
| modal choice with token branch | 1 | Teval's Judgment | Needs mode-choice semantics before auto token branch can be honest. |
| variable/token value boundary | 4 | Skyclave Apparition; Devastating Onslaught; Tireless Provisioner; Field of the Dead | Includes X/X, X quantity, token-kind choice, and conditional trigger predicates. |

Local Scryfall snapshot spot checks:

- Liliana, Dreadhorde General: `+1: Create a 2/2 black Zombie creature token.` This is a clean
  fixed-count, self-created, no-ability custom creature token candidate.
- Ragavan, Nimble Pilferer: combat-damage trigger creates a Treasure token and exiles a card. The
  token atom is predefined Treasure, but the whole line is not a batch2-7 custom/copy/tapped case.
- Tormod, the Desecrator: creates a tapped 2/2 black Zombie creature token. This is a clean tapped
  custom creature token example.
- Adeline, Resplendent Cathar: creates 1/1 Human tokens tapped and attacking. This is not just a
  tapped-token problem; it also needs combat attacker state.
- Splinter Twin: grants an activated ability that creates a token copy with haste and delayed exile.
  This is a copy-token example, but outside a minimal printed-characteristics-only subset.

## Current substrate inventory

Already present:

- `CardInstance.isToken`, `CardInstance.tapped`, `CardInstance.isCopy`, `CardInstance.defId`.
- `CardFace.oracleText` exists in the data model, but `applyCreateToken` currently does not populate
  token oracle text or keyword metadata.
- `ObjectSnapshot` includes token/state-relevant fields, but no full copiable-values record.
- `GameCommand.createToken` accepts `name`, `typeLine`, optional `power`, `toughness`, `quantity`,
  optional `producedMana`, and `tokenKind`.
- `applyCreateToken` synthesizes one `CardDef` and N battlefield `CardInstance`s, always
  owner/controller P1 and always `tapped: false`.
- `GameCommand.copyPermanent` creates battlefield token copies using the source `defId`, copies
  `faceIndex`, does not copy counters/status, and applies battlefield entry effects. This matches
  some CR 707.2 exclusions, but it does not compute full copiable values or copy exceptions.
- `compileAbilityIR` does not receive `GameState`, so compiler-emitted `createToken` followed by
  predicted `setTapped` IDs is not a robust generic path.

## Subcase A: tapped token

CR reading:

- Tapped entry is status (CR 110.5a), not a token characteristic. CR 110.5b supplies the default
  untapped entry and lets the creating effect override it.
- Creation itself is still CR 701.7a token placement with specified characteristics.

What existing substrate can do:

- Manual UI can create a token and the user can tap it afterward, but this is two user actions and
  not an honest auto/guided resolution of "create a tapped token".
- Engine state already has `CardInstance.tapped`; no new GameState field is needed.
- Existing `createToken` cannot create tapped tokens atomically and the grammar compiler cannot
  reliably target the just-created ids without state.

Classification:

- Existing-command auto: no, except manual user follow-up.
- Guided/auto with implementation: possible for fixed-count self-created tokens if a creation command
  can carry initial tapped status.
- Keep manual/defer for "tapped and attacking", "token enters tapped and attacking", and "tokens are
  tapped and attacking" until combat attacker records can include created token ids and defending
  player/planeswalker targets.

Minimal command-surface options for judge:

- Option T0: no new command. Keep tapped token creation manual/defer; document that users may create
  then tap manually. Lowest risk, but leaves Tormod/Tataru/Kuja token status unautomated.
- Option T1: add a new, narrow command instead of extending pinned `createToken`, e.g.
  `createTokenWithStatus` with the same token spec plus `initialTapped: boolean` and optional
  `createdBy?: PlayerId` defaulting to P1. Internally share `applyCreateToken`.
- Option T2: extend existing `createToken` with `initialTapped?: boolean`. This is smallest code
  churn, but conflicts with the recent "do not broaden pinned command payloads unless necessary"
  discipline; should only be chosen by judge if command churn is preferable to a parallel command.

## Subcase B: custom creature token

CR reading:

- CR 111.3 / 111.4 directly support custom token characteristics: name, type line, color, P/T, and
  rules text defined by the creating effect.
- CR 111.2 matters for effects where another player creates the token.

What existing substrate can do now:

- Fixed-count, self-created, no-ability creature tokens can be represented by existing `createToken`
  if the compiler can parse the token spec. Example: Liliana's 2/2 black Zombie token.
- Existing `createToken` can also set typeLine and P/T for many custom tokens, but currently omits
  oracle text. For tokens with keyword or quoted abilities, this loses defined token text under
  CR 111.3 and should not be claimed as complete automation.
- Existing `createToken` always creates under P1, so Swan Song/Pongify/Rapid Hybridization style
  "its controller creates" cannot be auto unless the effect has already bound that player and the
  command can create for that player.

Suggested honest classifications:

- Auto candidate: fixed numeric count, self/P1-created, single custom creature token, fixed P/T,
  no `with ...` ability text, no target-derived controller, no modal/optional/variable condition.
  Golden candidate: Liliana, Dreadhorde General.
- Guided candidate: fixed custom creature token where only the creating player must be selected
  from an already-guided player/target answer. This requires a command surface that can create for
  `PlayerId`; otherwise remain manual.
- Manual/defer: variable count/P-T, modal choice, multiple token kinds in one line, "for each",
  opponent/target-controller creation without player-binding, tokens with nontrivial oracle text,
  conditional predicates not already handled by the trigger/envelope.

Minimal command-surface options for judge:

- Option C0: use existing `createToken` only for the Liliana-class no-ability self tokens. No new
  GameState and no new GameCommand. This is immediately compatible but narrow.
- Option C1: add a new `createDefinedToken` command carrying a token spec:
  `name`, `typeLine`, `power?`, `toughness?`, `oracleText?`, `keywords?`,
  `quantity`, `createdBy?: PlayerId`, `initialTapped?: boolean`, `tokenKind?`.
  This single new command covers tapped + custom + non-P1 creation while leaving pinned
  `createToken` untouched. `restoreGame` needs no new field unless the synthesized `CardDef` shape
  changes; if token oracle text is added to `defs`, old snapshots already tolerate missing text.
- Option C2: extend existing `createToken` with `oracleText?`, `keywords?`, `createdBy?`,
  `initialTapped?`. Lower code duplication, but broader pinned-command mutation.

## Subcase C: copy token

CR reading:

- CR 707.2 requires copiable values, not arbitrary current derived characteristics. Copy effects,
  face-down status, and certain as-enters choices matter; counters, status, stickers, and ordinary
  layer effects do not.
- CR 707.9 exceptions such as "except it has haste", "except it is 5/5", "isn't legendary", or
  "in addition to its other types" become part of the copied result's copiable values.
- CR 111.12 requires no token for nonexistent copied objects, except LKI cases.

Existing `copyPermanent` subset:

- Good fit for a simple battlefield permanent source where using `source.defId` as printed/defined
  characteristics is acceptable.
- Correctly does not copy status/counters.
- Insufficient for full CR 707 because it does not compute layer-1 copiable values, does not encode
  copy exceptions, does not add gained abilities to copiable values, does not handle cards in
  graveyard/exile/LKI, and does not support delayed sacrifice/exile cleanup.

Recommended minimal subset if judge wants some copy-token automation:

- Guided only, not auto: user selects one battlefield source object.
- Pattern: fixed count 1 (or fixed small integer if already parsed), "Create a token that's a copy
  of target creature/permanent/artifact you control" with no "except", no "gains", no delayed
  sacrifice/exile, no tapped/attacking, no variable X, no card-in-zone/LKI source.
- Resolution command: existing `copyPermanent` is acceptable for this subset, with a warning in the
  spec that it is "printed/defined characteristics via current `defId`", not a full CR 707 engine.
- Examples fitting the general pattern in local snapshot include Cackling Counterpart / Quasiduplicate
  / Mirrorpool. MyDeck's actual copy rows do not cleanly fit this minimal subset.

MyDeck copy rows classification:

- Fable / Reflection of Kiki-Jiki: manual/defer for this slice. It has target filtering, an "except
  it has haste" copy exception, and delayed sacrifice.
- Ardyn, the Usurper: manual/defer. It copies an exiled graveyard card via LKI/link and has 5/5 black
  Demon exceptions.
- Devastating Onslaught: manual/defer. It has X quantity, target artifact/creature, haste, and delayed
  sacrifice.
- Springheart Nantuko: manual/defer. It depends on attachment state, optional payment, copied
  creature identity, and fallback counter behavior.

Judge decision options:

- Option K0: copy token completely defer in batch2-7. Safest. Avoids implying CR 707 correctness.
- Option K1: guided minimal printed/defined-characteristics subset using existing `copyPermanent`.
  Scope must explicitly exclude copy effects/layers/exceptions/LKI/cards-in-zones/delayed cleanup.
- Option K2: introduce a `createCopyToken` command with a copied-values snapshot/spec. This is closer
  to CR 707 but should be a separate copy/layers slice, not batch2-7, because it requires defining
  what a `CopiableValuesSnapshot` means and how it is restored.

Implementer recommendation: K1 only if judge accepts the narrow "printed/defined characteristics
via `defId`" label. Otherwise K0 is more honest for this batch, because all MyDeck copy-token rows
cross high-risk boundaries.

## Proposed batch2-7 acceptance shape

If judge wants a low-risk implementation brief, the narrowest useful cut is:

1. Custom no-ability self tokens:
   - parse fixed-count custom creature token specs with fixed P/T and no `with` ability text;
   - emit existing `createToken`;
   - golden: Liliana creates one 2/2 black Zombie token.
2. Tapped tokens:
   - either keep manual under T0 or add one new `createDefinedToken`/`createTokenWithStatus` command
     under T1/C1 and use it for Tormod/Tataru-class fixed tapped tokens;
   - golden if implemented: Tormod token enters with `tapped === true`.
3. Predefined Treasure non-regression:
   - Ragavan's token atom remains Treasure/predefined; because the full line also exiles/cast-permits
     a card, do not claim whole-line auto in this slice.
4. Copy tokens:
   - default K0 defer, or K1 guided minimal subset with a non-MyDeck golden such as Cackling
     Counterpart / Quasiduplicate / Mirrorpool.

## High-risk boundaries to keep manual/defer

- Replacement effects that modify creation or entry, e.g. doubling/replacement order (CR 701.7b).
- Token creation prevented by "can't enter" rules/effects (CR 111.5).
- Non-P1 owner/controller unless a command carries `createdBy` and target/player binding is pinned.
- Variable count or variable P/T (`X/X`, `for each`, die roll, greatest power, mana value).
- Multiple token kinds or "or" token choices in one line.
- Tokens with quoted triggered/static/activated abilities unless token oracle text is preserved in
  `CardDef.faces[0].oracleText`.
- Keyword-only token text if future automation needs keyword display/rules; displaying a blank token
  would be incomplete under CR 111.3.
- Modal choices and optional payments.
- Copy tokens with "except", "gains", "isn't legendary", added/removed types, color/P-T override, or
  linked delayed sacrifice/exile.
- Copying cards from graveyard/exile or nonexistent objects/LKI (CR 111.12).
- Full CR 707 copiable-values generalization: copy effects, face-down status, DFC handling,
  as-enters choices, stickers, merged permanents, and layer dependencies.
- Tapped and attacking tokens, because they require combat-state attacker records and defending
  target semantics in addition to tapped status.

## Judge decision points

1. Tapped tokens: choose T0 manual/defer, T1 new narrow command, or T2 extend `createToken`.
2. Custom tokens: choose C0 existing `createToken` for no-ability self tokens only, C1 new
   `createDefinedToken` carrying oracle text/status/player, or C2 extend `createToken`.
3. Copy token boundary: choose K0 full defer, K1 guided printed/defined subset via `copyPermanent`,
   or K2 separate `CopiableValuesSnapshot` design slice.
4. Golden set:
   - Should Liliana be the primary custom-token golden?
   - Should Tormod be the tapped-token golden if tapped support is in scope?
   - Should Ragavan be only a Treasure non-regression / mixed-line manual boundary?
   - If K1 is accepted, should the copy golden be a simple non-MyDeck card such as Cackling
     Counterpart rather than the high-risk MyDeck Fable/Ardyn rows?
5. Command-surface discipline: if one new command is allowed, prefer a single `createDefinedToken`
   over several special-purpose commands, but only after judge confirms that this does not violate
   the recent "do not broaden pinned commands" principle.

## Non-claims

- No implementation is present in this draft.
- No `docs/`, `review.*`, ledger body, `CLAUDE.md`, `AGENTS.md`, or git state was changed.
- This draft does not claim batch2-7 is approved, complete, or shipped.
