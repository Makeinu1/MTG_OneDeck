/**
 * review.av7-production-integration — AV7本番sample、意味操作経路、公開境界の判定者pin。
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_SFX_KINDS, sfxLayersFor } from '../presentation/sfxManifest';

const ROOT = process.cwd();
const SFX_DIR = resolve(ROOT, 'public/audio/sfx');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

const EXPECTED_WAVS = [
  'commander-contact.wav',
  'commander-portal-open.wav',
  'draw-fan.wav',
  'draw-slide.wav',
  'land-place.wav',
  'low-thud.wav',
  'resolve-shove.wav',
  'shuffle.wav',
  'spell-arcane-snap.wav',
  'spell-place.wav',
  'tap-shove.wav',
  'turn-chip.wav',
  'untap-slide.wav',
] as const;

const APPROVED_PREVIEW_HASHES: Record<string, string> = {
  'draw-slide.wav': '8878c9205195e508af1b897f037c1681d6a4e7085da138a289e7605834512e26',
  'draw-fan.wav': '50830621220f6892ee46ca895a48c9cf97ee0b4a6ff1003946bf2702cb0e138f',
  'land-place.wav': '298f5d3f503f6fa8764ecf3783622d7e12d450346be67c496a4b0f893d0aa390',
  'spell-place.wav': '94375f268ef135cf28975bbfe5a28f6cdfb13d9cda75b99779ef8bf951752f8a',
  'spell-arcane-snap.wav': 'b01e048510bd7675ebb452dde85a24df303ac1fff73d98820c30fe4f8d2ab545',
  'tap-shove.wav': '5f4f440a1d4ceb7f92d64cb7cec3b2965f3ed33b8ccacd8b5ac3569d8ec6b42a',
  'untap-slide.wav': 'e20036776d6f3f9fa25dd83c5f7a33b71e52ba9e17823f7c8e5bc6af7110955f',
  'resolve-shove.wav': '93debe8eac4c112b9d19668081e734dcdbaf1ea6caa19772a695f7492281293b',
  'shuffle.wav': 'e044131952f79aaf7d9d33a1f9c4d05385b7255fac3c7772c357d683134fe8b0',
  'turn-chip.wav': '49fa385676db5e29542d15326e49a102ca0102af93e66a8d7c6880f070d7f727',
  'commander-contact.wav': 'a2ee82f494ce9d062020631dfabd31cc3b7ffe86f827818ae6a0d169f5197a2c',
  'commander-portal-open.wav': 'ee2ea64487642f5a9ab63f33df577096db15857e2eb449fd7f935bf78fe2eccb',
};

function pcmInfo(buffer: Buffer): {
  channels: number;
  sampleRate: number;
  bitDepth: number;
  durationSec: number;
  samplePeakDbfs: number;
} {
  expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');
  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitDepth = 0;
  let data: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') {
      expect(buffer.readUInt16LE(start)).toBe(1);
      channels = buffer.readUInt16LE(start + 2);
      sampleRate = buffer.readUInt32LE(start + 4);
      bitDepth = buffer.readUInt16LE(start + 14);
    } else if (id === 'data') {
      data = buffer.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  let peak = 0;
  for (let index = 0; index + 1 < data.length; index += 2) {
    peak = Math.max(peak, Math.abs(data.readInt16LE(index)) / 32768);
  }
  return {
    channels,
    sampleRate,
    bitDepth,
    durationSec: data.length / (sampleRate * channels * (bitDepth / 8)),
    samplePeakDbfs: 20 * Math.log10(Math.max(peak, Number.EPSILON)),
  };
}

describe('AV7 production assets', () => {
  it('publishes only the approved WAV set and local license evidence', () => {
    expect(existsSync(SFX_DIR)).toBe(true);
    const files = readdirSync(SFX_DIR).sort();
    expect(files).toEqual([...EXPECTED_WAVS, 'LICENSE.txt'].sort());
    expect(readFileSync(resolve(SFX_DIR, 'LICENSE.txt'), 'utf8')).toContain('Creative Commons Zero');
  });

  it('preserves approved preview bytes and production PCM bounds', () => {
    for (const file of EXPECTED_WAVS) {
      const buffer = readFileSync(resolve(SFX_DIR, file));
      const approvedHash = APPROVED_PREVIEW_HASHES[file];
      if (approvedHash) {
        expect(createHash('sha256').update(buffer).digest('hex')).toBe(approvedHash);
      }
      const info = pcmInfo(buffer);
      expect(info.channels).toBe(2);
      expect(info.sampleRate).toBe(48_000);
      expect(info.bitDepth).toBe(16);
      expect(info.durationSec).toBeLessThanOrEqual(file.startsWith('commander-') ? 1.6 : 1);
      expect(info.samplePeakDbfs).toBeLessThanOrEqual(-3);
    }
  });
});

describe('AV7 semantic integration boundaries', () => {
  it('keeps every fixed layer declarative and deterministic', () => {
    for (const kind of ALL_SFX_KINDS) {
      const variants = kind === 'tap-changed'
        ? [sfxLayersFor(kind, { tapped: true }), sfxLayersFor(kind, { tapped: false })]
        : [sfxLayersFor(kind)];
      for (const layers of variants) {
        expect(layers.length).toBeGreaterThan(0);
        for (const layer of layers) {
          expect(Object.keys(layer).sort()).toEqual(['chokeGroup', 'gainDb', 'offsetMs', 'src']);
          expect(layer.offsetMs).toBe(0);
          expect(layer.src).toMatch(/audio\/sfx\/.+\.wav$/);
        }
      }
    }
    expect(read('src/components/game/presentation/sfxManifest.ts')).not.toContain('Math.random');
    expect(read('src/components/game/presentation/sfxRenderer.ts')).not.toContain('Math.random');
  });

  it('routes UI entry points through controller success wrappers and keeps commander-only ducking', () => {
    const controller = read('src/components/game/gameController.tsx');
    const hand = read('src/components/game/HandRibbon.tsx');
    const card = read('src/components/game/GameCard.tsx');
    const menu = read('src/components/game/ThumbZone.tsx');
    const ordinary = read('src/components/game/presentation/SemanticPresentationLayer.tsx');
    const commander = read('src/components/game/presentation/CommanderRitualLayer.tsx');

    for (const name of [
      'requestDraw',
      'requestShuffleLibrary',
      'requestToggleTap',
      'requestSetAllTapped',
      'requestResolveTop',
      'requestResolveAll',
    ]) expect(controller).toContain(name);
    expect(hand).toContain('controller.requestDraw');
    expect(card).toContain('controller.requestToggleTap');
    expect(menu).toContain('controller.requestSetAllTapped');
    expect(controller).toContain("action: 'resolve-stack'");
    expect(controller).toContain("action: 'shuffle-library'");
    expect(controller).not.toMatch(/celebrate\((?:'|")(?:primary|draw|resolve|chain)/);
    expect(ordinary).not.toMatch(/duck|commanderDuckEnvelope|scheduleDuck/);
    expect(commander).toContain('scheduleDuck');
  });

  it('reapplies the saved SFX slider value when the gesture creates the audio bus', () => {
    const provider = read('src/components/game/presentation/AudioVisualProvider.tsx');
    expect(provider).toMatch(
      /setSessionSfxVolume\(preferences\.sfxVolume \?\? 80\);[\s\S]{0,120}\[preferences\.sfxVolume,\s*unlocked\]/,
    );
  });

  it('shows SFX load failure and retries on later gestures or audio-setting changes', () => {
    const provider = read('src/components/game/presentation/AudioVisualProvider.tsx');
    const renderer = read('src/components/game/presentation/sfxRenderer.ts');
    expect(provider).toContain('sfxLoadFailed');
    expect(provider).toContain('failed || sfxLoadFailed');
    expect(provider.match(/retrySfxLoad\(\);/g)).toHaveLength(3);
    expect(renderer).toContain('loadCache.delete(src)');
  });
});
