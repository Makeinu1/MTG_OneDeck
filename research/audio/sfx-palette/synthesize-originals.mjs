/** Deterministic, project-original AV7-P2 magical preview synthesis. */
import { writeFile } from 'node:fs/promises';

export const SAMPLE_RATE = 48000;
const EDGE_FADE_SECONDS = 0.002;

const xorshift32 = (seed) => () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0xffffffff;
};

const normalize = (channels, targetRms, peakLimit) => {
  let sum = 0;
  let peak = 0;
  for (const channel of channels) for (const sample of channel) {
    sum += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const scale = Math.min(targetRms / Math.sqrt(sum / (channels.length * channels[0].length)), peakLimit / peak);
  for (const channel of channels) for (let index = 0; index < channel.length; index += 1) channel[index] *= scale;
};

const edgeFade = (channels) => {
  const length = channels[0].length;
  const fadeSamples = Math.round(SAMPLE_RATE * EDGE_FADE_SECONDS);
  for (const channel of channels) for (let index = 0; index < fadeSamples; index += 1) {
    const gain = index / fadeSamples;
    channel[index] *= gain;
    channel[length - 1 - index] *= gain;
  }
};

const renderSpellArcaneSnap = () => {
  const duration = 0.48;
  const length = Math.round(duration * SAMPLE_RATE);
  const random = xorshift32(0x51a7e21d);
  const channels = [new Float64Array(length), new Float64Array(length)];
  const phase = [0.17, 0.61];
  const frequencies = [1741, 2377, 3199];
  for (let index = 0; index < length; index += 1) {
    const time = index / SAMPLE_RATE;
    const air = ((random() * 2 - 1) - (random() * 2 - 1) * 0.72) * Math.exp(-time / 0.105);
    for (let channel = 0; channel < 2; channel += 1) {
      const resonances = frequencies.reduce((sum, frequency, harmonic) => sum + Math.sin((Math.PI * 2 * frequency * time) + phase[channel] + harmonic * 0.83) * (0.48 - harmonic * 0.1), 0);
      channels[channel][index] = air * 0.72 + resonances * Math.exp(-time / 0.072) * 0.48;
    }
  }
  edgeFade(channels);
  normalize(channels, 0.043, 0.38);
  return { channels, duration, targetRmsDbfs: -27.3, peakCeiling: 0.38 };
};

const renderCommanderPortalOpen = () => {
  const duration = 1.24;
  const length = Math.round(duration * SAMPLE_RATE);
  const random = xorshift32(0xc04d7a11);
  const channels = [new Float64Array(length), new Float64Array(length)];
  const phase = [0.29, 1.04];
  const frequencies = [683, 1061, 1619, 2473];
  for (let index = 0; index < length; index += 1) {
    const time = index / SAMPLE_RATE;
    const opening = ((random() * 2 - 1) - (random() * 2 - 1) * 0.58) * Math.exp(-time / 0.16);
    const tailAir = ((random() * 2 - 1) - (random() * 2 - 1) * 0.86) * Math.exp(-time / 0.58);
    for (let channel = 0; channel < 2; channel += 1) {
      const resonances = frequencies.reduce((sum, frequency, harmonic) => sum + Math.sin((Math.PI * 2 * frequency * time) + phase[channel] + harmonic * 0.67) * (0.36 - harmonic * 0.055), 0);
      channels[channel][index] = opening * 0.66 + tailAir * 0.2 + resonances * Math.exp(-time / 0.46) * 0.42;
    }
  }
  edgeFade(channels);
  normalize(channels, 0.054, 0.4);
  return { channels, duration, targetRmsDbfs: -25.4, peakCeiling: 0.4 };
};

const originals = {
  'spell-arcane-snap': renderSpellArcaneSnap,
  'commander-portal-open': renderCommanderPortalOpen,
};

export const originalAsset = (id) => {
  const render = originals[id];
  if (!render) throw new Error(`Unknown project-original preview: ${id}`);
  return render();
};

export const writeOriginalWav = async (id, path) => {
  const { channels, duration, targetRmsDbfs, peakCeiling } = originalAsset(id);
  const dataSize = channels[0].length * 4;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < channels[0].length; index += 1) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[0][index])) * 32767), 44 + index * 4);
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[1][index])) * 32767), 46 + index * 4);
  }
  await writeFile(path, buffer);
  return { duration, targetRmsDbfs, peakCeiling };
};
