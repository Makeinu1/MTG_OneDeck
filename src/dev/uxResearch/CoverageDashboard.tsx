import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  listCoverageEntries,
  listResearchSessions,
  listResearchTaskReports,
  saveCoverageEntry,
  saveResearchTaskReport,
} from './storage';
import { routeResearchReview, selectNextResearchTask } from './researchTasks';
import {
  CAPTURE_CRITERION_LABELS,
  COVERAGE_STATUSES,
  COVERAGE_STATUS_LABELS,
  RESEARCH_DECK_IDS,
  RESEARCH_PHASE_LABELS,
  UX_EXPERIENCES,
  type CoverageStatus,
  type ResearchDeckId,
  type ResearchSeverity,
  type ResearchTaskOutcome,
  type ResearchTaskReport,
  type UiResearchSession,
  type UxCoverageEntry,
  type UxExperienceId,
} from './types';
import './coverageDashboard.css';

interface SelectedCoverage {
  deckId: ResearchDeckId;
  experienceId: UxExperienceId;
}

function formString(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

function coverageKey(deckId: ResearchDeckId, experienceId: UxExperienceId): string {
  return `${deckId}:${experienceId}`;
}

export function CoverageDashboard() {
  const [sessions, setSessions] = useState<UiResearchSession[]>([]);
  const [coverage, setCoverage] = useState<UxCoverageEntry[]>([]);
  const [selected, setSelected] = useState<SelectedCoverage | null>(null);
  const [reports, setReports] = useState<ResearchTaskReport[]>([]);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    void Promise.all([
      listResearchSessions(),
      listCoverageEntries(),
      listResearchTaskReports(),
    ]).then(
      ([loadedSessions, loadedCoverage, loadedReports]) => {
        setSessions(loadedSessions);
        setCoverage(loadedCoverage);
        setReports(loadedReports);
      },
    );
  }, []);

  const coverageByKey = useMemo(
    () => new Map(coverage.map((entry) => [entry.key, entry])),
    [coverage],
  );

  const selectedEntry = selected
    ? coverageByKey.get(coverageKey(selected.deckId, selected.experienceId))
    : undefined;
  const loopDecision = useMemo(
    () => selectNextResearchTask({ sessions, reports }),
    [reports, sessions],
  );

  async function submitPendingReport(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (loopDecision.kind !== 'pending-report') return;
    const data = new FormData(event.currentTarget);
    const score = Number(formString(data, 'anotherTurnScore'));
    if (!Number.isInteger(score) || score < 1 || score > 7) return;
    const outcome = formString(data, 'outcome') as ResearchTaskOutcome;
    const observedMomentIds = data.getAll('observedMomentId')
      .filter((value): value is string => typeof value === 'string');
    const missingMoments = loopDecision.task.moments.filter(
      (moment) => !observedMomentIds.includes(moment.id),
    );
    if (outcome === 'completed' && missingMoments.length > 0) {
      setReportError(`未観察の中心体験があります：${missingMoments.map((moment) => moment.label).join('、')}`);
      return;
    }
    const report: ResearchTaskReport = {
      reportId: crypto.randomUUID(),
      taskId: loopDecision.task.id,
      sessionId: loopDecision.session.sessionId,
      submittedAt: new Date().toISOString(),
      outcome,
      severity: formString(data, 'severity') as ResearchSeverity,
      neededHelp: data.get('neededHelp') === 'on',
      anotherTurnScore: score as ResearchTaskReport['anotherTurnScore'],
      observation: formString(data, 'observation').trim(),
      userStatement: formString(data, 'userStatement').trim(),
      inconvenience: formString(data, 'inconvenience').trim(),
      delight: formString(data, 'delight').trim(),
      observedMomentIds,
    };
    await saveResearchTaskReport(report);
    setReports((current) => [report, ...current]);
    setReportError('');
  }

  async function acknowledgeRepair(): Promise<void> {
    if (loopDecision.kind !== 'repair-gate') return;
    const updated = { ...loopDecision.report, reviewedAt: new Date().toISOString() };
    await saveResearchTaskReport(updated);
    setReports((current) => current.map((report) => (
      report.reportId === updated.reportId ? updated : report
    )));
  }

  async function updateCoverage(
    deckId: ResearchDeckId,
    experienceId: UxExperienceId,
    status: CoverageStatus,
    note = coverageByKey.get(coverageKey(deckId, experienceId))?.note ?? '',
  ): Promise<void> {
    const entry: UxCoverageEntry = {
      key: coverageKey(deckId, experienceId),
      deckId,
      experienceId,
      status,
      note,
      updatedAt: new Date().toISOString(),
    };
    await saveCoverageEntry(entry);
    setCoverage((current) => [...current.filter((item) => item.key !== entry.key), entry]);
  }

  const completedSessions = sessions.filter((session) => session.endedAt).length;
  const capturedMoments = sessions.flatMap((session) =>
    session.checkpoints
      .filter((checkpoint) => checkpoint.captureCriterion)
      .map((checkpoint) => ({ session, checkpoint })),
  );

  return (
    <main className="ux-dashboard" data-testid="ux-research-dashboard">
      <header className="ux-dashboard__header">
        <div>
          <h1>4デッキ UX Coverage</h1>
          <p>実プレイで観察した事実だけを更新する。</p>
        </div>
        <a className="ux-dashboard__action" href="/?ux-research=1">調査画面へ</a>
      </header>

      <section className="ux-dashboard__summary" aria-label="調査記録の概要">
        <p><strong>{sessions.length}</strong><span>セッション</span></p>
        <p><strong>{completedSessions}</strong><span>完了</span></p>
        <p><strong>{capturedMoments.length}</strong><span>fixture候補</span></p>
      </section>

      <section className="ux-dashboard__next" aria-labelledby="next-task-heading">
        <h2 id="next-task-heading">人間への次の指示</h2>
        {loopDecision.kind === 'task' && (() => {
          const params = new URLSearchParams({
            'ux-research': '1',
            task: loopDecision.task.id,
            deck: loopDecision.task.deckId,
            phase: loopDecision.task.phase,
          });
          return (
            <div className="ux-dashboard__task-card">
              <p className="ux-dashboard__eyebrow">{loopDecision.task.deckId} · {RESEARCH_PHASE_LABELS[loopDecision.task.phase]}</p>
              <h3>{loopDecision.task.title}</h3>
              <p>{loopDecision.task.instruction}</p>
              {loopDecision.task.moments.length > 0 && (
                <div className="ux-dashboard__moments">
                  <strong>この回で観察する中心体験</strong>
                  <ul>{loopDecision.task.moments.map((moment) => <li key={moment.id}>{moment.label}</li>)}</ul>
                </div>
              )}
              <p><strong>終了条件：</strong>{loopDecision.task.stopCondition}</p>
              <a className="ux-dashboard__action" href={`/?${params.toString()}`}>
                指定されたプレイURLを開く
              </a>
              <p className="ux-dashboard__muted">終了後、この画面へ戻るとレポート入力が最優先で表示されます。</p>
            </div>
          );
        })()}
        {loopDecision.kind === 'pending-report' && (
          <form className="ux-dashboard__report" onSubmit={(event) => void submitPendingReport(event)}>
            <p><strong>{loopDecision.task.title}</strong>のプレイは終了しました。次へ進む前に、人間の経験を報告してください。</p>
            <div className="ux-dashboard__report-grid">
              <label>結果<select name="outcome" defaultValue="completed"><option value="completed">完了</option><option value="blocked">詰まった</option><option value="not-observed">場面が起きなかった</option></select></label>
              <label>深刻度<select name="severity" defaultValue="none"><option value="none">なし</option><option value="S0">S0</option><option value="S1">S1</option><option value="S2">S2</option><option value="S3">S3</option></select></label>
              <label>もう1ターン回したい（1〜7）<input name="anotherTurnScore" type="number" min="1" max="7" defaultValue="4" required /></label>
              <label className="ux-dashboard__check"><input name="neededHelp" type="checkbox" />援助が必要だった</label>
            </div>
            {loopDecision.task.moments.length > 0 && (
              <fieldset className="ux-dashboard__moment-checks">
                <legend>実際に起きた中心体験</legend>
                {loopDecision.task.moments.map((moment) => (
                  <label key={moment.id} className="ux-dashboard__check">
                    <input name="observedMomentId" type="checkbox" value={moment.id} />
                    {moment.label}
                  </label>
                ))}
              </fieldset>
            )}
            <label>実際に起きたこと<textarea name="observation" rows={3} required /></label>
            <label>その時に口にしたこと<textarea name="userStatement" rows={2} /></label>
            <label>不便だったこと<textarea name="inconvenience" rows={2} /></label>
            <label>気持ちよかったこと<textarea name="delight" rows={2} /></label>
            {reportError && <p className="ux-dashboard__error" role="alert">{reportError}</p>}
            <button className="ux-dashboard__action" type="submit">レポートを保存して次へ</button>
          </form>
        )}
        {loopDecision.kind === 'repair-gate' && (
          <div className="ux-dashboard__gate">
            <strong>自動ループ停止：修正が必要です</strong>
            <p>{loopDecision.reason}</p>
            <p><strong>{loopDecision.task.title}</strong> · 失敗 {loopDecision.failureCount}回</p>
            <p>報告：{loopDecision.report.observation}</p>
            {loopDecision.report.inconvenience && <p>不便：{loopDecision.report.inconvenience}</p>}
            <button className="ux-dashboard__action" type="button" onClick={() => void acknowledgeRepair()}>
              修正済みとして同じタスクを再試験
            </button>
          </div>
        )}
        {loopDecision.kind === 'prototype-gate' && (
          <div className="ux-dashboard__gate">
            <strong>自動ループ停止：人間と司令官の判断が必要です</strong>
            <p>{loopDecision.reason}</p>
          </div>
        )}
      </section>

      <section className="ux-dashboard__routing" aria-labelledby="routing-heading">
        <h2 id="routing-heading">AI委譲キュー</h2>
        <p>司令官はGPT-5.6 Sol。判断を伴わない整理だけをTerra/Lunaへ送る設計です。</p>
        {reports.length === 0 ? <p>人間のレポート待ちです。</p> : (
          <ul>
            {reports.slice(0, 5).map((report) => {
              const route = routeResearchReview(report);
              return <li key={report.reportId}><strong>{route.model}</strong><span>{route.reason}</span><small>{route.roles.join(' · ')}</small></li>;
            })}
          </ul>
        )}
        <p className="ux-dashboard__muted">現在のCodex子Agent APIにはモデル指定がないため、この表は実行可能な面でのみ適用し、未対応面では役割分割だけを行います。</p>
      </section>

      <section className="ux-dashboard__matrix" aria-labelledby="coverage-heading">
        <h2 id="coverage-heading">体験coverage</h2>
        <div className="ux-dashboard__table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">体験</th>
                {RESEARCH_DECK_IDS.map((deckId) => <th key={deckId} scope="col">{deckId}</th>)}
              </tr>
            </thead>
            <tbody>
              {UX_EXPERIENCES.map(([experienceId, label]) => (
                <tr key={experienceId}>
                  <th scope="row">{label}</th>
                  {RESEARCH_DECK_IDS.map((deckId) => {
                    const entry = coverageByKey.get(coverageKey(deckId, experienceId));
                    return (
                      <td key={deckId}>
                        <select
                          aria-label={`${deckId} ${label}`}
                          value={entry?.status ?? 'unobserved'}
                          data-status={entry?.status ?? 'unobserved'}
                          onFocus={() => setSelected({ deckId, experienceId })}
                          onChange={(event) => {
                            setSelected({ deckId, experienceId });
                            void updateCoverage(deckId, experienceId, event.target.value as CoverageStatus);
                          }}
                        >
                          {COVERAGE_STATUSES.map((status) => (
                            <option key={status} value={status}>{COVERAGE_STATUS_LABELS[status]}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="ux-dashboard__selected" aria-label="選択したcoverageのメモ">
          <strong>{selected.deckId} · {UX_EXPERIENCES.find(([id]) => id === selected.experienceId)?.[1]}</strong>
          <label>
            観察メモ
            <textarea
              key={selectedEntry?.key ?? coverageKey(selected.deckId, selected.experienceId)}
              rows={3}
              defaultValue={selectedEntry?.note ?? ''}
              onBlur={(event) => {
                void updateCoverage(
                  selected.deckId,
                  selected.experienceId,
                  selectedEntry?.status ?? 'unobserved',
                  event.target.value,
                );
              }}
            />
          </label>
        </section>
      )}

      <section className="ux-dashboard__sessions" aria-labelledby="captured-heading">
        <h2 id="captured-heading">Captured Moment Registry</h2>
        {capturedMoments.length === 0 ? (
          <p>昇格候補はまだありません。</p>
        ) : (
          <ul>
            {capturedMoments.map(({ session, checkpoint }) => (
              <li key={`${session.sessionId}:${checkpoint.id}`}>
                <span>
                  <strong>{session.deckId}</strong> · {checkpoint.note ?? checkpoint.reason} ·{' '}
                  {checkpoint.captureCriterion
                    ? CAPTURE_CRITERION_LABELS[checkpoint.captureCriterion]
                    : null}
                </span>
                <a href={`/research/design/visual-fixtures/?session=${encodeURIComponent(session.sessionId)}&checkpoint=${encodeURIComponent(checkpoint.id)}&ui=new`}>
                  同じ盤面を開く
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ux-dashboard__sessions" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">記録済みセッション</h2>
        {sessions.length === 0 ? (
          <p>まだ記録がありません。</p>
        ) : (
          <ul>
            {sessions.map((session) => {
              const checkpoint = session.checkpoints.at(-1);
              return (
                <li key={session.sessionId}>
                  <span>
                    <strong>{session.deckId}</strong> · {RESEARCH_PHASE_LABELS[session.phase]} · {session.checkpoints.length} checkpoint
                  </span>
                  {checkpoint && (
                    <a href={`/research/design/visual-fixtures/?session=${encodeURIComponent(session.sessionId)}&checkpoint=${encodeURIComponent(checkpoint.id)}&ui=new`}>
                      最終盤面
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
