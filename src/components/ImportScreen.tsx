import { useState } from 'react';
import { parseDeckList, type ParseError } from '../data/deckParser';
import { resolveDeck, type ResolveProgress } from '../data/scryfall';
import type { CardDef } from '../types/card';
import type { InitDeckCard } from '../engine/init';
import { DeckStats } from './DeckStats';

export interface ImportScreenProps {
  initialDeckText: string;
  onStart: (deck: InitDeckCard[], deckText: string) => void;
}

interface ResolvedEntry {
  name: string;
  card: CardDef;
  quantity: number;
  section: 'commander' | 'main';
}

/**
 * The deck-import screen: paste a deck list, resolve it against Scryfall,
 * review unresolved/parse-error rows, then start the game.
 */
export function ImportScreen({ initialDeckText, onStart }: ImportScreenProps) {
  const [deckText, setDeckText] = useState(initialDeckText);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ResolveProgress | null>(null);
  const [resolvedEntries, setResolvedEntries] = useState<ResolvedEntry[]>([]);
  const [unresolved, setUnresolved] = useState<{ name: string; line: number; reason: string }[]>(
    [],
  );
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [hasImported, setHasImported] = useState(false);

  const handleImport = async (): Promise<void> => {
    setIsImporting(true);
    setProgress(null);
    setResolvedEntries([]);
    setUnresolved([]);
    setParseErrors([]);
    setHasImported(false);

    try {
      const { entries, errors } = parseDeckList(deckText);
      setParseErrors(errors);

      const result = await resolveDeck(entries, (p) => setProgress(p));

      const resolved: ResolvedEntry[] = [];
      for (const entry of entries) {
        const card = result.resolved.get(entry.name);
        if (card) {
          resolved.push({ name: entry.name, card, quantity: entry.quantity, section: entry.section });
        }
      }
      setResolvedEntries(resolved);
      setUnresolved(result.unresolved);
      setHasImported(true);
    } finally {
      setIsImporting(false);
    }
  };

  const totalCount = resolvedEntries.reduce((sum, e) => sum + e.quantity, 0);
  const canStart = hasImported && unresolved.length === 0 && resolvedEntries.length > 0;

  const handleStart = (): void => {
    const deck: InitDeckCard[] = [];
    for (const entry of resolvedEntries) {
      for (let i = 0; i < entry.quantity; i++) {
        deck.push({ def: entry.card, isCommander: entry.section === 'commander' });
      }
    }
    onStart(deck, deckText);
  };

  const progressPct = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <div className="import-screen">
      <div className="import-screen__hero">
        <p className="import-screen__kicker">MTG OneDeck</p>
        <h1>統率者戦・一人回し</h1>
        <p className="import-screen__lede">
          デッキリストを貼り付けて、プレイマット上でゴールドフィッシュ(一人回し)を再現します。
        </p>
      </div>

      <div className="import-screen__panel">
        <label className="import-screen__label" htmlFor="deck-input">
          デッキリスト
        </label>
        <textarea
          id="deck-input"
          data-testid="deck-input"
          className="import-screen__textarea"
          value={deckText}
          onChange={(e) => setDeckText(e.target.value)}
          placeholder={'例:\n統率者\n1 The Ur-Dragon\n\nデッキ\n1 Sol Ring\n4 稲妻'}
          spellCheck={false}
        />

        <div className="import-screen__actions">
          <button
            type="button"
            data-testid="import-button"
            className="btn btn--primary"
            onClick={() => void handleImport()}
            disabled={isImporting || deckText.trim() === ''}
          >
            {isImporting ? 'インポート中…' : 'インポート'}
          </button>

          <button
            type="button"
            data-testid="start-game"
            className="btn btn--accent"
            onClick={handleStart}
            disabled={!canStart}
          >
            ゲーム開始
          </button>
        </div>

        {progress && (
          <div className="import-screen__progress">
            <div className="import-screen__progress-bar">
              <div
                className="import-screen__progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="import-screen__progress-label">
              解決中: {progress.done} / {progress.total}
            </span>
          </div>
        )}

        {hasImported && (
          <div className="import-screen__summary">
            <span className="import-screen__summary-item import-screen__summary-item--ok">
              解決済み {totalCount} 枚
            </span>
            <span
              className={`import-screen__summary-item ${
                unresolved.length > 0 ? 'import-screen__summary-item--warn' : ''
              }`}
            >
              未解決 {unresolved.length} 件
            </span>
            <span
              className={`import-screen__summary-item ${
                parseErrors.length > 0 ? 'import-screen__summary-item--warn' : ''
              }`}
            >
              パースエラー {parseErrors.length} 件
            </span>
          </div>
        )}

        {hasImported && resolvedEntries.length > 0 && <DeckStats entries={resolvedEntries} />}

        {unresolved.length > 0 && (
          <section className="import-screen__issues">
            <h2>解決できなかったカード</h2>
            <ul>
              {unresolved.map((item) => (
                <li key={`${item.line}-${item.name}`}>
                  <span className="import-screen__issue-line">{item.line}行目</span>
                  <span className="import-screen__issue-name">{item.name}</span>
                  <span className="import-screen__issue-reason">{item.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {parseErrors.length > 0 && (
          <section className="import-screen__issues">
            <h2>パースエラー</h2>
            <ul>
              {parseErrors.map((error) => (
                <li key={`${error.line}-${error.text}`}>
                  <span className="import-screen__issue-line">{error.line}行目</span>
                  <span className="import-screen__issue-name">「{error.text}」</span>
                  <span className="import-screen__issue-reason">{error.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {resolvedEntries.length > 0 && (
        <section className="import-screen__gallery">
          <h2>
            解決済みカード <span className="import-screen__gallery-count">{resolvedEntries.length}</span>
          </h2>
          <div className="import-screen__grid">
            {resolvedEntries.map((entry) => (
              <figure key={entry.name} className="import-screen__card">
                {entry.card.faces[0]?.imageUrl ? (
                  <img
                    src={entry.card.faces[0].imageUrl}
                    alt={entry.card.faces[0].printedName ?? entry.card.faces[0].name}
                    loading="lazy"
                  />
                ) : (
                  <div className="import-screen__card-fallback">
                    {entry.card.printedName ?? entry.card.name}
                  </div>
                )}
                {entry.quantity > 1 && (
                  <span className="import-screen__card-qty">×{entry.quantity}</span>
                )}
                {entry.section === 'commander' && (
                  <span className="import-screen__card-badge">統率者</span>
                )}
                <figcaption>{entry.card.printedName ?? entry.card.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
