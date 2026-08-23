# O4P-08C Judge Acceptance Brief — 2026-08-24

1. Create variable lobby/room/genesis for `(2,20)`, `(2,40)`, `(4,40)`; reject
   `(4,20)`, other counts/life values, sparse seats, extra fields and mismatches.
2. Two-seat admission becomes full after P2; ready/start requires only P1/P2.
   Four-seat behavior remains four-required.
3. Two-player Core and every roster-bearing nested state contain exactly P1/P2;
   both life values are exact and P3/P4 never appear as player state.
4. Four-player Core remains P1-P4 at 40.
5. Two-player accepted snapshots totaling 40, 60 and 100 cards, including zero
   commanders, construct and replay to the same digest without legality checks.
6. Projection exposes configuration and exact roster while hiding credentials
   and private card definitions from other audiences.
7. Public create v5 is additive; v1/v3/v4 exact responses and rejection behavior
   remain unchanged. Runtime persistence/restart preserves configuration.
8. No O4P-08D React table/workbench selector or layout work appears.
