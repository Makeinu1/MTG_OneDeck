# O4P-06F Four-Browser Production Acceptance & Release contract

Date: 2026-08-21<br>
Milestone: `O4P-06F`<br>
Base SHA: `8810ed2e6db69fdc93c131f6abc195af6a763066`<br>
Status: frozen Judge-owned candidate contract<br>
Risk: R3 production network, browser, credential, replay, and release closure

## Goal

Close the user-approved O4P-06 program by executing one bounded production
scenario against the exact shipped Pages app and Cloudflare Worker. Four
isolated actual Chrome browser contexts use the four real Commander decks
`Mydeck/Celes.txt`, `Gogo.txt`, `Kefka.txt`, and `Muldrotha.txt`; create and
start one private Room; authenticate all four Players plus the host Table;
accept one O4P-06B `table-draw` from every seat; reconnect and resynchronize;
accept one Player exit; and prove that the persisted final state reconstructed
after an identical-code Worker deployment has the same audience projections.

This is an acceptance/release milestone. It does not add another product API,
protocol version, credential channel, browser persistence path, dependency, or
test hook. A production defect found by executable evidence fails closed and
must receive a separately bounded correction and re-audit before release.

## Exact production surfaces

- Pages: `https://makeinu1.github.io/MTG_OneDeck/`
- Worker: `https://mtg-onedeck-online.makeinu1.workers.dev`
- Room create: `POST /api/online/rooms`
- Lobby: `GET|POST /api/online/rooms/{roomId}/lobby`
- Room status: `GET /api/online/rooms/{roomId}`
- WebSocket: `wss://mtg-onedeck-online.makeinu1.workers.dev/api/online/rooms/{roomId}/websocket`

All browser HTTP and WebSocket traffic must originate inside the four Chrome
contexts with the public Pages origin. Node may orchestrate Chrome DevTools
Protocol and retain returned credentials in process memory, but it must not
perform participant network traffic itself. The exact Pages document must load
successfully in every context and expose the public Online entry and lobby
controls before the production scenario begins.

## Browser and dependency boundary

The executable harness uses the already installed system Google Chrome through
Chrome DevTools Protocol and Node 24 built-ins only. It creates exactly four
distinct `Target.createBrowserContext` contexts, one page in each, and closes
all targets, contexts, sockets, and the temporary Chrome profile on success or
failure. Four tabs in one default context, jsdom, fake sockets, HTTP-only
clients, Node-owned WebSockets, or a mocked Worker are not production evidence.

No Playwright, Puppeteer, WebSocket, browser, runtime, or other dependency may
be added to `package.json` or the lockfile. The harness accepts an explicit
Chrome binary override for portability but never downloads a browser or
package. Chrome launch, Cloudflare deployment, GitHub publication, and network
inspection remain Judge/operator actions after audit and full check.

## Secret and evidence discipline

Room/participant IDs and every invite/seat/Table capability are generated at
runtime. Capabilities and every contiguous eight-code-unit fragment remain
only in volatile process/page memory. They must never enter a URL, file,
terminal output, screenshot, trace, HAR, console line, thrown message, evidence
record, command line, environment dump, browser storage, or public projection.
The non-secret Room correlation ID may appear only in bounded operator output.

The harness emits one closed, descriptor-safe, size-bounded summary containing
only: schema/kind, production origins, Chrome version, four-context count,
four fixed deck labels plus SHA-256 hashes and byte counts, public asset hashes,
HTTP statuses, revision/count facts, action-kind counts, reconnect/resync facts,
pre/post deployment version identifiers, per-audience projection hashes,
recovery-fact counts, console error/warning counts, and cleanup outcome. It
emits no response body or raw JSON protocol frame.

## Executable scenario

1. Launch one temporary headless Chrome process and create four isolated
   browser contexts. In every context load the exact Pages URL, select the
   Online entry, and verify the public Online root/create/join/deck/ready/start
   controls exist with zero console error or warning.
2. From the host context create one lobby and retain exactly three invites,
   one Player credential, and one Table credential in memory. Claim the three
   remaining seats from the other contexts. Submit the exact four real-deck
   texts in fixed seat order and mark all four ready.
3. Start only through `online-forming-lobby-start-with-table-v1`. Require
   revision zero, four authenticated Player sockets, one authenticated Table
   socket, accepted hello, and capability-free audience projections.
4. Sequentially accept one `table-draw` command from P1, P2, P3, and P4 at
   revisions 1 through 4. Every command uses the authenticated seat, exact
   next sequence/base revision, actor=decision maker, and the frozen tabletop
   decision context. Require four non-duplicate ACKs, each player's own hand
   count to increase by one, own library count to decrease by one, and no
   opponent hidden-card identity disclosure.
5. Close P2's socket without clearing its volatile identity, open a fresh
   socket in the same browser context, authenticate, request from a stale known
   revision, and require bounded resync plus one current projected snapshot.
   Duplicate, stale-epoch, or unsolicited frames must not advance evidence.
6. From P4 accept one `player-exit` concession as revision 5. Require the
   status endpoint to report revision and accepted-command count 5 and every
   remaining Player/Table audience to report P4 exited/conceded without hidden
   identity leakage.
7. Canonicalize and hash each capability-free final audience projection. Pause
   at a secret-free operator barrier. Deploy the exact same audited Worker
   candidate as a distinct Cloudflare version, then reconnect P1-P3 and Table,
   request current projections, and require each audience hash to equal its
   corresponding pre-deployment hash.
8. Require bounded Workers Logs evidence for the same Room: distinct valid
   pre/post deployment version identifiers, zero exception/error/parse/secret
   violations, and at least one successful recovery verification with
   checkpoint revision 0, current revision 5, replay count 5, and outcome ok.
   Final HTTP status remains revision/count 5.

The five accepted commands are the complete journal suffix. The repository's
normal load path independently replays that suffix and compares reconstructed
state before serving the post-deployment projections; therefore the recovery
fact plus byte-stable audience hashes is the executable final-state/replay
comparison. No public raw Core root or journal endpoint is introduced.

## Release sequence

1. Judge-owned contract, acceptance, implementation brief, and `review.*`
   tests are frozen before implementation.
2. A Luna xhigh implementer may add only the evidence harness, its ordinary
   tests, the evidence tsconfig inclusion, and one dependency-free npm command.
3. A context-free Luna xhigh cold auditor returns findings only. BLOCKER/HIGH
   must be zero and the audit record must exist.
4. The exact audited fingerprint passes one local `npm run check`. Only a
   defect found by that check permits a bounded repair, invalidated checks,
   re-audit, and one final full check.
5. Commit/push the exact candidate. Exact-head Actions must pass full check,
   build, forbidden ownership reauthorization, Pages artifact, and deploy.
6. Wrangler `4.122.0` dry-run and deploy the exact candidate. Run the production
   harness, perform its identical-code barrier deploy, capture secret-free tail
   facts, and verify Pages HTML/JS/CSS plus Worker/status smoke.
7. Independently audit the production evidence record and exact identities.
   Only then promote O4P-06F in both ledger collections, close active O4P-06,
   commit/push terminal metadata, require exact-head CI/Pages success, confirm
   Cloudflare still serves the audited deployment, and leave a clean worktree.

## Implementer write boundary

Allowed writes are exactly:

- additive `scripts/online/o4p-06f-four-browser-evidence.ts`;
- additive ordinary tests named without `review.` under
  `src/online/browser/__tests__/`;
- `scripts/online/tsconfig.json` only to include that script; and
- `package.json` only to add one dependency-free `evidence:o4p-06f` command.

No product file under `src/` other than the ordinary test, `review.*`, docs,
ledger, workflow, Wrangler config, package-lock, dependency field, version,
manifest, generated file, git operation, deploy, network evidence, or release
record is in the implementer boundary.

## Explicit non-claims

This milestone does not claim a 24-hour soak, matchmaking, chat, public room
discovery, accounts, spectators beyond the single host Table, custom domains,
multi-tab ownership, background sync, token rotation UI, account-wide abuse or
cost control, arbitrary Oracle automation, or complete automated Magic rules.
