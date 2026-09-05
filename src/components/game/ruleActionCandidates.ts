import type { RuleTag } from '../../data/ruleClassifier';

export type RuleActionCandidateKind =
  | 'draw'
  | 'mill'
  | 'scry'
  | 'surveil'
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
    label: '引く',
    testId: 'candidate-draw',
    requiresTarget: false,
    tagIds: ['action.draw'],
  },
  {
    kind: 'mill',
    label: '切削する',
    testId: 'candidate-mill',
    requiresTarget: false,
    tagIds: ['action.mill'],
  },
  {
    kind: 'scry',
    label: '占術を行う',
    testId: 'candidate-scry',
    requiresTarget: false,
    tagIds: ['action.scry'],
  },
  {
    kind: 'surveil',
    label: '諜報を行う',
    testId: 'candidate-surveil',
    requiresTarget: false,
    tagIds: ['action.surveil'],
  },
  {
    kind: 'token',
    label: 'トークンを生成する',
    testId: 'candidate-token',
    requiresTarget: false,
    tagIds: ['action.create-token'],
  },
  {
    kind: 'proliferate',
    label: 'カウンターを一括で増やす',
    testId: 'candidate-proliferate',
    requiresTarget: false,
    tagIds: ['action.proliferate'],
  },
  {
    kind: 'discard',
    label: '捨てるカードを選ぶ',
    testId: 'candidate-discard',
    requiresTarget: false,
    tagIds: ['action.discard'],
  },
  {
    kind: 'shuffle',
    label: '切り直す',
    testId: 'candidate-shuffle',
    requiresTarget: false,
    tagIds: ['action.shuffle'],
  },
  {
    kind: 'sacrifice-target',
    label: '生け贄に捧げる',
    testId: 'candidate-sacrifice-target',
    requiresTarget: true,
    tagIds: ['action.sacrifice'],
  },
  {
    kind: 'destroy-target',
    label: '破壊する',
    testId: 'candidate-destroy-target',
    requiresTarget: true,
    tagIds: ['action.destroy'],
  },
  {
    kind: 'exile-target',
    label: '追放する',
    testId: 'candidate-exile-target',
    requiresTarget: true,
    tagIds: ['action.exile'],
  },
  {
    kind: 'counters-target',
    label: '＋1/＋1カウンターを置く',
    testId: 'candidate-counters-target',
    requiresTarget: true,
    tagIds: ['action.card-counters'],
  },
  {
    kind: 'attach-target',
    label: 'つける（手動）',
    testId: 'candidate-attach-target',
    requiresTarget: true,
    tagIds: ['action.attach'],
  },
  {
    kind: 'search-library',
    label: 'ライブラリーを探す',
    testId: 'candidate-search-library',
    requiresTarget: false,
    tagIds: ['action.search'],
  },
  {
    kind: 'return-from-zone',
    label: '墓地を見る',
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
