/**
 * review.av7p2-spell-commander-refine — judge pin for the two refined cues.
 * The implementer must not edit this test.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const FIXTURE_PATH = 'research/design/mockups/av7-audio-palette.html';
const PALETTE_ROOT = 'research/audio/sfx-palette';

interface AuditionAsset {
  id: string;
  file: string;
  source: string;
  license: 'CC0-1.0' | 'user-supplied-prototype-only' | 'project-original';
  durationSec: number;
  truePeakDbfs: number;
  comparisonOnly?: boolean;
}

interface AuditionManifest {
  assets: AuditionAsset[];
}

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function manifest(): AuditionManifest {
  return JSON.parse(read(`${PALETTE_ROOT}/manifest.json`)) as AuditionManifest;
}

function asset(id: string): AuditionAsset {
  const found = manifest().assets.find((item) => item.id === id);
  if (!found) throw new Error(`missing audition asset: ${id}`);
  return found;
}

function pcm16StereoRmsDbfs(path: string): number {
  const bytes = readFileSync(resolve(ROOT, path));
  expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const chunk = bytes.subarray(offset, offset + 4).toString('ascii');
    const size = bytes.readUInt32LE(offset + 4);
    if (chunk === 'fmt ') {
      expect(bytes.readUInt16LE(offset + 8)).toBe(1);
      channels = bytes.readUInt16LE(offset + 10);
      sampleRate = bytes.readUInt32LE(offset + 12);
      bitsPerSample = bytes.readUInt16LE(offset + 22);
    }
    if (chunk === 'data') {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }

  expect({ channels, sampleRate, bitsPerSample }).toEqual({
    channels: 2,
    sampleRate: 48000,
    bitsPerSample: 16,
  });
  expect(dataOffset).toBeGreaterThan(0);

  let sumSquares = 0;
  let samples = 0;
  for (let cursor = dataOffset; cursor < dataOffset + dataSize; cursor += 2) {
    const sample = bytes.readInt16LE(cursor) / 32768;
    sumSquares += sample * sample;
    samples += 1;
  }
  return 20 * Math.log10(Math.sqrt(sumSquares / samples));
}

describe('AV7-P2 spell and commander refinement', () => {
  it('uses the two project-original assets in the recommended fixture', () => {
    const html = read(FIXTURE_PATH);
    const spell = asset('spell-arcane-snap');
    const commander = asset('commander-portal-open');

    expect(spell.license).toBe('project-original');
    expect(commander.license).toBe('project-original');
    expect(spell.source).toContain('synthesize-originals.mjs#spell-arcane-snap');
    expect(commander.source).toContain('synthesize-originals.mjs#commander-portal-open');
    expect(html).toContain("'spell-arcane-snap':'spell-arcane-snap.wav'");
    expect(html).toContain("'commander-portal-open':'commander-portal-open.wav'");
    expect(html).not.toMatch(/spell-summon|commander-short|long-invocation/);
    expect(html).not.toContain('comparison-long-invocation');
    expect(html).toContain('data-testid="av7p2-design-decision"');

    for (const id of ['spell-summon', 'commander-short', 'comparison-long']) {
      expect(asset(id).comparisonOnly).toBe(true);
    }
  });

  it('pins bounded density, duration, and peak for both original sounds', () => {
    const spell = asset('spell-arcane-snap');
    const commander = asset('commander-portal-open');
    const spellRms = pcm16StereoRmsDbfs(`${PALETTE_ROOT}/${spell.file}`);
    const commanderRms = pcm16StereoRmsDbfs(`${PALETTE_ROOT}/${commander.file}`);

    expect(spell.durationSec).toBeGreaterThanOrEqual(0.42);
    expect(spell.durationSec).toBeLessThanOrEqual(0.55);
    expect(spell.truePeakDbfs).toBeLessThanOrEqual(-6);
    expect(spellRms).toBeGreaterThanOrEqual(-30);
    expect(spellRms).toBeLessThanOrEqual(-25);

    expect(commander.durationSec).toBeGreaterThanOrEqual(1.15);
    expect(commander.durationSec).toBeLessThanOrEqual(1.35);
    expect(commander.truePeakDbfs).toBeLessThanOrEqual(-6);
    expect(commanderRms).toBeGreaterThanOrEqual(-28);
    expect(commanderRms).toBeLessThanOrEqual(-23);
  });

  it('pins the selected gains and keeps every other semantic cue unchanged', () => {
    const html = read(FIXTURE_PATH);
    for (const expected of [
      "spell:[['spell-place',.8]]",
      "commander:[['commander-contact',.55],['thud',.5]]",
      "spell:[['spell-place',.72],['spell-arcane-snap',.3]]",
      "commander:[['commander-contact',.44],['thud',.5],['commander-portal-open',.46]]",
      "spell:[['spell-place',.52],['spell-arcane-snap',.56]]",
      "commander:[['commander-contact',.32],['thud',.42],['commander-portal-open',.68]]",
      "draw:[['draw-slide',.76],['draw-fan',.32]]",
      "land:[['land-place',.85],['thud',.42]]",
      "tap:[['tap-shove',.75]]",
      "untap:[['untap-slide',.72]]",
      "resolve:[['resolve-shove',.64]]",
      "shuffle:[['shuffle',.8]]",
      "turn:[['turn-chip',.8],['thud',.35]]",
      "draw:[['draw-slide',.5],['draw-fan',.48]]",
      "land:[['land-place',.65],['thud',.38]]",
      "tap:[['tap-shove',.55]]",
      "untap:[['untap-slide',.52]]",
      "resolve:[['resolve-shove',.52]]",
      "shuffle:[['shuffle',.64]]",
      "turn:[['turn-chip',.5],['thud',.48]]",
    ]) {
      expect(html).toContain(expected);
    }
    expect(html).toContain("event === 'commander' ? 'BGMダックあり' : 'BGMダックなし'");
  });

  it('keeps original synthesis deterministic and dependency-free', () => {
    const synthesis = read(`${PALETTE_ROOT}/synthesize-originals.mjs`);
    const renderer = read(`${PALETTE_ROOT}/render-previews.mjs`);
    expect(synthesis).not.toContain('Math.random');
    expect(synthesis).toMatch(/seed|xorshift|mulberry/i);
    expect(synthesis).toContain('48000');
    expect(renderer).toContain('synthesize-originals.mjs');
    expect(`${synthesis}\n${renderer}`).not.toMatch(/https?:\/\//);
  });
});
