import {
  buildTableDisplayViewV1,
  type TableDisplayCardV1,
  type TableDisplayViewV1,
  type TableDisplayZoneV1,
} from '../../online/tableDisplay/index';
import './tableDisplay.css';

function phaseLabel(phase: TableDisplayViewV1['turn']['phase']): string {
  const labels: Readonly<Record<TableDisplayViewV1['turn']['phase'], string>> = {
    beginning: '開始フェイズ',
    'precombat-main': '戦闘前メイン・フェイズ',
    combat: '戦闘フェイズ',
    'postcombat-main': '戦闘後メイン・フェイズ',
    ending: '終了フェイズ',
  };
  return labels[phase];
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

function roomLabel(lifecycle: TableDisplayViewV1['roomLifecycle']): string {
  const labels: Readonly<Record<TableDisplayViewV1['roomLifecycle'], string>> = {
    forming: '準備中',
    ready: '開始準備完了',
    started: '開始処理中',
    active: '対戦中',
    finished: '対戦終了',
  };
  return labels[lifecycle];
}

function presenceLabel(presence: 'connected' | 'disconnected'): string {
  return presence === 'connected' ? '接続中' : '切断中';
}

function playerStatusLabel(status: 'active' | 'exited'): string {
  return status === 'active' ? 'プレイ中' : '退席済み';
}

function outcomeLabel(outcome: 'pending' | 'conceded' | 'defeated'): string {
  const labels: Readonly<Record<typeof outcome, string>> = {
    pending: '継続中',
    conceded: '投了',
    defeated: '敗北',
  };
  return labels[outcome];
}

function Card({ card }: Readonly<{ readonly card: TableDisplayCardV1 }>) {
  if (card.kind === 'stack-object') {
    return <article className="table-display__card" data-testid="table-display-stack-object"><strong>{card.label}</strong></article>;
  }
  if (card.kind === 'concealed-card') {
    return (
      <article className="table-display__card table-display__card--concealed" data-testid="table-display-concealed-card">
        <strong>{card.label}</strong>
        <span>{card.tapped ? 'タップ状態' : 'アンタップ状態'}</span>
        <span>{card.phasedOut ? 'フェイズアウト中' : 'フェイズイン中'}</span>
        {card.counters.length > 0 && <span>カウンター {card.counters.map((counter) => `${counter.kind} ${counter.count}`).join(' / ')}</span>}
        {card.markedDamage > 0 && <span>ダメージ {card.markedDamage}</span>}
      </article>
    );
  }
  return (
    <article className="table-display__card" data-testid="table-display-visible-card">
      <strong>{card.label}</strong>
      <span>{card.typeLine}</span>
      <span>{card.tapped ? 'タップ状態' : 'アンタップ状態'}</span>
      <span>{card.phasedOut ? 'フェイズアウト中' : 'フェイズイン中'}</span>
      {card.counters.length > 0 && <span>カウンター {card.counters.map((counter) => `${counter.kind} ${counter.count}`).join(' / ')}</span>}
      {card.markedDamage > 0 && <span>ダメージ {card.markedDamage}</span>}
    </article>
  );
}

function Zone({ title, zone, testId }: Readonly<{
  readonly title: string;
  readonly zone: TableDisplayZoneV1;
  readonly testId: string;
}>) {
  return (
    <section className="table-display__zone" data-testid={testId}>
      <header><h3>{title}</h3><span>{zone.count} 枚</span></header>
      <div className="table-display__cards">
        {zone.cards.map((card) => <Card card={card} key={card.objectId} />)}
      </div>
    </section>
  );
}

function unavailable() {
  return <main className="table-display__unavailable" data-testid="table-display-unavailable">表示できません</main>;
}

export function TableDisplay({ projection }: Readonly<{ readonly projection: unknown }>) {
  let view: TableDisplayViewV1 | null;
  try {
    view = buildTableDisplayViewV1(projection);
  } catch {
    view = null;
  }

  if (view === null) return unavailable();
  const step = stepLabel(view.turn.step);
  return (
    <main className="table-display" data-testid="table-display">
      <header className="table-display__status" data-testid="table-display-status">
        <p>テーブル表示 / {presenceLabel(view.tablePresence)} / {roomLabel(view.roomLifecycle)}</p>
        <h1>ターン {view.turn.turnNumber}</h1>
        <p>手番 {view.turn.activePlayerId} / {phaseLabel(view.turn.phase)}{step === null ? '' : ` / ${step}`}</p>
      </header>

      <section className="table-display__priority" data-testid="table-display-priority-status">
        優先権保持者は投影されていません
      </section>

      <section className="table-display__players" aria-label="プレイヤー一覧">
        {view.players.map((player) => (
          <article className="table-display__player" data-testid="table-display-player-summary" key={player.playerId}>
            <strong>プレイヤー {player.playerId}{player.isActive ? '（手番）' : ''}</strong>
            <span>席 {player.seatIndex + 1} / {presenceLabel(player.presence)}</span>
            <span>状態 {playerStatusLabel(player.status)} / 結果 {outcomeLabel(player.outcome)}</span>
            <span>ライフ {player.life} / 毒 {player.poison}</span>
            <span>エネルギー {player.energy} / 経験 {player.experience}</span>
            <span>マナ W{player.mana.W} U{player.mana.U} B{player.mana.B} R{player.mana.R} G{player.mana.G} C{player.mana.C}</span>
            <span>手札 {player.handCount} / ライブラリー {player.libraryCount} / 墓地 {player.graveyardCount}</span>
          </article>
        ))}
      </section>

      <section className="table-display__zones" aria-label="公開領域">
        <Zone title="戦場" zone={view.zones.battlefield} testId="table-display-zone-battlefield" />
        <Zone title="スタック" zone={view.zones.stack} testId="table-display-zone-stack" />
        <Zone title="追放" zone={view.zones.exile} testId="table-display-zone-exile" />
        <Zone title="統率者領域" zone={view.zones.command} testId="table-display-zone-command" />
      </section>
    </main>
  );
}
