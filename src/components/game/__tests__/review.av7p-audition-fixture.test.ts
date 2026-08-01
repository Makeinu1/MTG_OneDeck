/**
 * review.av7p-audition-fixture — AV7-P prototype judge pin.
 * The implementer must not edit this test.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const FIXTURE_PATH = 'research/design/mockups/av7-audio-palette.html';
const MANIFEST_PATH = 'research/audio/sfx-palette/manifest.json';

interface AuditionAsset {
  id: string;
  file: string;
  source: string;
  license: 'CC0-1.0' | 'user-supplied-prototype-only' | 'project-original';
  sha256: string;
  durationSec: number;
  sampleRate: 48000;
  bitDepth: 16;
  truePeakDbfs: number;
  comparisonOnly?: boolean;
}

interface AuditionManifest {
  version: 1;
  defaults: {
    palette: 'hybrid';
    bgmVolume: 70;
    sfxVolume: 80;
  };
  assets: AuditionAsset[];
  cueIds: string[];
  paletteIds: string[];
}

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function manifest(): AuditionManifest {
  return JSON.parse(read(MANIFEST_PATH)) as AuditionManifest;
}

describe('AV7-P audition fixture contract', () => {
  it('provides the dev-only fixture and frozen three-palette matrix', () => {
    const html = read(FIXTURE_PATH);
    expect(html).toContain('data-testid="av7-audio-palette"');
    expect(html).toContain('data-palette="tabletop"');
    expect(html).toContain('data-palette="hybrid"');
    expect(html).toContain('data-palette="arcane"');
    expect(html).toContain('卓上音のみ');
    expect(html).toContain('卓上＋魔法');
    expect(html).toContain('魔法強め');
    expect(html).toMatch(/data-palette="tabletop"[^>]*aria-pressed="false"/);
    expect(html).toMatch(/data-palette="hybrid"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/data-palette="arcane"[^>]*aria-pressed="false"/);
    expect(html).toContain('data-testid="continuous-demo"');
    expect(html).toContain('data-testid="stop-all"');
    expect(html).toContain('data-testid="export-selection"');
  });

  it('uses one native-loop streaming BGM element with no boundary crossfade', () => {
    const html = read(FIXTURE_PATH);
    expect(html).toContain('candidate-b-tight-128-bars.mp3');
    expect(html).toMatch(/\bloop\s*=\s*true\b/);
    expect(html).not.toMatch(/crossfade|equalPower|secondDeck|dualMedia/i);
    expect(html).not.toMatch(/decodeAudioData\s*\([^)]*candidate-b-tight/i);
  });

  it('pins defaults, semantic rows, and the three palette IDs', () => {
    const data = manifest();
    expect(data.version).toBe(1);
    expect(data.defaults).toEqual({
      palette: 'hybrid',
      bgmVolume: 70,
      sfxVolume: 80,
    });
    expect(data.paletteIds).toEqual(['tabletop', 'hybrid', 'arcane']);
    expect(data.cueIds).toEqual([
      'draw-completed',
      'land-played',
      'spell-cast',
      'tap',
      'untap',
      'stack-resolved',
      'shuffle-completed',
      'turn-advanced',
      'commander-cast',
    ]);
  });

  it('uses only mastered WAV previews with recorded provenance and hashes', () => {
    const data = manifest();
    expect(data.assets.length).toBeGreaterThanOrEqual(8);

    for (const asset of data.assets) {
      expect(asset.file).toMatch(/^previews\/[a-z0-9-]+\.wav$/);
      expect(asset.source).not.toMatch(/cockatrice|sound\/spells|\.zip$|\.7z$/i);
      expect(['CC0-1.0', 'user-supplied-prototype-only', 'project-original']).toContain(asset.license);
      expect(asset.sampleRate).toBe(48000);
      expect(asset.bitDepth).toBe(16);
      expect(asset.truePeakDbfs).toBeLessThanOrEqual(-3);
      expect(asset.durationSec).toBeGreaterThan(0);
      if (!asset.comparisonOnly) {
        expect(['commander-short', 'commander-portal-open'].includes(asset.id)
          ? asset.durationSec <= 1.6
          : asset.durationSec <= 1.0).toBe(true);
      }

      const absolute = resolve(ROOT, 'research/audio/sfx-palette', asset.file);
      expect(existsSync(absolute)).toBe(true);
      const bytes = readFileSync(absolute);
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    }
  });

  it('keeps the original source tree out of fixture URLs and remote dependencies out', () => {
    const html = read(FIXTURE_PATH);
    expect(html).not.toMatch(/(?:src|href)=["'][^"']*sound\//i);
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/localStorage/);
  });

  it('chokes every voice and contains audio-start failures', () => {
    const html = read(FIXTURE_PATH);
    expect(html).toContain('playing.push(playThud(event,gain))');
    expect(html).toMatch(/const stopRow[\s\S]*?voice => voice\.stop\(\)/);
    expect(html).toMatch(/const playThud[\s\S]*?return voice/);
    expect(html.match(/if \(!await ensureAudio\(\)\) return(?: false)?;/g)).toHaveLength(3);
    expect(html).toContain('音声出力を開始できませんでした');
  });

  it('exposes accessible, responsive audition controls', () => {
    const html = read(FIXTURE_PATH);
    for (const id of [
      'bgm-toggle',
      'bgm-volume',
      'sfx-volume',
      'audio-status',
      'track-position',
      'cue-draw-completed',
      'cue-land-played',
      'cue-spell-cast',
      'cue-tap',
      'cue-untap',
      'cue-stack-resolved',
      'cue-shuffle-completed',
      'cue-turn-advanced',
      'cue-commander-cast',
    ]) {
      // Semantic cue buttons are rendered from the fixed cueTestIds map.
      // Static transport controls use literal data-testid attributes.
      expect(html).toContain(id.startsWith('cue-') ? `'${id}'` : `data-testid="${id}"`);
    }
    expect(html).toMatch(/min-height:\s*44px/);
    expect(html).toMatch(/@media\s*\(max-width:\s*700px\)/);
    expect(html).toMatch(/@media\s*\(max-width:\s*440px\)/);
    expect(html).toMatch(/\.cue\s*>\s*button\s*\{\s*width:\s*100%/);
    expect(html).toMatch(/overflow-x:\s*hidden/);
  });
});
