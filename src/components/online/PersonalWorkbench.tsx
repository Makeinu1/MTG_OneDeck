import { useMemo, useRef, useState } from 'react';
import {
  buildPersonalWorkbenchViewV1,
  type PersonalWorkbenchActionV1,
  type PersonalWorkbenchCardV1,
  type PersonalWorkbenchInteractionStateV1,
  type PersonalWorkbenchViewV1,
  type PersonalWorkbenchZoneV1,
} from '../../online/workbench/index';
import './personalWorkbench.css';

export type PersonalWorkbenchProps = Readonly<{
  readonly projection: unknown;
  readonly interactionState: PersonalWorkbenchInteractionStateV1;
  readonly onAction: (action: PersonalWorkbenchActionV1) => void;
}>;

function makeRefreshAction(view: PersonalWorkbenchViewV1): PersonalWorkbenchActionV1 {
  return Object.freeze({ kind: 'request-refresh' as const, knownRevision: view.revision });
}

function makePlayerAction(
  kind: 'priority-pass' | 'concede',
  view: PersonalWorkbenchViewV1,
): PersonalWorkbenchActionV1 {
  return Object.freeze({ kind, actorPlayerId: view.corePlayerId, baseRevision: view.revision });
}

function Card({ card }: Readonly<{ readonly card: PersonalWorkbenchCardV1 }>) {
  if (card.kind === 'hidden-card') {
    return <div className="personal-workbench__card personal-workbench__card--hidden" data-testid="workbench-hidden-card" aria-hidden="true" />;
  }
  if (card.kind === 'stack-object') {
    return (
      <article className="personal-workbench__card" data-testid="workbench-stack-object">
        <strong>{card.label}</strong>
      </article>
    );
  }
  if (card.kind === 'concealed-card') {
    return (
      <article className="personal-workbench__card" data-testid="workbench-concealed-card">
        <strong>{card.label}</strong>
        <span>{card.tapped ? 'タップ状態' : 'アンタップ状態'}</span>
        {card.counters.length > 0 && <span>カウンター {card.counters.map((counter) => `${counter.kind} ${counter.count}`).join(' / ')}</span>}
        {card.markedDamage > 0 && <span>ダメージ {card.markedDamage}</span>}
      </article>
    );
  }
  return (
    <article className="personal-workbench__card" data-testid="workbench-visible-card">
      <strong>{card.label}</strong>
      <span>{card.typeLine}</span>
      {card.manaCost !== null && <span>{card.manaCost}</span>}
      {card.oracleText.length > 0 && <span>{card.oracleText}</span>}
    </article>
  );
}

function Zone({ title, zone, testId }: Readonly<{
  readonly title: string;
  readonly zone: PersonalWorkbenchZoneV1;
  readonly testId: string;
}>) {
  return (
    <section className="personal-workbench__zone" data-testid={testId}>
      <header><h3>{title}</h3><span>{zone.count} 枚</span></header>
      <div className="personal-workbench__cards">
        {zone.cards.map((card, index) => <Card card={card} key={card.kind === 'hidden-card' ? index : card.objectId} />)}
      </div>
    </section>
  );
}

function unavailable() {
  return <section className="personal-workbench__unavailable" data-testid="personal-workbench-unavailable">表示できません</section>;
}

function phaseLabel(phase: string): string {
  const labels: Readonly<Record<string, string>> = {
    beginning: '開始フェイズ',
    'precombat-main': '戦闘前メイン・フェイズ',
    combat: '戦闘フェイズ',
    'postcombat-main': '戦闘後メイン・フェイズ',
    ending: '終了フェイズ',
  };
  return labels[phase] ?? 'フェイズ情報';
}

function stepLabel(step: string | null): string | null {
  if (step === null) return null;
  const labels: Readonly<Record<string, string>> = {
    untap: 'アンタップ・ステップ',
    upkeep: 'アップキープ・ステップ',
    draw: 'ドロー・ステップ',
    'beginning-of-combat': '戦闘開始ステップ',
    'declare-attackers': '攻撃クリーチャー指定ステップ',
    'declare-blockers': 'ブロック・クリーチャー指定ステップ',
    'combat-damage': '戦闘ダメージ・ステップ',
    'end-of-combat': '戦闘終了ステップ',
    end: '終了ステップ',
    cleanup: 'クリンナップ・ステップ',
  };
  return labels[step] ?? 'ステップ情報';
}

function playerStatusLabel(status: string): string {
  if (status === 'active') return 'プレイ中';
  if (status === 'exited') return '退席済み';
  return '状態情報';
}

type ConcedeIdentity = Readonly<{
  readonly playerId: string;
  readonly revision: number;
}>;

function sameConcedeIdentity(left: ConcedeIdentity | null, right: ConcedeIdentity | null): boolean {
  return left?.playerId === right?.playerId && left?.revision === right?.revision;
}

export function PersonalWorkbench({ projection, interactionState, onAction }: PersonalWorkbenchProps) {
  const view = useMemo(() => {
    try {
      return buildPersonalWorkbenchViewV1(projection);
    } catch {
      return null;
    }
  }, [projection]);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationIdentity, setConfirmationIdentity] = useState<ConcedeIdentity | null>(null);
  const [concededAction, setConcededAction] = useState<ConcedeIdentity | null>(null);
  const currentIdentity = view === null
    ? null
    : Object.freeze({ playerId: view.corePlayerId, revision: view.revision });
  const [lastValidatedIdentity, setLastValidatedIdentity] = useState<ConcedeIdentity | null>(currentIdentity);
  const emittedConcede = useRef<ConcedeIdentity | null>(null);

  if (!sameConcedeIdentity(lastValidatedIdentity, currentIdentity)) {
    setLastValidatedIdentity(currentIdentity);
    if (confirmationIdentity !== null) setConfirmationIdentity(null);
  }

  const canSendPlayerAction = view !== null &&
    interactionState === 'ready' &&
    view.roomLifecycle === 'active' &&
    view.outcome === 'pending';
  const ownPlayerIsActive = view !== null && view.players.some(
    (player) => player.isSelf && player.status === 'active',
  );
  const hasConcededAtCurrentRevision = view !== null &&
    sameConcedeIdentity(concededAction, currentIdentity);
  const canPassPriority = canSendPlayerAction && ownPlayerIsActive;
  const canConcede = canSendPlayerAction && ownPlayerIsActive && !hasConcededAtCurrentRevision;
  const currentStep = stepLabel(view?.turn.step ?? null);
  const confirmationMatchesCurrentView = sameConcedeIdentity(confirmationIdentity, currentIdentity);

  if (view === null) return unavailable();

  function confirmConcede(): void {
    if (
      !canConcede ||
      !confirmationOpen ||
      !confirmationMatchesCurrentView ||
      sameConcedeIdentity(emittedConcede.current, currentIdentity)
    ) return;
    const actionIdentity = currentIdentity;
    if (actionIdentity === null) return;
    emittedConcede.current = actionIdentity;
    setConcededAction(actionIdentity);
    setConfirmationOpen(false);
    setConfirmationIdentity(null);
    onAction(makePlayerAction('concede', view));
  }

  function beginConcede(): void {
    if (!canConcede) return;
    if (currentIdentity === null) return;
    setConfirmationIdentity(currentIdentity);
    setConfirmationOpen(true);
  }

  return (
    <main className="personal-workbench" data-testid="personal-workbench">
      <header className="personal-workbench__status" data-testid="workbench-status">
        <div>
          <p>自分の席 {view.seatIndex + 1} / {view.presence === 'connected' ? '接続中' : '接続待ち'}</p>
          <h1>ターン {view.turn.turnNumber}</h1>
          <p>{phaseLabel(view.turn.phase)}{currentStep === null ? '' : ` / ${currentStep}`}</p>
        </div>
        <button type="button" data-testid="workbench-refresh" onClick={() => onAction(makeRefreshAction(view))}>盤面を更新</button>
      </header>

      <section className="personal-workbench__players" aria-label="プレイヤー一覧">
        {view.players.map((player) => (
          <article className="personal-workbench__player" data-testid="workbench-player-summary" key={player.playerId}>
            <strong>{player.isSelf ? '自分' : 'プレイヤー'} {player.isActive ? '（手番）' : ''}</strong>
            <span>ライフ {player.life} / 毒 {player.poison}</span>
            <span>エネルギー {player.energy} / 経験 {player.experience}</span>
            <span>マナ W{player.mana.W} U{player.mana.U} B{player.mana.B} R{player.mana.R} G{player.mana.G} C{player.mana.C}</span>
            <span>状態 {playerStatusLabel(player.status)}</span>
            <span>手札 {player.handCount} / ライブラリー {player.libraryCount} / 墓地 {player.graveyardCount}</span>
          </article>
        ))}
      </section>

      <section className="personal-workbench__zones" aria-label="自分の領域">
        <Zone title="手札" zone={view.zones.ownHand} testId="workbench-zone-own-hand" />
        <section className="personal-workbench__zone" data-testid="workbench-zone-own-library">
          <header><h3>ライブラリー</h3><span>{view.zones.ownLibraryCount} 枚</span></header>
        </section>
        <Zone title="墓地" zone={view.zones.ownGraveyard} testId="workbench-zone-own-graveyard" />
      </section>

      <section className="personal-workbench__zones" aria-label="公開領域">
        <Zone title="戦場" zone={view.zones.battlefield} testId="workbench-zone-battlefield" />
        <Zone title="スタック" zone={view.zones.stack} testId="workbench-zone-stack" />
        <Zone title="追放" zone={view.zones.exile} testId="workbench-zone-exile" />
        <Zone title="統率者領域" zone={view.zones.command} testId="workbench-zone-command" />
      </section>

      <section className="personal-workbench__actions" aria-label="操作">
        <button type="button" data-testid="workbench-priority-pass" disabled={!canPassPriority} onClick={() => onAction(makePlayerAction('priority-pass', view))}>優先権をパス（サーバー確認）</button>
        <button type="button" data-testid="workbench-concede" disabled={!canConcede} onClick={beginConcede}>投了する</button>
      </section>

      {confirmationOpen && canConcede && confirmationMatchesCurrentView && (
        <section className="personal-workbench__confirmation" data-testid="workbench-concede-confirmation" role="dialog" aria-label="投了の確認">
          <p>投了をサーバーへ要求しますか？</p>
          <div>
            <button type="button" data-testid="workbench-concede-cancel" onClick={() => { setConfirmationOpen(false); setConfirmationIdentity(null); }}>キャンセル</button>
            <button type="button" data-testid="workbench-concede-confirm" onClick={confirmConcede}>投了を要求</button>
          </div>
        </section>
      )}
    </main>
  );
}
