import { useState } from 'react';
import './App.css';
import { parseDeckList, type ParseError } from './data/deckParser';
import { resolveDeck, type ResolveProgress } from './data/scryfall';
import type { CardDef } from './types/card';

// Temporary debug UI for the data layer (deck parsing + Scryfall resolution).
// This will be replaced by the real deck-building UI in a later milestone.
function App() {
  const [deckText, setDeckText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ResolveProgress | null>(null);
  const [resolvedCards, setResolvedCards] = useState<{ name: string; card: CardDef }[]>([]);
  const [unresolved, setUnresolved] = useState<{ name: string; line: number; reason: string }[]>(
    [],
  );
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);

  const handleImport = async (): Promise<void> => {
    setIsImporting(true);
    setProgress(null);
    setResolvedCards([]);
    setUnresolved([]);
    setParseErrors([]);

    try {
      const { entries, errors } = parseDeckList(deckText);
      setParseErrors(errors);

      const result = await resolveDeck(entries, (p) => setProgress(p));

      const cards: { name: string; card: CardDef }[] = [];
      for (const [name, card] of result.resolved) {
        cards.push({ name, card });
      }
      setResolvedCards(cards);
      setUnresolved(result.unresolved);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="app">
      <h1>MTG OneDeck</h1>
      <p>デッキリストを貼り付けてインポートしてください(デバッグ用UI)</p>

      <textarea
        value={deckText}
        onChange={(e) => setDeckText(e.target.value)}
        placeholder={"例:\nCommander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n4 稲妻"}
      />

      <button type="button" onClick={() => void handleImport()} disabled={isImporting}>
        {isImporting ? 'インポート中...' : 'インポート'}
      </button>

      {progress && (
        <p className="progress">
          解決中: {progress.done} / {progress.total}
        </p>
      )}

      {resolvedCards.length > 0 && (
        <section>
          <h2>解決済みカード ({resolvedCards.length})</h2>
          <div className="card-grid">
            {resolvedCards.map(({ name, card }) => (
              <figure key={name}>
                {card.faces[0]?.imageUrl && (
                  <img src={card.faces[0].imageUrl} alt={card.faces[0].printedName ?? card.name} />
                )}
                <figcaption>{card.printedName ?? card.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {unresolved.length > 0 && (
        <section>
          <h2>解決できなかったカード ({unresolved.length})</h2>
          <ul className="unresolved-list">
            {unresolved.map((item) => (
              <li key={`${item.line}-${item.name}`}>
                {item.line}行目: {item.name} ({item.reason})
              </li>
            ))}
          </ul>
        </section>
      )}

      {parseErrors.length > 0 && (
        <section>
          <h2>パースエラー ({parseErrors.length})</h2>
          <ul className="error-list">
            {parseErrors.map((error) => (
              <li key={`${error.line}-${error.text}`}>
                {error.line}行目: 「{error.text}」 ({error.reason})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default App;
