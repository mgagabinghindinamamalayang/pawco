#!/usr/bin/env python3
"""Quick sync quality check for a Pawco chart."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import librosa
import numpy as np


def analyze(song_id: str) -> None:
    audio = Path(f"songs/{song_id}/audio.mp3")
    chart = json.loads(Path(f"songs/{song_id}/chart.json").read_text(encoding="utf-8"))
    y, sr = librosa.load(str(audio), sr=22050, mono=True)
    hop = 256
    tempo, beat_frames = librosa.beat.beat_track(
        y=y, sr=sr, hop_length=hop, units="frames", tightness=120
    )
    bpm_det = float(np.atleast_1d(tempo)[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)
    y_h, y_p = librosa.effects.hpss(y)
    onset_env = 0.45 * librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop) + 0.55 * librosa.onset.onset_strength(
        y=y_p, sr=sr, hop_length=hop
    )
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop,
        units="frames",
        backtrack=True,
        delta=0.055,
        wait=1,
    )
    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop)
    notes = chart["notes"]
    offset = float(chart.get("offset") or 0)
    d_beat = []
    d_onset = []
    for n in notes:
        t = float(n["t"]) + offset
        d_beat.append(float(np.min(np.abs(beat_times - t))) if len(beat_times) else 999)
        d_onset.append(float(np.min(np.abs(onset_times - t))) if len(onset_times) else 999)
    d_beat = np.array(d_beat)
    d_onset = np.array(d_onset)
    print(f"=== {song_id} ===")
    print(
        f"chart bpm={chart['bpm']} detected={bpm_det:.2f} duration={chart['duration']} "
        f"notes={len(notes)} start={chart['start']} offset={offset}"
    )
    print(
        f"note->beat: mean={d_beat.mean()*1000:.1f}ms med={np.median(d_beat)*1000:.1f}ms "
        f"p90={np.percentile(d_beat,90)*1000:.1f}ms within30ms={(d_beat<=0.03).mean()*100:.0f}%"
    )
    print(
        f"note->onset: mean={d_onset.mean()*1000:.1f}ms med={np.median(d_onset)*1000:.1f}ms "
        f"p90={np.percentile(d_onset,90)*1000:.1f}ms within40ms={(d_onset<=0.04).mean()*100:.0f}%"
    )
    print(f"density={len(notes)/chart['duration']:.2f} nps")


if __name__ == "__main__":
    ids = sys.argv[1:] or ["strategy", "butter", "cupid"]
    for sid in ids:
        analyze(sid)
