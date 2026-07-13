import {
  RESEARCH_DECK_IDS,
  type ResearchTask,
  type ResearchTaskReport,
  type ResearchDeckId,
  type UiResearchSession,
  type UxExperienceId,
} from './types';

const DISCOVERY_TASKS: ResearchTask[] = RESEARCH_DECK_IDS.map((deckId) => ({
  id: `discovery:${deckId}`,
  kind: 'free-play',
  deckId,
  phase: 'owner-discovery',
  title: `${deckId}を普段どおり回す`,
  instruction: '特定の場面を作ろうとせず、普段どおり自由にプレイしてください。操作方法は調べず、迷いもそのまま残します。',
  stopCondition: '8〜12ターン、45〜60分、または自然にやめたくなった時のいずれか早い時点。',
  moments: [],
}));

const COVERAGE_TASKS: readonly (readonly [
  ResearchDeckId,
  UxExperienceId,
  string,
  readonly (readonly [string, string])[],
])[] = [
  ['Celes', 'discard-draw', '手札を入れ替え、墓地の資源を使って盤面を作り直す', [
    ['discard', 'カードを捨てる'], ['draw', 'カードを引く'], ['reanimate', '墓地から蘇生する'], ['etb', 'ETBを処理する'],
  ]],
  ['Celes', 'counters', 'カウンターと誘発が重なるターンを進める', [
    ['counter', 'カウンターを置く'], ['attack-zero', '攻撃0体でも戦闘を進める'], ['attack-trigger', '攻撃誘発を処理する'],
  ]],
  ['Gogo', 'copy', '能力または呪文をコピーし、必要なら新しい対象を選ぶ', [
    ['activated', '起動型能力を使う'], ['tap-state', 'タップ／アンタップする'], ['copy', 'コピーする'], ['retarget', '対象を変更する'],
  ]],
  ['Gogo', 'stack-response', '複数の応答が重なるスタックを最後まで処理する', [
    ['counterspell', '呪文を打ち消す'], ['multi-stack', '複数段のスタックを処理する'], ['stack-target', 'スタック上の呪文を対象にする'], ['manual-target', '呪文またはパーマネントを手動対象にする'],
  ]],
  ['Kefka', 'transform', '手札を捨てる流れを進め、変身が起きる状態まで遊ぶ', [
    ['discard-chain', 'discard連鎖を処理する'], ['life-loss', 'ライフ損失を記録する'], ['transform', '変身する'], ['delayed-trigger', '遅延誘発を処理する'],
  ]],
  ['Kefka', 'exile-use', '追放されたカードを利用してターンを進める', [
    ['exile-use', '追放領域のカードを利用する'],
  ]],
  ['Muldrotha', 'graveyard', '墓地のカードを資源として盤面を立て直す', [
    ['mill', 'millする'], ['graveyard-use', '墓地からカードを使う'], ['landfall', 'landfallを処理する'], ['search', 'サーチする'],
  ]],
  ['Muldrotha', 'sacrifice', '生け贄にしたカードを再利用する流れを完了する', [
    ['sacrifice', '生け贄にする'], ['reuse', 'そのカードを再利用する'],
  ]],
];

export const RESEARCH_TASK_CATALOG: readonly ResearchTask[] = [
  ...DISCOVERY_TASKS,
  ...COVERAGE_TASKS.map(([deckId, experienceId, goal, moments]) => ({
    id: `coverage:${deckId}:${experienceId}`,
    kind: 'experience-probe' as const,
    deckId,
    phase: 'owner-coverage' as const,
    experienceId,
    title: `${deckId}のゲーム上の目的`,
    instruction: `${goal}。どのUIを使うか、どのカードを選ぶかは自分で判断してください。`,
    stopCondition: '目的を達成した時、到達できないと判断した時、または12ターン経過時。',
    moments: moments.map(([id, label]) => ({ id, label })),
  })),
];

export type ResearchLoopDecision =
  | { kind: 'task'; task: ResearchTask }
  | { kind: 'pending-report'; session: UiResearchSession; task: ResearchTask }
  | { kind: 'repair-gate'; report: ResearchTaskReport; task: ResearchTask; failureCount: number; reason: string }
  | { kind: 'prototype-gate'; reason: string };

function taskWasCompleted(task: ResearchTask, report: ResearchTaskReport): boolean {
  if (
    report.outcome !== 'completed' ||
    report.neededHelp ||
    report.severity === 'S0' ||
    report.severity === 'S1'
  ) return false;
  const observed = new Set(report.observedMomentIds ?? []);
  return task.moments.every((moment) => observed.has(moment.id));
}

function needsRepairGate(report: ResearchTaskReport): boolean {
  return !report.reviewedAt && (
    report.outcome === 'blocked' ||
    report.neededHelp ||
    report.severity === 'S0' ||
    report.severity === 'S1'
  );
}

export function selectNextResearchTask(input: {
  sessions: readonly UiResearchSession[];
  reports: readonly ResearchTaskReport[];
}): ResearchLoopDecision {
  const reportsBySession = new Set(input.reports.map((report) => report.sessionId));
  const pending = input.sessions
    .filter((session) => session.endedAt && session.taskId && !reportsBySession.has(session.sessionId))
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt))[0];
  if (pending?.taskId) {
    const task = RESEARCH_TASK_CATALOG.find((candidate) => candidate.id === pending.taskId);
    if (task) return { kind: 'pending-report', session: pending, task };
  }

  const repairReport = input.reports
    .filter(needsRepairGate)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))[0];
  if (repairReport) {
    const task = RESEARCH_TASK_CATALOG.find((candidate) => candidate.id === repairReport.taskId);
    if (task) {
      const failureCount = input.reports.filter((report) => (
        report.taskId === task.id &&
        (report.outcome !== 'completed' || report.neededHelp || report.severity === 'S0' || report.severity === 'S1')
      )).length;
      return {
        kind: 'repair-gate',
        report: repairReport,
        task,
        failureCount,
        reason: failureCount >= 3
          ? '同じ中心体験で3回失敗しています。再試験を重ねず、司令官が原因と修正範囲を決めてください。'
          : '中核操作の失敗または援助が記録されました。原因を修正するまで次のタスクへ進みません。',
      };
    }
  }

  const next = RESEARCH_TASK_CATALOG.find((task) => (
    !input.reports.some((report) => report.taskId === task.id && taskWasCompleted(task, report))
  ));
  if (next) return { kind: 'task', task: next };

  return {
    kind: 'prototype-gate',
    reason: 'Discoveryと中心体験Coverageが完了しました。証拠を統合し、比較する問題群を1つ選ぶまで自動進行を停止します。',
  };
}

export type ResearchRoutingModel = 'gpt-5.6-sol' | 'gpt-5.6-terra' | 'gpt-5.6-luna';

export function routeResearchReview(report: ResearchTaskReport): {
  model: ResearchRoutingModel;
  reason: string;
  roles: string[];
} {
  if (report.severity === 'S0' || report.severity === 'S1' || report.outcome === 'blocked') {
    return {
      model: 'gpt-5.6-sol',
      reason: '進行不能または中核操作の失敗は、司令官が証拠を統合して停止・修正判断を行う。',
      roles: ['反証Agent', 'repo監査Agent', 'Browser Skill'],
    };
  }
  if (report.severity === 'S2' || report.inconvenience.trim()) {
    return {
      model: 'gpt-5.6-terra',
      reason: '再現可能な摩擦の分類と試作brief作成は中位モデルへ委譲できる。',
      roles: ['UX分類Agent', 'visualize Skill'],
    };
  }
  return {
    model: 'gpt-5.6-luna',
    reason: '定型的な記録整理とcoverage集計は低コストモデルへ委譲できる。',
    roles: ['ログ整理Agent'],
  };
}
