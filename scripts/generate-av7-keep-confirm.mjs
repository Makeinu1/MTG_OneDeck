#!/usr/bin/env node
/**
 * Deterministically bakes the AV7b keep-confirm sample to production PCM.
 *
 * Contract (docs/audio-visual-contract.md §3.1, revision 2026-08-07):
 * 48kHz / 2ch / PCM16, <= 1s, true peak <= -3dBFS, 2ms fade at both edges.
 * Dry, small confirmation sound: two short fixed tones (a settled decision),
 * peak ~0.2. Fixed formulas only — no randomness, no external audio, no
 * dependencies.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sampleRate = 48_000;
const channels = 2;
const durationSec = 0.28;
const frameCount = Math.round(sampleRate * durationSec);
const attackSec = 0.003;
const silence = 0.0001;
const fadeFrames = Math.round(sampleRate * 0.002);

/** Two consecutive dry chips: a lower settle tone, then a slightly higher confirm. */
const segments = [
  { startSec: 0.0, endSec: 0.08, frequency: 520, peak: 0.2 },
  { startSec: 0.09, endSec: 0.26, frequency: 650, peak: 0.16 },
];

const dataSize = frameCount * channels * 2;
const output = Buffer.alloc(44 + dataSize);
output.write('RIFF', 0);
output.writeUInt32LE(36 + dataSize, 4);
output.write('WAVEfmt ', 8);
output.writeUInt32LE(16, 16);
output.writeUInt16LE(1, 20);
output.writeUInt16LE(channels, 22);
output.writeUInt32LE(sampleRate, 24);
output.writeUInt32LE(sampleRate * channels * 2, 28);
output.writeUInt16LE(channels * 2, 32);
output.writeUInt16LE(16, 34);
output.write('data', 36);
output.writeUInt32LE(dataSize, 40);

let phase = 0;
for (let frame = 0; frame < frameCount; frame += 1) {
  const time = frame / sampleRate;
  const segment = segments.find((item) => time >= item.startSec && time < item.endSec);
  let amplitude = silence;
  let frequency = 520;
  if (segment) {
    frequency = segment.frequency;
    const local = time - segment.startSec;
    const span = segment.endSec - segment.startSec;
    amplitude =
      local < attackSec
        ? silence * (segment.peak / silence) ** (local / attackSec)
        : segment.peak * (silence / segment.peak) ** ((local - attackSec) / (span - attackSec));
  }
  phase += (Math.PI * 2 * frequency) / sampleRate;

  let sample = Math.sin(phase) * amplitude;
  if (frame < fadeFrames) sample *= frame / fadeFrames;
  if (frame >= frameCount - fadeFrames) {
    sample *= (frameCount - 1 - frame) / fadeFrames;
  }
  const value = Math.round(sample * 32767);
  const offset = 44 + frame * channels * 2;
  output.writeInt16LE(value, offset);
  output.writeInt16LE(value, offset + 2);
}

const target = resolve('public/audio/sfx/keep-confirm.wav');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, output);
