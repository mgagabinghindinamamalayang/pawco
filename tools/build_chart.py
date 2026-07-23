#!/usr/bin/env python3
"""Build an accurate Pawco Pulse chart from an mp3.

Notes are placed on real audio onsets, lightly snapped to the beat grid
so hits line up with what you hear.

Usage:
  python tools/build_chart.py songs/my-song/audio.mp3 -o songs/my-song/chart.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import librosa
import numpy as np


def snap_to_grid(t: float, grid: float, anchor: float, max_slip: float) -> float:
    """Snap only if close to a grid line — keeps true hits accurate."""
    k = round((t - anchor) / grid)
    snapped = anchor + k * grid
    if abs(snapped - t) <= max_slip:
        return round(float(snapped), 3)
    return round(float(t), 3)


def build_chart(audio_path: Path, density: float = 1.15) -> dict:
    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    # --- tempo / beat grid ---
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames", tightness=100)
    bpm = float(np.atleast_1d(tempo)[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    if len(beat_times) < 4:
        raise SystemExit("Could not find a stable beat grid.")

    gaps = np.diff(beat_times)
    beat_step = float(np.median(gaps))  # ~ quarter note
    grid = beat_step / 4.0  # 16th notes
    # Prefer a later beat as anchor (more stable than the first)
    anchor = float(beat_times[min(16, len(beat_times) - 1)])
    # Re-estimate BPM from median gap for consistency with note timing
    bpm_from_gap = 60.0 / beat_step
    if abs(bpm_from_gap - bpm) / max(bpm, 1) < 0.12:
        bpm = bpm_from_gap

    # --- onsets (true hit moments) ---
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, aggregate=np.median)
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        units="frames",
        backtrack=True,
        delta=0.07,
        wait=2,
    )
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    onset_strengths = onset_env[onset_frames] if len(onset_frames) else np.array([])

    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512)
    rms_hi = float(np.percentile(rms, 70))
    rms_lo = float(np.percentile(rms, 40))

    # Skip quiet intro — first real energy
    start_t = 2.0
    for i, v in enumerate(rms):
        if v >= rms_hi * 0.55 and float(rms_times[i]) >= 1.5:
            start_t = max(1.8, float(rms_times[i]) - 0.15)
            break

    # Strength gate: keep musically salient hits
    if len(onset_strengths):
        thr = float(np.percentile(onset_strengths, 42))
    else:
        thr = 0.0

    min_gap = max(0.14, beat_step * 0.32)  # ~ eighth-ish
    max_slip = grid * 0.45  # only snap if within ~45% of a 16th

    candidates: list[tuple[float, float]] = []  # (time, strength)
    for t, s in zip(onset_times, onset_strengths):
        t = float(t)
        s = float(s)
        if t < start_t or t > duration - 1.0:
            continue
        if s < thr:
            continue
        tt = snap_to_grid(t, grid, anchor, max_slip)
        candidates.append((tt, s))

    # Always seed strong beats (downbeats + backbeats) when energy is present
    for i, bt in enumerate(beat_times):
        bt = float(bt)
        if bt < start_t or bt > duration - 1.0:
            continue
        # every beat, but prefer stronger ones via local onset env
        frame = int(librosa.time_to_frames(bt, sr=sr))
        local = float(onset_env[min(frame, len(onset_env) - 1)])
        # downbeats (every 4) always; others if energetic
        if i % 4 == 0 or local >= thr * 0.9:
            candidates.append((snap_to_grid(bt, grid, anchor, max_slip), local + (2.0 if i % 4 == 0 else 0.0)))

    # Sort by time, then pick best strength inside min_gap windows
    candidates.sort(key=lambda x: x[0])
    picked: list[tuple[float, float]] = []
    for t, s in candidates:
        if not picked:
            picked.append((t, s))
            continue
        if t - picked[-1][0] < min_gap:
            # keep stronger
            if s > picked[-1][1]:
                picked[-1] = (t, s)
        else:
            picked.append((t, s))

    # Density trim if overcrowded — drop weakest, keep spacing
    target = int(max(60, min(280, duration * density)))
    if len(picked) > target:
        ranked = sorted(picked, key=lambda x: -x[1])[:target]
        picked = sorted(ranked, key=lambda x: x[0])
        # re-enforce gap
        tight: list[tuple[float, float]] = []
        for t, s in picked:
            if not tight or t - tight[-1][0] >= min_gap * 0.9:
                tight.append((t, s))
            elif s > tight[-1][1]:
                tight[-1] = (t, s)
        picked = tight

    notes = []
    for t, s in picked:
        # Hold if energy stays high after the hit
        i0 = int(np.searchsorted(rms_times, t))
        hold_len = 0.0
        end = t
        sustained = 0
        for k in range(i0, min(len(rms), i0 + int(2.4 * sr / 512))):
            if rms[k] >= rms_lo:
                sustained += 1
                end = float(rms_times[k])
            else:
                if sustained > 3:
                    break
                if sustained and rms[k] < rms_lo * 0.7:
                    break
        hold_len = end - t
        # Only long notes when clearly sustained and not too common
        want_hold = hold_len >= beat_step * 0.9 and s >= thr * 1.05
        if want_hold:
            hl = min(1.2, max(0.45, round(hold_len, 3)))
            # snap hold length toward beat multiples
            beats = max(1, round(hl / beat_step))
            hl = round(min(1.2, beats * beat_step), 3)
            if hl >= 0.4:
                notes.append({"t": t, "type": "hold", "len": hl})
            else:
                notes.append({"t": t, "type": "tap", "len": 0})
        else:
            notes.append({"t": t, "type": "tap", "len": 0})

    # Cap hold ratio so charts stay catchable
    holds = [n for n in notes if n["type"] == "hold"]
    max_holds = max(10, len(notes) // 7)
    if len(holds) > max_holds:
        # demote shortest holds
        holds_sorted = sorted(holds, key=lambda n: n["len"])
        demote = {id(n) for n in holds_sorted[: len(holds) - max_holds]}
        for n in notes:
            if id(n) in demote:
                n["type"] = "tap"
                n["len"] = 0

    # Final dedupe
    cleaned = []
    for n in notes:
        if cleaned and abs(n["t"] - cleaned[-1]["t"]) < min_gap * 0.75:
            if n["type"] == "hold" and cleaned[-1]["type"] != "hold":
                cleaned[-1] = n
            continue
        cleaned.append(n)

    return {
        "bpm": round(float(bpm), 2),
        "duration": round(duration, 2),
        "anchor": round(anchor, 3),
        "offset": 0,
        "start": round(start_t, 3),
        "notes": cleaned,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Build accurate Pawco Pulse chart from mp3")
    ap.add_argument("audio", type=Path)
    ap.add_argument("-o", "--out", type=Path, required=True)
    ap.add_argument("--density", type=float, default=1.15, help="target notes per second")
    args = ap.parse_args()

    chart = build_chart(args.audio, density=args.density)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(chart, indent=2) + "\n", encoding="utf-8")
    taps = sum(1 for n in chart["notes"] if n["type"] == "tap")
    holds = sum(1 for n in chart["notes"] if n["type"] == "hold")
    print(
        f"Wrote {args.out} — {len(chart['notes'])} notes "
        f"({taps} taps, {holds} holds) @ {chart['bpm']} BPM, {chart['duration']}s"
    )


if __name__ == "__main__":
    main()
