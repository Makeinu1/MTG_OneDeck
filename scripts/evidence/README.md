# Current browser evidence contracts

Status: M5 supporting verification ownership  
Semantic authority: none  
Acceptance authority: none  
Project NOW authority: none  
External-write authority: none

This directory records the current owner of browser-level fault models that were previously stranded in legacy milestone/workflow bundles.

The IDs in `registry.json` are operational evidence-contract identifiers. They are **not** M2 semantic IDs, Product requirements, Acceptance IDs, or a replacement for M3/M3.1 candidate-relative verification.

A contract here establishes:

- the current executor/harness substrate;
- the browser-level observations that must survive evidence migration;
- environment bounds;
- which legacy evidence may retire only after the current execution path is active and verified.

It does not claim that a browser check is currently fresh for a candidate merely because the contract exists. Candidate freshness still belongs to the current verification path that executes/records the evidence.

The current three contracts intentionally remain outside `scripts/journeys/registry.json`: the journey harness local stages currently accept Vitest runners, while these Cockpit browser checks require local browser/server or evidence-only Vite setup. M5 does not redesign the journey harness merely to move old evidence.
