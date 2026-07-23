#!/usr/bin/env python3
"""Build an accurate Pawco Pulse chart from an mp3.

Priority: real onset times (what you hear), lightly aligned to the beat grid.

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
    """Snap only when very close — otherwise keep the true onset."""
    k = round((t - anchor) / grid)
    snapped = anchor + k * grid
    if abs(snapped - t) <= max_slip:
        return round(float(snapped), 3)
    return round(float(t), 3)


def build_chart(audio_path: Path, density: float = 1.25) -> dict:
    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))
    hop = 256

    # --- tempo / beat grid ---
    tempo, beat_frames = librosa.beat.beat_track(
        y=y, sr=sr, hop_length=hop, units="frames", tightness=120
    )
    bpm = float(np.atleast_1d(tempo)[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)
    if len(beat_times) < 4:
        raise SystemExit("Could not find a stable beat grid.")

    gaps = np.diff(beat_times)
    beat_step = float(np.median(gaps))
    bpm_from_gap = 60.0 / beat_step
    if abs(bpm_from_gap - bpm) / max(bpm, 1) < 0.15:
        bpm = bpm_from_gap

    # Many pop covers get detected at half-time — prefer the dance tempo
    if bpm < 95:
        bpm *= 2.0
        beat_step /= 2.0
        # denser beat grid from original beats + midpoints
        denser = []
        for i, bt in enumerate(beat_times):
            denser.append(float(bt))
            if i + 1 < len(beat_times):
                denser.append(float((bt + beat_times[i + 1]) * 0.5))
        beat_times = np.array(denser, dtype=float)

    grid = beat_step / 4.0  # 16ths
    mid = len(beat_times) // 2
    anchor = float(beat_times[mid])

    # --- multi-band onset strength (percussion + melodic) ---
    onset_env = librosa.onset.onset_strength(
        y=y, sr=sr, hop_length=hop, aggregate=np.median
    )
    # Percussive channel helps bongo/clap sync
    y_harm, y_perc = librosa.effects.hpss(y)
    onset_perc = librosa.onset.onset_strength(
        y=y_perc, sr=sr, hop_length=hop, aggregate=np.median
    )
    # Blend — favor perc for Bongo Cat covers
    n = min(len(onset_env), len(onset_perc))
    onset_env = 0.45 * onset_env[:n] + 0.55 * onset_perc[:n]

    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop,
        units="frames",
        backtrack=True,
        delta=0.055,
        wait=1,
        pre_max=2,
        post_max=2,
        pre_avg=2,
        post_avg=2,
    )
    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop)
    onset_strengths = onset_env[onset_frames] if len(onset_frames) else np.array([])

    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
    rms_hi = float(np.percentile(rms, 72))
    rms_lo = float(np.percentile(rms, 38))

    # First musical energy (skip silence / long intro fade)
    start_t = 1.5
    for i, v in enumerate(rms):
        t = float(rms_times[i])
        if t >= 1.2 and v >= rms_hi * 0.5:
            start_t = max(1.2, t - 0.08)
            break

    if len(onset_strengths):
        thr = float(np.percentile(onset_strengths, 38))
    else:
        thr = 0.0

    # Tighter gaps for accurate dense choruses; still playable
    min_gap = max(0.12, beat_step * 0.28)
    # Only snap if within ~30ms of a 16th — otherwise keep true onset
    max_slip = min(0.03, grid * 0.35)

    candidates: list[tuple[float, float]] = []
    for t, s in zip(onset_times, onset_strengths):
        t = float(t)
        s = float(s)
        if t < start_t or t > duration - 0.9:
            continue
        if s < thr:
            continue
        tt = snap_to_grid(t, grid, anchor, max_slip)
        candidates.append((tt, s))

    # Seed beats that have real energy (keeps pulse when onsets are soft)
    for i, bt in enumerate(beat_times):
        bt = float(bt)
        if bt < start_t or bt > duration - 0.9:
            continue
        frame = int(librosa.time_to_frames(bt, sr=sr, hop_length=hop))
        frame = min(frame, len(onset_env) - 1)
        local = float(onset_env[frame])
        # every downbeat; other beats only if energetic
        if i % 4 == 0 and local >= thr * 0.55:
            candidates.append((snap_to_grid(bt, grid, anchor, max_slip), local + 1.5))
        elif local >= thr * 1.05:
            candidates.append((snap_to_grid(bt, grid, anchor, max_slip), local))

    candidates.sort(key=lambda x: x[0])
    picked: list[tuple[float, float]] = []
    for t, s in candidates:
        if not picked:
            picked.append((t, s))
            continue
        if t - picked[-1][0] < min_gap:
            if s > picked[-1][1]:
                picked[-1] = (t, s)
        else:
            picked.append((t, s))

    target = int(max(70, min(300, duration * density)))
    if len(picked) > target:
        ranked = sorted(picked, key=lambda x: -x[1])[:target]
        picked = sorted(ranked, key=lambda x: x[0])
        tight: list[tuple[float, float]] = []
        for t, s in picked:
            if not tight or t - tight[-1][0] >= min_gap * 0.85:
                tight.append((t, s))
            elif s > tight[-1][1]:
                tight[-1] = (t, s)
        picked = tight

    notes = []
    for t, s in picked:
        i0 = int(np.searchsorted(rms_times, t))
        end = t
        sustained = 0
        for k in range(i0, min(len(rms), i0 + int(2.2 * sr / hop))):
            if rms[k] >= rms_lo:
                sustained += 1
                end = float(rms_times[k])
            else:
                if sustained > 4:
                    break
                if sustained and rms[k] < rms_lo * 0.65:
                    break
        hold_len = end - t
        want_hold = hold_len >= beat_step * 0.95 and s >= thr * 1.1
        if want_hold:
            beats = max(1, round(hold_len / beat_step))
            hl = round(min(1.15, max(0.45, beats * beat_step)), 3)
            if hl >= 0.4:
                notes.append({"t": t, "type": "hold", "len": hl})
            else:
                notes.append({"t": t, "type": "tap", "len": 0})
        else:
            notes.append({"t": t, "type": "tap", "len": 0})

    holds = [n for n in notes if n["type"] == "hold"]
    max_holds = max(8, len(notes) // 8)
    if len(holds) > max_holds:
        holds_sorted = sorted(holds, key=lambda n: n["len"])
        demote = {id(n) for n in holds_sorted[: len(holds) - max_holds]}
        for n in notes:
            if id(n) in demote:
                n["type"] = "tap"
                n["len"] = 0

    cleaned = []
    for n in notes:
        if cleaned and abs(n["t"] - cleaned[-1]["t"]) < min_gap * 0.7:
            if n["type"] == "hold" and cleaned[-1]["type"] != "hold":
                cleaned[-1] = n
            continue
        cleaned.append(n)

    # No other notes while a long note is still active
    cleaned = clear_notes_during_holds(cleaned, pad=max(0.12, min_gap * 0.5))

    return {
        "bpm": round(float(bpm), 2),
        "duration": round(duration, 2),
        "anchor": round(anchor, 3),
        "offset": 0,
        "start": round(start_t, 3),
        "notes": cleaned,
    }


def clear_notes_during_holds(notes: list[dict], pad: float = 0.12) -> list[dict]:
    """Drop taps/holds that start while another hold is still going.

    Long notes should be solo — nothing else falling until they finish.
    """
    if not notes:
        return notes

    holds = [n for n in notes if n.get("type") == "hold" and float(n.get("len") or 0) >= 0.4]
    holds.sort(key=lambda n: (n["t"], -float(n["len"])))
    keep_holds: list[dict] = []
    for h in holds:
        end = h["t"] + float(h["len"])
        conflict = False
        for k in keep_holds:
            kend = k["t"] + float(k["len"])
            if not (end + pad <= k["t"] or kend + pad <= h["t"]):
                conflict = True
                break
        if not conflict:
            keep_holds.append(h)

    hold_windows = [(h["t"], h["t"] + float(h["len"]) + pad) for h in keep_holds]
    keep_ids = {id(h) for h in keep_holds}

    out: list[dict] = []
    for n in notes:
        if n.get("type") == "hold":
            if id(n) in keep_ids:
                out.append(n)
            continue
        t = float(n["t"])
        if any(start < t < end for start, end in hold_windows):
            continue
        out.append(n)

    out.sort(key=lambda n: n["t"])
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Build accurate Pawco Pulse chart from mp3")
    ap.add_argument("audio", type=Path)
    ap.add_argument("-o", "--out", type=Path, required=True)
    ap.add_argument("--density", type=float, default=1.25, help="target notes per second")
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
