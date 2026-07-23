# Music + charts

## Menus

- **START GAME** — countdown then play the selected song
- **CHOOSE SONG** — full song list
- **QUIT** — bye screen (back to menu anytime)
- In-game: **Pause** (❚❚ / Esc / P) → Resume, Restart, Choose Song, Quit

## Add a song

1. Create `songs/<id>/` and put the mp3 at `songs/<id>/audio.mp3`
2. Build an accurate chart from the audio:
   ```bash
   python tools/build_chart.py songs/<id>/audio.mp3 -o songs/<id>/chart.json
   ```
3. Add an entry to `songs.json`

Charts are generated from real onsets + beat grid so notes match what you hear.

## Current songs

| id | title | artist |
|----|-------|--------|
| `cupid` | Cupid | Bongo Cat |
| `soda-pop` | Soda Pop | Bongo Cat |
| `not-cute-anymore` | NOT CUTE ANYMORE | ILLIT · Bongo Cat |
| `love-scenario` | LOVE SCENARIO | iKON · Bongo Cat |

If a song feels early/late, tweak `"offset"` in that song’s chart JSON (seconds).
