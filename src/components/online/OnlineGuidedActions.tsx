import { useState } from 'react';
import {
  buildOnlineGuidedActionsViewV1,
  createOnlineGuidedActionV1,
  type OnlineGuidedActionV1,
  type OnlineGuidedActionsViewV1,
  type OnlineGuidedCombatObjectV1,
  type OnlineGuidedControlCandidateV1,
} from '../../online/guidedActions/index';
import './onlineGuidedActions.css';

export type OnlineGuidedActionsProps = Readonly<{
  readonly projection: unknown;
  readonly interactionState: 'ready' | 'updating' | 'offline';
  readonly busy?: boolean;
  readonly onAction: (action: OnlineGuidedActionV1) => void;
  /** Server-bound combat damage callback. Snapshot/private state never crosses this boundary. */
  readonly onSubmitManualCombatDamage?: (input: Readonly<{
    readonly defendingPlayerId: string;
    readonly damage: number;
    readonly commanderObjectId: string | null;
  }>) => void | Promise<void>;
}>;

type ManualRecord = Readonly<{ readonly kind: string; readonly text: string }>;

function unavailable() {
  return <main className="online-guided-actions__unavailable" data-testid="online-guided-actions-unavailable">表示できません</main>;
}

function actionFrom(projection: unknown, action: unknown): OnlineGuidedActionV1 | null {
  try {
    return createOnlineGuidedActionV1({ projection, action });
  } catch {
    return null;
  }
}

function optionLabel(candidate: OnlineGuidedControlCandidateV1 | OnlineGuidedCombatObjectV1): string {
  return candidate.label;
}

function manualCombatTargetIds(projection: unknown): readonly string[] {
  if (projection === null || typeof projection !== 'object' || Array.isArray(projection)) return [];
  const game = (projection as Record<string, unknown>).game;
  if (game === null || typeof game !== 'object' || Array.isArray(game)) return [];
  const combat = (game as Record<string, unknown>).combat;
  if (combat === null || typeof combat !== 'object' || Array.isArray(combat)) return [];
  const attacks = (combat as Record<string, unknown>).attacks;
  if (!Array.isArray(attacks)) return [];
  const ids = attacks.flatMap((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const defender = (entry as Record<string, unknown>).defendingPlayerId;
    return typeof defender === 'string' ? [defender] : [];
  });
  return Object.freeze([...new Set(ids)]);
}

function manualCombatPermission(projection: unknown, actorPlayerId: string, busy: boolean, interactionState: OnlineGuidedActionsProps['interactionState']): boolean {
  if (busy || interactionState !== 'ready') return false;
  if (projection === null || typeof projection !== 'object' || Array.isArray(projection)) return false;
  const game = (projection as Record<string, unknown>).game;
  if (game === null || typeof game !== 'object' || Array.isArray(game)) return false;
  const value = game as Record<string, unknown>;
  const priority = value.assistedPriority;
  if (priority === null || typeof priority !== 'object' || Array.isArray(priority)) return false;
  const fields = priority as Record<string, unknown>;
  if (fields.stewardPlayerId !== actorPlayerId) return false;
  const holds = Array.isArray(fields.holds) ? fields.holds : [];
  const priorityHolds = Array.isArray(value.priorityHolds) ? value.priorityHolds : [];
  return holds.length === 0 && priorityHolds.length === 0 && manualCombatTargetIds(projection).length > 0;
}

function OnlineGuidedActionsForm({ projection, view, interactionState, busy = false, onAction, onSubmitManualCombatDamage }: OnlineGuidedActionsProps & Readonly<{ readonly view: OnlineGuidedActionsViewV1 }>) {
  const [searchSessionId, setSearchSessionId] = useState('');
  const [selectedSearchIds, setSelectedSearchIds] = useState<readonly string[]>([]);
  const [controlTarget, setControlTarget] = useState('');
  const [controlGaining, setControlGaining] = useState('');
  const [controlEffectKey, setControlEffectKey] = useState('guided-control');
  const [controlSource, setControlSource] = useState('');
  const [attacker, setAttacker] = useState('');
  const [attackerDefender, setAttackerDefender] = useState('');
  const [blocker, setBlocker] = useState('');
  const [blockedObject, setBlockedObject] = useState('');
  const [blockDefender, setBlockDefender] = useState('');
  const [faceDownObject, setFaceDownObject] = useState('');
  const [faceDownNote, setFaceDownNote] = useState('');
  const [lifePlayer, setLifePlayer] = useState('');
  const [lifeValue, setLifeValue] = useState('');
  const [lifeReason, setLifeReason] = useState('');
  const [commanderObject, setCommanderObject] = useState('');
  const [commanderDefender, setCommanderDefender] = useState('');
  const [commanderDamage, setCommanderDamage] = useState('');
  const [commanderReason, setCommanderReason] = useState('');
  const [manualDamageDefender, setManualDamageDefender] = useState('');
  const [manualDamageAmount, setManualDamageAmount] = useState('1');
  const [manualDamageCommander, setManualDamageCommander] = useState('');
  const [confirming, setConfirming] = useState<OnlineGuidedActionV1 | null>(null);
  const [manualRecords, setManualRecords] = useState<readonly ManualRecord[]>([]);

  const disabled = interactionState !== 'ready';
  const currentSearch = view.searchSessions.find((session) => session.sessionId === searchSessionId);
  const manualDamageTargets = manualCombatTargetIds(projection);
  const manualDamageAllowed = onSubmitManualCombatDamage !== undefined
    && manualCombatPermission(projection, view.actorPlayerId, busy, interactionState);

  function emit(action: OnlineGuidedActionV1 | null): void {
    if (disabled || action === null) return;
    const current = actionFrom(projection, action);
    if (current === null) {
      setConfirming(null);
      return;
    }
    onAction(current);
  }

  function submitManual(action: OnlineGuidedActionV1 | null, text: string, kind: string): void {
    if (disabled || action === null) return;
    onAction(action);
    setManualRecords((previous) => [...previous, { kind, text }]);
  }

  return (
    <main className="online-guided-actions" data-testid="online-guided-actions">
      <header className="online-guided-actions__status" data-testid="online-guided-actions-status">
        <h1>ガイド付き操作と手動記録</h1>
        <p>{interactionState === 'ready' ? 'サーバー確認を送信できます' : interactionState === 'updating' ? '表示を更新しています' : '表示同期は保留中'}</p>
        <p>リビジョン {view.revision} / 手番 {view.turn.turnNumber}</p>
      </header>

      <section className="online-guided-actions__section" data-testid="guided-control" aria-labelledby="guided-control-title">
        <h2 id="guided-control-title">コントロール</h2>
        <p>対象と取得するプレイヤーを選び、サーバーへ確認します。適法性はサーバーが判定します。</p>
        <form onSubmit={(event) => { event.preventDefault(); const action = actionFrom(projection, { kind: 'apply-control', actorPlayerId: view.actorPlayerId, baseRevision: view.revision, effectKey: controlEffectKey, targetObjectId: controlTarget, gainingControllerPlayerId: controlGaining, sourceObjectId: controlSource === '' ? null : controlSource, duration: { kind: 'manual' } }); setConfirming(action); }}>
          <label>対象
            <select value={controlTarget} onChange={(event) => setControlTarget(event.target.value)} disabled={disabled}>
              <option value="">選択してください</option>
              {view.controlCandidates.map((candidate) => <option value={candidate.objectId} key={candidate.objectId}>{optionLabel(candidate)}</option>)}
            </select>
          </label>
          <label>取得するプレイヤー
            <select value={controlGaining} onChange={(event) => setControlGaining(event.target.value)} disabled={disabled}>
              <option value="">選択してください</option>
              {view.players.filter((player) => player.isActive).map((player) => <option value={player.playerId} key={player.playerId}>{player.isSelf ? '自分' : `プレイヤー ${player.playerId}`}</option>)}
            </select>
          </label>
          <label>効果キー
            <input value={controlEffectKey} onChange={(event) => setControlEffectKey(event.target.value)} disabled={disabled} />
          </label>
          <label>発生源（任意）
            <select value={controlSource} onChange={(event) => setControlSource(event.target.value)} disabled={disabled}>
              <option value="">指定しない</option>
              {view.controlCandidates.map((candidate) => <option value={candidate.objectId} key={candidate.objectId}>{optionLabel(candidate)}</option>)}
            </select>
          </label>
          <button type="submit" disabled={disabled}>サーバーへ確認する</button>
        </form>
      </section>

      <section className="online-guided-actions__section" data-testid="guided-search" aria-labelledby="guided-search-title">
        <h2 id="guided-search-title">ライブラリー探索</h2>
        <p>投影された候補から選び、条件の最終判定をサーバーへ確認します。</p>
        <form onSubmit={(event) => { event.preventDefault(); if (currentSearch === undefined) return; const action = actionFrom(projection, { kind: 'complete-search', actorPlayerId: view.actorPlayerId, baseRevision: view.revision, sessionId: currentSearch.sessionId, selectedObjectIds: selectedSearchIds }); setConfirming(action); }}>
          <label>探索セッション
            <select value={searchSessionId} onChange={(event) => { setSearchSessionId(event.target.value); setSelectedSearchIds([]); }} disabled={disabled}>
              <option value="">選択してください</option>
              {view.searchSessions.map((session) => <option value={session.sessionId} key={session.sessionId}>候補 {session.candidates.length} 件</option>)}
            </select>
          </label>
          {currentSearch !== undefined && <fieldset disabled={disabled}><legend>候補（{currentSearch.minimum}〜{currentSearch.maximum} 件）</legend>{currentSearch.candidates.map((candidate) => <label className="online-guided-actions__check" key={candidate.objectId}><input type="checkbox" checked={selectedSearchIds.includes(candidate.objectId)} onChange={(event) => setSelectedSearchIds((previous) => event.target.checked ? [...previous, candidate.objectId] : previous.filter((id) => id !== candidate.objectId))} />{candidate.label}</label>)}</fieldset>}
          <button type="submit" disabled={disabled || currentSearch === undefined}>サーバーへ確認する</button>
        </form>
      </section>

      <section className="online-guided-actions__section" data-testid="manual-face-down" aria-labelledby="manual-face-down-title">
        <h2 id="manual-face-down-title">裏向き情報</h2>
        <p className="online-guided-actions__manual">手動記録（未送信）</p>
        <form onSubmit={(event) => { event.preventDefault(); submitManual(actionFrom(projection, { kind: 'note-face-down', actorPlayerId: view.actorPlayerId, baseRevision: view.revision, objectId: faceDownObject, note: faceDownNote }), faceDownNote, '裏向き情報'); }}>
          <label>対象
            <select value={faceDownObject} onChange={(event) => setFaceDownObject(event.target.value)} disabled={disabled}><option value="">選択してください</option>{view.faceDownItems.map((item) => <option value={item.objectId} key={item.objectId}>{item.label} / {item.zone}</option>)}</select>
          </label>
          <label>メモ<textarea value={faceDownNote} onChange={(event) => setFaceDownNote(event.target.value)} disabled={disabled} /></label>
          <button type="submit" disabled={disabled}>手動記録（未送信）</button>
        </form>
      </section>

      <section className="online-guided-actions__section" data-testid="guided-combat" aria-labelledby="guided-combat-title">
        <h2 id="guided-combat-title">戦闘</h2>
        <p>候補を指定した試行をサーバーへ確認します。戦闘の適法性や結果は確定していません。</p>
        <form onSubmit={(event) => { event.preventDefault(); const action = actionFrom(projection, { kind: 'declare-attacker', actorPlayerId: view.actorPlayerId, baseRevision: view.revision, attackerObjectId: attacker, defendingPlayerId: attackerDefender }); setConfirming(action); }}>
          <h3>攻撃クリーチャー</h3>
          <label>攻撃者<select value={attacker} onChange={(event) => setAttacker(event.target.value)} disabled={disabled}><option value="">選択してください</option>{view.combat.ownObjects.map((candidate) => <option value={candidate.objectId} key={candidate.objectId}>{optionLabel(candidate)}</option>)}</select></label>
          <label>防御プレイヤー<select value={attackerDefender} onChange={(event) => setAttackerDefender(event.target.value)} disabled={disabled}><option value="">選択してください</option>{view.combat.defendingPlayers.map((player) => <option value={player.playerId} key={player.playerId}>プレイヤー {player.playerId}</option>)}</select></label>
          <button type="submit" disabled={disabled}>サーバーへ確認する</button>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); const action = actionFrom(projection, { kind: 'declare-blocker', actorPlayerId: view.actorPlayerId, baseRevision: view.revision, blockerObjectId: blocker, attackedObjectId: blockedObject, defendingPlayerId: blockDefender }); setConfirming(action); }}>
          <h3>ブロック・クリーチャー</h3>
          <label>ブロッカー<select value={blocker} onChange={(event) => setBlocker(event.target.value)} disabled={disabled}><option value="">選択してください</option>{view.combat.ownObjects.map((candidate) => <option value={candidate.objectId} key={candidate.objectId}>{optionLabel(candidate)}</option>)}</select></label>
          <label>攻撃対象<select value={blockedObject} onChange={(event) => setBlockedObject(event.target.value)} disabled={disabled}><option value="">選択してください</option>{view.combat.attackedObjects.map((candidate) => <option value={candidate.objectId} key={candidate.objectId}>{optionLabel(candidate)}</option>)}</select></label>
          <label>防御プレイヤー<select value={blockDefender} onChange={(event) => setBlockDefender(event.target.value)} disabled={disabled}><option value="">選択してください</option>{view.combat.defendingPlayers.map((player) => <option value={player.playerId} key={player.playerId}>プレイヤー {player.playerId}</option>)}</select></label>
          <button type="submit" disabled={disabled}>サーバーへ確認する</button>
        </form>
        {onSubmitManualCombatDamage !== undefined && (
          <form data-testid="manual-combat-damage" onSubmit={(event) => {
            event.preventDefault();
            const amount = Number(manualDamageAmount);
            if (!manualDamageAllowed || manualDamageDefender === '' || !Number.isSafeInteger(amount) || amount < 1 || amount > 120) return;
            void onSubmitManualCombatDamage({
              defendingPlayerId: manualDamageDefender,
              damage: amount,
              commanderObjectId: manualDamageCommander === '' ? null : manualDamageCommander,
            });
          }}>
            <h3>Manual Damage（戦闘結果）</h3>
            <p className="online-guided-actions__manual">攻撃先へ手動で記録します。最終判定と勝敗はサーバーが行います。</p>
            <label>防御プレイヤー<select data-testid="online-manual-damage-defender" value={manualDamageDefender} onChange={(event) => setManualDamageDefender(event.target.value)} disabled={!manualDamageAllowed}>
              <option value="">攻撃先を選択</option>
              {view.combat.defendingPlayers.filter((player) => manualDamageTargets.includes(player.playerId)).map((player) => <option value={player.playerId} key={player.playerId}>プレイヤー {player.playerId}</option>)}
            </select></label>
            <label>ダメージ<input data-testid="online-manual-damage-amount" type="number" min="1" max="120" value={manualDamageAmount} onChange={(event) => setManualDamageAmount(event.target.value)} disabled={!manualDamageAllowed} /></label>
            <label>発生源（統率者の場合のみ任意）<select data-testid="online-manual-damage-commander" value={manualDamageCommander} onChange={(event) => setManualDamageCommander(event.target.value)} disabled={!manualDamageAllowed}>
              <option value="">通常の戦闘ダメージ</option>
              {view.corrections.commanders.map((commander) => <option value={commander.objectId} key={commander.objectId}>{commander.label}</option>)}
            </select></label>
            <button type="submit" data-testid="online-manual-damage-submit" disabled={!manualDamageAllowed || manualDamageDefender === '' || !Number.isSafeInteger(Number(manualDamageAmount)) || Number(manualDamageAmount) < 1 || Number(manualDamageAmount) > 120}>Manual Damage を送信</button>
            {!manualDamageAllowed && <p className="online-guided-actions__manual" data-testid="online-manual-damage-unavailable">現在は Manual Damage を送信できません（steward の戦闘・HOLDなし・接続済みが必要です）。</p>}
          </form>
        )}
      </section>

      <section className="online-guided-actions__section" data-testid="manual-correction" aria-labelledby="manual-correction-title">
        <h2 id="manual-correction-title">手動修正</h2>
        <p className="online-guided-actions__manual">手動記録（未送信）</p>
        <form onSubmit={(event) => { event.preventDefault(); submitManual(actionFrom(projection, { kind: 'request-life-correction', actorPlayerId: view.actorPlayerId, baseRevision: view.revision, playerId: lifePlayer, replacementLifeTotal: Number(lifeValue), reason: lifeReason }), lifeReason, 'ライフ記録'); }}>
          <h3>ライフ記録</h3>
          <label>プレイヤー<select value={lifePlayer} onChange={(event) => setLifePlayer(event.target.value)} disabled={disabled}><option value="">選択してください</option>{view.corrections.players.map((player) => <option value={player.playerId} key={player.playerId}>プレイヤー {player.playerId}</option>)}</select></label>
          <label>記録するライフ<input type="number" value={lifeValue} onChange={(event) => setLifeValue(event.target.value)} disabled={disabled} /></label>
          <label>理由<textarea value={lifeReason} onChange={(event) => setLifeReason(event.target.value)} disabled={disabled} /></label>
          <button type="submit" disabled={disabled}>手動記録（未送信）</button>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); submitManual(actionFrom(projection, { kind: 'note-commander-damage-correction', actorPlayerId: view.actorPlayerId, baseRevision: view.revision, commanderObjectId: commanderObject, defendingPlayerId: commanderDefender, replacementDamageTotal: Number(commanderDamage), reason: commanderReason }), commanderReason, '統率者ダメージ記録'); }}>
          <h3>統率者ダメージ記録</h3>
          <label>統率者<select value={commanderObject} onChange={(event) => setCommanderObject(event.target.value)} disabled={disabled}><option value="">選択してください</option>{view.corrections.commanders.map((commander) => <option value={commander.objectId} key={commander.objectId}>{commander.label}</option>)}</select></label>
          <label>防御プレイヤー<select value={commanderDefender} onChange={(event) => setCommanderDefender(event.target.value)} disabled={disabled}><option value="">選択してください</option>{view.corrections.players.map((player) => <option value={player.playerId} key={player.playerId}>プレイヤー {player.playerId}</option>)}</select></label>
          <label>記録するダメージ<input type="number" value={commanderDamage} onChange={(event) => setCommanderDamage(event.target.value)} disabled={disabled} /></label>
          <label>理由<textarea value={commanderReason} onChange={(event) => setCommanderReason(event.target.value)} disabled={disabled} /></label>
          <button type="submit" disabled={disabled}>手動記録（未送信）</button>
        </form>
        {manualRecords.length > 0 && <ul className="online-guided-actions__records" data-testid="manual-records">{manualRecords.map((record, index) => <li key={`${record.kind}-${index}`}>{record.kind} / 手動記録（未送信）: {record.text}</li>)}</ul>}
      </section>

      {confirming !== null && !disabled && <section className="online-guided-actions__confirmation" data-testid="guided-confirmation" role="dialog" aria-label="サーバー確認">
        <p>この操作をサーバーへ確認しますか？</p>
        <button type="button" onClick={() => setConfirming(null)}>キャンセル</button>
        <button type="button" onClick={() => { emit(confirming); setConfirming(null); }}>サーバーへ確認する</button>
      </section>}
    </main>
  );
}

export function OnlineGuidedActions({ projection, interactionState, busy = false, onAction, onSubmitManualCombatDamage }: OnlineGuidedActionsProps) {
  let view: OnlineGuidedActionsViewV1;
  try {
    view = buildOnlineGuidedActionsViewV1(projection);
  } catch {
    return unavailable();
  }
  return (
    <OnlineGuidedActionsForm
      key={JSON.stringify(view)}
      projection={projection}
      view={view}
      interactionState={interactionState}
      busy={busy}
      onAction={onAction}
      onSubmitManualCombatDamage={onSubmitManualCombatDamage}
    />
  );
}
