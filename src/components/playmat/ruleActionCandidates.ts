import type { RuleTag } from '../../data/ruleClassifier';

export type RuleActionCandidateKind =
  | 'draw'
  | 'mill'
  | 'scry-surveil'
  | 'token'
  | 'proliferate'
  | 'discard'
  | 'shuffle';

export interface RuleActionCandidate {
  kind: RuleActionCandidateKind;
  label: string;
  testId: string;
}

interface RuleActionCandidateTemplate extends RuleActionCandidate {
  tagIds: readonly string[];
}

const RULE_ACTION_CANDIDATE_TEMPLATES: readonly RuleActionCandidateTemplate[] = [
  {
    kind: 'draw',
    label: 'ドロー',
    testId: 'candidate-draw',
    tagIds: ['action.draw'],
  },
  {
    kind: 'mill',
    label: '切削',
    testId: 'candidate-mill',
    tagIds: ['action.mill'],
  },
  {
    kind: 'scry-surveil',
    label: '占術/諜報',
    testId: 'candidate-scry',
    tagIds: ['action.scry', 'action.surveil'],
  },
  {
    kind: 'token',
    label: 'トークン生成',
    testId: 'candidate-token',
    tagIds: ['action.create-token'],
  },
  {
    kind: 'proliferate',
    label: '増殖',
    testId: 'candidate-proliferate',
    tagIds: ['action.proliferate'],
  },
  {
    kind: 'discard',
    label: 'ランダムに捨てる',
    testId: 'candidate-discard',
    tagIds: ['action.discard'],
  },
  {
    kind: 'shuffle',
    label: 'シャッフル',
    testId: 'candidate-shuffle',
    tagIds: ['action.shuffle'],
  },
];

export function ruleActionCandidatesFromTags(
  tags: readonly Pick<RuleTag, 'id'>[],
): RuleActionCandidate[] {
  const tagIds = new Set(tags.map((tag) => tag.id));

  return RULE_ACTION_CANDIDATE_TEMPLATES.flatMap((template) => {
    if (!template.tagIds.some((tagId) => tagIds.has(tagId))) {
      return [];
    }

    return [
      {
        kind: template.kind,
        label: template.label,
        testId: template.testId,
      },
    ];
  });
}
