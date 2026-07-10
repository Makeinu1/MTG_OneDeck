/**
 * Feed — ログ/誘発/警告の統合タイムライン(浮動 Toasts / TriggerCandidatePanel の後継)。
 * docs/design-system.md §8 Feed・docs/ui-architecture-v2.md §3。
 *
 * gameStore の warnings / triggerCandidates / ログの投影(feedProjection・独自真実なし)。
 * 誘発項目は「スタックへ/無視」を内蔵。undo でログが縮むと項目も自然に縮む。
 */

import { projectFeed } from './feedProjection';
import type { GameController } from './gameController';

export interface FeedProps {
  controller: GameController;
  onClose: () => void;
}

export function Feed({ controller, onClose }: FeedProps) {
  const { state, store } = controller;
  if (!state) return null;
  const items = projectFeed(store.warnings, store.triggerCandidates, state.log);

  function placeTrigger(sourceId?: string, pendingTriggerId?: string, abilityLineIndex?: number): void {
    if (pendingTriggerId) {
      store.putPendingTriggerOnStack(pendingTriggerId);
      return;
    }
    if (sourceId) store.addAbilityToStack(sourceId, 'triggered', abilityLineIndex);
  }

  return (
    <div className="game-sheet-overlay game-sheet-overlay--feed" data-testid="feed-overlay" onClick={onClose}>
      <div className="feed" data-testid="feed" onClick={(e) => e.stopPropagation()}>
        <div className="game-sheet__header">
          <span className="game-sheet__title">フィード</span>
          <div className="feed__head-actions">
            {store.triggerCandidates.length > 0 && (
              <button type="button" className="life-sheet__mini" data-testid="feed-triggers-ignore-all" onClick={() => store.dismissTriggerCandidates()}>
                誘発を全て無視
              </button>
            )}
            {store.warnings.length > 0 && (
              <button type="button" className="life-sheet__mini" data-testid="feed-clear-warnings" onClick={() => store.clearWarnings()}>
                警告を消す
              </button>
            )}
            <button type="button" className="game-sheet__close" onClick={onClose} data-testid="feed-close">
              閉じる
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="feed__empty" data-testid="feed-empty">
            まだ記録はありません。
          </p>
        ) : (
          <ul className="feed__list" data-testid="feed-list">
            {items.map((item) => (
              <li key={item.id} className={`feed__item feed__item--${item.kind}`} data-testid={`feed-item-${item.kind}`}>
                <span className="feed__text">{item.text}</span>
                {item.kind === 'trigger' && (
                  <span className="feed__actions">
                    <button
                      type="button"
                      className="feed__act feed__act--primary"
                      data-testid={`feed-trigger-stack-${item.sourceId}`}
                      onClick={() => placeTrigger(item.sourceId, item.pendingTriggerId, item.abilityLineIndex)}
                    >
                      スタックへ
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
