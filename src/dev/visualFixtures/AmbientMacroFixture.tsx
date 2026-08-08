import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';
import { triggerCandidatesFromPendingTriggers } from '../../engine/triggers';
import { disableSnapshotPersistenceForDevelopment, useGameStore } from '../../store/gameStore';
import { GameScreen } from '../../components/game/GameScreen';
import { buildVisualFixture } from './fixtureBuilder';
import {
  AMBIENT_MACRO_CANDIDATES,
  AMBIENT_MACRO_GROUPS,
  macroLimits,
  macroLoopDurationSec,
  phaseFromElapsedMs,
  sampleMacroMotion,
  type AmbientMacroCandidate,
} from './ambientMacroMotion';

type FixtureTheme = 'dark' | 'light';
type FixtureDensity = 'EMPTY' | 'DENSE';
type FixturePlayback = 'OFF' | '1x' | '16x';
type FixtureMotion = 'ON' | 'OFF' | 'REDUCED';

const DEFAULT_THEME: FixtureTheme = 'dark';
const DEFAULT_CANDIDATE: AmbientMacroCandidate = 'B';
const DEFAULT_DENSITY: FixtureDensity = 'DENSE';
const DEFAULT_PLAYBACK: FixturePlayback = 'OFF';
const DEFAULT_MOTION: FixtureMotion = 'ON';

const CANDIDATE_NAMES: Record<AmbientMacroCandidate, string> = {
  BASELINE: 'BASELINE',
  A: 'SUBTLE',
  B: 'BALANCED',
  C: 'CINEMATIC',
};

const PLAYBACK_SPEED: Record<Exclude<FixturePlayback, 'OFF'>, 1 | 16> = {
  '1x': 1,
  '16x': 16,
};

type MacroStyle = CSSProperties & Record<string, string>;

function applyFixtureTheme(theme: FixtureTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function scenarioForDensity(density: FixtureDensity): 'ambient-macro-empty' | 'ambient-macro-dense' {
  return density === 'DENSE' ? 'ambient-macro-dense' : 'ambient-macro-empty';
}

function restoreFixtureState(density: FixtureDensity): void {
  disableSnapshotPersistenceForDevelopment();
  const fixture = buildVisualFixture(scenarioForDensity(density));
  const store = useGameStore.getState();
  store.restoreGame(fixture.snapshot);
  useGameStore.setState({
    warnings: fixture.warnings,
    triggerCandidates: triggerCandidatesFromPendingTriggers(fixture.snapshot.state.pendingTriggers),
    pendingGuided: null,
    mulliganDecisionPending: false,
  });
}

function initialTheme(): FixtureTheme {
  const value = new URLSearchParams(window.location.search).get('theme');
  return value === 'light' || value === 'dark' ? value : DEFAULT_THEME;
}

function initialCandidate(): AmbientMacroCandidate {
  const value = new URLSearchParams(window.location.search).get('candidate');
  return AMBIENT_MACRO_CANDIDATES.includes(value as AmbientMacroCandidate)
    ? value as AmbientMacroCandidate
    : DEFAULT_CANDIDATE;
}

function initialDensity(): FixtureDensity {
  return new URLSearchParams(window.location.search).get('density') === 'EMPTY'
    ? 'EMPTY'
    : DEFAULT_DENSITY;
}

function initialPhase(): number {
  const value = Number(new URLSearchParams(window.location.search).get('phase'));
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : 50;
}

function macroStyle(
  candidate: AmbientMacroCandidate,
  phasePercent: number,
  viewportWidth: number,
  motion: FixtureMotion,
): MacroStyle {
  const sample = motion === 'ON'
    ? sampleMacroMotion(candidate, phasePercent / 100, viewportWidth)
    : sampleMacroMotion('BASELINE', 0, viewportWidth);
  const variables: MacroStyle = {};
  for (const group of AMBIENT_MACRO_GROUPS) {
    const value = sample[group];
    variables[`--ambient-macro-${group.toLowerCase()}-x`] = `${value.x}px`;
    variables[`--ambient-macro-${group.toLowerCase()}-y`] = `${value.y}px`;
    variables[`--ambient-macro-${group.toLowerCase()}-scale`] = `${1 + value.scaleIncrease}`;
    variables[`--ambient-macro-${group.toLowerCase()}-opacity`] = `${value.opacityDelta}`;
  }
  return variables;
}

function ChoiceButtons<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  testId: string;
}) {
  return (
    <fieldset className="ambient-macro-controls__group">
      <legend>{label}</legend>
      <div className="ambient-macro-controls__choices" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className="ambient-macro-controls__choice"
            data-testid={`${testId}-${option.toLowerCase()}`}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AmbientMacroFixture() {
  const [theme, setTheme] = useState<FixtureTheme>(initialTheme);
  const [candidate, setCandidate] = useState<AmbientMacroCandidate>(initialCandidate);
  const [density, setDensity] = useState<FixtureDensity>(initialDensity);
  const [phasePercent, setPhasePercent] = useState(initialPhase);
  const [playback, setPlayback] = useState<FixturePlayback>(DEFAULT_PLAYBACK);
  const [motion, setMotion] = useState<FixtureMotion>(DEFAULT_MOTION);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const ready = useGameStore((state) => state.state !== null);
  const phaseRef = useRef(phasePercent);
  const playbackOriginRef = useRef(0);

  useEffect(() => {
    applyFixtureTheme(theme);
  }, [theme]);

  useEffect(() => {
    restoreFixtureState(density);
  }, [density]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const setPhaseFromInput = useCallback((next: number): void => {
    const normalized = Math.min(100, Math.max(0, Math.round(next)));
    phaseRef.current = normalized;
    const speed = playback === 'OFF' ? 1 : PLAYBACK_SPEED[playback];
    const durationMs = macroLoopDurationSec(theme) * 1000;
    playbackOriginRef.current = performance.now() - (normalized / 100) * durationMs / speed;
    setPhasePercent(normalized);
  }, [playback, theme]);

  useEffect(() => {
    const speed = playback === 'OFF' ? null : PLAYBACK_SPEED[playback];
    if (speed === null) return undefined;
    const durationMs = macroLoopDurationSec(theme) * 1000;
    playbackOriginRef.current = performance.now() - (phaseRef.current / 100) * durationMs / speed;
    const timer = window.setInterval(() => {
      const nextPhase = phaseFromElapsedMs(performance.now() - playbackOriginRef.current, theme, speed);
      const nextPercent = Math.round(nextPhase * 100);
      phaseRef.current = nextPercent;
      setPhasePercent(nextPercent);
    }, 100);
    return () => window.clearInterval(timer);
  }, [playback, theme]);

  const onDensityChange = (next: FixtureDensity): void => {
    setDensity(next);
  };

  const style = useMemo(
    () => macroStyle(candidate, phasePercent, viewportWidth, motion),
    [candidate, phasePercent, viewportWidth, motion],
  );
  const selectedLimits = useMemo(
    () => AMBIENT_MACRO_GROUPS.map((group) => ({ group, limits: macroLimits(candidate, group) })),
    [candidate],
  );
  const loopDuration = macroLoopDurationSec(theme);

  return (
    <div
      className="ambient-macro-fixture"
      data-theme={theme}
      data-candidate={candidate}
      data-density={density}
      data-motion={motion}
      data-phase={phasePercent}
      style={style}
    >
      <div className="ambient-macro-fixture__stage" data-testid="ambient-macro-stage">
        {ready && <GameScreen keybindings={DEFAULT_KEYBINDINGS} />}
      </div>
      <aside className="ambient-macro-controls" aria-label="長周期アンビエント比較fixture">
        <div className="ambient-macro-controls__header">
          <div>
            <p className="ambient-macro-controls__eyebrow">DEV VISUAL FIXTURE</p>
            <h1>長周期アンビエント比較</h1>
          </div>
          <span className="ambient-macro-controls__phase-readout" data-testid="ambient-macro-phase-readout">
            {phasePercent}%
          </span>
        </div>
        <p className="ambient-macro-controls__hint">
          既存の背景レイヤーだけを、曲一周の長い時間軸で比較します。
        </p>
        <div className="ambient-macro-controls__grid">
          <ChoiceButtons
            label="テーマ"
            value={theme}
            options={['dark', 'light'] as const}
            onChange={setTheme}
            testId="ambient-macro-theme"
          />
          <ChoiceButtons
            label="候補"
            value={candidate}
            options={AMBIENT_MACRO_CANDIDATES}
            onChange={setCandidate}
            testId="ambient-macro-candidate"
          />
          <ChoiceButtons
            label="盤面密度"
            value={density}
            options={['EMPTY', 'DENSE'] as const}
            onChange={onDensityChange}
            testId="ambient-macro-density"
          />
          <ChoiceButtons
            label="自動再生"
            value={playback}
            options={['OFF', '1x', '16x'] as const}
            onChange={setPlayback}
            testId="ambient-macro-playback"
          />
          <ChoiceButtons
            label="motion"
            value={motion}
            options={['ON', 'OFF', 'REDUCED'] as const}
            onChange={setMotion}
            testId="ambient-macro-motion"
          />
        </div>
        <label className="ambient-macro-controls__slider-label" htmlFor="ambient-macro-phase">
          マクロ位相 <span>0–100%</span>
        </label>
        <input
          id="ambient-macro-phase"
          className="ambient-macro-controls__slider"
          data-testid="ambient-macro-phase"
          type="range"
          min="0"
          max="100"
          step="1"
          value={phasePercent}
          onChange={(event) => setPhaseFromInput(Number(event.target.value))}
        />
        <div className="ambient-macro-controls__phase-marks" role="group" aria-label="位相プリセット">
          {[0, 25, 50, 75, 100].map((mark) => (
            <button
              key={mark}
              type="button"
              data-testid={`ambient-macro-phase-${mark}`}
              onClick={() => setPhaseFromInput(mark)}
            >
              {mark}%
            </button>
          ))}
        </div>
        <dl className="ambient-macro-controls__meta">
          <div><dt>テーマ曲のloop区間</dt><dd>{loopDuration.toFixed(3)}秒</dd></div>
          <div><dt>狭幅補正</dt><dd>{viewportWidth < 900 ? '移動量 ×0.7' : 'なし'}</dd></div>
          <div><dt>現在の候補</dt><dd>{candidate === 'BASELINE' ? 'BASELINE' : `${candidate} · ${CANDIDATE_NAMES[candidate]}`}</dd></div>
        </dl>
        <div className="ambient-macro-controls__limits" data-testid="ambient-macro-limits">
          {selectedLimits.map(({ group, limits }) => (
            <div key={group}>
              <strong>{group}</strong>
              <span>±{limits.movementPx}px</span>
              <span>+{(limits.scaleIncrease * 100).toFixed(1)}%</span>
              <span>±{limits.opacityDelta.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
