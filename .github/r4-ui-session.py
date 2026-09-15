from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}")
    target.write_text(text.replace(old, new, 1))


path = "src/components/game/CockpitSessionScreen.tsx"
replace_once(path, """  manaColors,
  tableManaResources,
  tableCastPayment,
  tableZones,
""", """  manaColors,
  tableManaResources,
  tableZones,
""")
replace_once(path, """import {
  captureExpectedInteractionContext,
  type ExpectedInteractionContext,
  type R31TableOperation,
} from '../../engine/cockpitR31';
""", """import {
  captureExpectedInteractionContext,
  type ExpectedInteractionContext,
  type R31TableOperation,
} from '../../engine/cockpitR31';
import {
  emptyR4CastAdditionalCosts,
  r4CastPayment,
  type R4CastAdditionalCosts,
  type R4CastSourceZone,
  type R4TableOperation,
} from '../../engine/cockpitR4';
""")
replace_once(path, """import { CockpitManaBatch } from './CockpitManaBatch';
import { liveStackDetail } from './cockpitTransientSelections';
""", """import { CockpitManaBatch } from './CockpitManaBatch';
import { CockpitCastAdditionalCosts } from './CockpitCastAdditionalCosts';
import { liveStackDetail } from './cockpitTransientSelections';
""")
replace_once(path, """const zoneLabels: Record<ZoneId, string> = {
  hand: '手札',
  library: '山札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率領域',
  stack: 'スタック',
};
""", """const zoneLabels: Record<ZoneId, string> = {
  hand: '手札',
  library: '山札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率領域',
  stack: 'スタック',
};
const r4CastSourceZones: readonly R4CastSourceZone[] = [
  'hand',
  'command',
  'graveyard',
  'exile',
  'library',
];
const isR4CastSourceZone = (zone: ZoneId): zone is R4CastSourceZone =>
  r4CastSourceZones.includes(zone as R4CastSourceZone);
""")
replace_once(path, """  const [cast, setCast] = useState<{
    cardId: string;
    x: number;
    excludedSourceIds: string[];
    manualManaCost: string | null;
    costNote: string;
    targets: string[];
    paymentPlan: GameCommand[];
    error: string;
    context: ExpectedInteractionContext;
  } | null>(null);
""", """  const [cast, setCast] = useState<{
    cardId: string;
    sourceZone: R4CastSourceZone;
    x: number;
    excludedSourceIds: string[];
    manualManaCost: string | null;
    costNote: string;
    targets: string[];
    additionalCosts: R4CastAdditionalCosts;
    paymentPlan: GameCommand[];
    additionalCostPlan: GameCommand[];
    error: string;
    context: ExpectedInteractionContext;
  } | null>(null);
""")
replace_once(path, """  async function send(
    operation: TableOperation | R31TableOperation | { type: 'undo' } | { type: 'redo' },
    expectedContext?: ExpectedInteractionContext,
  ) {
""", """  async function send(
    operation:
      | TableOperation
      | R31TableOperation
      | R4TableOperation
      | { type: 'undo' }
      | { type: 'redo' },
    expectedContext?: ExpectedInteractionContext,
  ) {
""")
replace_once(path, """      const moving =
        presentsDraw ||
        ['keep', 'move', 'activate', 'resolve.finish', 'resolve.fetch'].includes(operation.type);
""", """      const moving =
        presentsDraw ||
        ['keep', 'move', 'playLand', 'cast', 'activate', 'resolve.finish', 'resolve.fetch'].includes(
          operation.type,
        );
""")
replace_once(path, """  function prepareCast(
    cardId: string,
    x = 0,
    excludedSourceIds: string[] = [],
    targets = selected.filter((id) => id !== cardId),
    manualManaCost: string | null = cast?.cardId === cardId ? cast.manualManaCost : null,
    costNote = cast?.cardId === cardId ? cast.costNote : '',
  ) {
    let paymentPlan: GameCommand[] = [];
    let error = '';
    try {
      paymentPlan = tableCastPayment(table, cardId, x, excludedSourceIds, manualManaCost, costNote);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'マナ支援の条件を確認してください。';
    }
    setDetail(null);
    setCastPeek(false);
    setCast({
      cardId,
      x,
      excludedSourceIds,
      manualManaCost,
      costNote,
      targets,
      paymentPlan,
      error,
      context:
        cast?.cardId === cardId ? cast.context : captureExpectedInteractionContext(table),
    });
  }
""", """  function prepareCast(
    cardId: string,
    x = 0,
    excludedSourceIds: string[] = [],
    targets = selected.filter(
      (id) => id !== cardId && !['hand', 'library'].includes(table.cards[id]?.zone ?? ''),
    ),
    manualManaCost: string | null = cast?.cardId === cardId ? cast.manualManaCost : null,
    costNote = cast?.cardId === cardId ? cast.costNote : '',
    additionalCosts: R4CastAdditionalCosts =
      cast?.cardId === cardId ? cast.additionalCosts : emptyR4CastAdditionalCosts(),
  ) {
    const previous = cast?.cardId === cardId ? cast : null;
    const card = table.cards[cardId];
    const sourceZone =
      previous?.sourceZone ?? (card && isR4CastSourceZone(card.zone) ? card.zone : null);
    if (!sourceZone) {
      setOperationError(true);
      setMessage('この領域からは「唱える」を開始できません。');
      return;
    }
    let paymentPlan: GameCommand[] = [];
    let additionalCostPlan: GameCommand[] = [];
    let error = '';
    try {
      const plans = r4CastPayment(table, {
        cardId,
        x,
        excludedSourceIds,
        manualManaCost,
        costNote,
        additionalCosts,
      });
      paymentPlan = plans.paymentPlan;
      additionalCostPlan = plans.additionalCostPlan;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '支払い条件を確認してください。';
    }
    setDetail(null);
    setCastPeek(false);
    setCast({
      cardId,
      sourceZone,
      x,
      excludedSourceIds,
      manualManaCost,
      costNote,
      targets,
      additionalCosts,
      paymentPlan,
      additionalCostPlan,
      error,
      context: previous?.context ?? captureExpectedInteractionContext(table),
    });
  }
""")
replace_once(path, """                    void send({
                      type: 'move',
                      ids: [detailCard.id],
                      to: 'battlefield',
                      position: 'top',
                    }).then((saved) => {
""", """                    void send({
                      type: 'playLand',
                      cardId: detailCard.id,
                    }).then((saved) => {
""")
replace_once(path, """            {['hand', 'command'].includes(detailCard.zone) &&
              !/\\bLand\\b/.test(detailDef?.faces[detailCard.faceIndex]?.typeLine ?? '') && (
""", """            {isR4CastSourceZone(detailCard.zone) &&
              !/\\bLand\\b/.test(detailDef?.faces[detailCard.faceIndex]?.typeLine ?? '') && (
""")
replace_once(path, """                    <p>
                      非マナコストは必要な基本操作で先に確定して記録し、ここで二重に払いません。手動指定は合法性の自動確認ではありません。
                    </p>
""", """                    <p>
                      マナ以外の追加コストは下の有限項目で選ぶと、この「唱える」と同じ確定操作で支払います。手動指定は合法性の自動確認ではありません。
                    </p>
""")
replace_once(path, """              <details>
                <summary>対象を変更</summary>
""", """              <CockpitCastAdditionalCosts
                table={table}
                castCardId={cast.cardId}
                selected={selected}
                costs={cast.additionalCosts}
                disabled={disabled}
                label={label}
                onChange={(additionalCosts) =>
                  prepareCast(
                    cast.cardId,
                    cast.x,
                    cast.excludedSourceIds,
                    cast.targets,
                    cast.manualManaCost,
                    cast.costNote,
                    additionalCosts,
                  )
                }
              />
              <details>
                <summary>対象を変更</summary>
""")
replace_once(path, """                          ...selected.filter((id) => id !== cast.cardId),
""", """                          ...selected.filter(
                            (id) =>
                              id !== cast.cardId &&
                              !['hand', 'library'].includes(table.cards[id]?.zone ?? ''),
                          ),
""")
replace_once(path, """                {!cast.error && !cast.paymentPlan.length && <p>マナの消費はありません。</p>}
                <ul>
                  {cast.paymentPlan.map((command, index) => (
                    <li key={index}>{cockpitCostText(command, label)}</li>
                  ))}
                </ul>
""", """                {!cast.error &&
                  !cast.paymentPlan.length &&
                  !cast.additionalCostPlan.length && <p>支払い操作はありません。</p>}
                <ul>
                  {[...cast.paymentPlan, ...cast.additionalCostPlan].map((command, index) => (
                    <li key={index}>{cockpitCostText(command, label)}</li>
                  ))}
                </ul>
""")
replace_once(path, """                      type: 'cast',
                      cardId: cast.cardId,
                      targets: cast.targets,
                      x: cast.x,
                      excludedSourceIds: cast.excludedSourceIds,
                      manualManaCost: cast.manualManaCost,
                      costNote: cast.costNote,
                      paymentPlan: cast.paymentPlan,
""", """                      type: 'cast',
                      cardId: cast.cardId,
                      sourceZone: cast.sourceZone,
                      targets: cast.targets,
                      x: cast.x,
                      excludedSourceIds: cast.excludedSourceIds,
                      manualManaCost: cast.manualManaCost,
                      costNote: cast.costNote,
                      paymentPlan: cast.paymentPlan,
                      additionalCosts: cast.additionalCosts,
""")
