/**
 * GameScreen — 新レイアウトの唯一のルート(縦/横/デスクトップを CSS grid-template-areas で適応)。
 * docs/ui-architecture-v2.md §2・docs/design-playbook.md §3 D2。
 *
 * 規律: JSX での isPhone 分岐をしない(単一 adaptive tree)。3形態の出し分けは game.css の
 * grid-template-areas / media query のみで行う。ガイド解決ダイアログ等は controller.overlays。
 */

import { useGameController } from './gameController';
import { StatusBand } from './StatusBand';
import { StackBand } from './StackBand';
import { Board } from './Board';
import { LandRow } from './LandRow';
import { HandRibbon } from './HandRibbon';
import { ThumbZone } from './ThumbZone';
import type { KeybindingsMap } from '../../data/keybindings';
import './game.css';

export interface GameScreenProps {
  keybindings: KeybindingsMap;
}

export function GameScreen({ keybindings }: GameScreenProps) {
  const controller = useGameController({ keybindings });
  if (!controller.state) return null;

  return (
    <div className="game-screen" data-testid="game-screen">
      <div className="game-screen__status">
        <StatusBand controller={controller} />
      </div>
      <div className="game-screen__stack">
        <StackBand controller={controller} />
      </div>
      <div className="game-screen__board">
        <Board controller={controller} />
      </div>
      <div className="game-screen__lands">
        <LandRow controller={controller} />
      </div>
      <div className="game-screen__hand">
        <HandRibbon controller={controller} />
      </div>
      <div className="game-screen__thumb">
        <ThumbZone controller={controller} />
      </div>

      {controller.overlays}
    </div>
  );
}
