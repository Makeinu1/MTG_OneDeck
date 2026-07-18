/**
 * ThumbZone — 画面下の親指ゾーン(undo + プライマリアクション + メニュー)。
 * docs/design-system.md §8 PrimaryAction・docs/ui-architecture-v2.md §2。
 *
 * D2 の PrimaryAction は簡易版(スタック非空→解決 / 他→次のフェイズ)。完全な状態機械
 * (誘発を処理/攻撃を確定)は D3。スタック未解決中のフェイズ移動禁止(CLAUDE.md 唯一の強制)は
 * 「ボタンが自動で『解決』になる」ことで構造表現する(無効化グレーにしない)。
 */

import { useState } from 'react';
import { primaryActionModel } from './primaryAction';
import { celebrate } from './sound';
import { isSoundEnabled, setSoundEnabled } from './motion';
import { primaryActionLanguage } from './primaryActionDisplay';
import type { GameController } from './gameController';
import { ThemeToggle } from '../ThemeToggle';
import { Icon } from '../../ui/icons';

export interface ThumbZoneProps {
  controller: GameController;
  onOpenOpponentSetup?: () => void;
}

function GameMenuSheet({
  controller,
  onClose,
  onOpenOpponentSetup,
}: {
  controller: GameController;
  onClose: () => void;
  onOpenOpponentSetup?: () => void;
}) {
  const { store } = controller;
  const [sound, setSound] = useState(isSoundEnabled());
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };
  return (
    <div className="game-sheet-overlay" data-testid="game-menu-overlay" onClick={onClose}>
      <div className="game-sheet" data-testid="game-menu-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="game-sheet__header">
          <span className="game-sheet__title">メニュー</span>
          <button type="button" className="game-sheet__close" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="game-menu__actions">
          <div className="game-menu__theme" data-testid="menu-theme">
            <span>表示テーマ</span>
            <ThemeToggle compact />
          </div>
          <button type="button" className="game-menu__action" data-testid="menu-token" onClick={act(controller.openTokenDialog)}>
            トークン生成
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-opponent-setup" onClick={act(() => onOpenOpponentSetup?.())}>
            対戦相手セットアップ
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-attack" onClick={act(controller.openAttackDialog)}>
            攻撃
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-scry" onClick={act(controller.openArrangeTop)}>
            占術 / 諜報
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-graveyard" onClick={act(() => controller.openZoneViewer('graveyard'))}>
            墓地を見る
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-exile" onClick={act(() => controller.openZoneViewer('exile'))}>
            追放を見る
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-search" onClick={act(() => controller.openZoneViewer('library'))}>
            ライブラリを見る
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-opponent-board" onClick={act(controller.openOpponentBoard)}>
            相手盤面を見る
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-tap-all" onClick={act(() => store.tapAllPermanents())}>
            全てタップ
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-untap-all" onClick={act(() => store.untapAllPermanents())}>
            全てアンタップ
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-proliferate" onClick={act(() => store.proliferateAll())}>
            増殖
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-die" onClick={act(() => store.rollDie(20))}>
            ダイス(d20)
          </button>
          <button type="button" className="game-menu__action" data-testid="menu-coin" onClick={act(() => store.flipCoin())}>
            コイン
          </button>
          <button
            type="button"
            className="game-menu__action"
            data-testid="menu-auto-advance"
            onClick={act(() => store.setAutoAdvance(!store.autoAdvanceToMain))}
          >
            ターン開始: {store.autoAdvanceToMain ? '自動でメイン1まで' : 'フェイズごとに進む'}
          </button>
          <button
            type="button"
            className="game-menu__action"
            data-testid="menu-sound"
            onClick={() => {
              const next = !sound;
              setSoundEnabled(next);
              setSound(next);
            }}
          >
            音(演出): {sound ? 'ON' : 'OFF'}
          </button>
          <button type="button" className="game-menu__action game-menu__action--warn" data-testid="menu-restart" onClick={act(() => controller.requestConfirm('restart'))}>
            最初からやり直す
          </button>
          <button type="button" className="game-menu__action game-menu__action--warn" data-testid="menu-back" onClick={act(() => controller.requestConfirm('back-to-import'))}>
            デッキ選択に戻る
          </button>
        </div>
      </div>
    </div>
  );
}

export function ThumbZone({ controller, onOpenOpponentSetup }: ThumbZoneProps) {
  const { state, store } = controller;
  const [menuOpen, setMenuOpen] = useState(false);
  if (!state) return null;
  const stackActive = state.zones.stack.length > 0;
  const progressBlocked = stackActive || controller.triggerCandidateCount > 0;
  const primary = primaryActionModel(state, controller.triggerCandidateCount);
  const primaryLanguage = primaryActionLanguage(state, primary, controller.triggerCandidateCount);

  function runPrimary(): void {
    switch (primary.kind) {
      case 'resolve':
        controller.requestResolveTop(); // celebrate('resolve') はコントローラ内。
        break;
      case 'triggers':
        celebrate('primary');
        controller.processTriggers?.();
        break;
      case 'attack':
        celebrate('primary');
        controller.openAttackDialog();
        break;
      case 'next-phase':
        celebrate('primary');
        controller.advancePhase();
        break;
    }
  }

  return (
    <div className="thumb-zone" data-testid="thumb-zone">
      <button
        type="button"
        className="thumb-zone__icon-btn"
        data-testid="undo"
        disabled={!store.canUndo}
        onClick={controller.undo}
        title="元に戻す"
      >
        <Icon name="undo" />
      </button>

      <button
        type="button"
        className="thumb-zone__icon-btn"
        data-testid="redo"
        disabled={!store.canRedo}
        onClick={controller.redo}
        title="やり直す"
      >
        <Icon name="redo" />
      </button>

      <button
        type="button"
        className={`thumb-zone__primary${primary.glow ? ' thumb-zone__primary--stack' : ''}${primary.kind === 'next-phase' ? ' thumb-zone__primary--advance' : ''}`}
        data-testid="primary-action"
        data-kind={primary.kind}
        aria-label={primaryLanguage.full}
        title={primaryLanguage.full}
        onClick={runPrimary}
      >
        <Icon name={primaryLanguage.icon} />
        <span className="thumb-zone__primary-full">{primaryLanguage.full}</span>
        <span className="thumb-zone__primary-compact" aria-hidden="true">{primaryLanguage.compact}</span>
      </button>

      <button
        type="button"
        className="thumb-zone__icon-btn"
        data-testid="next-turn"
        disabled={progressBlocked}
        onClick={() => controller.advanceTurn()}
        title="次のターン"
      >
        <Icon name="turn-next" />
      </button>

      <button
        type="button"
        className="thumb-zone__icon-btn"
        data-testid="game-menu"
        onClick={() => setMenuOpen(true)}
        title="メニュー"
      >
        <Icon name="menu" />
      </button>

      {menuOpen && (
        <GameMenuSheet
          controller={controller}
          onClose={() => setMenuOpen(false)}
          onOpenOpponentSetup={onOpenOpponentSetup}
        />
      )}
    </div>
  );
}
