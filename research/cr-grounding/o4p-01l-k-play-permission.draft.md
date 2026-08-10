# O4P-01L Wave 3-K — Play Permission V1 draft

Implemented the additive `playPermissionV1.ts` substrate for the K lane.

- Permission subjects are object-with-expected-zone, top-of-library, and face-down-exile.
- Operations are immutable and return `{ value }`; single-use consumption removes the requested ordered permission and never changes registry zones.
- Attempt checks are deliberately limited to allowed player, action, subject/current zone, top-library index, and face-down identity visibility. Timing, type, costs, land count, color identity, Commander tax, and play/cast legality remain deferred.
- No barrel, registry, ledger, review test, docs, dependency, Solo/Online, or git changes are included.

Status: implemented-not-audited.
