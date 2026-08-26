import { createRoot } from 'react-dom/client';
import '../../index.css';
import '../../App.css';
import { GameScreen } from '../../components/game/GameScreen';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';
import {
  disableSnapshotPersistenceForDevelopment,
  useGameStore,
} from '../../store/gameStore';
import { loadResearchCheckpoint } from '../uxResearch/storage';
import {
  buildVisualFixture,
  isVisualFixtureScenario,
  type VisualFixtureScenario,
} from './fixtureBuilder';
import { initializeTheme, saveThemePreference } from '../../ui/theme';
import { triggerCandidatesFromPendingTriggers } from '../../engine/triggers';
import {
  applyTabletopPrototypeMode,
  resolveTabletopPrototypeMode,
} from './tabletopPrototype';
import { AmbientMacroFixture } from './AmbientMacroFixture';
import { PregameFixture } from './PregameFixture';
import { TabletopManualFixture } from './TabletopManualFixture';
import './tabletopPrototype.css';

function queryValue(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

function fixtureScenario(): VisualFixtureScenario {
  const value = queryValue('scenario');
  return isVisualFixtureScenario(value) ? value : 'battlefield';
}

const requestedScenario = queryValue('scenario');
const isAmbientMacroFixture = requestedScenario === 'ambient-macro';
const isPregameFixture = requestedScenario === 'pregame';
const isTabletopManualFixture = requestedScenario === 'tabletop-manual';
const scenario = fixtureScenario();
const tabletopMode = resolveTabletopPrototypeMode(queryValue('tabletop'));
applyTabletopPrototypeMode(document.documentElement, tabletopMode);

/**
 * `?theme=light|dark` は**どのシナリオにも**効く。
 * 以前はテーマ固定が theme-light / theme-dark シナリオ専用で、他のシナリオは
 * 保存済みの好みに従っていた=新しい fixture を両テーマで見る手段が無かった。
 * ライトの可読性が壊れたまま出荷された穴はここ(2026-07-16 に塞いだ)。
 */
function queryTheme(): 'light' | 'dark' | null {
  const q = queryValue('theme');
  return q === 'light' || q === 'dark' ? q : null;
}

const explicitTheme = queryTheme();
if (isAmbientMacroFixture) {
  const theme = explicitTheme ?? 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
} else if (explicitTheme) {
  // **保存される**(localStorage `mtg-onedeck:theme`)。dev harness は実アプリと同一
  // オリジンなので、この後アプリを開くと同じテーマで起動する。
  // なぜ dataset 直書きでないか: ThemeToggle(useTheme)がマウント時に
  // applyTheme(loadThemePreference()) で同期し直書きを上書きするため、
  // メニューを開いた瞬間にテーマが戻ってしまう。相手盤面の確認はメニュー経由が
  // 必須ゆえ、直書きだと fixture は常に誤ったテーマを見せる(=ライトが壊れたまま
  // 出荷された穴)。ゆえに**明示的な `?theme=` を渡した時だけ**好みごと切り替える
  // (opt-in の副作用)。テーマを汚したくない場合は `?theme=` を付けない。
  saveThemePreference(explicitTheme);
} else if (scenario === 'theme-light' || scenario === 'theme-dark') {
  // 既存シナリオは従来どおり**保存しない**(この場での見た目固定のみ)。
  document.documentElement.dataset.theme = scenario === 'theme-light' ? 'light' : 'dark';
  document.documentElement.style.colorScheme = scenario === 'theme-light' ? 'light' : 'dark';
} else {
  initializeTheme();
}

const root = document.getElementById('root');
if (!root) throw new Error('visual fixture root is missing');
const rootElement = root;

async function renderFixture(): Promise<void> {
  disableSnapshotPersistenceForDevelopment();
  const sessionId = queryValue('session');
  const checkpointId = queryValue('checkpoint');
  const capturedCheckpoint =
    sessionId && checkpointId
      ? await loadResearchCheckpoint(sessionId, checkpointId)
      : null;

  if ((sessionId || checkpointId) && !capturedCheckpoint) {
    throw new Error('指定したUX調査checkpointが見つかりません。');
  }

  const syntheticFixture = capturedCheckpoint ? null : buildVisualFixture(scenario);
  const snapshot = capturedCheckpoint?.snapshot ?? syntheticFixture?.snapshot;
  if (!snapshot) throw new Error('表示するsnapshotがありません。');

  const store = useGameStore.getState();
  store.restoreGame(snapshot);
  useGameStore.setState({
    warnings: capturedCheckpoint?.transient.warnings ?? syntheticFixture?.warnings ?? [],
    triggerCandidates: triggerCandidatesFromPendingTriggers(snapshot.state.pendingTriggers),
    pendingGuided: capturedCheckpoint?.transient.pendingGuided ?? null,
    mulliganDecisionPending:
      capturedCheckpoint?.transient.mulliganDecisionPending ??
      syntheticFixture?.mulliganDecisionPending ??
      false,
  });

  const fixtureName = capturedCheckpoint
    ? `captured-${capturedCheckpoint.reason}`
    : scenario;
  document.documentElement.dataset.fixtureScenario = fixtureName;
  document.title = `MTG OneDeck — ${fixtureName} — ${tabletopMode}`;

  createRoot(rootElement).render(<GameScreen keybindings={DEFAULT_KEYBINDINGS} />);
}

if (isAmbientMacroFixture) {
  document.documentElement.dataset.fixtureScenario = 'ambient-macro';
  document.title = 'MTG OneDeck — 長周期アンビエント比較fixture';
  createRoot(rootElement).render(<AmbientMacroFixture />);
} else if (isPregameFixture) {
  const playerCount = queryValue('players') === '4' ? 4 : 2;
  document.documentElement.dataset.fixtureScenario = `pregame-${playerCount}`;
  document.title = `MTG OneDeck — Pregame ${playerCount}P fixture`;
  createRoot(rootElement).render(<PregameFixture playerCount={playerCount} />);
} else if (isTabletopManualFixture) {
  document.documentElement.dataset.fixtureScenario = 'tabletop-manual';
  document.title = 'MTG OneDeck — tabletop manual fixture';
  createRoot(rootElement).render(<TabletopManualFixture />);
} else {
  void renderFixture().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'fixtureの表示に失敗しました。';
    root.textContent = message;
    console.error(message, error);
  });
}
