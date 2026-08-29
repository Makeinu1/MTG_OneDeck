import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '0c0c7a533fffd8e3495cf74bb7d86b827f222c2e';
const FROZEN_CANDIDATE_SHA = '3fb115b58260bebbea6911642616bc8a863ef95c';
const OBSOLETE_GOVERNANCE_REVIEWS = new Set([
  'src/test/architecture/review.gov-codex-56r2-request-normalization.test.ts',
]);
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');
const gitLines = (args: string[]): string[] => execFileSync('git', args, {
  cwd: ROOT,
  encoding: 'utf8',
}).trim().split(/\r?\n/u).filter(Boolean);

const PORT = 'src/components/game/gameScreenInteractionPort.ts';
const REQUIRED_PRODUCT_PATHS = [
  PORT,
  'src/components/game/GameScreen.tsx',
  'src/components/game/gameController.tsx',
  'src/components/game/DecisionBar.tsx',
  'src/components/game/Feed.tsx',
  'src/components/game/GameCard.tsx',
  'src/components/game/HandRibbon.tsx',
  'src/components/game/LifeSheet.tsx',
  'src/components/game/StackBand.tsx',
  'src/components/game/StatusBand.tsx',
  'src/components/game/ThumbZone.tsx',
  'src/components/game/TriggerSheet.tsx',
  'src/components/game/presentation/CommanderRitualLayer.tsx',
  'src/dev/uxResearch/ResearchRecorder.tsx',
] as const;
const ALLOWED_PATHS = new Set([
  'docs/contracts/manifest.json',
  'research/cr-grounding/cr-backbone-ledger.json',
  'research/cr-grounding/archive/o4p-09a-unified-game-surface-cold-audit-record-2026-08-25.md',
  'research/cr-grounding/o4p-09a-unified-game-surface.contract.draft.md',
  'research/cr-grounding/o4p-09a-acceptance-brief.draft.md',
  'research/cr-grounding/o4p-09a-implementation-brief.draft.md',
  'research/cr-grounding/o4p-09a-cold-audit-brief.draft.md',
  ...REQUIRED_PRODUCT_PATHS,
  'src/components/game/GameScreenInteractionPort.test.tsx',
  'src/components/game/CommanderAltar.test.tsx',
  'src/components/game/HudInteractions.test.tsx',
  'src/components/game/OpponentSetupScreen.review.test.tsx',
  'src/components/game/TriggerSheet.test.tsx',
  'src/components/game/__tests__/review.s1-stack-pile.test.tsx',
  'src/test/architecture/review.o4p-09a-unified-game-surface.test.ts',
  'src/test/architecture/review.o4p-06-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-07-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-08-roadmap-registration.test.ts',
  'src/test/architecture/review.o4p-09-roadmap-registration.test.ts',
]);

describe('O4P-09A unified GameScreen surface seam', () => {
  it('defines an explicit store-free interaction port', () => {
    const port = read(PORT);
    expect(port).toContain('export interface GameScreenInteractionPort');
    expect(port).toContain('state: GameState | null');
    for (const required of [
      'mulliganDecisionPending',
      'resolutionSession',
      'triggerCandidates',
      'confirmGuidedZeroChoice',
      'removeStackItem',
      'completeManualResolution',
      'placePendingTriggersForPriority',
      'putPendingTriggerOnStack',
      'addAbilityToStack',
      'resolveCommanderRitualCue',
    ]) expect(port, required).toContain(required);
    for (const forbidden of [
      'GameStore', 'useGameStore', 'zustand', 'dispatch:', 'Room',
      'protocolVersion', 'revision:', 'capability', 'WebSocket',
    ]) expect(port, forbidden).not.toContain(forbidden);
    expect(port).not.toMatch(/\bstore\s*:/u);
  });

  it('keeps one exported GameScreen root and one shared internal surface', () => {
    const screen = read('src/components/game/GameScreen.tsx');
    expect(screen).toContain('interactionPort?: GameScreenInteractionPort');
    expect(screen).toContain('function LocalGameScreen');
    expect(screen).toContain('function GameScreenSurface');
    expect(screen).toContain('<GameScreenSurface');
    expect(screen).toContain("import { CardView } from '../CardView'");
    expect(screen.match(/export function GameScreen\b/gu)).toHaveLength(1);
    expect(screen).not.toContain('useGameStore');

    const app = read('src/App.tsx');
    expect(app).toContain('<GameScreen');
    expect(app).not.toContain('interactionPort=');
  });

  it('removes local-store reach-through from affected UI sources', () => {
    for (const path of REQUIRED_PRODUCT_PATHS) {
      const source = read(path);
      expect(source, path).not.toContain('controller.store');
      expect(source, path).not.toMatch(
        /\b(?:const|let)\s*\{[^}]*\bstore\b[^}]*\}\s*=\s*controller\b/su,
      );
    }
    const controller = read('src/components/game/gameController.tsx');
    expect(controller).toContain('GameScreenInteractionPort');
    expect(controller).not.toMatch(/\n\s*store,\n\s*openCardMenu/u);

    const ritual = read('src/components/game/presentation/CommanderRitualLayer.tsx');
    expect(ritual).toContain('resolveCue');
    expect(ritual).not.toContain('useGameStore');
    const screen = read('src/components/game/GameScreen.tsx');
    expect(screen).toContain('resolveCue={controller.resolveCommanderRitualCue}');
  });

  it('does not fork online/player presentation or expand the milestone', () => {
    const changed = new Set(gitLines([
      'diff', '--name-only', BASE_SHA, FROZEN_CANDIDATE_SHA,
    ]).filter((path) => !OBSOLETE_GOVERNANCE_REVIEWS.has(path)));
    for (const path of REQUIRED_PRODUCT_PATHS) expect(changed, path).toContain(path);
    expect(changed).toContain('src/components/game/GameScreenInteractionPort.test.tsx');
    for (const path of changed) {
      expect(ALLOWED_PATHS.has(path), `unexpected O4P-09A path: ${path}`).toBe(true);
      expect(path).not.toMatch(/(?:OnlineGameScreen|OnlineBoard|OnlineHand|OnlineStack)/u);
      expect(path).not.toMatch(/^src\/(?:engine|online|store)\//u);
    }
    expect(() => execFileSync('git', ['diff', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    })).not.toThrow();
  });
});
