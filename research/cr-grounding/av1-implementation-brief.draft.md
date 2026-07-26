# AV1 implementation brief — semantic presentation boundary

## Role and scope

You are the `qwen3.8-max-preview` implementer. Implement AV1 only. Do not touch git,
`review.*`, `docs/`, `AGENTS.md`, the ledger, settings UI, production audio playback,
visual effects, or controller wiring.

Read only:

- `AGENTS.md`
- `docs/audio-visual-contract.md` §§2, 4
- `docs/ui-architecture-v2.md` §§7.1–7.3, 7.6 AV1
- `src/components/game/__tests__/review.av1-presentation-events.test.ts`
- AV0 files under `src/components/game/presentation/`

## Required implementation

Create:

- `src/components/game/presentation/presentationEvents.ts`
- `src/components/game/presentation/presentationSequencer.ts`
- ordinary tests under `src/components/game/presentation/__tests__/`

The judge pin fixes the public boundary:

- exactly four kinds: `spell-cast`, `commander-cast`, `land-played`, `turn-advanced`
- successful forward semantic actions only
- commander replaces generic cast
- cast and land include causal source/destination zones
- ID is `<session nonce>:<shared increasing sequence>`
- `committedAtMs` comes from an injectable monotonic clock and is not identity
- repeated engine `sourceEventId` still receives a fresh presentation ID
- channel is future-only; no replay on subscribe/remount/baseline
- republishing the same already-sequenced ID is delivered at most once

Use no log-text parsing, random effects, React state clock, dependency, or engine API
change. Keep the modules UI-only and framework-independent.

## Verify and report

Run the AV1 judge pin, AV1 ordinary tests, AV0 pins/tests, and lint. Report only:

1. changed files
2. exact test result summary
3. deferred work
4. unresolved concerns
