# PC UI regression diagnosis (Codex draft, 2026-07-12)

## Scope

This is a read-only diagnosis of the current `GameScreen` desktop experience, grounded in
source inspection and a 1440x900 / 1920x1080 browser run. It does not approve a design
contract and does not change product code.

## Executive finding

The user's seven complaints are not independent defects. The desktop currently renders the
portrait-first, single-column D2 tree with only one desktop override: `max-width: 1100px`.
D4 desktop reconstruction was specified but never implemented. The result is a phone
information architecture centered on a large screen, not a desktop adaptation.

The regression has three layers:

1. **Legibility loss**: information that was glanceable is now encoded as tiny symbols,
   hidden behind sheets, or absent until interaction.
2. **Spatial loss**: a wide display is artificially narrowed while hand, land, and board
   rows still use mobile scrolling/overlap policies.
3. **Agency loss**: the interface promotes one large "next" button and removes or hides
   desktop-native manipulation (hover, drag, direct phase comprehension).

This is why the experience feels worse even where the underlying feature still exists.
The problem is not primarily missing functionality; it is loss of visible state, directness,
and a stable mental model.

## Measured evidence

At 1440x900:

- `.game-screen`: x=170, width=1100. About 340px of horizontal space is unused.
- status band: 36px high.
- the complete seven-phase display: 125px wide; each phase marker is 17x17px.
- hand: width=1100, `overflow-x:auto`; after keeping the opening hand, eight 132px cards
  plus gaps and the library tile require horizontal scrolling.
- primary action: about 868x44px, while phase structure occupies only 125x17px.
- browser console errors: zero. This is a design regression, not a runtime failure.

At 1920x1080:

- `.game-screen` remains 1100px wide at x=410; about 820px of the display is unused.
- the board remains 1100px wide while its empty height grows to about 642px.
- the primary action remains about 868px wide.

The visual hierarchy therefore says "advance" much more loudly than "understand the turn"
or "inspect the board".

## The seven reported symptoms, reclassified

### Mulligan appears missing

The mulligan flow exists on a fresh game, but on desktop it is a detached top-right panel
instead of a centered opening-hand decision. R1 additionally reproduced a persistence bug:
`restoreGame` unconditionally sets `mulliganDecisionPending` to false, so reloading/resuming
before keep removes the decision entirely. The complaint is therefore both a composition
failure and a real resume-path feature loss.

### Phase transition is hard to understand

The current phase row is seven non-interactive `span` elements, 17px each, labelled with
single-character abbreviations. The only prominent progression control is the large primary
button at the opposite edge of the screen.

The user's difficulty is not simply inability to read the active label. It is loss of the
turn's predictive model:

- Where am I now?
- What has already happened?
- What comes next?
- What actions are meaningful before I advance?
- Did the phase change because I asked it to, or because automation skipped something?

Without those answers, pressing "next" becomes trial-and-observe. That undermines the
project's goal of helping the player understand how the deck works.

### Hover enlargement disappeared

Confirmed in the browser: hovering a hand card produces no preview and no transform.
`useHoverPreview`, `CardPreview`, and the `CardView` event props already exist, but `GameCard`
does not wire them. This is a dropped affordance, not a new feature request.

### Graveyard became harder to see

The graveyard viewer remains one click away, but its only persistent entry is a tiny
abbreviated chip in the 36px status band. The menu also contains a duplicate graveyard
command. The extra effort is mostly visual search and target acquisition rather than raw
click count. A desktop design should optimize frequent zone checks for glance + one obvious
action, not make the user remember whether to use a two-character chip or the menu.

### Eight cards do not fit

Confirmed. Eight 132px cards, 8px-ish gaps, and the library tile exceed the fixed 1100px
container. The scrollbar is therefore deterministic at a normal opening-hand-plus-one
state. The current implementation has no count-aware compression for `HandRibbon`, even
though the legacy hand already has a bounded negative-margin fan technique.

### The board wastes desktop space

Confirmed. The sole desktop rule is `max-width:1100px`. At 1920px, 43% of the viewport width
is unused. Simultaneously, the empty board consumes most of the vertical space while the
phase model, zones, hand, and controls remain compressed at the edges. The defect is not
only total area; it is allocation of area to low-information emptiness.

### Lands overlap too early

The model unconditionally groups same-name basic lands before layout is known, and CSS then
uses a fixed -60px overlap on 72px slots. This contradicts the existing design-system note
that desktop should wrap instead of scroll/overlap. The user's desired policy is progressive:
show individual cards while space exists, compress only when the row approaches capacity.

## Additional regressions not in the seven-item list

### Desktop drag-and-drop is gone

`GameCard` hard-codes `draggable={false}`. The D4 roadmap explicitly requires desktop game
completion with DnD coexistence. This is a concrete contract/implementation mismatch and a
desktop-native affordance regression.

### Desktop single-click is inert

`GameCard` wires right-click and double-click, but not mouse click. `CardView` only converts a
short *touch* pointer gesture into the context-menu action. On desktop, a normal click on the
main object of the interface does nothing. Even if right-click remains the complete
alternative, the primary object needs a discoverable direct action or inspection response.

### The feed hides the engine's work

The feed is mounted only while `feedOpen` and otherwise collapses to a bell. On desktop this
conceals triggers, warnings, and history even when there is enough room. It weakens the
project's stated product value: making engine behavior visible and inspectable.

### Board structure is visually ambiguous when sparse

Creature and non-creature shelves have no labels and are separated only by a hairline. With
few or zero permanents the center becomes a large undifferentiated void. Removing panel
chrome was appropriate for mobile space economy, but desktop still needs subtle spatial
anchors so the player can predict where objects belong.

### Mobile control proportions dominate desktop

The bottom `ThumbZone` remains 88px high and gives most width to one action. Undo, redo,
turn, and menu are pushed to the far bottom edge. This is good thumb ergonomics but poor
pointer ergonomics: frequent controls are far from their objects and the action hierarchy is
too coarse for a large display.

## Correction to the existing D4 proposal

The existing diagnosis and direction (desktop-native, same component tree, no JSX fork) are
sound. However, "make it three columns" is not sufficient by itself.

A left rail plus right feed can shrink the center below today's 1100px, recreating the hand
and board problem inside a nominally full-width layout. The contract should therefore state
measurable center-stage constraints before column widths are chosen:

- At 1280px, eight opening-hand cards must be identifiable without horizontal scrolling.
- At 1440px, the central play surface must not be narrower than the current useful board
  width unless a verified card-density strategy preserves readability.
- Rails should be compact/collapsible based on available width; they are supporting
  information, not fixed-width furniture.
- Hand, land, and battlefield compression must be driven by available inline size, not only
  card count or global viewport width. Container-aware CSS is preferable to duplicating JSX.
- DnD, hover, right-click, double-click, and keyboard paths must be tested as a coherent
  desktop input system, not as isolated features.

## Recommended decision order (not implementation approval)

1. Restore the lost zero-cost reading loop: hover preview, meaningful single-click
   inspection, visible mulligan composition.
2. Define measurable desktop information goals (hand capacity, central width, zone/phase
   visibility) and only then choose the column geometry.
3. Restore the turn model: readable current/previous/next phases with clear transition
   feedback. Keep the contextual primary action, but stop making it the only legible model.
4. Make compression progressive and container-aware for hand, lands, and battlefield.
5. Restore desktop manipulation as a system: DnD plus right-click, keyboard, and visible
   discoverability hints.
6. Make engine output persistent enough to explain what happened, without allowing the feed
   rail to steal the central stage.

The success criterion is not merely that all seven complaints have a corresponding control.
It is that a player can look at the desktop screen and answer, without opening a sheet:
"where am I, what changed, what can I do, and how is my deck developing?"
