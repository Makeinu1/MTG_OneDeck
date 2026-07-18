/**
 * ManualKeywordsDialog — 手動キーワード付与ダイアログ。
 * 旧 Playmat.tsx のローカルコンポーネントを game/ レーンへ抽出(D2)。
 * 旧 Playmat は無編集(ロールバック経路保全)ゆえ当面は二重定義=D4 で Playmat 側を退役。
 */

import { Modal } from '../Modal';
import { normalizeKeywords, type Keyword } from '../../engine/status';
import { useInteractionHistory } from '../../hooks/useInteractionHistory';

const MANUAL_KEYWORD_OPTIONS: ReadonlyArray<{ id: Keyword; label: string }> = [
  { id: 'flying', label: '飛行' },
  { id: 'vigilance', label: '警戒' },
  { id: 'trample', label: 'トランプル' },
  { id: 'deathtouch', label: '接死' },
  { id: 'lifelink', label: '絆魂' },
  { id: 'menace', label: '威迫' },
  { id: 'first-strike', label: '先制攻撃' },
  { id: 'double-strike', label: '二段攻撃' },
  { id: 'reach', label: '到達' },
  { id: 'haste', label: '速攻' },
  { id: 'hexproof', label: '呪禁' },
  { id: 'indestructible', label: '破壊不能' },
  { id: 'defender', label: '防衛' },
  { id: 'ward', label: '護法' },
];

export interface ManualKeywordsDialogProps {
  cardName: string;
  initialKeywords: readonly string[] | undefined;
  onConfirm: (keywords: Keyword[]) => void;
  onCancel: () => void;
}

export function ManualKeywordsDialog({
  cardName,
  initialKeywords,
  onConfirm,
  onCancel,
}: ManualKeywordsDialogProps) {
  const [selected, setSelected] = useInteractionHistory<Set<Keyword>>(
    new Set(normalizeKeywords(initialKeywords)),
    onCancel,
  );

  function setKeyword(keyword: Keyword, checked: boolean): void {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(keyword);
      else next.delete(keyword);
      return next;
    });
  }

  function selectedKeywords(): Keyword[] {
    return MANUAL_KEYWORD_OPTIONS.flatMap((option) => (selected.has(option.id) ? [option.id] : []));
  }

  return (
    <Modal title="手動キーワード" onClose={onCancel} width="sm" testId="manual-keywords-dialog">
      <div className="manual-keywords">
        <p className="manual-keywords__card">《{cardName}》</p>
        <div className="manual-keywords__grid">
          {MANUAL_KEYWORD_OPTIONS.map((option) => (
            <label key={option.id} className="manual-keywords__option">
              <input
                type="checkbox"
                checked={selected.has(option.id)}
                onChange={(event) => setKeyword(option.id, event.currentTarget.checked)}
                data-testid={`manual-kw-${option.id}`}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <div className="dialog__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onCancel}
            data-testid="manual-keywords-cancel"
          >
            キャンセル
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onConfirm(selectedKeywords())}
            data-testid="manual-keywords-confirm"
          >
            確定
          </button>
        </div>
      </div>
    </Modal>
  );
}
