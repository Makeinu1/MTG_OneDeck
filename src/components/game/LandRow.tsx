/**
 * LandRow — 土地行(盤面下・手札上の横スクロール1行)。docs/design-system.md §8。
 * 同名の基本地形はずらし重ね(×n)、特殊地形は個別、統率者は左端に金枠で常駐。
 *
 * 乖離記録(D2): §206 の「束シート(一括タップ)」は本スライスでは未実装。束内の各カードは
 * 重ねたまま個別に右クリック/タップで操作可能(情報の非破壊は保つ)。一括タップの利便は D3/D4 へ。
 */

import type { GameState } from '../../engine/types';
import { isCommander } from '../../engine/commander';
import { GameCard } from './GameCard';
import { bundleLands, type LandRowCard, type LandBundle } from './landRowModel';
import type { GameController } from './gameController';

function faceOf(state: GameState, cardId: string) {
  const card = state.cards[cardId];
  const def = card ? state.defs[card.defId] : undefined;
  return { card, def, face: def?.faces[card?.faceIndex ?? 0] ?? def?.faces[0] };
}

function toLandRowCard(state: GameState, cardId: string): LandRowCard | null {
  const { card, face, def } = faceOf(state, cardId);
  if (!card) return null;
  const typeLine = face?.typeLine ?? def?.typeLine ?? '';
  if (!typeLine.includes('Land')) return null;
  return {
    id: cardId,
    name: face?.name ?? def?.name ?? cardId,
    isBasic: typeLine.includes('Basic'),
    tapped: card.tapped,
  };
}

function Bundle({ controller, bundle }: { controller: GameController; bundle: LandBundle }) {
  const multi = bundle.cardIds.length > 1;
  return (
    <div
      className="land-bundle"
      data-testid={`land-bundle-${bundle.key}`}
      data-tapped={bundle.tappedCount > 0}
    >
      {bundle.cardIds.map((cardId, index) => (
        <div className="land-bundle__slot" style={{ zIndex: bundle.cardIds.length - index }} key={cardId}>
          <GameCard controller={controller} cardId={cardId} size="board" />
        </div>
      ))}
      {multi && (
        <span className="land-bundle__count" data-testid={`land-bundle-count-${bundle.key}`}>
          ×{bundle.cardIds.length}
        </span>
      )}
      {bundle.tappedCount > 0 && multi && (
        <span className="land-bundle__tapped" title="タップ済みを含む">
          {bundle.tappedCount}⤵
        </span>
      )}
    </div>
  );
}

export interface LandRowProps {
  controller: GameController;
}

export function LandRow({ controller }: LandRowProps) {
  const { state } = controller;
  if (!state) return null;

  const commanderIds = state.zones.command.filter((id) => isCommander(state, id));
  const landCards = state.zones.battlefield
    .map((id) => toLandRowCard(state, id))
    .filter((c): c is LandRowCard => c !== null);
  const bundles = bundleLands(landCards);

  return (
    <div className="land-row" data-testid="land-row">
      {commanderIds.length > 0 && (
        <div className="land-row__commander" data-testid="land-row-commander">
          {commanderIds.map((cardId) => (
            <GameCard key={cardId} controller={controller} cardId={cardId} size="board" />
          ))}
        </div>
      )}
      <div className="land-row__lands">
        {bundles.map((bundle) => (
          <Bundle key={bundle.key} controller={controller} bundle={bundle} />
        ))}
      </div>
    </div>
  );
}
