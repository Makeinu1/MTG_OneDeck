import type { CoreCommandV1 } from './commandV1';
import { applyCoreCommandV1 } from './applyCommandV1';
import { appendCoreCommandJournalEntryV1, createCoreReplayPackageV1, type CoreCommandJournalEntryV1, type CoreReplayPackageV1 } from './journalV1';
import type { CoreDomainEventV1 } from './domainEventV1';
import type { ModeNeutralCoreRootV1 } from './rootV1';
import { coreCanonicalDigestFromValueV1 } from './canonicalV1';

export type CoreHeadlessClosureReportV1 = Readonly<{
  readonly kind: 'mode-neutral-core-four-player-headless-closure-v1';
  readonly playerIds: readonly string[];
  readonly initialStateDigest: string;
  readonly finalStateDigest: string;
  readonly finalRoot: ModeNeutralCoreRootV1;
  readonly journal: readonly CoreCommandJournalEntryV1[];
  readonly events: readonly CoreDomainEventV1[];
  readonly replayPackage: CoreReplayPackageV1;
  readonly deferred: readonly ['full-combat-damage', 'arbitrary-manual-state-mutation', 'network', 'room', 'projection', 'ui'];
}>;

export function runOrdinaryFourPlayerCoreClosureV1(initialRoot: ModeNeutralCoreRootV1, commands: readonly CoreCommandV1[] = []): CoreHeadlessClosureReportV1 {
  const active = initialRoot.playerLifecycle.players.filter((entry) => entry.status === 'active').map((entry) => entry.playerId);
  if (active.length !== 4) throw new Error('Ordinary Core closure requires exactly four active players');
  let root = initialRoot; let journal: readonly CoreCommandJournalEntryV1[] = Object.freeze([]); const events: CoreDomainEventV1[] = [];
  for (const command of commands) { const result = applyCoreCommandV1(root, command); journal = appendCoreCommandJournalEntryV1(journal, command, result); events.push(...result.events); if (result.status !== 'rejected') root = result.root; }
  const replayPackage = createCoreReplayPackageV1(initialRoot, journal);
  return Object.freeze({ kind: 'mode-neutral-core-four-player-headless-closure-v1', playerIds: Object.freeze(active.slice()), initialStateDigest: coreCanonicalDigestFromValueV1(initialRoot), finalStateDigest: coreCanonicalDigestFromValueV1(root), finalRoot: root, journal, events: Object.freeze(events), replayPackage, deferred: Object.freeze(['full-combat-damage', 'arbitrary-manual-state-mutation', 'network', 'room', 'projection', 'ui'] as const) });
}

export const executeOrdinaryFourPlayerCoreClosureV1 = runOrdinaryFourPlayerCoreClosureV1;
