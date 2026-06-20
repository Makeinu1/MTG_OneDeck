import type { RuleTag } from '../../data/ruleClassifier';

export type RuleActionCandidateKind =
  | 'draw'
  | 'mill'
  | 'scry-surveil'
  | 'token'
  | 'proliferate'
  | 'discard'
  | 'shuffle'
  | 'sacrifice-target'
  | 'destroy-target'
  | 'exile-target'
  | 'counters-target'
  | 'attach-target'
  | 'search-library'
  | 'return-from-zone';

export interface RuleActionCandidate {
  kind: RuleActionCandidateKind;
  label: string;
  testId: string;
  requiresTarget: boolean;
}

interface RuleActionCandidateTemplate extends RuleActionCandidate {
  tagIds: readonly string[];
}

const RULE_ACTION_CANDIDATE_TEMPLATES: readonly RuleActionCandidateTemplate[] = [
  {
    kind: 'draw',
    label: 'ドロー',
    testId: 'candidate-draw',
    requiresTarget: false,
    tagIds: ['action.draw'],
  },
  {
    kind: 'mill',
    label: '切削',
    testId: 'candidate-mill',
    requiresTarget: false,
    tagIds: ['action.mill'],
  },
  {
    kind: 'scry-surveil',
    label: '占術/諜報',
    testId: 'candidate-scry',
    requiresTarget: false,
    tagIds: ['action.scry', 'action.surveil'],
  },
  {
    kind: 'token',
    label: 'トークン生成',
    testId: 'candidate-token',
    requiresTarget: false,
    tagIds: ['action.create-token'],
  },
  {
    kind: 'proliferate',
    label: '増殖',
    testId: 'candidate-proliferate',
    requiresTarget: false,
    tagIds: ['action.proliferate'],
  },
  {
    kind: 'discard',
    label: 'ランダムに捨てる',
    testId: 'candidate-discard',
    requiresTarget: false,
    tagIds: ['action.discard'],
  },
  {
    kind: 'shuffle',
    label: 'シャッフル',
    testId: 'candidate-shuffle',
    requiresTarget: false,
    tagIds: ['action.shuffle'],
  },
  {
    kind: 'sacrifice-target',
    label: '対象の生け贄',
    testId: 'candidate-sacrifice-target',
    requiresTarget: true,
    tagIds: ['action.sacrifice'],
  },
  {
    kind: 'destroy-target',
    label: '対象を破壊',
    testId: 'candidate-destroy-target',
    requiresTarget: true,
    tagIds: ['action.destroy'],
  },
  {
    kind: 'exile-target',
    label: '対象を追放',
    testId: 'candidate-exile-target',
    requiresTarget: true,
    tagIds: ['action.exile'],
  },
  {
    kind: 'counters-target',
    label: '対象にカウンター',
    testId: 'candidate-counters-target',
    requiresTarget: true,
    tagIds: ['action.card-counters'],
  },
  {
    kind: 'attach-target',
    label: '装備/付与',
    testId: 'candidate-attach-target',
    requiresTarget: true,
    tagIds: ['action.attach'],
  },
  {
    kind: 'search-library',
    label: 'ライブラリを探す',
    testId: 'candidate-search-library',
    requiresTarget: false,
    tagIds: ['action.search'],
  },
  {
    kind: 'return-from-zone',
    label: '墓地/追放から戻す',
    testId: 'candidate-return-from-zone',
    requiresTarget: false,
    tagIds: ['action.return'],
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
        requiresTarget: template.requiresTarget,
      },
    ];
  });
}
