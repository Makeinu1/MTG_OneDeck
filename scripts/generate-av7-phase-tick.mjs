#!/usr/bin/env node
/**
 * Deterministically bakes the AV7b phase tick to production PCM.
 *
 * Contract (docs/audio-visual-contract.md §3.1, revision 2026-08-07):
 * 48kHz / 2ch / PCM16, <= 1s, true peak <= -3dBFS, 2ms fade at both edges.
 * Dry, clearly quieter separator than the turn cue: a short high chip
 * sweeping 600Hz -> 400Hz with a sharp exponential decay, peak ~0.1.
 * Fixed formulas only — no randomness, no external audio, no dependencies.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sampleRate = 48_000;
const channels = 2;
const durationSec = 0.09;
const frameCount = Math.round(sampleRate * durationSec);
const chipEndSec = 0.08;
const attackEndSec = 0.003;
const startFrequency = 600;
const endFrequency = 400;
const silence = 0.0001;
const peak = 0.1;
const fadeFrames = Math.round(sampleRate * 0.002);

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
  let amplitude = silence;
  let frequency = endFrequency;
  if (time < chipEndSec) {
    frequency = startFrequency * (endFrequency / startFrequency) ** (time / chipEndSec);
    amplitude =
      time < attackEndSec
        ? silence * (peak / silence) ** (time / attackEndSec)
        : peak * (silence / peak) ** ((time - attackEndSec) / (chipEndSec - attackEndSec));
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

const target = resolve('public/audio/sfx/phase-tick.wav');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, output);
