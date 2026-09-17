# MTG OneDeck

MTG OneDeck is a React + TypeScript + Vite Commander sandbox. Engine transitions are deterministic and reversible; unsupported Oracle composites remain guided or manual.

## Read the right source

- Current project state (generated restart view): [`docs/generated/project-state.md`](docs/generated/project-state.md)
- Canonical project-state source: [`docs/project-state/index.json`](docs/project-state/index.json)
- Contracts and ownership: [`docs/contracts/manifest.json`](docs/contracts/manifest.json)
- Acceptance scenarios: [`docs/acceptance/scenarios.json`](docs/acceptance/scenarios.json)
- Document entry: [`docs/README.md`](docs/README.md)
- Extended roadmap / provenance / history: `research/cr-grounding/cr-backbone-ledger.json`

## Verification lanes

```sh
node scripts/checks/check-project-state.mjs
npm run check:docs
npm run check:fast
npm run check:domain -- docs
npm run check
```

The Project State check validates M1 state integrity and freshness; it does not infer semantic correctness. `check:fast` is the affected, offline, no-build lane. `check:domain` selects one domain. `check` is the release gate and runs the complete static verification, docs verification, lint, Vitest projects, and one production build.

## Development

```sh
npm ci
npm run dev
```

The public Pages site is [makeinu1.github.io/MTG_OneDeck](https://makeinu1.github.io/MTG_OneDeck/).
