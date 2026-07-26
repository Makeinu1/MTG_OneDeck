#!/usr/bin/env python3
"""Analyze tempo and loop-boundary candidates without third-party DSP packages."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np


ANALYSIS_SAMPLE_RATE = 12_000
FFT_SIZE = 1_024
HOP_SIZE = 128


def decode_mono(path: Path) -> np.ndarray:
    command = [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        str(path),
        "-map",
        "0:a:0",
        "-ac",
        "1",
        "-ar",
        str(ANALYSIS_SAMPLE_RATE),
        "-f",
        "f32le",
        "pipe:1",
    ]
    decoded = subprocess.run(command, check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(decoded, dtype="<f4").copy()


def moving_average(values: np.ndarray, width: int) -> np.ndarray:
    if width <= 1:
        return values
    kernel = np.ones(width, dtype=np.float64) / width
    return np.convolve(values, kernel, mode="same")


def frame_signal(signal: np.ndarray) -> np.ndarray:
    frame_count = 1 + (len(signal) - FFT_SIZE) // HOP_SIZE
    shape = (frame_count, FFT_SIZE)
    strides = (signal.strides[0] * HOP_SIZE, signal.strides[0])
    return np.lib.stride_tricks.as_strided(signal, shape=shape, strides=strides)


def onset_envelope(signal: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    frames = frame_signal(signal)
    window = np.hanning(FFT_SIZE).astype(np.float32)
    frequencies = np.fft.rfftfreq(FFT_SIZE, 1 / ANALYSIS_SAMPLE_RATE)
    low_mask = (frequencies >= 35) & (frequencies <= 180)
    high_mask = (frequencies >= 180) & (frequencies <= 5_000)

    chunk_size = 1_000
    low_energy_parts: list[np.ndarray] = []
    high_energy_parts: list[np.ndarray] = []
    previous_spectrum: np.ndarray | None = None
    flux_parts: list[np.ndarray] = []

    for offset in range(0, len(frames), chunk_size):
        chunk = frames[offset : offset + chunk_size] * window
        spectrum = np.abs(np.fft.rfft(chunk, axis=1))
        low_energy_parts.append(np.sqrt(np.mean(spectrum[:, low_mask] ** 2, axis=1)))
        high_energy_parts.append(np.sqrt(np.mean(spectrum[:, high_mask] ** 2, axis=1)))

        if previous_spectrum is None:
            differences = np.diff(spectrum, axis=0, prepend=spectrum[:1])
        else:
            differences = np.diff(
                np.concatenate([previous_spectrum[None, :], spectrum], axis=0),
                axis=0,
            )
        flux_parts.append(np.mean(np.maximum(differences, 0), axis=1))
        previous_spectrum = spectrum[-1]

    low_energy = np.concatenate(low_energy_parts)
    high_energy = np.concatenate(high_energy_parts)
    flux = np.concatenate(flux_parts)

    low_log = np.log1p(low_energy)
    high_log = np.log1p(high_energy)
    low_onset = np.maximum(np.diff(low_log, prepend=low_log[0]), 0)
    high_onset = np.maximum(np.diff(high_log, prepend=high_log[0]), 0)

    combined = 0.65 * low_onset + 0.20 * high_onset + 0.15 * (
        flux / (np.percentile(flux, 95) + 1e-9)
    )
    baseline = moving_average(combined, 41)
    envelope = np.maximum(combined - baseline, 0)
    envelope = moving_average(envelope, 3)
    return envelope, low_log


def estimate_tempo(envelope: np.ndarray, start: float, end: float) -> dict[str, float]:
    seconds_per_frame = HOP_SIZE / ANALYSIS_SAMPLE_RATE
    start_frame = max(0, round(start / seconds_per_frame))
    end_frame = min(len(envelope), round(end / seconds_per_frame))
    segment = envelope[start_frame:end_frame].astype(np.float64)
    segment -= np.mean(segment)

    min_bpm = 115.0
    max_bpm = 130.0
    min_lag = round(60 / max_bpm / seconds_per_frame)
    max_lag = round(60 / min_bpm / seconds_per_frame)
    scores: list[tuple[float, int]] = []
    for lag in range(min_lag, max_lag + 1):
        score = float(np.dot(segment[:-lag], segment[lag:]))
        scores.append((score, lag))
    _, best_lag = max(scores)

    # Parabolic interpolation reduces the coarse 10.67 ms frame quantization.
    score_by_lag = {lag: score for score, lag in scores}
    y1 = score_by_lag.get(best_lag - 1, score_by_lag[best_lag])
    y2 = score_by_lag[best_lag]
    y3 = score_by_lag.get(best_lag + 1, score_by_lag[best_lag])
    denominator = y1 - 2 * y2 + y3
    offset = 0.0 if abs(denominator) < 1e-12 else 0.5 * (y1 - y3) / denominator
    interpolated_lag = best_lag + float(np.clip(offset, -1, 1))
    period = interpolated_lag * seconds_per_frame
    return {"bpm": 60 / period, "periodSeconds": period}


def pick_peaks(
    envelope: np.ndarray,
    start: float,
    end: float,
    minimum_distance: float = 0.35,
) -> list[dict[str, float]]:
    seconds_per_frame = HOP_SIZE / ANALYSIS_SAMPLE_RATE
    start_frame = max(1, round(start / seconds_per_frame))
    end_frame = min(len(envelope) - 1, round(end / seconds_per_frame))
    segment = envelope[start_frame:end_frame]
    threshold = float(np.percentile(segment, 55))
    candidates = np.where(
        (envelope[start_frame:end_frame] >= envelope[start_frame - 1 : end_frame - 1])
        & (envelope[start_frame:end_frame] > envelope[start_frame + 1 : end_frame + 1])
        & (envelope[start_frame:end_frame] >= threshold)
    )[0] + start_frame

    order = candidates[np.argsort(envelope[candidates])[::-1]]
    selected: list[int] = []
    minimum_frames = round(minimum_distance / seconds_per_frame)
    for candidate in order:
        if all(abs(int(candidate) - existing) >= minimum_frames for existing in selected):
            selected.append(int(candidate))
    selected.sort()
    return [
        {
            "seconds": frame * seconds_per_frame,
            "strength": float(envelope[frame]),
        }
        for frame in selected
    ]


def rms_windows(signal: np.ndarray, window_seconds: float = 0.05) -> np.ndarray:
    width = round(window_seconds * ANALYSIS_SAMPLE_RATE)
    usable = len(signal) // width * width
    windows = signal[:usable].reshape(-1, width)
    return np.sqrt(np.mean(windows**2, axis=1))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()

    signal = decode_mono(arguments.input)
    duration = len(signal) / ANALYSIS_SAMPLE_RATE
    envelope, _ = onset_envelope(signal)
    rms = rms_windows(signal)
    rms_db = 20 * np.log10(np.maximum(rms, 1e-12))
    active = np.where(rms_db > -45)[0]
    active_end = (int(active[-1]) + 1) * 0.05 if len(active) else 0.0

    tempo_windows = []
    for start in range(0, 240, 30):
        tempo_windows.append(
            {
                "startSeconds": start,
                "endSeconds": min(start + 30, duration),
                **estimate_tempo(envelope, start, min(start + 30, duration)),
            }
        )

    result = {
        "input": str(arguments.input),
        "durationSeconds": duration,
        "analysisSampleRate": ANALYSIS_SAMPLE_RATE,
        "activeEndAtMinus45Db": active_end,
        "globalTempo": estimate_tempo(envelope, 0, min(duration, active_end)),
        "tempoWindows": tempo_windows,
        "startPeaks": pick_peaks(envelope, 0, 20),
        "endPeaks": pick_peaks(envelope, max(0, active_end - 20), active_end),
    }
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    if arguments.output:
        arguments.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
