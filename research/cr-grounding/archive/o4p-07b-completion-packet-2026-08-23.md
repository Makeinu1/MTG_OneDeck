# O4P-07B Completion Packet

Date: 2026-08-23
Milestone: O4P-07B
Risk: R3 / BROAD
Authority:

- `research/cr-grounding/o4p-07b-arbitrary-deck-ui-dynamic-genesis.contract.draft.md`
- `research/cr-grounding/o4p-07b-acceptance-brief.draft.md`
- `research/cr-grounding/archive/o4p-07b-cold-audit-record-2026-08-22.md`

## Released behavior

- The served Online UI selects every saved deck and imports a new Scryfall-backed
  list without using the fixed four-deck catalog as a v2 submission authority.
- Public v2 submit, ready, retry, start, owner-only issue handling, and truthful
  pre/post-WebSocket connection labels are active.
- Start builds the active Room directly from four immutable seat snapshots.
  Identical decks receive distinct seat-scoped physical IDs; arbitrary totals,
  zero/multiple commanders, quantities, and DFC faces remain supported.
- A fresh submission clears readiness before external resolution. Parse-invalid
  attempts are immutable `needs-attention` submissions; same ID/same content is
  idempotent and same ID/different content is a non-mutating structured conflict.

O4P-07B deliberately retains the legacy v1 compatibility endpoint and fixed
catalog fixture modules. Production import-graph removal, v1 upgrade rejection,
storage-isolated cross-browser acceptance, and the complete release claim remain
O4P-07C-owned.

## Candidate and audit chain

- Initial O4P-07B product: `02c3bf9b9575774b26bc65bae23b7b15ba603ef1`.
- Ownership reauthorization: `1784c9c1732b2567ed5ece23a68a2675e0d30502`.
- Production resubmission repair:
  `71f63ba07a08c63717f4e239fa1e72cafb05a18b`.
- Historical frozen-SHA chain repair and release HEAD:
  `1b709ba0477088fc8868a4a32daab6f635a5e7e3`.
- Final repair semantic fingerprint:
  `91b69b0657e83f88b503d3791e19de91363b08ed1067525b162609d765b8e005`.
- Final repair record-bearing fingerprint:
  `b27c457f97bb0b484a973e5a59bdc217b4d77032baba92576d2262f725d64eda`.
- Full-check hash-chain repair fingerprint:
  `c73646f61a3ae094690b2d0aceab4a58a770233b6ecb02007521137476963f33`.
- Hash-chain record-bearing fingerprint:
  `2878473a428321995bbdb24e08bfa9a4151f0ba6aa52d7927791a2e784f5f3ce`.
- Fresh Luna/xhigh repair and metadata audits by
  `/root/o4p07b_resubmit_cold_audit`: BLOCKER/HIGH/MEDIUM/LOW `0/0/0/0`.

## Exact-head CI and Pages

Actions `32606046111` checked out exact HEAD
`1b709ba0477088fc8868a4a32daab6f635a5e7e3` and passed:

- full `npm run check -- --build-base=/MTG_OneDeck/`;
- Core 227 files / 2,093 tests;
- DOM 336 files / 2,266 passed + 1 skipped = 2,267 tests;
- all machine verifiers, docs, lint, TypeScript, and Vite build;
- exact diff-base `71f63ba07a08c63717f4e239fa1e72cafb05a18b`;
- `check:forbidden` with no forbidden files;
- build job `97111124868`, total machine-check 755,232 ms;
- Pages deploy job `97112444712`.

Served Pages evidence:

- `https://makeinu1.github.io/MTG_OneDeck/`: HTTP 200;
- `assets/index-D9Wy8C7f.js`: HTTP 200;
- `assets/index-DB7TO263.css`: HTTP 200;
- HTML last-modified: `Sat, 22 Aug 2026 23:57:58 GMT`.

## Worker and public-flow evidence

Wrangler 4.125.0 deployed the exact release tree to
`https://mtg-onedeck-online.makeinu1.workers.dev`:

- Worker version `9dc26980-7e1b-4e4b-86e8-2314a373f2c2`;
- deployment `d7d8e0a8-70f2-4e35-b7ae-f7c4054d401a`;
- active allocation 100%;
- only `ONLINE_ROOMS` and `CF_VERSION_METADATA` bindings;
- startup 197 ms;
- safe root probe: HTTP 404 / `online-cloudflare-error-v1`.

The served Pages app was reopened after deployment in four fresh in-app browser
tabs. Four saved catalog-external lists were available. The exercised seats
included two identical deck selections, a zero-commander list, multiple
commanders, non-100 totals, a repeated quantity, and DFC definitions.

Observed public flow:

1. Four seats joined through three one-time invites; invite/capability values
   were retained only inside the browser test and never emitted to evidence.
2. All four submissions resolved through production Scryfall and projected
   `accepted`; all owner-error counts were zero.
3. The host toggled ready, explicitly resubmitted the same saved deck, and the
   final production projection was `accepted` plus `ready=false`.
4. All seats readied again; the Room reached start-ready and started.
5. All four tabs reported Online and rendered a personal workbench; the host
   also rendered the table pairing. Browser diagnostic log counts were zero in
   every tab.

The earlier production version `d8bb997e-934c-40e4-9ad8-8118be7b5476`
reproduced stale readiness and was not accepted. The repaired version above is
the first accepted production result for that scenario.

Responsive evidence on the same O4P-07B UI tree covered 375x812, 812x375, and
1440x900 with no horizontal overflow or clipped controls and zero console
errors. The post-audit repair changed persistence/result semantics, not layout
or CSS. Automated review and exact-head CI retain the closed reconnect,
revision-zero empty-journal replay, privacy, dynamic-genesis, and identical-deck
physical-ID assertions.

## Closure boundary

O4P-07B is eligible for `shipped`. This packet does not claim O4P-07 program
completion. O4P-07C must remove fixed-catalog and v1 production paths, prove the
production bundle/import graph excludes them, repeat the four independent
browser-context/cross-browser acceptance including reconnect/replay, and close
the final exact-head release gates.

## Independent completion audit

Fresh-context Luna/xhigh auditor `/root/o4p07b_completion_cold_audit`
recomputed candidate fingerprint
`f75cc1d5e94197174845784427235a8d5bbef37d41c549e0791e689bfc435e4c`.
It independently verified the exact two candidate paths, ledger synchronization
and O4P-07C transition, Actions test counts and jobs, Pages assets, Worker active
allocation and safe root, credential non-disclosure, and the explicit O4P-07C
defer boundary.

Findings: BLOCKER/HIGH/MEDIUM/LOW = `0/0/0/0`.

Approval: `O4P-07B-PRODUCTION-COMPLETION-APPROVED`.
