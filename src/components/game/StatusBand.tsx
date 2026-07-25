/**
 * StatusBand — 画面上端の1行。ターン/フェイズ + マナ + 自ライフ + ログ入口。
 * docs/design-system.md §8・docs/ui-architecture-v2.md §2。カードが主役(vision 原則7)ゆえ
 * 常設のゾーンラベル列・相手ライフ行は廃止し、高頻度の直接操作へ集約する。
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PHASE_ORDER } from '../../engine/types';
import { statusBandModel, PHASE_META } from './statusBandModel';
import { feedUnseenCount } from './feedProjection';
import { lifeFlashDirection } from './motion';
import { LifeSheet } from './LifeSheet';
import type { GameController } from './gameController';
import { manaReadinessModel } from './manaReadiness';
import { Icon } from '../../ui/icons';
import { RecentCue } from './RecentCue';
import { UpdateNotice } from './UpdateNotice';
import type { RecentCueKind } from './recentCueModel';

const MANA_LABELS = [
  { color: 'W', kanji: '白', name: '白マナ' },
  { color: 'U', kanji: '青', name: '青マナ' },
  { color: 'B', kanji: '黒', name: '黒マナ' },
  { color: 'R', kanji: '赤', name: '赤マナ' },
  { color: 'G', kanji: '緑', name: '緑マナ' },
  { color: 'C', kanji: '無', name: '無色マナ' },
] as const;

export interface StatusBandProps {
  controller: GameController;
}

export function StatusBand({ controller }: StatusBandProps) {
  const { state, store } = controller;
  const [lifeOpen, setLifeOpen] = useState(false);
  // ライフ変化の色フラッシュ(D5④)。hooks は早期 return より前。
  const life = controller.state?.life ?? null;
  const prevLife = useRef(life);
  const manaScrollRef = useRef<HTMLDivElement | null>(null);
  const [manaCanScrollRight, setManaCanScrollRight] = useState(false);
  const [lifeFlash, setLifeFlash] = useState<'gain' | 'loss' | null>(null);
  const [modeFlash, setModeFlash] = useState(false);
  const [recentCueKind, setRecentCueKind] = useState<RecentCueKind | null>(null);

  function updateManaScrollEdge(): void {
    const node = manaScrollRef.current;
    setManaCanScrollRight(Boolean(
      node && node.scrollLeft + node.clientWidth < node.scrollWidth - 1,
    ));
  }

  useLayoutEffect(() => {
    const node = manaScrollRef.current;
    if (!node) return;
    updateManaScrollEdge();
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateManaScrollEdge);
    observer?.observe(node);
    window.addEventListener('resize', updateManaScrollEdge);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateManaScrollEdge);
    };
  }, []);
  useEffect(() => {
    if (life !== null && prevLife.current !== null && life !== prevLife.current) {
      const dir = lifeFlashDirection(life - prevLife.current);
      if (dir !== 'none') {
        setLifeFlash(dir);
        const timer = setTimeout(() => setLifeFlash(null), 400);
        prevLife.current = life;
        return () => clearTimeout(timer);
      }
    }
    prevLife.current = life;
  }, [life]);
  useEffect(() => {
    if (!modeFlash) return;
    const timer = setTimeout(() => setModeFlash(false), 420);
    return () => clearTimeout(timer);
  }, [modeFlash]);
  if (!state) return null;
  const model = statusBandModel(state);
  const activePhaseIndex = PHASE_ORDER.indexOf(model.phase);
  const mana = manaReadinessModel(state);
  const unseen = feedUnseenCount(store.warnings, store.triggerCandidates);

  return (
    <div className="status-band" data-testid="status-band" data-stack-active={model.stackActive}>
      <div className="status-band__turn">
        <span className="status-band__turn-label">T</span>
        <span className="status-band__turn-num" data-testid="turn-indicator">
          {model.turn}
        </span>
      </div>

      <div className="status-band__phases" data-testid="phase-indicator" data-phase={model.phase} data-mode-flash={modeFlash || undefined}>
        <button
          type="button"
          className="status-band__phase-current"
          data-testid="current-phase-label"
          aria-pressed={store.autoAdvanceToMain}
          aria-label={`現在は${model.phaseLabel}。ターン開始は${store.autoAdvanceToMain ? '自動でメイン1まで進む' : 'フェイズごとに進む'}。押すと${store.autoAdvanceToMain ? '手動' : '自動'}へ切り替えます`}
          onClick={() => {
            store.setAutoAdvance(!store.autoAdvanceToMain);
            setModeFlash(true);
          }}
        >
          <strong>{model.phaseLabel}</strong>
          <span className="status-band__phase-mode" title={store.autoAdvanceToMain ? '自動進行' : '手動進行'}>
            <Icon name="auto" />{store.autoAdvanceToMain ? '自' : '手'}
          </span>
        </button>
        {PHASE_ORDER.map((phase, index) => (
          <span
            key={phase}
            data-phase-step={phase}
            className={`status-band__phase${phase === model.phase ? ' is-active' : ''}${index < activePhaseIndex ? ' is-done' : ''}`}
            title={PHASE_META[phase].label}
          >
            {PHASE_META[phase].short}
          </span>
        ))}
      </div>

      <div
        ref={manaScrollRef}
        className="status-band__mana"
        data-testid="mana-readiness"
        data-scroll-right={manaCanScrollRight || undefined}
        aria-label="マナプール色別調整"
        onScroll={updateManaScrollEdge}
      >
        <button
          type="button"
          className="status-band__mana-total"
          data-testid="mana-details"
          onClick={() => setLifeOpen(true)}
          title="マナの詳細を開く"
        >
          <strong>{mana.poolTotal}</strong>
        </button>
        <span className="status-band__mana-colors">
          {MANA_LABELS.map(({ color, kanji, name }) => (
            <span
              key={color}
              className="status-band__mana-stepper"
              data-mana={color}
              data-empty={mana.pool[color] === 0}
            >
              <button
                type="button"
                data-testid={`mana-minus-${color}`}
                aria-label={`${name}を1点減らす`}
                onClick={() => store.adjustMana(color, -1)}
              >−</button>
              <span title={`${name}${mana.pool[color]}点`} aria-label={`${name}${mana.pool[color]}点`}>
                {kanji}<strong>{mana.pool[color]}</strong>
              </span>
              <button
                type="button"
                data-testid={`mana-plus-${color}`}
                aria-label={`${name}を1点増やす`}
                onClick={() => store.adjustMana(color, 1)}
              >＋</button>
            </span>
          ))}
        </span>
      </div>

      <div className="status-band__event-slot" data-testid="status-event-slot">
        <RecentCue controller={controller} onKindChange={setRecentCueKind} />
        <UpdateNotice />
      </div>

      <div className="status-band__right-actions">
        <div className={`status-band__life-cluster${lifeFlash ? ` status-band__life--${lifeFlash}` : ''}`}>
          <button
            type="button"
            className="status-band__life-adjust"
            data-testid="life-minus"
            aria-label="ライフを1減らす"
            onClick={() => store.dispatch({ type: 'adjustLife', delta: -1 })}
          >
            −
          </button>
          <button
            type="button"
            className="status-band__life"
            data-testid="life-value"
            aria-label={`ライフ${model.life}。詳細を開く`}
            aria-live="polite"
            onClick={() => setLifeOpen(true)}
          >
            <span className="status-band__life-heart" aria-hidden="true">♥</span>
            {model.life}
          </button>
          <button
            type="button"
            className="status-band__life-adjust"
            data-testid="life-plus"
            aria-label="ライフを1増やす"
            onClick={() => store.dispatch({ type: 'adjustLife', delta: 1 })}
          >
            ＋
          </button>
        </div>
        <button
          type="button"
          className="status-band__bell"
          data-recent-kind={recentCueKind ?? undefined}
          data-testid="feed-bell"
          onClick={() => controller.openFeed()}
          title="フィード(誘発/警告/ログ)"
          aria-label="ログを開く"
        >
          <Icon name="bell" />
          {unseen > 0 && (
            <span className="status-band__bell-badge" data-testid="feed-badge">
              {unseen}
            </span>
          )}
        </button>
      </div>

      {lifeOpen && <LifeSheet controller={controller} onClose={() => setLifeOpen(false)} />}
    </div>
  );
}
