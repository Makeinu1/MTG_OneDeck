# MTG OneDeck

MTG OneDeck is a React + TypeScript + Vite Commander sandbox. Engine transitions are deterministic and reversible; unsupported Oracle composites remain guided or manual.

## Read the right source

- Contracts and ownership: [`docs/contracts/manifest.json`](docs/contracts/manifest.json)
- Acceptance scenarios: [`docs/acceptance/scenarios.json`](docs/acceptance/scenarios.json)
- Document entry: [`docs/README.md`](docs/README.md)
- Current roadmap/status: `research/cr-grounding/cr-backbone-ledger.json`

## Verification lanes

```sh
npm run check:docs
npm run check:fast
npm run check:domain -- docs
npm run check
```

`check:fast` is the affected, offline, no-build lane. `check:domain` selects one domain. `check` is the release gate and runs the complete static verification, docs verification, lint, Vitest projects, and one production build.

## Development

```sh
npm ci
npm run dev
```

The public Pages site is [makeinu1.github.io/MTG_OneDeck](https://makeinu1.github.io/MTG_OneDeck/).
