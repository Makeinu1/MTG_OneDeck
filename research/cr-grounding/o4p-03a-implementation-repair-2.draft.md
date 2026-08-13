# O4P-03A Luna implementation repair 2 of 2

Milestone: `O4P-03A`

Base SHA: `95b34868966de671c97f0aa824422ccb0c14e051`

Same implementer, final permitted return. Read the amended frozen contract,
acceptance brief, original implementation brief, repair 1 brief, and both
Judge-owned `review.o4p-03a-*` tests. Do not edit any Judge-owned path.

## Reproduced failures to close

1. Route classification must distinguish an invalid visible Room ID from an
   unknown route. An invalid Room ID returns generic 400. A valid Room ID plus
   unknown action or extra segment returns generic 404. Both reject before
   `ONLINE_ROOMS.getByName`. Routing authority is only the platform-normalized
   `new URL(request.url).pathname`; do not attempt to reconstruct raw dot-
   segment spellings removed before the Worker observes the request.
2. Before `transactionSync`, capability filtering must cover every textual
   accepted-journal SQL parameter: `commandId`, `participantId`, and serialized
   command JSON. Detect every contiguous window of at least eight UTF-16 code
   units from all configured seat/observer capabilities. A match throws before
   the transaction, so the Durable Object returns its generic 500, exposes no
   shipped ACK, and writes nothing.
3. Extend ordinary route and persistence/runtime tests for the exact 400/404
   split and capability-fragment metadata failure. Preserve the shipped
   protocol operation, its ACK/reject semantics for safe inputs, and every
   O4P-03B/C/D DEFER.

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
