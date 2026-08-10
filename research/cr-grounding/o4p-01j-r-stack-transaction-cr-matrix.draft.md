# O4P-01J-R Atomic Stack Transaction CR Matrix

- Status: `analyzed-not-integrated`
- Role: Independent Requirements Analyst
- Milestone: `O4P-01J Atomic Stack Commit, Retarget & Removal Transaction V1`
- Requested analysis base: `PLAN_SHA=3476e170124158da849dadb5a3031dfda4a28a3c`
- Local O4P-01J plan metadata: `INITIAL BASE_SHA=2cd27710e690ae12cdcacfde6d9ac544ab85201f`
- Authority: pinned local `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, effective 2026-06-19
- Inputs read: O4P-01G transition drafts/contracts, O4P-01H object/runtime drafts/contracts, O4P-01I stack-announcement drafts/contracts, the O4P-01J orchestration plan, and existing Core transition/object/runtime/stack files.
- This draft chooses no new TypeScript names, IDs, public exports, command/event envelope, or implementation structure.

## 1. Scope

O4P-01J is the atomic structural boundary joining the O4P-01H Object Registry V2, Object Runtime V2, and O4P-01I Stack Announcement V1 values. Its positive surface is: commit a card spell, commit a synthetic stack object, replace a committed target record immutably, move a card spell out of the stack, and cease a synthetic stack object. Every successful operation exposes one complete, deeply frozen bundle; every failed operation exposes no candidate state.

The matrix covers the requested 30 scenarios in §14. It treats the three roots as one transaction bundle, not as independently publishable updates.

## 2. Ruleset and source hierarchy

All deterministic rulings below come from the pinned local CR only. No web source, current external rules file, card database, or LLM interpretation is used as authority. O4P-01G/H/I are prior contracts and implementation evidence, not a higher authority than CR for rules meaning.

The decisive local clauses are CR 109.1, 110.2 and 110.5, 111.8 and 111.13, 112.1-2, 113.7-7a, 115.2-8, 400.3, 400.5-10, 400.6-7m, 405.1-6, 601.2-2i, 602.2-2b, 603.2-3d, 608.2b and 608.2m-n, 608.3a-f, 701.6a, 704.5d-e, and 707.10-10f.

## 3. Terms

- **Card object** means the physical-card object represented by the existing V2 card identity. A card becoming a spell is a role/locus transition; it is not a second physical card.
- **Synthetic object** means a spell copy, activated ability, or triggered ability represented by a non-card stack identity. It has no physical card runtime row.
- **Commit** means the successful construction of the new registry/runtime/announcement bundle at the applicable stack boundary. It does not prove proposal legality, cost payment, priority, or resolution.
- **Retarget** means replacement of the immutable announcement record for the same stack object. It does not mutate the old frozen value in place and does not create a new game object.
- **Cease** means removal of a synthetic object from the stack with no destination-zone object. It is not a card-zone transition.
- **Historical reference** means a target or source reference retained for a committed record; it is not a liveness or current-legality assertion.

## 4. Transaction invariant

The input bundle is validated before any candidate is built. The candidate registry, candidate runtime, and candidate announcement values are then cross-validated against one another. Publication is all-or-none:

`valid input bundle -> candidate Registry + Runtime + Announcement -> cross-validation -> one frozen result`

Any failure returns deterministic, complete, deeply frozen issues and leaves the caller's input and prior bundle unchanged. No operation sorts semantic arrays, trims strings, deduplicates choices, defaults omitted values, mutates input, reads time, allocates a random ID, or tolerates unknown fields.

## 5. Object-kind boundary

CR 109.1 includes cards, spells, abilities on the stack, copies of cards, tokens, permanents, and emblems. O4P-01J only touches the stackable kinds already represented by O4P-01H/I: card spells, spell copies, activated abilities, and triggered abilities.

Tokens are battlefield objects in the existing V2 registry, not ordinary stack objects. Static abilities, effects, state-based actions, turn-based actions, and qualifying mana abilities do not become ordinary stack objects under CR 405.6. A pending trigger before stack placement is not yet a committed stack object under CR 603.2-3.

## 6. Card-spell commit boundary

CR 601.2a moves the card (or permitted card copy) to the top of the stack and makes it a spell. CR 112.1-2 and 405.4 give the spell its card characteristics, owner, and controller. The source card incarnation is therefore replaced by a new stack incarnation under CR 400.7, subject to the enumerated exceptions.

O4P-01J may attach an already complete O4P-01I announcement record while committing the card object, but it must not manufacture a proposal, payment ledger, total-cost proof, priority proof, or legality result. A successful card commit has one card object in the stack, one matching announcement record, and the corresponding card runtime row.

## 7. Synthetic-stack commit boundary

CR 602.2a creates an activated ability as a non-card object on top of the stack; CR 603.2-3 creates and places a triggered ability only at the next priority opportunity. CR 707.10 puts a spell or ability copy on the stack without casting or activating it. Their controller and source/copy provenance come from the applicable CR boundary.

The existing H runtime contract admits card/token runtime rows and no spell-copy or ability runtime rows. Therefore a synthetic commit changes the registry and announcement sets while preserving the runtime key set without adding a synthetic runtime entry. A source may be absent after an activated/triggered ability is committed because CR 113.7a makes the ability independent of its source.

## 8. Stack order

The stack is one shared ordered zone. CR 405.1-2 puts each newly committed object on top; the existing bottom-to-top stack array is the sole order authority. A transaction appends exactly one new object for a commit, replaces no order for a retarget, and removes exactly one entry for a removal/cease.

Simultaneous trigger ordering under CR 405.3 and 603.3b, APNAP collection, priority, and trigger detection are not performed here. O4P-01J consumes an already ordered committed input and preserves all other stack entries byte-for-byte in semantic order.

## 9. Runtime result

For a card object entering the stack, the new card incarnation receives the existing default post-zone-change runtime: no battlefield status, no marked damage, no counters, and no attachment. The existing runtime validator's zone restrictions remain authoritative. Runtime data is not copied from the old incarnation.

For a synthetic object, no runtime row is created, removed, or repurposed. On synthetic cease, the synthetic registry object and announcement record disappear together while the card/token runtime map remains unchanged. A permanent-spell resolution that creates a battlefield token is a later resolution/object-creation boundary, not a synthetic-runtime shortcut.

## 10. Announcement result

The O4P-01I record is committed-only. It preserves the supplied mode, target, variable, distribution, cost-choice, and ability-text snapshots in their contract-defined semantic order. It is historical data, not proof that those choices were legal or paid.

On card commit or synthetic commit, exactly one record is added for the new stack object. On retarget, the old record is replaced by a fresh record for the same object identity. On card removal or synthetic cease, the record is removed with the stack object. No announcement record remains for a failed operation, a pending trigger, a payment-in-progress state, or a resolving choice.

## 11. New-object and incarnation rule

CR 400.7 is the default: an object moving between zones becomes a new object with no memory or relation to its previous existence. This applies to a card entering the stack and to a card spell leaving the stack. CR 400.7a-d preserve only the listed permanent-spell effects, static abilities, prevention effects, and spell-information references when the permanent spell becomes a permanent.

CR 400.8 and 400.10 are same-zone new-object exceptions relevant to exile and command; they are not permission to reuse an old identity. Same-zone reordering is not a generic zone transition and must not be silently folded into card-spell commit.

## 12. Retargeting semantics

CR 115.7a-c distinguish all-target, one-target, and any-target changes. CR 115.7d permits unchanged illegal targets only for “choose new targets” and requires every changed target to be legal. CR 115.7e evaluates only the final set; CR 115.7f freezes the original division; CR 115.8 forbids changing modes while changing targets.

O4P-01J owns the atomic immutable-record replacement and structural all-or-none boundary. It does not derive target predicates, check protection/hexproof/shroud, re-run mode legality, or choose a replacement target. Those are `LEGALITY_LATER` inputs or later effect semantics.

## 13. Removal and cease semantics

CR 701.6a removes a countered spell or ability from the stack; a countered spell goes to its owner’s graveyard. CR 608.2n puts an instant/sorcery spell into its owner’s graveyard at the end of resolution and removes an ability so it ceases. CR 608.3a-e moves a resolving permanent spell to the battlefield or to its owner’s graveyard when it cannot enter; CR 608.3f turns a resolving copy of a permanent spell into a token permanent.

O4P-01J can atomically perform the structural card-spell exit once the final destination/event is supplied. It must not decide whether the cause was countering, resolution, replacement, target illegality, or a failed battlefield entry. Synthetic objects have no card destination: removal from the stack is cease, except for the later token conversion of a copy of a permanent spell.

## 14. Required 30-scenario CR matrix

The following header is exact and applies to every row: **Scenario ID, Object kind, Source state, Operation, Destination, New object required, Runtime result, Announcement result, Stack order result, Governing CR, O4P-01J classification, Required test, Notes.**

| Scenario ID | Object kind | Source state | Operation | Destination | New object required | Runtime result | Announcement result | Stack order result | Governing CR | O4P-01J classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| J-01 | card spell | Card object in its owner’s hand; stack may be nonempty | Commit a completed card-spell announcement | Shared stack top | Yes; new card object after zone change | Remove old card runtime key; add default runtime for new stack card | Add exactly one card-spell record keyed to new object | Append one entry; prior bottom-to-top order unchanged | 112.1-2, 405.1-2, 601.2a, 400.7 | TRANSACTION_V1 | Valid hand-to-stack card commit with frozen bundle | The commit consumes a completed input; it does not implement proposal or payment. |
| J-02 | card spell | Card object in exile, graveyard, or command with an external cast permission | Commit a card spell from a non-hand source | Shared stack top | Yes | New card runtime uses zone-appropriate defaults; old key is absent | Preserve the supplied committed announcement; no permission field is invented | Append one entry on top | 400.7, 400.7g-h, 601.2a, 903.8 | LEGALITY_LATER | Non-hand source commit with permission supplied separately | Permission, face-down disclosure, timing, and Commander tax are not proven by this transaction. |
| J-03 | card spell | Card owner A; caster/controller B | Commit a card spell with divergent owner and controller | Shared stack top | Yes | New runtime follows the new card incarnation, not owner/controller metadata | Record remains attached to the new object; no controller duplication in announcement | Append one entry | 112.2, 405.4, 400.7 | TRANSACTION_V1 | Owner/controller divergence survives commit | Owner routes later card-zone destinations; controller is the caster. |
| J-04 | card spell | Existing card object has old-zone runtime state; source moves to stack | Commit and apply the V2 new-object/runtime reset | Shared stack top | Yes | Old tapped/face/counter/damage/attachment values do not carry; stack card has valid default runtime | Announcement is copied as a fresh immutable value, not from old runtime | Append new object only | 110.5, 400.7, 405.4 | TRANSACTION_V1 | Runtime reset and old-key removal | CR 400.7a-d are later preservation exceptions when a permanent spell becomes a permanent, not generic runtime copying. |
| J-05 | card spell | Nonempty mixed stack with existing card and synthetic objects | Commit one card spell with a complete O4P-01I record | Shared stack top | Yes | Card runtime key set gains exactly the new card key | Registry kind and announcement kind match exactly | Existing order preserved; new card is top | 405.1-4, 601.2i | TRANSACTION_V1 | Mixed-stack key/order parity | No second stack-order field is introduced. |
| J-06 | card spell | Card source and complete announcement are already fixed | Attach modes, targets, variables, distributions, and cost-choice snapshot during commit | Same new stack object | No additional object beyond J-01 | Runtime is unaffected by announcement fields | All supplied choices remain in O4P-01I order; no sort/dedup/default | One appended stack entry | 601.2b-d, 602.2b, 603.3c-d | TRANSACTION_V1 | Announcement round-trip through atomic commit | A valid structural record is not proof of legal targets or paid costs. |
| J-07 | card spell | Source object missing from every zone or identity registry | Attempt card-spell commit | No destination | No | Prior runtime remains unchanged; no candidate runtime is exposed | No announcement record is exposed | Stack remains byte-for-byte unchanged | 400.7, 601.2a, H exact membership invariant | TRANSACTION_V1 | Missing-source rejection and unchanged input | Failure is atomic; do not reserve an ID or publish a partial bundle. |
| J-08 | card spell | Registry, runtime, and announcement inputs disagree or contain duplicate source membership | Attempt card-spell commit | No destination | No | No candidate runtime is exposed | No candidate announcement is exposed | Stack remains unchanged | 400.5-7, 405.2, O4P-01H/I cross-invariants | TRANSACTION_V1 | Cross-bundle validation failure with no partial result | Complete deterministic issues are required; do not repair by sorting, merging, or deleting. |
| J-09 | spell copy | Existing committed source spell/ability reference; copy is not a card | Commit a spell-copy stack object with copied provenance supplied | Shared stack top | Yes; synthetic copy object | No runtime row is added | Add a spell-copy announcement record; copy decisions are input data, not derived here | Append one synthetic entry | 112.1a, 405.1-2, 707.10 | COPY_LATER | Valid spell-copy commit and no-runtime-row invariant | The structural commit consumes a complete copy input; copyable-values derivation and copy-effect execution remain deferred. |
| J-10 | activated ability | Source object may be present; activation has completed its external procedure | Commit an activated ability | Shared stack top | Yes; non-card ability object | No runtime row is added or copied from source | Add activated-ability record with text/choices snapshot | Append one entry | 602.2-2b, 405.1-4 | TRANSACTION_V1 | Activated-ability commit | CR 602.2 legality, cost, and payment are not reconstructed. |
| J-11 | activated ability | Source was valid at activation but has since left or changed zones | Commit the already activated ability | Shared stack top | Yes; ability object | No source runtime row is required by the synthetic contract | Record retains historical source reference/text; it does not require current source presence | Append one entry | 113.7, 113.7a, 602.2a | TRANSACTION_V1 | Source disappearance does not reject activated commit | Resolution-time current information/LKI is not implemented. |
| J-12 | triggered ability | Trigger occurred; source control at trigger time and placement choices are supplied | Commit a triggered ability at stack placement | Shared stack top | Yes; non-card ability object | No runtime row is added | Add triggered-ability record with placement-time text/choices | Append after already ordered trigger inputs | 603.2-3d, 603.3a-b, 405.3 | TRANSACTION_V1 | Triggered commit preserves trigger-time controller | Detection, APNAP collection, and priority are outside the transaction. |
| J-13 | triggered ability | Triggered ability requires a mode/target choice but no legal choice exists | Attempt to commit the pending trigger | No destination; ability is removed | No | No runtime row is created | No committed announcement record | Stack does not gain the ability | 603.3c-d | LEGALITY_LATER | Required-choice failure produces no commit | O4P-01J must accept only a completed/eligible input; the legality decision belongs to the caller/later slice. |
| J-14 | synthetic stack object | Valid spell-copy, activated-ability, or triggered-ability identity | Commit alongside card objects | Shared stack top | Yes; synthetic identity only | Runtime map key set remains card/token-only; no synthetic row | Exactly one matching synthetic announcement record | Mixed stack remains one bottom-to-top order | 109.1, 405.1-4, O4P-01H/H runtime | TRANSACTION_V1 | Synthetic/card mixed parity | This is a deliberate V2 runtime asymmetry, not a missing runtime row. |
| J-15 | token / mana or static ability | Token is a battlefield object, or action is a mana/static ability | Attempt to use ordinary synthetic stack commit | No ordinary stack destination | No | No runtime mutation | No announcement record | Stack unchanged | 405.6b-c, 604.1-2, 605.1-4, 109.1 | OUT_OF_SCOPE | Reject or route non-stack kinds without creating a stack object | A qualifying mana ability resolves immediately; a token is not a normal stack announcement object. |
| J-16 | synthetic stack object | Synthetic identity, source/copy reference, or kind does not match the requested announcement | Attempt synthetic commit | No destination | No | Prior runtime unchanged | No candidate announcement exposed | Stack unchanged | 112.1a, 113.7, 405.4, O4P-01H/I kind parity | TRANSACTION_V1 | Invalid identity/collision/mismatch failure | No ID generation, source resurrection, or kind coercion. |
| J-17 | any targeted stack object | Committed record has one target selection and an external effect permits changing one target | Replace exactly one target with a structurally valid supplied target | Same stack object | No; fresh record only | Runtime unchanged | Replace announcement immutably; modes/divisions remain unchanged | Same stack position and object ID | 115.2-3, 115.7b | TRANSACTION_V1 | Single-target replacement preserves identity/order | Whether the replacement is legal is not derived by O4P-01J. |
| J-18 | any targeted stack object | Committed record has multiple targets; external effect says change the target(s) | Replace all targets with a valid final set | Same stack object | No | Runtime unchanged | Fresh record contains the final target set | Same stack position | 115.7a, 115.7e | TRANSACTION_V1 | All-target replacement success | The operation is all-or-none; it cannot silently change only a subset. |
| J-19 | any targeted stack object | Multi-target record; at least one requested replacement is not legal | Attempt an all-target change | No state change | No | Runtime unchanged | Original record remains; no partial replacement | Same object/order | 115.7a | LEGALITY_LATER | All-or-none illegal-target failure | A legality engine must supply the result; transaction atomicity still forbids partial publication. |
| J-20 | any targeted stack object | Multi-target record; external effect says change any targets | Replace an allowed subset while preserving the rest | Same stack object | No | Runtime unchanged | Fresh record has only the selected changes | Same stack position | 115.7c, 115.7e | TRANSACTION_V1 | Any-target subset replacement | Target predicates and affected-subset choice remain external. |
| J-21 | any targeted stack object | Some existing targets are now illegal; effect says choose new targets | Leave any number unchanged and change only supplied legal targets | Same stack object | No | Runtime unchanged | Fresh record may retain historical illegal targets and changed targets | Same stack position | 115.7d | TRANSACTION_V1 | Choose-new-targets with unchanged illegal target | This is distinct from “change the target(s),” which cannot preserve an illegal target when replacement is required. |
| J-22 | any targeted stack object | Choose-new-targets effect supplies changed targets and unchanged targets | Validate final structural target set after replacements | Same stack object | No | Runtime unchanged | Publish only the final immutable record if the final set passes the external legality gate | Same stack position | 115.7d-e | LEGALITY_LATER | Final-set legality gate | O4P-01J does not implement protection, hexproof, shroud, zone, or characteristic predicates. |
| J-23 | any targeted stack object | Retarget request would change a target but also make an unchanged target illegal | Attempt target replacement | No state change | No | Runtime unchanged | Original record remains | Same stack position | 115.7d | LEGALITY_LATER | Unchanged-target interaction failure | The CR permits unchanged illegal targets only when the final set remains legal under the stated copy/retarget procedure. |
| J-24 | any targeted stack object | Targeted division record has assignments and target identities | Replace target references without changing amounts or assignment relation | Same stack object | No | Runtime unchanged | Original division assignments are preserved exactly | Same stack position | 115.7f, O4P-01I distribution contract | TRANSACTION_V1 | Retarget keeps division immutable | No rebalancing, sum recalculation, or new assignment is allowed. |
| J-25 | modal stack object | Committed modes are fixed; target replacement is requested | Replace targets only | Same stack object | No | Runtime unchanged | Mode sequence is unchanged; only target record can differ | Same stack position | 115.8, 700.2f | TRANSACTION_V1 | Modal retarget cannot alter mode | Any mode-legality check remains later. |
| J-26 | any targeted stack object | Target record points to an object no longer in the old zone or absent from current registry | Retarget or retain historical target reference | Same stack object | No | Runtime unchanged | Historical reference may remain; it is not rewritten to a new incarnation | Same stack position | 115.2, 608.2b, 400.7 | RESOLUTION_LATER | Historical target absence and later recheck | Current liveness and resolution legality are not validation requirements for the structural record. |
| J-27 | player-targeted stack object | Target reference names a player who may later leave or lose eligibility | Retain or structurally replace player target | Same stack object | No | Runtime unchanged | Player reference remains historical until a later legality/resolution rule acts | Same stack position | 115.2, 608.2b, 800.4 | RESOLUTION_LATER | Player-target lifecycle boundary | Player-exit semantics, targeting legality, and resolution outcome are outside O4P-01J. |
| J-28 | card spell | Card spell is on top or within the stack and a final card destination is already determined | Move card spell out of stack to its owner’s graveyard | Owner’s graveyard | Yes; new card object under CR 400.7 | Remove stack runtime key; add default runtime for new graveyard card; no status/counters/attachments | Remove the matching announcement record | Remove exactly that stack entry; relative order of others preserved | 400.3, 400.7, 405.1, 608.2n, 701.6a | RESOLUTION_LATER | Countered or completed instant/sorcery exit | Countering, all-illegal resolution, or final resolution cause is not selected here; the structural move is atomic once supplied. |
| J-29 | card spell / permanent-spell copy | Permanent spell is resolving and destination outcome is supplied | Move card spell to battlefield; for a permanent-spell copy, convert it to a token permanent | Shared battlefield | Yes; new permanent card object, or new token object for the copy branch | Card gets new battlefield runtime defaults; token gets its V2 token identity/runtime path | Remove source stack announcement; any later token announcement is not an O4P-01I stack record | Remove stack entry; battlefield placement follows the later resolution/object-creation contract | 110.2, 110.5b, 111.13, 400.7a-d, 608.3a-f, 707.10f | RESOLUTION_LATER | Resolution-to-battlefield boundary | Entry replacements, Aura attachment, mutation, continuous effects, and token creation details are not implemented by this matrix. |
| J-30 | spell copy / activated ability / triggered ability | Synthetic object is committed on the stack and is explicitly removed or has completed its stack lifecycle | Cease the synthetic object | No zone; object ceases | No destination object | Remove no runtime row; preserve all unrelated card/token runtime rows | Remove exactly its announcement record | Remove exactly its stack entry; remaining order preserved | 405.1, 608.2n, 704.5e, 707.10a, 800.4 | TRANSACTION_V1 | Synthetic cease is atomic and idempotence/error behavior is tested | A spell copy of a permanent spell resolving into a token is J-29, not a synthetic cease shortcut. |

## 15. Legality boundary

The transaction may reject malformed input, impossible cross-slice membership, wrong object kinds, duplicate identities, and invalid structural retarget shapes. It must not infer CR legality from a syntactically valid record. In particular, it does not decide whether a player may cast, whether a cost is payable, whether a target is legal, whether a triggered mode is legal, whether a final target set passes protection/zone checks, or whether a permanent spell can enter.

Those questions are classified `LEGALITY_LATER` where they gate a structural operation. An input that already carries the later decision may be committed atomically; the transaction does not claim to have made that decision.

## 16. Resolution boundary

CR 608.2a-b and 608.2h-n determine intervening-if checks, target rechecks, current information/LKI, resolution choices, and final movement/cease. O4P-01J does not run resolution or choose the final destination cause. It only applies a supplied structural exit in the J-28/J-29/J-30 shapes.

`RESOLUTION_LATER` therefore covers the timing/cause and target-outcome questions even when the eventual object move itself is a deterministic new-object transaction.

## 17. Copy boundary

CR 707.10 copies modes, targets, X, and additional/alternative-cost decisions, but not choices normally made during resolution. CR 707.10a removes a spell copy outside the stack; CR 707.10b preserves the original source for a copied ability; CR 707.10c-e govern new-target permissions; CR 707.10f converts a resolving permanent-spell copy into a token permanent.

O4P-01J may commit a complete spell-copy record or structurally replace a supplied target record. It does not derive copiable values, execute a copy effect, decide whether new targets are offered, or compare a copy against its source. Those are `COPY_LATER` or, for target legality, `LEGALITY_LATER`.

## 18. Contradictions and explicit DEFERs

### Contradictions recorded

1. The user instruction names `PLAN_SHA=3476e170124158da849dadb5a3031dfda4a28a3c`, while the local O4P-01J orchestration plan records `INITIAL BASE_SHA=2cd27710e690ae12cdcacfde6d9ac544ab85201f`. This analyst cannot use git to adjudicate the ancestry; the requested SHA is reported as the analysis base and the local discrepancy remains open.
2. The plan says the public result constructs/validates Registry V2, Runtime V2, and Announcement V1 together, while O4P-01H-H says Runtime V2 admits exactly card/token rows and no spell-copy/ability rows. The CR and existing validators resolve this deterministically: synthetic commits preserve the runtime key set and add no synthetic row.
3. CR 608.3f/707.10f turns a resolving copy of a permanent spell into a token permanent, while the O4P-01J summary names “synthetic-object cease.” The matrix treats J-29 as the explicit resolution-to-token exception and J-30 as cease for a synthetic object that leaves the stack without that exception.
4. O4P-01I calls target references historical and defers legality, while O4P-01J owns immutable retarget. The compatible boundary is structural record replacement in J, with all target predicates and final-set legality remaining later.

### DEFER list

- proposal, announcement UI, timing permission, priority, APNAP execution, trigger detection, and pending-trigger scheduling;
- total-cost calculation, mana abilities, payment, rollback protocol, Commander tax, and cost-resource mutation;
- target candidate generation, target legality predicates, protection/hexproof/shroud, final-set legality, player-exit resolution, and target outcomes;
- resolution, effect execution, continuous/replacement/prevention effects, Aura attachment, mutation, state-based actions, and cleanup;
- copyable-values derivation, copy-effect execution, copied decision derivation, new-target permission derivation, and full CR 707 handling;
- LKI capture and current source lookup beyond preserving the existing historical reference;
- command/event/audit metadata, actor/authority/visibility, revision, projection, Online/Cloudflare/WebSocket, Solo connection, persistence migration, UI, and public TypeScript naming;
- implementation, test-file edits, review tests, package/dependency/version changes, ledger/docs/AGENTS changes, git operations, CI, Pages, and release status.

## 19. Required test inventory

The acceptance author should derive tests from the frozen contract, not from this analyst’s prose alone. At minimum the tests must cover:

- one valid card commit from a hand source, one permitted non-hand source, owner/controller divergence, new object/runtime reset, mixed-stack order, and exact announcement parity;
- missing/duplicated source, invalid registry/runtime/announcement cross-bundle, wrong kind, identity collision, and every failure’s no-partial-state guarantee;
- one valid spell copy, activated ability, and triggered ability, source disappearance, no synthetic runtime row, trigger-required-choice rejection, and token/mana/static out-of-scope rejection;
- each CR 115.7a-e replacement shape, all-or-none failure, historical object and player targets, immutable division, and unchanged modes;
- card-spell graveyard exit, permanent-spell battlefield exit, permanent-spell-copy token exception, synthetic spell-copy cease, synthetic ability cease, stack order removal, and exact registry/runtime/announcement key parity after every success;
- fresh deep-frozen results, input preservation, deterministic issue ordering, no random/time/network behavior, and unchanged unrelated bundle entries.

No `review.*` test is edited by this analysis. No test result is claimed because implementation and acceptance-author work are outside this lane.

## 20. Status and handoff

This document is a requirements-analysis draft only. It is not a frozen contract, does not authorize implementation, and does not change any source, test, package, docs, ledger, review file, or release artifact.

Changed file: `research/cr-grounding/o4p-01j-r-stack-transaction-cr-matrix.draft.md`

Final status: `analyzed-not-integrated`
