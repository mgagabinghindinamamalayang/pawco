# Pawco Pulse

Cute pixel catch-rhythm game inspired by *Like A Dino!* — drag a cat paw to catch falling treats.

## Play

Open `index.html` in a browser, or:

```bash
npx --yes serve .
```

**Controls:** drag mouse or finger under falling treats.

## Songs

Pick a track on the title screen. To add more, see [MUSIC.md](MUSIC.md).

| Song | Artist |
|------|--------|
| Cupid | Bongo Cat |
| Soda Pop | Bongo Cat |
| NOT CUTE ANYMORE | Bongo Cat |
| LOVE SCENARIO | Bongo Cat |
| Super Shy | Bongo Cat |
| Strategy | Bongo Cat |
| Butter | Bongo Cat |
| Anghang (My Humps) | Bongo Cat |

## Files

| Path | What |
|------|------|
| `songs.json` | Song list catalog |
| `songs/<id>/` | Audio + chart per song |
| `tools/build_chart.py` | Generate a chart from an mp3 |
| `game.js` | Gameplay |
