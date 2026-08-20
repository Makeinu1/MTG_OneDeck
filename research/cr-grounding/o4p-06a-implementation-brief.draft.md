# O4P-06A Implementer Brief

Milestone: `O4P-06A`
Base SHA: `04dd0575388d3aa5a09f63ef6123f67b63933fe3`
Contract: `research/cr-grounding/o4p-06a-four-real-deck-bootstrap.contract.draft.md`
Acceptance: `research/cr-grounding/o4p-06a-acceptance-brief.draft.md`

## Goal

Implement the frozen additive four-real-deck bootstrap: a deterministic,
validated, deeply frozen revision-0 Core/Room/Protocol genesis, empty-journal
replay evidence, strict seat/card identity separation, a committed offline
336-name card catalog, and the three-artifact 1 MiB fail-closed size gate.

Read the frozen contract and acceptance brief completely before editing. Do
not reinterpret or broaden them.

## Allowed writes

Only new files under `src/online/bootstrap/**`, specifically:

- bootstrap/catalog/measurement modules and the local `index.ts` under that
  directory;
- `src/online/bootstrap/fixtures/o4p-06a-four-deck-card-catalog-v1.json`;
- ordinary tests under `src/online/bootstrap/__tests__/` whose basenames do
  not contain `review.`.

No existing file or barrel may be modified. If an existing-file edit appears
necessary, stop and report it as unresolved rather than expanding scope.

## Bounded fixture acquisition authority

You may derive 308 exact and 11 front-face entries from the local pinned raw
corpus. A front-face route is allowed only when `card_faces[0].name` is an
exact unique match and layout is `transform`, `modal_dfc`, or `prepare`; the
only `prepare` route is `Naktamun Lorespinner`. Because that corpus is
gitignored, commit the minimal projections for all 336 lookup names in the
catalog fixture; tests and runtime must use only that committed fixture.

The live acquisition budget is consumed. No further request, retry,
pagination, endpoint, localized-print fetch, or other network access is
authorized. The preserved initial rejection is
`/tmp/o4p06a/live-collection-response-1-400.json`; the accepted replacement
response is `/tmp/o4p06a/live-collection-response.json`; and the verified
mapping is `/tmp/o4p06a/live-mapping-report.json`. The accepted list has exactly
17 dense `data` entries, empty `not_found`, and no `has_more` or `total_cards`
field. Those absent optional fields satisfy the contract; only a present
`has_more: true` would indicate incomplete pagination.

Project only the frozen Core snapshot fields and discard all other live
response fields. `Malakir Rebirth` maps to face 0 of
`609d3ecf-f88d-4268-a8d3-4bf2bcf5df60`: retain lookup name
`Malakir Rebirth` and resolution `live-collection`, but project the full
`Malakir Rebirth // Malakir Mire` modal-DFC definition and both faces in
Scryfall order using the same projection as pinned front-face entries. Do not
invent a single-face definition, guess, or synthesize card data.

The committed fixture wrapper literals are exactly:
`kind: "o4p-06a-four-deck-card-catalog-v1"`, `schemaVersion: 1`,
`corpusManifest` equal to the pinned manifest's exact `source` object, and
`corpusSavedCards: 17491`. Do not substitute a path, the full manifest, or a
different stable literal.

## Constraints and prohibitions

- No git operations: no add, commit, push, branch, stash, checkout, or reset.
- Do not create or edit any `review.*` file. The Judge owns
  `src/online/bootstrap/__tests__/review.o4p-06a-four-real-deck-bootstrap.test.ts`.
- Do not edit `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/`, Judge protocol,
  any ledger/history/archive, or `research/cr-grounding/*.draft*`.
- Do not edit package files, dependencies, scripts/checks, workflows, version
  constants, CR files, `Mydeck/`, `src/data/deckParser.ts`, or any existing
  Core, Room, Protocol, Projection, Cloudflare, Store, Solo, React/CSS, app,
  deployment, or fixture file.
- No further network access; the authorized Scryfall acquisition is complete
  and its budget consumed. No storage, clock, randomness, environment
  fallback, DOM, UI, transport, lobby, deployment, or new gameplay command.
- TypeScript strict; no `any`. Use `unknown` plus explicit guards. Code,
  comments, identifiers, issues, and errors are English. UI text is N/A.
- Reuse shipped factories, validators, canonical serialization, replay, Room
  operations, Protocol construction, and Cloudflare constants/codecs. Factory
  inputs omit `kind`. Do not duplicate reducers or relax validation.
- Preserve caller inputs. Do not auto-trim, sort, deduplicate, merge, delete,
  or mutate deck data. Return deterministic complete issues and fresh deeply
  frozen successful outputs exactly as frozen by the contract.
- Run only the ordinary targeted commands in the acceptance brief while
  iterating. Do not run the full release check or claim audit/release status.

## Done when

- All twelve acceptance scenarios have ordinary executable evidence within
  the allowed path.
- The exact four tracked real decks yield 100/100/104/100 physical cards, four
  correct Commanders, no seat identity crossing, a valid active revision-0
  Protocol state, deterministic canonical strings/digests, and successful
  empty-journal replay.
- The committed catalog is exactly 336 entries with 308/11/17 provenance and
  no runtime/CI dependency on the ignored raw corpus or network.
- All three actual four-deck artifacts report exact TextEncoder byte counts at
  or below 1,048,576; over-limit probes return the frozen complete issue set
  and no partial value.
- Ordinary targeted Vitest, scoped ESLint, `npx tsc -b`, and
  `git diff --check` pass.

## Report format

Return a compact report with:

1. changed files;
2. exact acceptance IDs and targeted command results;
3. the three measured byte counts and limit;
4. explicit DEFER/non-goals preserved;
5. unresolved items, including any catalog name or size failure.

Do not report O4P-06A as audited, shippable, committed, or released.
