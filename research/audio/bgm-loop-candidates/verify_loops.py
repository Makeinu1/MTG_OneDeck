#!/usr/bin/env python3
"""Measure loop duration and seam discontinuity for rendered candidates."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np


SAMPLE_RATE = 48_000
PERIOD_SECONDS = 0.491793868


def decode_stereo(path: Path) -> np.ndarray:
    command = [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        str(path),
        "-map",
        "0:a:0",
        "-ac",
        "2",
        "-ar",
        str(SAMPLE_RATE),
        "-f",
        "f32le",
        "pipe:1",
    ]
    decoded = subprocess.run(command, check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(decoded, dtype="<f4").reshape(-1, 2).copy()


def dbfs(value: float) -> float:
    return 20 * np.log10(max(value, 1e-12))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def verify(path: Path) -> dict[str, object]:
    signal = decode_stereo(path)
    duration = len(signal) / SAMPLE_RATE
    window = round(0.05 * SAMPLE_RATE)
    first_rms = float(np.sqrt(np.mean(signal[:window] ** 2)))
    last_rms = float(np.sqrt(np.mean(signal[-window:] ** 2)))

    differences = np.max(np.abs(np.diff(signal, axis=0)), axis=1)
    boundary_jump = float(np.max(np.abs(signal[0] - signal[-1])))
    p999_difference = float(np.percentile(differences, 99.9))
    beat_count = duration / PERIOD_SECONDS
    nearest_beats = round(beat_count)

    return {
        "file": str(path),
        "sha256": sha256(path),
        "sizeBytes": path.stat().st_size,
        "sampleRate": SAMPLE_RATE,
        "channels": 2,
        "durationSeconds": duration,
        "tempoReferenceBpm": 60 / PERIOD_SECONDS,
        "beatCount": beat_count,
        "nearestIntegerBeats": nearest_beats,
        "beatLengthErrorMilliseconds": (beat_count - nearest_beats)
        * PERIOD_SECONDS
        * 1_000,
        "boundarySampleJumpDbfs": dbfs(boundary_jump),
        "typicalP999SampleDifferenceDbfs": dbfs(p999_difference),
        "boundaryJumpRelativeToP999Db": dbfs(boundary_jump)
        - dbfs(p999_difference),
        "first50msRmsDbfs": dbfs(first_rms),
        "last50msRmsDbfs": dbfs(last_rms),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", type=Path, nargs="+")
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()

    result = {"candidates": [verify(path) for path in arguments.files]}
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    if arguments.output:
        arguments.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
