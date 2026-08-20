# O4P-06D Cold Audit Brief

- Milestone: `O4P-06D`
- Base: `f050bd5b0db21b70a4fd6edbd89719b57bbf9e56`
- Profile: BROAD, context-free, findings only.
- Required reading: `AGENTS.md`, development skill/governance, `docs/judge-protocol.md`, O4P-06D contract, acceptance brief, and this brief.

Audit the frozen candidate without edits, git mutations, full check, network, publication, or implementation rationale. Verify the exact diff/fingerprint and all acceptance points. Adversarially test at least:

- lost/duplicate/out-of-order ACK and snapshot delivery;
- stale socket events across two or more epochs;
- revision regression/jump, identity mismatch, unknown/versioned frames, close/error races, reconnect exhaustion/cancellation;
- 64/65 outbox boundary, duplicate command-ID mismatch, command replay byte identity;
- malformed JSON, UTF-8/oversize, sparse/accessor/symbol/prototype/cycle inputs where reachable;
- capability/value/property-key fragments in public snapshots, errors, URL, pending commands, callbacks, and ambient browser storage/log surfaces;
- valid projection acceptance through the shipped validator and proof that no non-projection event mutates authoritative state;
- dependency/version/protocol/Worker/UI/storage/logging scope boundaries and reverse imports.

Independently rerun targeted Judge/ordinary/architecture tests, affected historical reviews, typecheck, affected lint, generator check, and diff check. Report BLOCKER/HIGH/MEDIUM/LOW counts. Only return `AUDIT-OK-PENDING-FULL-CHECK` if all are zero.
