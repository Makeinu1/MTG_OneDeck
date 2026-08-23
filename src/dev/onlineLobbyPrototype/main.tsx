import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import './onlineLobbyPrototype.css';

export type PrototypeState = 'deck' | 'entry' | 'join' | 'recovery' | 'host' | 'guest' | 'error';

type Seat = {
  label: string;
  membership: string;
  deck: string;
  ready: string;
  local?: boolean;
};

const steps = ['入室済み', 'デッキ提出', '準備完了', '対戦開始'];
const hostSeats: Seat[] = [
  { label: 'あなた（ホスト）', membership: '入室済み', deck: '提出済み', ready: '準備完了', local: true },
  { label: 'プレイヤー2', membership: '入室済み', deck: 'デッキ未提出', ready: '未準備' },
  { label: 'プレイヤー3', membership: '入室済み', deck: '提出済み', ready: '準備完了' },
  { label: 'プレイヤー4', membership: '空席', deck: '—', ready: '—' },
];
const guestSeats: Seat[] = [
  { label: 'ホスト', membership: '入室済み', deck: '提出済み', ready: '準備完了' },
  { label: 'あなた', membership: '入室済み', deck: '未提出', ready: '未準備', local: true },
  { label: 'プレイヤー3', membership: '入室済み', deck: '提出済み', ready: '準備完了' },
  { label: 'プレイヤー4', membership: '空席', deck: '—', ready: '—' },
];

function Status({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' }) {
  return <span className={`olp-status olp-status--${tone}`}><span aria-hidden="true">{tone === 'good' ? '✓' : tone === 'warn' ? '!' : '·'}</span>{children}</span>;
}

function Stepper({ current }: { current: number }) {
  return <ol className="olp-stepper" aria-label="対戦の進行状況">{steps.map((step, index) => (
    <li key={step} aria-current={index === current ? 'step' : undefined} className={index === current ? 'is-current' : index < current ? 'is-done' : ''}>
      <span className="olp-stepper__index">{index < current ? '✓' : index + 1}</span><span>{step}</span>
    </li>
  ))}</ol>;
}

function DeckChoice({ onChange }: { onChange: (state: PrototypeState) => void }) {
  return <section className="olp-card" aria-labelledby="deck-heading">
    <p className="olp-eyebrow">保存済みデッキ</p><h2 id="deck-heading">遊ぶデッキを選ぶ</h2>
    <div className="olp-deck-card"><div><strong>《冬の星座》</strong><span>統率者デッキ · 100枚</span></div><Status tone="good">選択中</Status></div>
    <p className="olp-muted">選択したデッキから、次の遊び方を選べます。</p>
    <div className="olp-actions olp-actions--equal"><button className="olp-button olp-button--primary" onClick={() => onChange('entry')}>一人回し</button><button className="olp-button olp-button--primary" onClick={() => onChange('entry')}>オンライン対戦</button></div>
    <button className="olp-link" type="button">別のデッキを登録・インポート</button>
  </section>;
}

function Entry({ onChange }: { onChange: (state: PrototypeState) => void }) {
  return <section className="olp-card" aria-labelledby="entry-heading"><p className="olp-eyebrow">オンライン対戦</p><h2 id="entry-heading">対戦の入口</h2>
    <div className="olp-choice-grid"><button className="olp-choice" onClick={() => onChange('host')}><strong>部屋を作る</strong><span>招待を発行して、4人部屋を開く</span></button><button className="olp-choice" onClick={() => onChange('join')}><strong>招待で参加</strong><span>招待コードを1つ入力して参加する</span></button></div>
    <div className="olp-recovery-hint"><Status>進行中の対戦はありません</Status><button className="olp-link" onClick={() => onChange('recovery')}>復旧状態を確認</button></div>
  </section>;
}

function Join({ onChange }: { onChange: (state: PrototypeState) => void }) {
  return <section className="olp-card" aria-labelledby="join-heading"><p className="olp-eyebrow">オンライン対戦</p><h2 id="join-heading">招待で参加</h2><p>共有された招待コードを入力してください。</p><label className="olp-field">招待コード<input aria-label="招待コード" name="invite-code" inputMode="text" autoComplete="off" placeholder="招待コードを入力" /></label><div className="olp-actions"><button className="olp-button olp-button--primary" onClick={() => onChange('guest')}>ロビーに参加</button><button className="olp-button" onClick={() => onChange('entry')}>キャンセル</button></div></section>;
}

function Recovery({ onChange }: { onChange: (state: PrototypeState) => void }) {
  return <section className="olp-card" aria-labelledby="recovery-heading"><p className="olp-eyebrow">復旧</p><h2 id="recovery-heading">進行中の対戦に戻る</h2><p>このブラウザには、進行中のロビーが見つかりました。</p><div className="olp-recovery-record"><Status tone="good">再接続できます</Status><strong>《冬の星座》 · プレイヤー2</strong><span>最後に確認した状態：デッキ提出</span></div><div className="olp-actions"><button className="olp-button olp-button--primary" onClick={() => onChange('guest')}>対戦に戻る</button><button className="olp-button" onClick={() => onChange('entry')}>キャンセル</button></div></section>;
}

function InviteControls() {
  const [revealed, setRevealed] = useState(false);
  return <div className="olp-invite"><div><p className="olp-eyebrow">共有招待</p><strong>{revealed ? 'ABCD-EFGH' : '招待リンクを準備しました'}</strong><span>コードは必要なときだけ表示できます。</span></div><div className="olp-actions"><button className="olp-button" type="button">招待リンクをコピー</button><button className="olp-button" type="button">招待コードをコピー</button><button className="olp-link" type="button" onClick={() => setRevealed((value) => !value)}>{revealed ? 'コードを隠す' : 'コードを表示'}</button></div></div>;
}

function Lobby({ host, onChange }: { host: boolean; onChange: (state: PrototypeState) => void }) {
  const blockerText = host ? '空席 1 · プレイヤー2: デッキ未提出 · プレイヤー2: 未準備' : '';
  const lobbySeats = host ? hostSeats : guestSeats;
  const currentStep = host ? 3 : 1;
  return <section className="olp-card olp-lobby" aria-labelledby="lobby-heading"><div className="olp-lobby__heading"><div><p className="olp-eyebrow">オンライン対戦</p><h2 id="lobby-heading">対戦ロビー</h2></div><Status>接続中</Status></div><Stepper current={currentStep}/><div className="olp-deck-card"><div><strong>《冬の星座》</strong><span>{host ? '提出済み · 100枚' : '選択中 · 100枚'}</span></div><Status tone={host ? 'good' : 'warn'}>{host ? '受理済み' : '未提出'}</Status></div><div className="olp-actions">{host ? <><button className="olp-button">デッキを再提出</button><button className="olp-button olp-button--primary">準備完了を取り消す</button></> : <><button className="olp-button olp-button--primary">デッキを提出</button><button className="olp-button" disabled>準備完了にする</button></>}</div><div className="olp-seats" aria-label="参加者"><h3>参加メンバー</h3>{lobbySeats.map((seat) => <article className="olp-seat" key={seat.label}><div><strong>{seat.label}</strong><span>{seat.membership}</span></div><div className="olp-seat__state"><span>{seat.deck}</span><span>{seat.ready}</span></div>{seat.label !== 'あなた' && seat.label !== 'あなた（ホスト）' && seat.label !== 'ホスト' && seat.membership !== '空席' && host ? <button className="olp-link olp-link--danger" type="button">ロビーから外す</button> : null}</article>)}</div>{host ? <><InviteControls/><div className="olp-host-tools"><button className="olp-button" type="button">招待を再発行</button><button className="olp-button" type="button">参加受付を締める</button></div><div className="olp-blockers"><strong>開始条件</strong><span>{blockerText}</span><button className="olp-button olp-button--primary" disabled>対戦を開始</button></div></> : <p className="olp-waiting">ホストの開始を待っています</p>}<button className="olp-link" type="button" onClick={() => onChange('entry')}>ロビーを退出</button></section>;
}

function ErrorState({ onChange }: { onChange: (state: PrototypeState) => void }) {
  return <section className="olp-card" aria-labelledby="error-heading"><p className="olp-eyebrow">接続エラー</p><h2 id="error-heading">ロビーを更新できませんでした</h2><div className="olp-error" role="alert"><Status tone="warn">タイムアウト</Status><p>サーバーからの応答を待ちきれませんでした。接続を確認して、もう一度接続してください。</p><span>照会 ID: local-demo-42</span></div><div className="olp-actions"><button className="olp-button olp-button--primary" onClick={() => onChange('entry')}>もう一度接続</button><button className="olp-button" onClick={() => onChange('deck')}>デッキ選択へ戻る</button></div></section>;
}

export function OnlineLobbyPrototype() {
  const [state, setState] = useState<PrototypeState>('deck');
  const content = state === 'deck' ? <DeckChoice onChange={setState}/> : state === 'entry' ? <Entry onChange={setState}/> : state === 'join' ? <Join onChange={setState}/> : state === 'recovery' ? <Recovery onChange={setState}/> : state === 'host' ? <Lobby host onChange={setState}/> : state === 'guest' ? <Lobby host={false} onChange={setState}/> : <ErrorState onChange={setState}/>;
  return <main className="olp-shell"><header className="olp-header"><div><p className="olp-eyebrow">DEV FIXTURE · O4P-08B</p><h1>OneDeck オンライン</h1></div><label className="olp-state-picker">表示状態<select aria-label="表示状態" value={state} onChange={(event) => setState(event.target.value as PrototypeState)}><option value="deck">デッキ選択</option><option value="entry">オンライン入口</option><option value="join">招待で参加</option><option value="recovery">復旧</option><option value="host">ホストロビー</option><option value="guest">ゲストロビー</option><option value="error">エラー</option></select></label></header><p className="olp-fixture-note">本番接続なしの表示確認用。状態を切り替えて階層・文言・密度を確認できます。</p>{content}</main>;
}

const root = document.getElementById('root');
const fixtureRoot = root ? createRoot(root) : null;
fixtureRoot?.render(<OnlineLobbyPrototype/>);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    fixtureRoot?.unmount();
  });
}
