# O4P-01I-C: Mode, Variable, Cost, and Copy Announcement Analysis

- Milestone: `O4P-01I-C`
- Role: Domain Analyst
- PLAN_SHA: `5418d82`
- Status: `analyzed-not-integrated`
- Source boundary: pinned local Comprehensive Rules, effective 2026-06-19,
  `rule/Magic_The_Gathering_Comprehensive_Rules.txt`
- Scope: committed announcement facts for a spell, spell copy, activated
  ability, or triggered ability already represented on the stack.

This is a CR analysis, not an implementation contract. It does not calculate
or pay a total cost, construct a payment plan, produce mana, apply Commander
tax, derive alternative characteristics, execute CR 707 copying, or resolve a
spell or ability. It records what a later committed announcement snapshot must
preserve and what must remain explicitly deferred.

## Twenty-four required topics

### 1. Mode key identity

CR 700.2 defines a mode as one option in the modal choice structure. A mode
key must therefore identify the card-definition-local option, not its localized
display text, array position alone, or the resulting effect. The key must be
stable for the same printed/Oracle definition and distinguish two options that
have similar text. Choosing a mode is an announcement fact under CR 601.2b
for a spell or activated ability and CR 603.3c for a triggered ability.

This analysis does not select a TypeScript field name or key alphabet. It does
require that a later contract reject an unknown, ambiguous, or noncanonical
mode key rather than silently treating it as another mode.

### 2. Mode order

When multiple modes are selected, the selected modes are not an unordered set.
CR 700.2d says a repeated mode is treated as appearing that many times in
sequence; CR 608.2c separately requires a resolving effect to follow its
instructions in order. The announcement snapshot must retain the selected
mode occurrence order. It must not sort by key, text, or numeric index.

### 3. Mode repetition

The default is that a player cannot choose the same mode more than once. A
card may explicitly allow repetition (CR 700.2d). A repeated mode is a
separate occurrence, and each occurrence can have its own target and division
information. CR 700.2h also makes each selected mode cost-bearing when a mode
lists an additional cost. A validator must reject duplicate keys when the
definition does not permit repetition and preserve duplicate occurrences when
it does.

### 4. X announcement and scope

For a spell or activated ability whose cost contains an undefined X, the
controller announces X while casting or activating it (CR 107.3a and
601.2b/602.2b). X applies to the relevant mana, alternative, additional, or
activation cost while the object is on the stack. A later snapshot must bind
X to the particular stack object and announcement, not to a card definition
or a player-wide value. Copies retain the announced X under CR 707.10.

This does not authorize validating whether the announced X can be paid.

### 5. Variables, defined values, and ranges

Not every X is player-selected. CR 107.3c makes a value defined by the spell
or ability’s text; CR 107.3f permits an undefined text X outside a cost to be
chosen at the appropriate time, including resolution. CR 107.3b restricts an
undefined cost X to zero when a spell is cast while paying neither its mana
cost nor an alternative cost containing X; a reduction to zero is not that
case. CR 107.3g–h define zero for objects not on the stack and for an object’s
mana cost paid outside the stack. CR 107.3k makes each activated ability’s X
independent of other activations.

Therefore a variable record needs provenance (announced, text-defined, or
resolution-time) and any card-defined lower/upper constraint. A range is not
permission to choose an out-of-range value, but checking the range is a
legality/compiler concern deferred from this structural lane.

### 6. Alternative costs

CR 118.9 defines an alternative cost as paid instead of the mana cost; only
one alternative cost can apply, and the intention is announced in CR 601.2b.
An alternative cost does not change the spell’s mana cost (CR 118.9c).
Additional costs, increases, and reductions apply to the chosen alternative
cost (CR 118.9d). The snapshot may preserve which alternative-cost option was
announced, but must not pretend that selecting it determines or pays the
resulting total cost.

### 7. Additional costs

CR 118.8 defines an additional cost as paid at the same time as the mana or
activation cost. Any number may apply, and intentions to pay are announced in
CR 601.2b; some are optional (CR 118.8a–b). Additional costs do not alter the
spell’s mana cost (CR 118.8d). The announcement record must distinguish each
selected additional-cost instance and its source, including mode-specific
additional costs under CR 700.2h. It must not collapse all additional costs
into one boolean.

### 8. Repeated cost instances

Repeated modes and multiple applicable additional costs create multiple cost
instances, even when their text is identical. CR 118.8a allows any number of
additional costs; CR 700.2h requires the additional costs of all selected
costed modes to be paid. Occurrence identity and order must be retained so a
later legality/payment layer can tell whether every required instance was
addressed. This is a structural multiplicity rule, not permission to charge
or pay any cost in this milestone.

### 9. Mandatory costs

A mandatory cost is required to cast or activate when the relevant option has
been selected or imposed. CR 118.3 requires sufficient resources for full
payment; CR 601.2h prohibits partial payment and unpayable costs cannot be
paid. CR 118.8c gives a narrow “if able” exception for a mandatory additional
cost involving hidden-zone cards. The snapshot may record that an imposed
cost is mandatory, but must not turn an impossible mandatory cost into a
successful cast or activation.

### 10. Optional costs

Optional additional costs are announced as intentions under CR 601.2b and
601.2f–h only when the controller chooses to use them. An optional cost is
not the same as a resolution choice. CR 118.8b and CR 118.12 distinguish
optional cost choices from later “if/unless” consequences. The structural
record must preserve “not selected” versus “selected” and must not infer
selection from a later payment or resolution result.

### 11. Choice versus payment

A choice states what option was selected; a payment is the action that fulfills
the selected cost. CR 601.2b announces modes, alternative/additional-cost
intentions, X, and hybrid/Phyrexian payment intentions; CR 601.2h later pays
the total cost. CR 118.1 describes paying a cost as carrying out its
instructions. A committed announcement snapshot may retain choices, but it
must not contain a payment plan, mana-source allocation, or claimed payment
result in place of those choices.

### 12. Total cost and lock-in boundary

CR 601.2f defines total cost as the mana or alternative cost plus additional
costs and increases, minus reductions, then locks the resulting total cost.
CR 601.2g activates mana abilities before payment; CR 601.2h pays the total
cost atomically with no partial payment; CR 601.2i marks the spell cast after
601.2a–h. This milestone may preserve the announced ingredients and
selection facts, but explicitly does not fix total cost, lock it, or claim
that the object was cast/activated.

### 13. Cost reductions

Reductions apply to the chosen alternative cost when one exists (CR 118.9d)
and to the applicable cost components under CR 601.2f. CR 118.7 and
118.7a–g describe how reductions affect generic, colored, colorless, hybrid,
Phyrexian, and snow components; mana reduced to nothing is {0}, never less
than {0}. A later cost engine must retain reduction provenance and component
semantics. This lane neither applies reductions nor chooses their order.

### 14. Cost increases

Cost increases are included in total-cost determination before the total is
locked (CR 601.2f), and they affect an alternative cost as stated in
CR 118.9d. An increase is not an additional cost: an additional cost is a
separate instruction paid at the same time, while an increase changes the
cost calculation. The snapshot must not merge these categories or infer an
increase from payment. Applying increases is deferred.

### 15. Commander tax boundary

CR 903.8 applies only when a player casts a commander they own from the
command zone and imposes an additional `{2}` for each previous such cast in
that game. It is therefore a Commander-variant rule that contributes an
additional cost to a qualifying cast; it is not a universal property of the
card, not a change to mana cost, and not a property of a spell copy. The
announcement lane may carry a later classifier boundary saying “tax may be
applicable,” but must not calculate, add, or pay Commander tax. Commander
cast-count state and implementation remain deferred.

### 16. Spell-copy retention of announcement decisions

CR 707.10 says a copy of a spell or ability copies characteristics and all
decisions already made for it, including modes, targets, X, and additional or
alternative costs. A spell copy is not cast (and an activated-ability copy is
not activated). The copy is placed on the stack with its copied decisions;
this is retention, not replay of the original announcement process.

### 17. Choose-new-targets boundary

Under CR 707.10c, an effect may allow new targets for a copy. The controller
may leave any number unchanged even if those targets are illegal, but every
changed target must be legal; once decided, the copy is put on the stack with
those targets. CR 700.2f says changing targets cannot change modes. Thus a
new-target choice is a distinct copy-time decision over the copied target
slots, not a general retargeting permission and not a mode rewrite. The
command, legality check, and copy creation are deferred.

### 18. Copiable-values boundary

CR 707.2 defines copiable values from printed text and specified copy,
face-down, and enters/turns-face-up effects. Type/text changes, status,
counters, stickers, and other noncopiable effects are not copied; CR 707.2b
says later changes to the original do not change an existing copy. CR 707.9
allows explicit exceptions and modifications, which become part of the
resulting copiable values. This analysis records the boundary only and does
not derive characteristics or implement CR 707.

### 19. Cost-payment objects and copy retention

CR 707.10 retains references needed when a copied effect refers to objects
used to pay the original cost. This does not copy mana, the act of payment,
or a payment plan. It is a historical reference to the original cost-payment
objects, subject to the later object/zone rules. The announcement record may
need a separate historical reference slot, but this milestone does not create
or resolve it.

### 20. Adventure

CR 715.3 makes casting an Adventurer card normal-versus-Adventure choice;
only the alternative characteristics are evaluated and the Adventure spell
has only those characteristics on the stack. CR 715.3b–c says its copy is
also an Adventure with the spell’s alternative characteristics. If it resolves,
CR 715.3d exiles the card rather than putting it into its owner’s graveyard,
and the card may later be played but not as an Adventure through that
permission. These are characteristic and lifecycle facts to preserve as
announced choice metadata; alternative-characteristic derivation and
resolution remain deferred.

### 21. Prototype

CR 718.3 makes normal-versus-prototyped casting a choice. A prototyped spell
and the permanent it becomes use only the alternative mana cost, power, and
toughness, with color implications from that alternative mana cost
(CR 718.3a–b). Copies retain the prototyped alternative characteristics
(CR 718.3c–d), while other characteristics remain normal (CR 718.5).
The announcement snapshot may distinguish the prototyped designation, but
must not derive or apply its alternative characteristics or costs.

### 22. Split cards

CR 709.3 requires choosing a half before the card is put on the stack; only
that half is evaluated and only its characteristics exist on the stack.
Outside the stack, the two halves’ characteristics are combined (CR 709.4).
Fuse is a separate combined-spell case (CR 709.4d). A copy that is cast can
retain the two-half structure under CR 709.3c, while a spell-copy decision
must retain the selected half/combined state as applicable. No half legality,
Fuse, cost, or copy execution is implemented here.

### 23. Resolution-time choices

Choices made during resolution are not announcement choices. CR 608.2d
requires choices offered by an effect, other than choices already made while
casting/activating/putting it on the stack, to be made while applying the
effect; illegal or impossible options cannot be chosen. CR 603.5 likewise
puts optional triggered abilities on the stack before the “may” choice is
made on resolution. A committed announcement record must not prefill,
conflate, or claim resolution choices. Resolution ordering and effect
execution are deferred.

### 24. Canonical ordering

The canonical semantic order follows the CR procedure, not object-key order:

1. put the spell/card copy on the stack (601.2a);
2. announce modes, splice, alternative/additional-cost intentions, X, and
   payment-form intentions (601.2b);
3. announce targets (601.2c);
4. announce divisions/distributions (601.2d);
5. perform the legality check (601.2e; a check result is not a choice);
6. determine and lock total cost (601.2f);
7. activate mana abilities if needed (601.2g);
8. pay the total cost (601.2h);
9. mark the spell cast and trigger cast/stack triggers (601.2i).

Activated abilities use the same sequence after creation on the stack through
CR 602.2a–b. Triggered abilities use CR 603.3c–d: APNAP placement is outside
the choice payload, then mode, target, and division announcements occur. A
canonical serializer may order record fields deterministically for comparison,
but it must preserve semantic array order, repeated occurrences, target-slot
order, and division order; it must not sort them as sets, deduplicate them, or
reorder by key.

## Findings and explicit deferrals

- **F-01 / structural requirement:** mode occurrences, repeated cost
  instances, variable provenance, target slots, and divisions need distinct
  ordered snapshots. A set-shaped representation would lose CR meaning.
- **F-02 / boundary:** announcement choice, legality, total-cost lock,
  mana-ability activation, payment, and cast/activation are separate CR
  stages. A committed record must not report later stages merely because
  earlier choices exist.
- **F-03 / copy boundary:** spell/ability copies retain already-made
  decisions, but resolution choices are not copied; choose-new-targets is a
  narrowly authorized exception under 707.10c. No generic retarget or CR707
  executor follows from this analysis.
- **F-04 / characteristic boundary:** Adventure, Prototype, and Split each
  have distinct on-stack characteristic rules. They cannot be represented as
  one generic “alternative face” toggle without losing CR 709/715/718
  semantics.
- **F-05 / Commander boundary:** Commander tax is a qualifying
  command-zone cast additional cost under 903.8. It is outside the
  mode-neutral core’s cost calculation and payment implementation.

Explicit DEFER: total-cost calculation and lock-in; payment plan and mana;
Commander tax count/calculation; legality and target validation; alternative
characteristic derivation; copyable-values derivation and CR707 execution;
priority/APNAP execution; resolution; protocol, projection, UI, and any
source/ledger/docs/test/package change.

## CR references

`107.3, 107.3a–k, 107.3m; 115; 118.1–.14; 400.7; 405.1–.6; 601.2a–i;
602.2–.2b; 603.3–.3d and 603.5; 608.2b–h; 700.2, 700.2a–h; 709.1–.5;
707.2–.10g; 715.2–.5; 718.2–.5; 903.8.`
