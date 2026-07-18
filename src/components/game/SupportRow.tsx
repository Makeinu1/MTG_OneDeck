import { useDroppable } from '@dnd-kit/core';
import { useMemo, type CSSProperties } from 'react';
import { BattlefieldShelf } from './Board';
import { CommanderAltar } from './CommanderAltar';
import { LandRow } from './LandRow';
import { landVisualUnitCount } from './landRowModel';
import { computeAdaptiveLaneLayout, useElementSize } from './adaptiveLaneLayout';
import { projectBattlefield } from './battlefieldProjection';
import type { GameController } from './gameController';
import { isLandCard, type DropTarget } from './dragIntent';

export function SupportRow({
  controller,
  activeDragId,
}: {
  controller: GameController;
  activeDragId?: string | null;
}) {
  const state = controller.state;
  const activeCard = state && activeDragId ? state.cards[activeDragId] : undefined;
  let dropTarget: DropTarget | null = null;
  if (state && activeCard && !isLandCard(state, activeCard.id)) {
    dropTarget = activeCard.zone === 'hand' || activeCard.zone === 'command'
      ? { kind: 'cast' }
      : activeCard.zone === 'battlefield'
        ? null
        : { kind: 'move-zone', zone: 'battlefield' };
  }
  const { setNodeRef, isOver } = useDroppable({
    id: 'game-support-row-drop',
    disabled: dropTarget === null,
    data: { dropTarget },
  });
  const { setNode: setMeasuredNode, width: rowWidth, height: rowHeight } = useElementSize<HTMLDivElement>();
  const projection = useMemo(() => state ? projectBattlefield(state) : null, [state]);
  if (!state || !projection) return null;
  const landUnits = landVisualUnitCount(state, projection.lands);
  const supportUnits = projection.support.length;
  const totalUnits = landUnits + supportUnits;
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const commanderWidth = viewportWidth < 900 ? 52 : viewportWidth >= 1400 ? 260 : 224;
  const layout = computeAdaptiveLaneLayout({
    width: Math.max(112, rowWidth - commanderWidth - 18),
    height: rowHeight > 0 ? Math.max(1, rowHeight - 16) : 156,
    count: totalUnits,
    preferredWidth: 112,
    wrapWidth: 72,
  });
  const landShare = landUnits === 0 ? 0 : Math.max(1, landUnits);
  const supportShare = supportUnits === 0 ? 0 : Math.max(1, supportUnits);
  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        setMeasuredNode(node);
      }}
      className="support-row"
      data-testid="support-row"
      data-has-lands={projection.lands.length > 0 || undefined}
      data-has-support={projection.support.length > 0 || undefined}
      data-drop-over={isOver || undefined}
      style={{
        '--support-card-w': `${layout.cardWidth}px`,
        '--support-rows': layout.rows,
        '--support-land-share': `${landShare}fr`,
        '--support-other-share': `${supportShare}fr`,
      } as CSSProperties}
    >
      <CommanderAltar controller={controller} activeDragId={activeDragId} />
      <div className="support-row__lands">
        <LandRow controller={controller} activeDragId={activeDragId} cardIds={projection.lands} />
      </div>
      <div className="support-row__others">
        <BattlefieldShelf
          controller={controller}
          bundles={projection.support}
          attachmentsByHost={projection.attachmentsByHost}
          testId="board-others"
          emptyLabel="その他"
          role="support"
          sharedCardWidth={layout.cardWidth}
          sharedRows={layout.rows}
        />
      </div>
      {dropTarget && (
        <div className="semantic-drop semantic-drop--support" aria-hidden>
          {dropTarget.kind === 'cast' ? '唱える → スタック' : '戦場へ移す'}
        </div>
      )}
    </div>
  );
}
