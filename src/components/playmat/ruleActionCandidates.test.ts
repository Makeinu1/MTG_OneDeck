import { describe, expect, it } from 'vitest';
import { ruleActionCandidatesFromTags } from './ruleActionCandidates';

function tags(...ids: string[]): Array<{ id: string }> {
  return ids.map((id) => ({ id }));
}

describe('ruleActionCandidatesFromTags', () => {
  it('maps supported action tags to candidate labels and test ids in stable order', () => {
    expect(
      ruleActionCandidatesFromTags(
        tags(
          'action.shuffle',
          'action.create-token',
          'action.draw',
          'action.proliferate',
          'action.mill',
          'action.discard',
        ),
      ),
    ).toEqual([
      { kind: 'draw', label: 'ドロー', testId: 'candidate-draw', requiresTarget: false },
      { kind: 'mill', label: '切削', testId: 'candidate-mill', requiresTarget: false },
      {
        kind: 'token',
        label: 'トークン生成',
        testId: 'candidate-token',
        requiresTarget: false,
      },
      {
        kind: 'proliferate',
        label: '増殖',
        testId: 'candidate-proliferate',
        requiresTarget: false,
      },
      {
        kind: 'discard',
        label: 'ランダムに捨てる',
        testId: 'candidate-discard',
        requiresTarget: false,
      },
      {
        kind: 'shuffle',
        label: 'シャッフル',
        testId: 'candidate-shuffle',
        requiresTarget: false,
      },
    ]);
  });

  it('deduplicates the shared scry and surveil candidate', () => {
    expect(ruleActionCandidatesFromTags(tags('action.scry', 'action.surveil'))).toEqual([
      {
        kind: 'scry-surveil',
        label: '占術/諜報',
        testId: 'candidate-scry',
        requiresTarget: false,
      },
    ]);
  });

  it('maps target-requiring action tags to candidates', () => {
    expect(
      ruleActionCandidatesFromTags(
        tags(
          'action.sacrifice',
          'action.destroy',
          'action.exile',
          'action.card-counters',
          'action.attach',
          'action.search',
          'action.return',
        ),
      ),
    ).toEqual([
      {
        kind: 'sacrifice-target',
        label: '対象の生け贄',
        testId: 'candidate-sacrifice-target',
        requiresTarget: true,
      },
      {
        kind: 'destroy-target',
        label: '対象を破壊',
        testId: 'candidate-destroy-target',
        requiresTarget: true,
      },
      {
        kind: 'exile-target',
        label: '対象を追放',
        testId: 'candidate-exile-target',
        requiresTarget: true,
      },
      {
        kind: 'counters-target',
        label: '対象にカウンター',
        testId: 'candidate-counters-target',
        requiresTarget: true,
      },
      {
        kind: 'attach-target',
        label: '装備/付与',
        testId: 'candidate-attach-target',
        requiresTarget: true,
      },
      {
        kind: 'search-library',
        label: 'ライブラリを探す',
        testId: 'candidate-search-library',
        requiresTarget: false,
      },
      {
        kind: 'return-from-zone',
        label: '墓地/追放から戻す',
        testId: 'candidate-return-from-zone',
        requiresTarget: false,
      },
    ]);
  });

  it('ignores tags without safe action candidates', () => {
    expect(ruleActionCandidatesFromTags(tags('trigger.etb', 'concept.target'))).toEqual([]);
  });
});
