# O4P-03A Luna implementation repair 1 of 2

Milestone: `O4P-03A`

Base SHA: `95b34868966de671c97f0aa824422ccb0c14e051`

Same implementer return. Read the frozen contract, acceptance brief, original
implementation brief, and both Judge-owned `review.o4p-03a-*` tests. Do not
edit any Judge-owned path.

## Reproduced failures to close

1. Real Cloudflare SQLite is `ctx.storage.sql.exec()`. Current construction
   reaches nonexistent `storage.exec()` and the Judge review reproduces
   `TypeError: storage.exec is not a function` before every Room operation.
   Model `storage.sql.exec` exactly and keep `transactionSync` on storage.
2. `online_room_state` must be a physical singleton: literal
   `singleton INTEGER PRIMARY KEY CHECK (singleton = 1)`. INSERT binds the
   singleton as the first of seven parameters. Accepted commit performs
   journal INSERT plus state UPDATE in one `transactionSync`; UPDATE is a
   compare-and-set constrained by singleton, Room ID, and prior/base revision.
   A missing/stale state throws so the transaction rolls back.
3. PUT initialization is a closed exact three-field record. Unknown fields,
   nonzero revision/accepted count, or nonempty receipts reject with zero
   writes. Identical canonical init is write-free; different init is `409`.
4. `room..legal` satisfies the shipped ID grammar and is not a dot segment.
   Remove the broad substring rejection while retaining encoded slash,
   traversal/dot-segment, prototype-key, control, invalid-encoding, empty, and
   extra-segment rejection before namespace lookup.
5. Remove the capability-bearing `OnlineCloudflareStoredCommandV1` envelope
   type. Replace `export *` with explicit value/type exports matching the
   contract. No public stored-envelope surface exists.
6. Expand the four ordinary test files to exercise their acceptance-brief
   responsibilities. The current 5 smoke tests are not sufficient evidence.

## Judge evidence

Run both Judge-owned tests to guide the repair but do not edit them:

```text
npx vitest run --project dom \
  src/online/cloudflare/__tests__/review.o4p-03a-cloudflare-runtime-persistence.test.ts \
  src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts
```

Then run the four ordinary tests, owned-file lint, `npm run build`, and
`git diff --check`. Do not run the release full check or any git operation.
Report exact results, remaining failures, DEFERs, and changed files.
