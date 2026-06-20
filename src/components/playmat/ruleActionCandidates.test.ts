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
      { kind: 'draw', label: 'ドロー', testId: 'candidate-draw' },
      { kind: 'mill', label: '切削', testId: 'candidate-mill' },
      { kind: 'token', label: 'トークン生成', testId: 'candidate-token' },
      { kind: 'proliferate', label: '増殖', testId: 'candidate-proliferate' },
      { kind: 'discard', label: 'ランダムに捨てる', testId: 'candidate-discard' },
      { kind: 'shuffle', label: 'シャッフル', testId: 'candidate-shuffle' },
    ]);
  });

  it('deduplicates the shared scry and surveil candidate', () => {
    expect(ruleActionCandidatesFromTags(tags('action.scry', 'action.surveil'))).toEqual([
      { kind: 'scry-surveil', label: '占術/諜報', testId: 'candidate-scry' },
    ]);
  });

  it('ignores tags without safe action candidates', () => {
    expect(ruleActionCandidatesFromTags(tags('trigger.etb', 'concept.target'))).toEqual([]);
  });
});
