# O4P-09D cold-audit brief

Milestone: `O4P-09D`
Risk/Audit budget: R3 / BROAD, one logical wait chain up to 45 minutes

Audit only the exact candidate fingerprint supplied by the Judge against:

- `research/cr-grounding/o4p-09d-tabletop-primitives.contract.draft.md`
- `research/cr-grounding/o4p-09d-acceptance-brief.draft.md`
- `research/cr-grounding/o4p-09-shared-table-playable-roadmap.contract.draft.md`
- repository `AGENTS.md` and the pinned existing Core/Protocol/Projection APIs

Authority boundary: this is a local semantic candidate. O4P-09D commit, push,
deploy, and ship are false. Verify that generated API bytes are current and
release preflight is green, but do not require or create the impossible
`lastVerifiedCommit` reanchor, release full check, or ledger promotion in this
audit. Report an actual semantic/generated-byte defect normally; identify the
unauthorized terminal gates separately rather than treating their deliberate
fail-closed state as a product finding.

Inspect adversarially: closed primitive coverage; explicit Structured/Freeform
provenance without authority widening; seat/object/player authority; own-hidden
versus other-hidden handling; executable Look/Reveal/Choose rejection; server-
only entropy and order; duplicate entropy-once behavior; atomic SQLite journal
and reconstruction; descriptor/unknown-field/sparse-array attacks; note text and
capability leakage; manual stack top-only behavior; Core/event/replay/final-root
parity; participant/table projection secrecy; bounded public errors; production
GameScreen journey; no client Core apply, optimistic state, second reducer or
player screen; Solo regressions; and responsive/accessibility evidence.
Inspect `research/cr-grounding/o4p-09d-browser-evidence.draft.md` for the final
three-viewport measurements and secret-free screenshot hashes.

Do not edit files, inherit implementation rationale, run the release full
check, or expose any secret value. Return only findings with severity, exact
path/line, violated acceptance, and minimal reproduction; finish with
BLOCKER/HIGH/MEDIUM/LOW totals and the audited fingerprint.
