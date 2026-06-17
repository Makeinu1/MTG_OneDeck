import { computeGameInfo } from '../../data/gameInfo';
import type { GameState } from '../../engine/types';
import { Modal } from '../Modal';

const DEVOTION_COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
const DEVOTION_LABELS = {
  W: '白',
  U: '青',
  B: '黒',
  R: '赤',
  G: '緑',
} as const;

export interface InfoPanelProps {
  state: GameState;
  onClose: () => void;
}

export function InfoPanel({ state, onClose }: InfoPanelProps) {
  const info = computeGameInfo(state);

  return (
    <Modal title="情報" onClose={onClose} width="sm" testId="game-info">
      <div className="info-panel">
        <div className="info-panel__grid">
          <div className="info-panel__card">
            <span className="info-panel__label">ストーム</span>
            <span className="info-panel__value" data-testid="game-info-storm">
              {info.storm}
            </span>
          </div>
          <div className="info-panel__card">
            <span className="info-panel__label">今ターンの土地</span>
            <span className="info-panel__value" data-testid="game-info-lands">
              {info.landsThisTurn}
            </span>
          </div>
          <div className="info-panel__card">
            <span className="info-panel__label">今ターンのドロー</span>
            <span className="info-panel__value" data-testid="game-info-draws">
              {info.drawsThisTurn}
            </span>
          </div>
        </div>

        <section className="info-panel__section" aria-labelledby="game-info-devotion-heading">
          <h3 id="game-info-devotion-heading">信心</h3>
          <div className="info-panel__devotion">
            {DEVOTION_COLORS.map((color) => (
              <div key={color} className={`info-panel__devotion-item info-panel__devotion-item--${color}`}>
                <span className="info-panel__devotion-label">{DEVOTION_LABELS[color]}</span>
                <span className="info-panel__devotion-value" data-testid={`game-info-devotion-${color}`}>
                  {info.devotion[color]}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="dialog__actions">
          <button type="button" className="btn btn--accent" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </Modal>
  );
}
