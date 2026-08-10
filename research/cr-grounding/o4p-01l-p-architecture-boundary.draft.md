# O4P-01L-P Architecture Boundary draft

Status: implemented-not-audited; architecture asset was judge-integrated after
the bounded O/P recovery lanes stopped before edits.

The Compiler API gate walks the mode-neutral rules source tree, reports
violations in deterministic code-unit order, rejects product/runtime imports,
random/time calls, Solo aliases, dynamic imports, and reverse imports from
Object Registry or Turn Bundle into Rules. It also includes a synthetic AST
walk pin for forbidden calls. No runtime, store, React, DOM, Cloudflare,
WebSocket, IndexedDB, Scryfall client, or projection is introduced.
