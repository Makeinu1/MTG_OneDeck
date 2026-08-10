# Acceptance entry

The acceptance registry is [`acceptance/scenarios.json`](acceptance/scenarios.json).

Scenario IDs are globally unique. Ordinary acceptance uses committed fixtures and snapshots. A failed scenario starts again at that scenario's first step; a shared fixture change rechecks its domain; shared engine, store, or test infrastructure changes use the wider affected lane. Release check runs once after candidate freeze.

Viewport evidence is required only for UI impact. AV comfort evidence is required only for AV impact. Live Scryfall evidence belongs to [`ACC-ONLINE-001`](acceptance/scenarios.json) and is not an ordinary acceptance prerequisite.

The complete former document is preserved at [`research/archive/document-reset-2026-08/original-acceptance.md`](../research/archive/document-reset-2026-08/original-acceptance.md), with every heading mapped in [`migration-map.json`](../research/archive/document-reset-2026-08/migration-map.json).
