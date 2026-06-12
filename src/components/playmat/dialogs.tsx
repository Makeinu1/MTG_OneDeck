import { useState } from 'react';
import { Modal } from '../Modal';
import type { ManaColor } from '../../types/card';
import type { CardDef } from '../../types/card';
import type { CardInstance, GameState, ZoneId } from '../../engine/types';
import { isCommander } from '../../engine/commander';
import { CardView } from '../CardView';

const MANA_LABELS: Record<ManaColor, string> = {
  W: '白',
  U: '青',
  B: '黒',
  R: '赤',
  G: '緑',
  C: '無色',
};

/** Popup asking which color to add when a multi-color mana source is tapped. */
export function ManaChoiceDialog({
  options,
  onChoose,
  onCancel,
}: {
  options: ManaColor[];
  onChoose: (color: ManaColor) => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="マナの色を選択" onClose={onCancel} width="sm" testId="mana-choice-dialog">
      <div className="mana-choice">
        {options.map((color) => (
          <button
            key={color}
            type="button"
            className={`mana-choice__swatch mana-choice__swatch--${color.toLowerCase()}`}
            onClick={() => onChoose(color)}
            data-testid={`mana-choice-${color}`}
          >
            {MANA_LABELS[color]}
            <span className="mana-choice__symbol">{color}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Confirmation dialog when a cast would leave mana unpaid. */
export function ShortfallDialog({
  shortfall,
  onForce,
  onCancel,
}: {
  shortfall: number;
  onForce: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="マナが不足しています" onClose={onCancel} width="sm" testId="shortfall-dialog">
      <p>
        マナが <strong>{shortfall}</strong> 点不足しています。強行してキャストしますか?
      </p>
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel} data-testid="shortfall-cancel">
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={onForce}
          data-testid="shortfall-force"
        >
          強行する
        </button>
      </div>
    </Modal>
  );
}

/** Dialog for choosing where a moving commander should go (incl. command zone). */
export function CommanderMoveDialog({
  cardName,
  destinationLabel,
  onChoose,
  onCancel,
}: {
  cardName: string;
  destinationLabel: string;
  onChoose: (toCommandZone: boolean) => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="統率者の移動先" onClose={onCancel} width="sm" testId="commander-move-dialog">
      <p>
        《{cardName}》は統率者です。{destinationLabel}に送る代わりに統率領域へ戻しますか?
      </p>
      <div className="dialog__actions">
        <button
          type="button"
          className="btn"
          onClick={() => onChoose(false)}
          data-testid="commander-move-keep"
        >
          {destinationLabel}へ送る
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => onChoose(true)}
          data-testid="commander-move-command"
        >
          統率領域へ戻す
        </button>
      </div>
    </Modal>
  );
}

/** Token creation dialog: name, type line, P/T, quantity. */
export function TokenCreateDialog({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string, typeLine: string, power: string, toughness: string, qty: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [typeLine, setTypeLine] = useState('Creature — Token');
  const [power, setPower] = useState('');
  const [toughness, setToughness] = useState('');
  const [qty, setQty] = useState(1);

  const canCreate = name.trim() !== '' && typeLine.trim() !== '' && qty >= 1;

  return (
    <Modal title="トークンを生成" onClose={onCancel} width="sm" testId="token-create-dialog">
      <div className="form-grid">
        <label>
          名前
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="token-name"
            placeholder="例: 兵士"
            autoFocus
          />
        </label>
        <label>
          タイプ
          <input
            type="text"
            value={typeLine}
            onChange={(e) => setTypeLine(e.target.value)}
            data-testid="token-type"
            placeholder="例: Creature — Soldier"
          />
        </label>
        <div className="form-grid__row">
          <label>
            パワー
            <input
              type="text"
              value={power}
              onChange={(e) => setPower(e.target.value)}
              data-testid="token-power"
              placeholder="1"
            />
          </label>
          <label>
            タフネス
            <input
              type="text"
              value={toughness}
              onChange={(e) => setToughness(e.target.value)}
              data-testid="token-toughness"
              placeholder="1"
            />
          </label>
          <label>
            個数
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
              data-testid="token-qty"
            />
          </label>
        </div>
      </div>
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
        <button
          type="button"
          className="btn btn--accent"
          disabled={!canCreate}
          onClick={() => onCreate(name.trim(), typeLine.trim(), power.trim(), toughness.trim(), qty)}
          data-testid="token-create-confirm"
        >
          生成
        </button>
      </div>
    </Modal>
  );
}

const ZONE_TITLES: Record<ZoneId, string> = {
  library: 'ライブラリ',
  hand: '手札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率領域',
};

/** Modal listing every card in a zone with a per-card move menu. */
export function ZoneViewerDialog({
  zone,
  cardIds,
  state,
  onMove,
  onClose,
}: {
  zone: ZoneId;
  cardIds: string[];
  state: GameState;
  onMove: (cardId: string, to: ZoneId) => void;
  onClose: () => void;
}) {
  const allTargets: { zone: ZoneId; label: string }[] = [
    { zone: 'hand', label: '手札へ' },
    { zone: 'battlefield', label: '戦場へ' },
    { zone: 'graveyard', label: '墓地へ' },
    { zone: 'exile', label: '追放へ' },
    { zone: 'library', label: 'ライブラリ最上部へ' },
    { zone: 'command', label: '統率領域へ' },
  ];
  const targets = allTargets.filter((t) => t.zone !== zone);

  return (
    <Modal title={ZONE_TITLES[zone]} onClose={onClose} width="lg" testId={`${zone}-viewer-dialog`}>
      {cardIds.length === 0 ? (
        <p className="zone-viewer__empty">カードはありません。</p>
      ) : (
        <ul className="zone-viewer__list">
          {cardIds.map((id) => {
            const card: CardInstance | undefined = state.cards[id];
            const def: CardDef | undefined = card ? state.defs[card.defId] : undefined;
            const face = card ? def?.faces[card.faceIndex] ?? def?.faces[0] : undefined;
            const displayName = face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
            return (
              <li key={id} className="zone-viewer__item">
                <div className="zone-viewer__thumb">
                  {card && def && <CardView instance={card} def={def} size="small" />}
                </div>
                <div className="zone-viewer__info">
                  <span className="zone-viewer__name">
                    {displayName}
                    {card && isCommander(state, card.id) && (
                      <span className="zone-viewer__badge">統率者</span>
                    )}
                  </span>
                  <div className="zone-viewer__targets">
                    {targets.map((t) => (
                      <button
                        key={t.zone}
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => onMove(id, t.zone)}
                        data-testid={`move-${id}-${t.zone}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** Small floating menu near the library zone: draw / shuffle / open viewer. */
export function LibraryMenu({
  x,
  y,
  onDraw,
  onShuffle,
  onView,
  onClose,
}: {
  x: number;
  y: number;
  onDraw: () => void;
  onShuffle: () => void;
  onView: () => void;
  onClose: () => void;
}) {
  return (
    <div className="context-menu" style={{ left: x, top: y }} role="menu">
      <ul>
        <li>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDraw();
              onClose();
            }}
            data-testid="library-draw"
          >
            1枚引く
          </button>
        </li>
        <li>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onShuffle();
              onClose();
            }}
            data-testid="library-shuffle"
          >
            シャッフル
          </button>
        </li>
        <li>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onView();
              onClose();
            }}
            data-testid="library-view"
          >
            ライブラリを見る
          </button>
        </li>
      </ul>
    </div>
  );
}

/** Mulligan: choose which cards from hand go to the bottom of the library. */
export function MulliganBottomDialog({
  cardIds,
  state,
  count,
  onConfirm,
}: {
  cardIds: string[];
  state: GameState;
  count: number;
  onConfirm: (chosen: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string): void {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= count) return prev;
      return [...prev, id];
    });
  }

  return (
    <Modal title="マリガン: ライブラリの下に戻すカード" width="lg" testId="mulligan-bottom-dialog">
      <p>
        {count}枚を選んでライブラリの一番下に戻してください。(選択中: {selected.length} / {count})
      </p>
      <div className="mulligan-grid">
        {cardIds.map((id) => {
          const card = state.cards[id];
          const def = card ? state.defs[card.defId] : undefined;
          if (!card || !def) return null;
          const chosen = selected.includes(id);
          return (
            <div
              key={id}
              className={`mulligan-grid__item ${chosen ? 'mulligan-grid__item--chosen' : ''}`}
              onClick={() => toggle(id)}
              data-testid={`mulligan-pick-${id}`}
            >
              <CardView instance={card} def={def} size="small" />
              {chosen && <div className="mulligan-grid__check">戻す</div>}
            </div>
          );
        })}
      </div>
      <div className="dialog__actions">
        <button
          type="button"
          className="btn btn--accent"
          disabled={selected.length !== count}
          onClick={() => onConfirm(selected)}
          data-testid="mulligan-bottom-confirm"
        >
          決定
        </button>
      </div>
    </Modal>
  );
}
