#!/usr/bin/env python3
"""Rebuild with build_chart, lock BPM, and tune global offset for hit sync."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import librosa
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_chart import build_chart  # noqa: E402


def best_offset(note_times: np.ndarray, onset_env: np.ndarray, sr: int, hop: int, search=0.08) -> float:
    if not len(note_times) or not len(onset_env):
        return 0.0
    times = librosa.frames_to_time(np.arange(len(onset_env)), sr=sr, hop_length=hop)
    best_o, best_score = 0.0, -1.0
    for o in np.linspace(-search, search, 65):
        score = 0.0
        for t in note_times:
            tt = float(t) + float(o)
            if tt < times[0] or tt > times[-1]:
                continue
            i = int(np.searchsorted(times, tt))
            i = min(max(i, 0), len(onset_env) - 1)
            lo, hi = max(0, i - 1), min(len(onset_env), i + 2)
            score += float(np.max(onset_env[lo:hi]))
        if score > best_score:
            best_score = score
            best_o = float(o)
    return round(best_o, 3)


def refine(audio: Path, out: Path, bpm_lock: float = 110.0, density: float = 1.45) -> None:
    chart = build_chart(audio, density=density)
    y, sr = librosa.load(str(audio), sr=22050, mono=True)
    hop = 256
    y_h, y_p = librosa.effects.hpss(y)
    onset_env = 0.35 * librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop) + 0.65 * librosa.onset.onset_strength(
        y=y_p, sr=sr, hop_length=hop
    )
    note_times = np.array([n["t"] for n in chart["notes"]], dtype=float)
    offset = best_offset(note_times, onset_env, sr, hop)
    chart["bpm"] = round(float(bpm_lock), 2)
    chart["offset"] = offset
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(chart, indent=2) + "\n", encoding="utf-8")
    taps = sum(1 for n in chart["notes"] if n["type"] == "tap")
    holds = sum(1 for n in chart["notes"] if n["type"] == "hold")
    print(
        f"Wrote {out} — {len(chart['notes'])} notes ({taps} taps, {holds} holds) "
        f"@ {chart['bpm']} BPM, offset={offset}, {chart['duration']}s"
    )


if __name__ == "__main__":
    refine(Path("songs/strategy/audio.mp3"), Path("songs/strategy/chart.json"), 110.0, 1.45)
    refine(Path("songs/butter/audio.mp3"), Path("songs/butter/chart.json"), 110.0, 1.45)
