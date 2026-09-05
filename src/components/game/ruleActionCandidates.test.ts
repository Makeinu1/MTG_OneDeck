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
      { kind: 'draw', label: '引く', testId: 'candidate-draw', requiresTarget: false },
      { kind: 'mill', label: '切削する', testId: 'candidate-mill', requiresTarget: false },
      {
        kind: 'token',
        label: 'トークンを生成する',
        testId: 'candidate-token',
        requiresTarget: false,
      },
      {
        kind: 'proliferate',
        label: 'カウンターを一括で増やす',
        testId: 'candidate-proliferate',
        requiresTarget: false,
      },
      {
        kind: 'discard',
        label: '捨てるカードを選ぶ',
        testId: 'candidate-discard',
        requiresTarget: false,
      },
      {
        kind: 'shuffle',
        label: '切り直す',
        testId: 'candidate-shuffle',
        requiresTarget: false,
      },
    ]);
  });

  it('keeps scry and surveil as distinct actions', () => {
    expect(ruleActionCandidatesFromTags(tags('action.scry', 'action.surveil'))).toEqual([
      {
        kind: 'scry',
        label: '占術を行う',
        testId: 'candidate-scry',
        requiresTarget: false,
      },
      { kind: 'surveil', label: '諜報を行う', testId: 'candidate-surveil', requiresTarget: false },
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
        label: '生け贄に捧げる',
        testId: 'candidate-sacrifice-target',
        requiresTarget: true,
      },
      {
        kind: 'destroy-target',
        label: '破壊する',
        testId: 'candidate-destroy-target',
        requiresTarget: true,
      },
      {
        kind: 'exile-target',
        label: '追放する',
        testId: 'candidate-exile-target',
        requiresTarget: true,
      },
      {
        kind: 'counters-target',
        label: '＋1/＋1カウンターを置く',
        testId: 'candidate-counters-target',
        requiresTarget: true,
      },
      {
        kind: 'attach-target',
        label: 'つける（手動）',
        testId: 'candidate-attach-target',
        requiresTarget: true,
      },
      {
        kind: 'search-library',
        label: 'ライブラリーを探す',
        testId: 'candidate-search-library',
        requiresTarget: false,
      },
      {
        kind: 'return-from-zone',
        label: '墓地を見る',
        testId: 'candidate-return-from-zone',
        requiresTarget: false,
      },
    ]);
  });

  it('ignores tags without safe action candidates', () => {
    expect(ruleActionCandidatesFromTags(tags('trigger.etb', 'concept.target'))).toEqual([]);
  });
});
