import { useMemo, useState } from 'react';
import type { OnlineParticipantProjectionV1 } from '../../online/projection';
import type { OnlineVisibilityDurationV1, OnlineVisibilityIntentEnvelope } from '../../online/visibilityDecisions';
import './onlineVisibilityDecisions.css';

export type OnlineVisibilityDecisionsProps = Readonly<{
  projection: OnlineParticipantProjectionV1;
  interactionState: 'ready' | 'updating' | 'offline';
  busy?: boolean;
  onSubmit: (intent: OnlineVisibilityIntentEnvelope) => void;
}>;

let intentCounter = 0;
function commandId(revision: number): string { intentCounter += 1; return `visibility-${revision}-${intentCounter}`; }

type ProjectedZoneEntry = OnlineParticipantProjectionV1['game']['zones']['battlefield']['entries'][number];
type ProjectedObjectEntry = Extract<ProjectedZoneEntry, { readonly kind: 'visible-object' | 'concealed-object' }>;

function projectedCardLabel(entry: ProjectedObjectEntry): string {
  if (entry.kind === 'concealed-object') return '非公開オブジェクト';
  if (entry.definition === null) return '公開オブジェクト';
  const definition = entry.definition as typeof entry.definition & { readonly printedName?: unknown };
  const printedName = definition.printedName;
  const name = typeof printedName === 'string' && printedName !== '' ? printedName : definition.name;
  return typeof name === 'string' && name !== '' ? `《${name}》` : '公開オブジェクト';
}

export function OnlineVisibilityDecisions({ projection, interactionState, busy = false, onSubmit }: OnlineVisibilityDecisionsProps) {
  const playerId = projection.corePlayerId;
  const game = projection.game;
  const ownZones = game?.zones.byPlayer.find((entry) => entry.playerId === playerId)?.zones;
  const objectOptions = useMemo(() => {
    const options: { readonly handle: string; readonly label: string }[] = [];
    const seen = new Set<string>();
    const add = (entry: ProjectedZoneEntry): void => {
      if ((entry.kind !== 'visible-object' && entry.kind !== 'concealed-object') || seen.has(entry.objectId)) return;
      // Hand/graveyard cards are only surfaced from the actor's own player
      // zones.  Public shared objects are offered when the projection records
      // that this player owns or currently controls the object; the server
      // still rechecks this relation against the authoritative root.
      if (entry.kind === 'visible-object' && entry.ownerPlayerId !== playerId && entry.controllerPlayerId !== playerId) return;
      seen.add(entry.objectId);
      options.push({ handle: entry.objectId, label: projectedCardLabel(entry) });
    };
    for (const entry of ownZones?.hand.entries ?? []) add(entry);
    for (const entry of ownZones?.graveyard.entries ?? []) add(entry);
    const zones = game?.zones;
    if (zones !== undefined) {
      for (const zone of [zones.battlefield, zones.stack, zones.exile, zones.command]) {
        for (const entry of zone.entries) add(entry);
      }
    }
    return options;
  }, [game?.zones, ownZones, playerId]);
  const sourceOptions = useMemo(() => {
    const zones = game?.zones;
    if (zones === undefined) return [];
    const options: { readonly handle: string; readonly label: string }[] = [];
    const seen = new Set<string>();
    for (const zone of [zones.battlefield, zones.stack, zones.exile, zones.command]) {
      for (const entry of zone.entries) {
        if (entry.kind === 'visible-object' && !seen.has(entry.objectId) && (entry.ownerPlayerId === playerId || entry.controllerPlayerId === playerId)) {
          seen.add(entry.objectId);
          options.push({ handle: entry.objectId, label: projectedCardLabel(entry) });
        }
      }
    }
    return options;
  }, [game?.zones, playerId]);
  const sourceHandles = sourceOptions.map((option) => option.handle);
  const sessions = game?.searchSessions ?? [];
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [topCount, setTopCount] = useState(1);
  const [duration, setDuration] = useState<OnlineVisibilityDurationV1>({ kind: 'next-command' });
  const [viewers, setViewers] = useState<readonly string[]>(playerId === null ? [] : [playerId]);
  const [pending, setPending] = useState<Readonly<{ kind: 'look' | 'reveal'; handle?: string; count?: number } | { kind: 'open-choice'; count: number }> | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [choiceCount, setChoiceCount] = useState(1);
  const disabled = busy || interactionState !== 'ready' || playerId === null;
  const durationFeasible = duration.kind === 'next-command' || duration.kind === 'end-of-turn' || (duration.kind === 'source-bound' && sourceHandles.includes(duration.sourceHandle)) || (duration.kind === 'choice-bound' && sessions.some((session) => session.sessionId === duration.searchSessionId));
  const activePlayerSet = new Set(game?.players.filter((entry) => entry.status === 'active').map((entry) => entry.playerId) ?? []);
  const activePlayers = projection.room.seats.length > 0
    ? projection.room.seats.slice().sort((left, right) => left.seatIndex - right.seatIndex).map((seat) => seat.corePlayerId).filter((id) => activePlayerSet.has(id))
    : game?.players.filter((entry) => entry.status === 'active').map((entry) => entry.playerId) ?? [];
  const seatNumbers = new Map<string, number>(projection.room.seats.map((seat) => [seat.corePlayerId, seat.seatIndex + 1]));
  const activePlayerLabels = activePlayers.map((id) => String(id));
  const viewerLabel = (id: string): string => id === playerId ? '自分' : `席${seatNumbers.get(id) ?? activePlayerLabels.indexOf(id) + 1}`;
  const durationLabel = (value: OnlineVisibilityDurationV1): string => {
    if (value.kind === 'next-command') return '次の操作まで';
    if (value.kind === 'end-of-turn') return 'ターン終了まで';
    if (value.kind === 'source-bound') return '対象が存在する間';
    return '選択完了まで';
  };
  const ownLibraryCount = ownZones?.library.count ?? 0;
  const topCountOptions = Array.from({ length: Math.min(10, ownLibraryCount) }, (_, index) => index + 1);
  const choiceCountOptions = Array.from({ length: Math.min(10, ownLibraryCount) }, (_, index) => index + 1);
  const topCountFeasible = topCountOptions.includes(topCount);
  const choiceCountFeasible = choiceCountOptions.includes(choiceCount);
  const ownPendingChoice = sessions.some((session) => session.selectorPlayerId === playerId);
  const selectedSubjectFeasible = selectedHandle !== 'top:1' || topCountFeasible;
  const confirm = () => {
    if (pending === null || playerId === null) return;
    if (pending.kind === 'open-choice') {
      onSubmit({ kind: 'online-visibility-intent-v2', schemaVersion: 2, commandId: commandId(projection.revision), baseRevision: projection.revision, openChoice: { count: pending.count } });
      setPending(null);
      return;
    }
    if (!durationFeasible || (pending.count !== undefined && !topCountOptions.includes(pending.count))) return;
    const subject = pending.handle === undefined || pending.handle.startsWith('top:')
      ? { kind: 'top-of-library' as const, count: pending.count ?? Number(pending.handle?.slice(4) || 1) }
      : { kind: 'object' as const, handle: pending.handle };
    const envelope = pending.kind === 'look'
      ? { kind: 'online-visibility-intent-v1' as const, schemaVersion: 1 as const, commandId: commandId(projection.revision), baseRevision: projection.revision, look: { subject, viewerPlayerIds: viewers, duration } }
      : { kind: 'online-visibility-intent-v1' as const, schemaVersion: 1 as const, commandId: commandId(projection.revision), baseRevision: projection.revision, reveal: { subject, duration } };
    onSubmit(envelope);
    setPending(null);
  };
  return (
    <section className="online-visibility-decisions" aria-label="非公開情報の操作" data-testid="online-visibility-decisions">
      <header><h2>見る・公開する・選ぶ</h2><p>許可された投影だけを使い、確認後にサーバーへ送信します。</p></header>
      <div className="online-visibility-decisions__actions">
        <fieldset><legend>見る</legend>
          <label>対象<select data-testid="visibility-look-subject" value={selectedHandle ?? ''} onChange={(event) => setSelectedHandle(event.target.value || null)}><option value="">対象を選択</option><option value="top:1">ライブラリの上から</option>{objectOptions.map((option) => <option key={option.handle} value={option.handle}>{option.label}</option>)}</select></label>
          <label>上から何枚<select data-testid="visibility-top-count" value={topCount} onChange={(event) => setTopCount(Number(event.target.value))} disabled={topCountOptions.length === 0}>{topCountOptions.map((count) => <option key={count} value={count}>{count}枚</option>)}</select></label>
          <label>公開時間<select data-testid="visibility-look-duration" value={duration.kind} onChange={(event) => { const kind = event.target.value; setDuration(kind === 'source-bound' ? { kind, sourceHandle: sourceHandles[0] ?? '' } : kind === 'choice-bound' ? { kind, searchSessionId: sessions[0]?.sessionId ?? '' } : { kind: kind as 'next-command' | 'end-of-turn' }); }}><option value="next-command">次の操作まで</option><option value="end-of-turn">ターン終了まで</option><option value="source-bound" disabled={sourceHandles.length === 0}>対象が存在する間</option><option value="choice-bound" disabled={sessions.length === 0}>選択完了まで</option></select></label>
          {duration.kind === 'source-bound' && <label>存在元<select data-testid="visibility-look-source" value={duration.sourceHandle} onChange={(event) => setDuration({ kind: 'source-bound', sourceHandle: event.target.value })}>{sourceOptions.map((option) => <option key={option.handle} value={option.handle}>{option.label}</option>)}</select></label>}
          <label>見る人<select multiple size={Math.min(4, Math.max(1, activePlayers.length))} data-testid="visibility-look-viewers" value={viewers} onChange={(event) => setViewers([...event.target.selectedOptions].map((option) => option.value))}>{activePlayers.map((id) => <option key={id} value={id}>{viewerLabel(id)}</option>)}</select></label>
          <button type="button" data-testid="visibility-look" disabled={disabled || !durationFeasible || !selectedSubjectFeasible || selectedHandle === null || viewers.length === 0} onClick={() => setPending(selectedHandle?.startsWith('top:') ? { kind: 'look', count: topCount } : { kind: 'look', handle: selectedHandle ?? undefined })}>見る</button>
        </fieldset>
        <fieldset><legend>公開する</legend>
          <button type="button" data-testid="visibility-reveal" disabled={disabled || !durationFeasible || !selectedSubjectFeasible || selectedHandle === null} onClick={() => setPending({ kind: 'reveal', handle: selectedHandle ?? undefined })}>公開する</button>
          <button type="button" data-testid="visibility-reveal-top" disabled={disabled || !durationFeasible || !topCountFeasible} onClick={() => setPending({ kind: 'reveal', count: topCount })}>ライブラリの上から公開</button>
        </fieldset>
        <fieldset><legend>選ぶ</legend>
          <label>候補として見る枚数<select data-testid="visibility-choice-count" value={choiceCount} onChange={(event) => setChoiceCount(Number(event.target.value))} disabled={disabled || choiceCountOptions.length === 0 || ownPendingChoice}>{choiceCountOptions.map((count) => <option key={count} value={count}>{count}枚</option>)}</select></label>
          <p className="online-visibility-decisions__manual">自分だけが自分のライブラリ上のカードを見て、0〜1枚を選びます。選択結果だけを記録し、カードの移動やシャッフルは自動で行いません。</p>
          <button type="button" data-testid="visibility-open-choice" disabled={disabled || !choiceCountFeasible || ownLibraryCount === 0 || ownPendingChoice} onClick={() => setPending({ kind: 'open-choice', count: choiceCount })}>選択を開始</button>
          {sessions.length === 0 ? <p>現在選べる候補はありません。</p> : sessions.map((session) => {
            const selected = selectedCandidates[session.sessionId] ?? [];
            const isSelector = session.selectorPlayerId === playerId;
            const isQualified = session.criteria.kind === 'qualified';
            const mayCompleteEmpty = session.criteria.kind === 'qualified' && session.criteria.mayFailToFind === true;
            const quantityMayCompleteEmpty = session.criteria.kind === 'quantity' && session.criteria.minimum === 0;
            const mayCompleteWithoutSelection = mayCompleteEmpty || quantityMayCompleteEmpty;
            const selectedCountValid = mayCompleteWithoutSelection
              ? selected.length === 0 || selected.length >= session.criteria.minimum
              : selected.length >= session.criteria.minimum;
            return <div key={session.sessionId} data-testid={`visibility-choice-${session.sessionId}`}>
              <p>{isSelector ? '候補を選択' : '候補を確認（選択は指定されたプレイヤーのみ）'}（{session.criteria.minimum}〜{session.criteria.maximum}枚）</p>
              {session.candidates.map((candidate) => isSelector && !isQualified
                ? <label key={candidate.objectId}><input type="checkbox" value={candidate.objectId} checked={selected.includes(candidate.objectId)} disabled={disabled || (!selected.includes(candidate.objectId) && selected.length >= session.criteria.maximum)} onChange={() => setSelectedCandidates((current) => ({ ...current, [session.sessionId]: selected.includes(candidate.objectId) ? selected.filter((id) => id !== candidate.objectId) : [...selected, candidate.objectId] }))} />{projectedCardLabel(candidate)}</label>
                : <p key={candidate.objectId} className="online-visibility-decisions__candidate">{projectedCardLabel(candidate)}</p>)}
              {isSelector && isQualified && <p className="online-visibility-decisions__manual">Freeform Manual（条件付き候補は自動判定しません）</p>}
              {isSelector && (isQualified ? mayCompleteEmpty : true) && <button type="button" data-testid={`visibility-choose-${session.sessionId}`} disabled={disabled || !selectedCountValid} onClick={() => onSubmit({ kind: 'online-visibility-intent-v1', schemaVersion: 1, commandId: commandId(projection.revision), baseRevision: projection.revision, choose: { searchSessionId: session.sessionId, candidateHandles: selected } })}>{mayCompleteWithoutSelection && selected.length === 0 ? '選ばずに完了' : '選ぶ'}</button>}
            </div>;
          })}
        </fieldset>
      </div>
      {pending !== null && <div role="alertdialog" aria-label="操作の確認">
        {pending.kind === 'open-choice' ? <>
          <p>自分のライブラリー上{pending.count}枚を自分だけが見て、0〜1枚を選びます。</p>
          <p>選択結果だけを記録し、カードの移動やシャッフルは自動で行いません。</p>
        </> : <>
          <p>{pending.kind === 'look' ? '選択した対象を指定したプレイヤーに見せます。' : '選択した対象を全員に公開します。'}</p>
          <p>対象: {pending.count === undefined ? '選択したカード' : `ライブラリー上${pending.count}枚`}</p>
          <p>閲覧者: {pending.kind === 'look' ? viewers.map(viewerLabel).join('、') : '全員'} / 期間: {durationLabel(duration)}</p>
        </>}
        <button type="button" data-testid="visibility-confirm" disabled={disabled} onClick={confirm}>確認して送信</button><button type="button" onClick={() => setPending(null)}>キャンセル</button>
      </div>}
      <p className="online-visibility-decisions__manual">Freeform Manual（非公開情報は送信しません）</p>
      {interactionState !== 'ready' && <p role="status">接続を確認してから再試行してください。</p>}
    </section>
  );
}
