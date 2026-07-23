# Music + charts

## Flow

- **START GAME** → choose song + paw color → countdown → play
- **QUIT** — bye screen
- In-game: Pause (❚❚ / Esc / P) → Resume, Restart, Quit

## Add a song

1. Create `songs/<id>/` and put the mp3 at `songs/<id>/audio.mp3`
2. Build an accurate chart:
   ```bash
   python tools/build_chart.py songs/<id>/audio.mp3 -o songs/<id>/chart.json
   ```
3. Add an entry to `songs.json`

Charts use percussive + melodic onsets snapped tightly to the beat grid.

## Current songs

| id | title |
|----|-------|
| `cupid` | Cupid |
| `soda-pop` | Soda Pop |
| `not-cute-anymore` | NOT CUTE ANYMORE |
| `love-scenario` | LOVE SCENARIO |
| `super-shy` | Super Shy |
| `anghang` | Anghang (My Humps) |

If a song feels early/late, tweak `"offset"` in that song’s chart JSON (seconds).
