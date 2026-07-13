import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameController } from '../../components/game/gameController';
import {
  createResearchCheckpoint,
  createResearchSession,
  createResearchTransient,
  inferResearchDeckId,
  researchInteractionFromEvent,
} from './researchModel';
import {
  appendResearchInteraction,
  loadResearchSession,
  saveResearchSession,
} from './storage';
import {
  CAPTURE_CRITERIA,
  CAPTURE_CRITERION_LABELS,
  RESEARCH_DECK_IDS,
  RESEARCH_PHASE_LABELS,
  RESEARCH_PHASES,
  type CaptureCriterion,
  type ResearchCheckpointReason,
  type ResearchDeckId,
  type ResearchEvidence,
  type ResearchPhase,
  type UiResearchSession,
} from './types';
import './researchRecorder.css';

const ACTIVE_SESSION_KEY = 'mtg-onedeck:ux-research-active-session';

function assignedTaskFromUrl(): {
  taskId?: string;
  deckId?: ResearchDeckId;
  phase?: ResearchPhase;
} {
  const params = new URLSearchParams(window.location.search);
  const deck = params.get('deck');
  const taskPhase = params.get('phase');
  return {
    ...(params.get('task') ? { taskId: params.get('task') ?? undefined } : {}),
    ...(RESEARCH_DECK_IDS.some((value) => value === deck)
      ? { deckId: deck as ResearchDeckId }
      : {}),
    ...(RESEARCH_PHASES.some((value) => value === taskPhase)
      ? { phase: taskPhase as ResearchPhase }
      : {}),
  };
}

function nowElapsed(session: UiResearchSession): number {
  return Math.max(0, Date.now() - Date.parse(session.startedAt));
}

function downloadSession(session: UiResearchSession): void {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${session.deckId}-${session.phase}-${session.sessionId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ResearchRecorder({ controller }: { controller: GameController }) {
  const { state, store } = controller;
  const [assignedTask] = useState(assignedTaskFromUrl);
  const participantDiscovery = Boolean(assignedTask.taskId && assignedTask.phase === 'owner-discovery');
  const [deckId, setDeckId] = useState<ResearchDeckId>(() =>
    assignedTask.deckId ?? (state ? inferResearchDeckId(state) : 'Celes'),
  );
  const [phase, setPhase] = useState<ResearchPhase>(assignedTask.phase ?? 'owner-discovery');
  const [note, setNote] = useState('');
  const [captureCriterion, setCaptureCriterion] = useState<CaptureCriterion | ''>('');
  const [evidence, setEvidence] = useState<ResearchEvidence>({});
  const [session, setSession] = useState<UiResearchSession | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [restoring, setRestoring] = useState(
    () => sessionStorage.getItem(ACTIVE_SESSION_KEY) !== null,
  );
  const sessionRef = useRef<UiResearchSession | null>(null);
  const writeQueueRef = useRef(Promise.resolve());
  const lastPointerSampleRef = useRef<{ elapsedMs: number; x: number; y: number } | null>(null);
  const lastHoverTestIdRef = useRef<string | undefined>(undefined);
  const pendingCheckpointReasonRef = useRef<ResearchCheckpointReason | null>(null);
  const previousSignalsRef = useRef({
    stackLength: state?.zones.stack.length ?? 0,
    warningSignature: JSON.stringify(store.warnings),
    guidedOpen: store.pendingGuided !== null,
  });

  const persist = useCallback((next: UiResearchSession): void => {
    sessionRef.current = next;
    setSession(next);
    writeQueueRef.current = writeQueueRef.current
      .then(() => saveResearchSession(next))
      .catch((error: unknown) => {
        console.error('UX調査セッションの保存に失敗しました。', error);
      });
  }, []);

  const transientState = useCallback(() => {
    return createResearchTransient({
      mulliganDecisionPending: store.mulliganDecisionPending,
      warnings: store.warnings,
      pendingGuided: store.pendingGuided,
      feedOpen: controller.feedOpen,
      shortcutsBlocked: controller.shortcutsBlocked,
    });
  }, [
    controller.feedOpen,
    controller.shortcutsBlocked,
    store.mulliganDecisionPending,
    store.pendingGuided,
    store.warnings,
  ]);

  const addCheckpoint = useCallback((
    reason: ResearchCheckpointReason,
    checkpointNote?: string,
    criterion?: CaptureCriterion,
    checkpointEvidence?: ResearchEvidence,
  ): void => {
    const current = sessionRef.current;
    if (!current || !state) return;
    const checkpoint = createResearchCheckpoint({
      elapsedMs: nowElapsed(current),
      reason,
      state,
      autoAdvanceToMain: store.autoAdvanceToMain,
      transient: transientState(),
      note: checkpointNote,
      captureCriterion: criterion,
      evidence: checkpointEvidence,
    });
    persist({ ...current, checkpoints: [...current.checkpoints, checkpoint] });
  }, [persist, state, store.autoAdvanceToMain, transientState]);

  useEffect(() => {
    const activeSessionId = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (!activeSessionId) return;
    let cancelled = false;
    void loadResearchSession(activeSessionId).then((loaded) => {
      if (cancelled) return;
      if (loaded && !loaded.endedAt) {
        sessionRef.current = loaded;
        setSession(loaded);
        setDeckId(loaded.deckId);
        setPhase(loaded.phase);
        setCollapsed(true);
      } else {
        sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      }
      setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const eventTypes = [
      'pointermove',
      'pointerover',
      'pointerout',
      'pointerdown',
      'click',
      'dblclick',
      'contextmenu',
      'keydown',
    ] as const;
    const record = (event: Event): void => {
      const current = sessionRef.current;
      if (!current) return;
      const interaction = researchInteractionFromEvent({
        event,
        elapsedMs: nowElapsed(current),
        state,
      });
      if (!interaction) return;
      if (interaction.kind === 'pointermove') {
        const previous = lastPointerSampleRef.current;
        const x = interaction.x ?? 0;
        const y = interaction.y ?? 0;
        if (
          previous &&
          interaction.elapsedMs - previous.elapsedMs < 100 &&
          Math.hypot(x - previous.x, y - previous.y) < 24
        ) {
          return;
        }
        lastPointerSampleRef.current = { elapsedMs: interaction.elapsedMs, x, y };
      }
      if (interaction.kind === 'pointerover') {
        if (interaction.testId === lastHoverTestIdRef.current) return;
        lastHoverTestIdRef.current = interaction.testId;
      }
      if (interaction.kind === 'pointerout') {
        if (interaction.relatedTestId === interaction.testId) return;
        lastHoverTestIdRef.current = interaction.relatedTestId;
      }
      if (interaction.testId === 'undo') pendingCheckpointReasonRef.current = 'undo';
      const next = { ...current, interactions: [...current.interactions, interaction] };
      sessionRef.current = next;
      setSession(next);
      void appendResearchInteraction(current.sessionId, interaction).catch((error: unknown) => {
        console.error('UX調査interactionの保存に失敗しました。', error);
      });
    };
    eventTypes.forEach((eventType) => document.addEventListener(eventType, record, true));
    return () => {
      eventTypes.forEach((eventType) => document.removeEventListener(eventType, record, true));
    };
  }, [state]);

  useEffect(() => {
    const currentSignals = {
      stackLength: state?.zones.stack.length ?? 0,
      warningSignature: JSON.stringify(store.warnings),
      guidedOpen: store.pendingGuided !== null,
    };
    const previous = previousSignalsRef.current;
    previousSignalsRef.current = currentSignals;
    if (!sessionRef.current || !state) return;

    const pendingReason = pendingCheckpointReasonRef.current;
    pendingCheckpointReasonRef.current = null;
    if (pendingReason) {
      addCheckpoint(pendingReason);
    }
    if (previous.stackLength === 0 && currentSignals.stackLength > 0) {
      addCheckpoint('stack-opened');
    }
    if (!previous.guidedOpen && currentSignals.guidedOpen) {
      addCheckpoint('guided-opened');
    }
    if (currentSignals.warningSignature !== previous.warningSignature) {
      addCheckpoint('warning');
    }
  }, [addCheckpoint, state, store.pendingGuided, store.warnings]);

  if (!state) return null;

  function startSession(): void {
    if (!state) return;
    const started = createResearchSession({
      deckId,
      phase,
      startedAt: new Date(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      taskId: assignedTask.taskId,
    });
    sessionStorage.setItem(ACTIVE_SESSION_KEY, started.sessionId);
    sessionRef.current = started;
    previousSignalsRef.current = {
      stackLength: state.zones.stack.length,
      warningSignature: JSON.stringify(store.warnings),
      guidedOpen: store.pendingGuided !== null,
    };
    const firstCheckpoint = createResearchCheckpoint({
      elapsedMs: 0,
      reason: 'session-start',
      state,
      autoAdvanceToMain: store.autoAdvanceToMain,
      transient: transientState(),
    });
    persist({ ...started, checkpoints: [firstCheckpoint] });
    setCollapsed(true);
  }

  function endSession(): void {
    const current = sessionRef.current;
    if (!current || !state) return;
    const finalCheckpoint = createResearchCheckpoint({
      elapsedMs: nowElapsed(current),
      reason: 'session-end',
      state,
      autoAdvanceToMain: store.autoAdvanceToMain,
      transient: transientState(),
      note,
    });
    const ended = {
      ...current,
      endedAt: new Date().toISOString(),
      checkpoints: [...current.checkpoints, finalCheckpoint],
    };
    sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    persist(ended);
    sessionRef.current = null;
    setSession(null);
    setNote('');
    setCaptureCriterion('');
    setEvidence({});
    setCollapsed(false);
  }

  const checkpoints = session?.checkpoints.slice(-4).reverse() ?? [];
  const inferredDeckId = inferResearchDeckId(state);
  const assignedDeckMismatch = Boolean(
    assignedTask.taskId && assignedTask.deckId && assignedTask.deckId !== inferredDeckId,
  );

  return (
    <aside
      className={`ux-recorder${collapsed && session ? ' ux-recorder--collapsed' : ''}`}
      data-ux-research-recorder
      data-testid="ux-research-recorder"
    >
      <div className="ux-recorder__header">
        <strong>UX調査</strong>
        <div className="ux-recorder__header-actions">
          {session && (
            <button type="button" onClick={() => setCollapsed((value) => !value)}>
              {collapsed ? '開く' : '畳む'}
            </button>
          )}
          {!participantDiscovery && (
            <a href="/research/design/ux-research/" target="_blank" rel="noreferrer">
              coverage
            </a>
          )}
        </div>
      </div>

      {session && collapsed ? (
        <p className="ux-recorder__muted">
          {session.deckId} · checkpoint {session.checkpoints.length} · 記録中
        </p>
      ) : restoring ? (
        <p className="ux-recorder__muted">セッションを復元中…</p>
      ) : !session ? (
        <>
          <label className="ux-recorder__field">
            デッキ
            <select
              value={deckId}
              disabled={Boolean(assignedTask.taskId)}
              onChange={(event) => setDeckId(event.target.value as ResearchDeckId)}
            >
              {RESEARCH_DECK_IDS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="ux-recorder__field">
            調査段階
            <select
              value={phase}
              disabled={Boolean(assignedTask.taskId)}
              onChange={(event) => setPhase(event.target.value as ResearchPhase)}
            >
              {RESEARCH_PHASES.map((value) => (
                <option key={value} value={value}>{RESEARCH_PHASE_LABELS[value]}</option>
              ))}
            </select>
          </label>
          {assignedDeckMismatch && (
            <p className="ux-recorder__warning" role="alert">
              指定は{assignedTask.deckId}ですが、現在の統率者は{inferredDeckId}デッキです。
              正しいデッキを読み込んでから記録してください。
            </p>
          )}
          <button
            type="button"
            className="ux-recorder__primary"
            onClick={startSession}
            disabled={assignedDeckMismatch}
          >
            記録を開始
          </button>
        </>
      ) : (
        <>
          <p className="ux-recorder__status">
            {session.deckId} · {RESEARCH_PHASE_LABELS[session.phase]}
          </p>
          <p className="ux-recorder__muted">
            checkpoint {session.checkpoints.length} · interaction {session.interactions.length}
          </p>
          {!participantDiscovery && <label className="ux-recorder__field">
            今の瞬間のメモ
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
          </label>}
          {!participantDiscovery && <details className="ux-recorder__evidence">
            <summary>振り返りを4層に分けて記録</summary>
            {([
              ['observation', 'Observation（実際に起きたこと）'],
              ['userStatement', 'User statement（ユーザーの発言）'],
              ['interpretation', 'Interpretation（原因の解釈）'],
              ['hypothesis', 'Hypothesis（試す修正）'],
            ] as const).map(([key, label]) => (
              <label className="ux-recorder__field" key={key}>
                {label}
                <textarea
                  value={evidence[key] ?? ''}
                  onChange={(event) => setEvidence((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))}
                  rows={2}
                />
              </label>
            ))}
          </details>}
          {!participantDiscovery && <label className="ux-recorder__field">
            fixture候補への昇格理由
            <select
              value={captureCriterion}
              onChange={(event) => setCaptureCriterion(event.target.value as CaptureCriterion | '')}
            >
              <option value="">通常checkpoint</option>
              {CAPTURE_CRITERIA.map((criterion) => (
                <option key={criterion} value={criterion}>
                  {CAPTURE_CRITERION_LABELS[criterion]}
                </option>
              ))}
            </select>
          </label>}
          <div className="ux-recorder__actions">
            {!participantDiscovery && <button type="button" className="ux-recorder__primary" onClick={() => {
              addCheckpoint('manual-marker', note, captureCriterion || undefined, evidence);
              setNote('');
              setCaptureCriterion('');
              setEvidence({});
            }}>
              瞬間を保存
            </button>}
            <button type="button" onClick={() => downloadSession(session)}>JSON</button>
            <button type="button" onClick={endSession}>終了</button>
          </div>
          {!participantDiscovery && checkpoints.length > 0 && (
            <ul className="ux-recorder__checkpoints">
              {checkpoints.map((checkpoint) => (
                <li key={checkpoint.id}>
                  <span>{checkpoint.note ?? checkpoint.reason}</span>
                  {checkpoint.captureCriterion && (
                    <small>{CAPTURE_CRITERION_LABELS[checkpoint.captureCriterion]}</small>
                  )}
                  <a
                    href={`/research/design/visual-fixtures/?session=${encodeURIComponent(session.sessionId)}&checkpoint=${encodeURIComponent(checkpoint.id)}&ui=new`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    比較
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
