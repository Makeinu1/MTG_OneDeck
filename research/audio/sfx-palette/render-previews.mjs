#!/usr/bin/env node
/** Regenerates the bounded AV7-P audition previews. Source files are never modified. */
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeOriginalWav } from './synthesize-originals.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../..');
const outputDirectory = resolve(directory, 'previews');
const preview = (id, name, source, duration, license, comparisonOnly = false) => ({ id, name, source, duration, license, comparisonOnly });
const original = (id, name) => ({ id, name, source: `research/audio/sfx-palette/synthesize-originals.mjs#${id}`, license: 'project-original' });
const previews = [
  preview('draw-slide', 'draw-slide.wav', 'sound/kenney_casino-audio/Audio/card-slide-1.ogg', 0.72, 'CC0-1.0'),
  preview('draw-fan', 'draw-fan.wav', 'sound/kenney_casino-audio/Audio/card-fan-1.ogg', 0.82, 'CC0-1.0'),
  preview('land-place', 'land-place.wav', 'sound/kenney_casino-audio/Audio/card-place-1.ogg', 0.78, 'CC0-1.0'),
  preview('spell-place', 'spell-place.wav', 'sound/kenney_casino-audio/Audio/card-place-2.ogg', 0.78, 'CC0-1.0'),
  original('spell-arcane-snap', 'spell-arcane-snap.wav'),
  preview('spell-summon', 'spell-summon.wav', 'sound/召喚.ogg', 1.0, 'user-supplied-prototype-only', true),
  preview('tap-shove', 'tap-shove.wav', 'sound/kenney_casino-audio/Audio/card-shove-1.ogg', 0.86, 'CC0-1.0'),
  preview('untap-slide', 'untap-slide.wav', 'sound/kenney_casino-audio/Audio/card-slide-3.ogg', 0.72, 'CC0-1.0'),
  preview('resolve-shove', 'resolve-shove.wav', 'sound/kenney_casino-audio/Audio/card-shove-3.ogg', 0.62, 'CC0-1.0'),
  preview('shuffle', 'shuffle.wav', 'sound/kenney_casino-audio/Audio/card-shuffle.ogg', 0.9, 'CC0-1.0'),
  preview('turn-chip', 'turn-chip.wav', 'sound/kenney_casino-audio/Audio/chip-lay-1.ogg', 0.3, 'CC0-1.0'),
  preview('commander-contact', 'commander-contact.wav', 'sound/kenney_casino-audio/Audio/card-place-4.ogg', 0.78, 'CC0-1.0'),
  original('commander-portal-open', 'commander-portal-open.wav'),
  preview('commander-short', 'commander-short.wav', 'sound/統率者召喚.mp3', 1.6, 'user-supplied-prototype-only', true),
  preview('comparison-long', 'comparison-long-invocation.wav', 'sound/統率者、召喚.mp3', 9.56, 'user-supplied-prototype-only', true),
];

const run = (command, args) => execFileSync(command, args, { cwd: root, encoding: 'utf8' });
const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const probe = (path) => JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,bits_per_sample', '-of', 'json', path]));
const truePeak = (path) => {
  const process = spawnSync('ffmpeg', ['-v', 'info', '-i', path, '-af', 'loudnorm=I=-23:LRA=7:TP=-3:print_format=json', '-f', 'null', '-'], { cwd: root, encoding: 'utf8' });
  if (process.status !== 0) throw new Error(`Could not measure true peak for ${path}`);
  const result = `${process.stdout}${process.stderr}`;
  const match = result.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) throw new Error(`loudnorm did not return JSON for ${path}`);
  return Number(JSON.parse(match[0]).input_tp);
};

await mkdir(outputDirectory, { recursive: true });
const manifestPreviews = [];
for (const item of previews) {
  const outputPath = resolve(outputDirectory, item.name);
  let transform;
  if (item.license === 'project-original') {
    const originalMetadata = await writeOriginalWav(item.id, outputPath);
    transform = `fixed-seed bounded synthesis; 2 ms edge fades; 48 kHz stereo PCM s16le; target RMS ${originalMetadata.targetRmsDbfs} dBFS; sample peak ceiling ${originalMetadata.peakCeiling}`;
  } else {
    const sourcePath = resolve(root, item.source);
    const sourceDuration = Number(probe(sourcePath).format.duration);
    const outputDuration = Math.min(item.duration, sourceDuration);
    const fadeOutStart = Math.max(0, outputDuration - 0.002).toFixed(3);
    transform = `trim 0-${outputDuration.toFixed(3)}s; 2 ms edge fades; 48 kHz stereo PCM s16le; limiter ceiling 0.55`;
    // Preserve every non-target AV7-P preview byte-for-byte.
    run('ffmpeg', ['-y', '-v', 'error', '-i', sourcePath, '-af', `atrim=0:${outputDuration},afade=t=in:st=0:d=0.002,afade=t=out:st=${fadeOutStart}:d=0.002,aresample=48000,alimiter=limit=0.55:level=0`, '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', outputPath]);
  }
  const metadata = probe(outputPath);
  manifestPreviews.push({
    id: item.id,
    file: `previews/${item.name}`,
    source: item.source,
    license: item.license,
    transform,
    sha256: await sha256(outputPath),
    durationSec: Number(metadata.format.duration),
    sampleRate: Number(metadata.streams[0]?.sample_rate),
    bitDepth: Number(metadata.streams[0]?.bits_per_sample),
    truePeakDbfs: truePeak(outputPath),
    ...(item.comparisonOnly ? { comparisonOnly: true } : {}),
  });
}

const manifest = {
  version: 1,
  defaults: { palette: 'hybrid', bgmVolume: 70, sfxVolume: 80 },
  paletteIds: ['tabletop', 'hybrid', 'arcane'],
  cueIds: ['draw-completed', 'land-played', 'spell-cast', 'tap', 'untap', 'stack-resolved', 'shuffle-completed', 'turn-advanced', 'commander-cast'],
  generatedBy: 'node research/audio/sfx-palette/render-previews.mjs',
  notes: 'Spell and commander magical layers are fixed-seed project-original synthesis. Voice and long-invocation candidates are comparison-only and absent from playable fixture paths.',
  assets: manifestPreviews,
};
await writeFile(resolve(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Rendered ${manifestPreviews.length} previews in ${relative(root, outputDirectory)} and manifest.json.`);
