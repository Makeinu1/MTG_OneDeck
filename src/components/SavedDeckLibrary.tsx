import { useState } from 'react';
import type { SavedDeck } from '../data/savedDecks';
import type { ManaColor } from '../types/card';
import cardBackUrl from '../assets/onedeck/card-back.svg';
import { Modal } from './Modal';

interface SavedDeckLibraryProps {
  decks: SavedDeck[];
  selectedDeckId?: string;
  hasUnsavedChanges?: boolean;
  disabled?: boolean;
  onOpen: (deck: SavedDeck) => void;
  onNew: () => void;
  onRename: (deck: SavedDeck, name: string) => Promise<void>;
  onDelete: (deck: SavedDeck) => Promise<void>;
}

const MANA_ORDER: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

function commanderLabel(deck: SavedDeck): string {
  return deck.entries
    .filter((entry) => entry.section === 'commander')
    .map((entry) => entry.card.printedName ?? entry.card.faces[0]?.printedName ?? entry.card.name)
    .join(' & ') || '統率者未設定';
}

function commanderImage(deck: SavedDeck): string {
  const commander = deck.entries.find((entry) => entry.section === 'commander');
  return commander?.card.faces[0]?.imageUrlSmall
    ?? commander?.card.faces[0]?.imageUrl
    ?? cardBackUrl;
}

function deckColors(deck: SavedDeck): ManaColor[] {
  const colors = new Set<ManaColor>();
  for (const entry of deck.entries) {
    for (const color of entry.card.colorIdentity) {
      if (MANA_ORDER.includes(color as ManaColor)) colors.add(color as ManaColor);
    }
  }
  return MANA_ORDER.filter((color) => colors.has(color));
}

function deckCount(deck: SavedDeck): number {
  return deck.entries.reduce((total, entry) => total + entry.quantity, 0);
}

function formatUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(timestamp);
}

export function SavedDeckLibrary({
  decks,
  selectedDeckId,
  hasUnsavedChanges = false,
  disabled = false,
  onOpen,
  onNew,
  onRename,
  onDelete,
}: SavedDeckLibraryProps) {
  const [renameDeck, setRenameDeck] = useState<SavedDeck | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteDeck, setDeleteDeck] = useState<SavedDeck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openRename = (deck: SavedDeck): void => {
    setRenameDeck(deck);
    setRenameValue(deck.name);
    setError(null);
  };

  const submitRename = async (): Promise<void> => {
    const name = renameValue.trim();
    if (name.length < 1 || name.length > 60) {
      setError('デッキ名は1〜60文字で入力してください。');
      return;
    }
    if (!renameDeck) return;
    setBusy(true);
    setError(null);
    try {
      await onRename(renameDeck, name);
      setRenameDeck(null);
    } catch {
      setError('名前を変更できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteDeck) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(deleteDeck);
      setDeleteDeck(null);
    } catch {
      setError('デッキを削除できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="saved-decks" aria-labelledby="saved-decks-title" data-testid="saved-decks">
      <div className="saved-decks__heading">
        <div>
          <p className="saved-decks__eyebrow">このブラウザに保存</p>
          <h2 id="saved-decks-title">マイデッキ</h2>
          <p>サイトデータを削除すると、保存したデッキも消去されます。</p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          data-testid="new-deck"
          disabled={disabled}
          onClick={onNew}
        >
          新しいデッキ
        </button>
      </div>

      {decks.length === 0 ? (
        <div className="saved-decks__empty" data-testid="saved-decks-empty">
          デッキを正しく解析すると、ここへ自動で保存されます。
        </div>
      ) : (
        <div className="saved-decks__grid">
          {decks.map((deck) => {
            const colors = deckColors(deck);
            return (
              <article
                key={deck.id}
                className="saved-deck"
                data-selected={deck.id === selectedDeckId || undefined}
                data-testid={`saved-deck-${deck.id}`}
              >
                <div className="saved-deck__art">
                  <img
                    src={commanderImage(deck)}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      if (event.currentTarget.src !== cardBackUrl) {
                        event.currentTarget.src = cardBackUrl;
                      }
                    }}
                  />
                </div>
                <div className="saved-deck__body">
                  <div className="saved-deck__title-row">
                    <h3 title={deck.name}>{deck.name}</h3>
                    <div className="saved-deck__colors" aria-label={`固有色 ${colors.join('') || '無色'}`}>
                      {(colors.length > 0 ? colors : ['C' as ManaColor]).map((color) => (
                        <span key={color} className={`saved-deck__mana saved-deck__mana--${color.toLowerCase()}`}>
                          {color}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="saved-deck__commander">《{commanderLabel(deck)}》</p>
                  <p className="saved-deck__meta">{deckCount(deck)}枚 · {formatUpdatedAt(deck.updatedAt)}更新</p>
                  <div className="saved-deck__actions">
                    <button
                      type="button"
                      className="btn btn--accent"
                      data-testid={`open-saved-deck-${deck.id}`}
                      disabled={disabled}
                      onClick={() => onOpen(deck)}
                    >
                      開く
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      data-testid={`rename-saved-deck-${deck.id}`}
                      disabled={disabled}
                      onClick={() => openRename(deck)}
                    >
                      名前変更
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm saved-deck__delete"
                      data-testid={`delete-saved-deck-${deck.id}`}
                      disabled={disabled}
                      onClick={() => {
                        setDeleteDeck(deck);
                        setError(null);
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {renameDeck && (
        <Modal title="デッキ名を変更" onClose={() => !busy && setRenameDeck(null)} width="sm" testId="rename-deck-dialog">
          <label className="dialog__field">
            <span>デッキ名</span>
            <input
              data-testid="rename-deck-input"
              data-autofocus="true"
              value={renameValue}
              maxLength={60}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitRename();
              }}
            />
          </label>
          {error && <p className="saved-decks__error" role="alert">{error}</p>}
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setRenameDeck(null)}>キャンセル</button>
            <button type="button" className="btn btn--accent" data-testid="rename-deck-confirm" disabled={busy} onClick={() => void submitRename()}>変更する</button>
          </div>
        </Modal>
      )}

      {deleteDeck && (
        <Modal title="デッキを削除" onClose={() => !busy && setDeleteDeck(null)} width="sm" testId="delete-deck-dialog">
          <p>
            「{deleteDeck.name}」をこのブラウザから削除します。
            {deleteDeck.id === selectedDeckId && hasUnsavedChanges
              ? ' 入力中の未解析の変更も失われます。'
              : ''}
            ゲームの中断データとカードキャッシュは削除されません。
          </p>
          {error && <p className="saved-decks__error" role="alert">{error}</p>}
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setDeleteDeck(null)}>キャンセル</button>
            <button type="button" className="btn btn--danger" data-testid="delete-deck-confirm" disabled={busy} onClick={() => void confirmDelete()}>削除する</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
