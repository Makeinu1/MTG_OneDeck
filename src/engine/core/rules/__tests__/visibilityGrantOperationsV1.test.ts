import { describe, expect, it } from 'vitest';
import {
  closeCoreVisibilityGrantV1,
  coreVisibilityTopLibraryPrefixDigestV1,
  openCoreVisibilityGrantV1,
  pruneCoreVisibilityGrantsV1,
} from '../visibilityGrantOperationsV1';
import { validateCoreRuleDurationV1 } from '../ruleDurationV1';
import { createModeNeutralCoreVisibilitySliceV1 } from '../visibilityGrantV1';

const objectId = 'PC1:0' as never;
const base = createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} });

describe('Core visibility grant lifecycle', () => {
  it('accepts canonical duration kinds and rejects wire aliases in Core', () => {
    expect(validateCoreRuleDurationV1({ kind: 'until-next-command', openingSequence: 1 }).ok).toBe(true);
    expect(validateCoreRuleDurationV1({ kind: 'until-search-completes', searchSessionId: 'search-1' }).ok).toBe(true);
    expect(validateCoreRuleDurationV1({ kind: 'next-command', openingSequence: 1 }).ok).toBe(false);
    expect(validateCoreRuleDurationV1({ kind: 'choice-bound', searchSessionId: 'search-1' }).ok).toBe(false);
  });

  it('opens finite network durations and closes next-command grants atomically', () => {
    const opened = openCoreVisibilityGrantV1(base, 'g', {
      subject: { kind: 'object', objectId },
      audience: { kind: 'players', playerIds: ['P1' as never] },
      mode: 'look',
      duration: { kind: 'until-next-command', openingSequence: 1 },
      openingSequence: 1,
      sourceObjectId: null,
    });
    expect(opened.value.grantOrder).toEqual(['g']);
    expect(pruneCoreVisibilityGrantsV1(opened.value, { currentSequence: 1 }).closedGrantKeys).toEqual([]);
    expect(pruneCoreVisibilityGrantsV1(opened.value, { currentSequence: 2 }).closedGrantKeys).toEqual(['g']);
    expect(closeCoreVisibilityGrantV1(opened.value, 'g').value.grantOrder).toEqual([]);
  });

  it('keeps an end-of-turn grant through its opening turn and closes it after the turn advances', () => {
    const opened = openCoreVisibilityGrantV1(base, 'turn', {
      subject: { kind: 'object', objectId },
      audience: { kind: 'players', playerIds: ['P1' as never] },
      mode: 'look',
      duration: { kind: 'until-end-of-turn', turnNumber: 4 },
      sourceObjectId: null,
    });
    expect(pruneCoreVisibilityGrantsV1(opened.value, { currentTurnNumber: 4 }).closedGrantKeys).toEqual([]);
    expect(pruneCoreVisibilityGrantsV1(opened.value, { currentTurnNumber: 5 }).closedGrantKeys).toEqual(['turn']);
  });

  it('invalidates source and top-prefix snapshots without exposing digest material', () => {
    const digest = coreVisibilityTopLibraryPrefixDigestV1([objectId]);
    const opened = openCoreVisibilityGrantV1(base, 'top', {
      subject: { kind: 'top-of-library', playerId: 'P1' as never, count: 1 },
      audience: { kind: 'all-players' },
      mode: 'reveal',
      duration: { kind: 'while-source-exists', sourceObjectId: objectId },
      sourceObjectId: objectId,
      openingObjectIds: [objectId],
      topLibraryPrefixDigest: digest,
    });
    expect(opened.value.byGrant.top.topLibraryPrefixDigest).toBe(digest);
    expect(pruneCoreVisibilityGrantsV1(opened.value, { registry: { objects: {}, zones: { byPlayer: { P1: { library: [], hand: [], graveyard: [] } }, shared: { battlefield: [], stack: [], exile: [], command: [] } } } as never, activePlayerIds: ['P1' as never] }).closedGrantKeys).toEqual(['top']);
  });

  it('closes a top-library grant for an accepted reorder even when the prefix IDs are unchanged', () => {
    const opened = openCoreVisibilityGrantV1(base, 'same-prefix', {
      subject: { kind: 'top-of-library', playerId: 'P1' as never, count: 1 },
      audience: { kind: 'players', playerIds: ['P1' as never] },
      mode: 'look',
      duration: { kind: 'until-end-of-turn', turnNumber: 1 },
      sourceObjectId: null,
      openingObjectIds: [objectId],
      topLibraryPrefixDigest: coreVisibilityTopLibraryPrefixDigestV1([objectId]),
    });
    const registry = {
      objects: { [objectId]: {} },
      zones: { byPlayer: { P1: { library: [objectId], hand: [], graveyard: [] } }, shared: { battlefield: [], stack: [], exile: [], command: [] } },
    } as never;
    expect(pruneCoreVisibilityGrantsV1(opened.value, {
      registry,
      activePlayerIds: ['P1' as never],
      currentTurnNumber: 1,
      libraryOrderChangedPlayerIds: ['P1' as never],
    }).closedGrantKeys).toEqual(['same-prefix']);
  });
});
