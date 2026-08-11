import type { CoreDomainEventV1 } from './domainEventV1';
import { applyCoreCommandV1 } from './applyCommandV1';
import type { CoreReplayPackageV1, CoreCommandJournalEntryV1 } from './journalV1';
import { createCoreReplayPackageV1, validateCoreReplayPackageV1 } from './journalV1';
import { coreCanonicalDigestFromValueV1 } from './canonicalV1';
import type { ModeNeutralCoreRootV1 } from './rootV1';

export type CoreReplayDivergenceV1 = Readonly<{ readonly code: 'INVALID_PACKAGE' | 'COMMAND_DIGEST_MISMATCH' | 'STATUS_MISMATCH' | 'BEFORE_DIGEST_MISMATCH' | 'AFTER_DIGEST_MISMATCH' | 'EVENT_DIGEST_MISMATCH' | 'FINAL_STATE_DIGEST_MISMATCH' | 'FINAL_EVENT_DIGEST_MISMATCH'; readonly journalIndex: number; readonly expected: string; readonly actual: string }>;
export type CoreReplayResultV1 =
  | Readonly<{ readonly ok: true; readonly finalRoot: ModeNeutralCoreRootV1; readonly events: readonly CoreDomainEventV1[]; readonly finalStateDigest: string; readonly eventTranscriptDigest: string }>
  | Readonly<{ readonly ok: false; readonly divergence: CoreReplayDivergenceV1 }>;

function transcriptDigest(events: readonly CoreDomainEventV1[]): string { return coreCanonicalDigestFromValueV1(events); }
function divergence(code: CoreReplayDivergenceV1['code'], journalIndex: number, expected: string, actual: string): CoreReplayResultV1 { return Object.freeze({ ok: false, divergence: Object.freeze({ code, journalIndex, expected, actual }) }); }

export function replayCoreCommandsV1(packageInput: CoreReplayPackageV1): CoreReplayResultV1 {
  const checked = validateCoreReplayPackageV1(packageInput);
  if (!checked.ok) return divergence('INVALID_PACKAGE', -1, 'valid replay package', 'invalid replay package');
  let root = checked.value.initialRoot;
  const events: CoreDomainEventV1[] = [];
  for (const [index, entry] of checked.value.journal.entries()) {
    const commandDigest = coreCanonicalDigestFromValueV1(entry.command);
    if (commandDigest !== entry.commandDigest) return divergence('COMMAND_DIGEST_MISMATCH', index, entry.commandDigest, commandDigest);
    const before = coreCanonicalDigestFromValueV1(root);
    if (before !== entry.beforeStateDigest) return divergence('BEFORE_DIGEST_MISMATCH', index, entry.beforeStateDigest, before);
    const result = applyCoreCommandV1(root, entry.command);
    if (result.status !== entry.status) return divergence('STATUS_MISMATCH', index, entry.status, result.status);
    const actualEventDigest = coreCanonicalDigestFromValueV1(result.events);
    if (actualEventDigest !== entry.eventDigest) return divergence('EVENT_DIGEST_MISMATCH', index, entry.eventDigest, actualEventDigest);
    if (result.afterStateDigest !== entry.afterStateDigest) return divergence('AFTER_DIGEST_MISMATCH', index, entry.afterStateDigest, result.afterStateDigest);
    root = result.root; events.push(...result.events);
  }
  const finalStateDigest = coreCanonicalDigestFromValueV1(root); const eventTranscriptDigest = transcriptDigest(events);
  if (finalStateDigest !== checked.value.expectedFinalStateDigest) return divergence('FINAL_STATE_DIGEST_MISMATCH', checked.value.journal.length, checked.value.expectedFinalStateDigest, finalStateDigest);
  if (eventTranscriptDigest !== checked.value.expectedEventTranscriptDigest) return divergence('FINAL_EVENT_DIGEST_MISMATCH', checked.value.journal.length, checked.value.expectedEventTranscriptDigest, eventTranscriptDigest);
  return Object.freeze({ ok: true, finalRoot: root, events: Object.freeze(events), finalStateDigest, eventTranscriptDigest });
}

export function replayCoreCommandsFromRootV1(initialRoot: ModeNeutralCoreRootV1, journal: readonly CoreCommandJournalEntryV1[]): CoreReplayResultV1 {
  try { return replayCoreCommandsV1(createCoreReplayPackageV1(initialRoot, journal)); } catch { return divergence('INVALID_PACKAGE', -1, 'valid replay package', 'invalid replay package'); }
}
