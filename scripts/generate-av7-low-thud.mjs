#!/usr/bin/env node
/** Deterministically bakes the AV7 fixture low thud to production PCM. */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sampleRate = 48_000;
const channels = 2;
const durationSec = 0.16;
const frameCount = Math.round(sampleRate * durationSec);
const attackEndSec = 0.008;
const decayEndSec = 0.15;
const pitchEndSec = 0.11;
const startFrequency = 92;
const endFrequency = 47;
const silence = 0.0001;
const peak = 0.24;

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
  const frequency =
    time < pitchEndSec
      ? startFrequency * (endFrequency / startFrequency) ** (time / pitchEndSec)
      : endFrequency;
  phase += (Math.PI * 2 * frequency) / sampleRate;

  const amplitude =
    time < attackEndSec
      ? silence * (peak / silence) ** (time / attackEndSec)
      : time < decayEndSec
        ? peak * (silence / peak) ** ((time - attackEndSec) / (decayEndSec - attackEndSec))
        : silence;
  const sample = Math.round(Math.sin(phase) * amplitude * 32767);
  const offset = 44 + frame * channels * 2;
  output.writeInt16LE(sample, offset);
  output.writeInt16LE(sample, offset + 2);
}

const target = resolve('public/audio/sfx/low-thud.wav');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, output);
