(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const el = {
    title: document.getElementById("title"),
    songs: document.getElementById("songs"),
    results: document.getElementById("results"),
    bye: document.getElementById("bye"),
    hud: document.getElementById("hud"),
    score: document.getElementById("score"),
    lives: document.getElementById("lives"),
    combo: document.getElementById("combo"),
    judgement: document.getElementById("judgement"),
    playBtn: document.getElementById("playBtn"),
    quitBtn: document.getElementById("quitBtn"),
    songsBackBtn: document.getElementById("songsBackBtn"),
    retryBtn: document.getElementById("retryBtn"),
    grade: document.getElementById("grade"),
    resultMood: document.getElementById("resultMood"),
    resultTitle: document.getElementById("resultTitle"),
    rScore: document.getElementById("rScore"),
    rPerfects: document.getElementById("rPerfects"),
    rCombo: document.getElementById("rCombo"),
    rAcc: document.getElementById("rAcc"),
    skinRow: document.getElementById("skinRow"),
    pauseBtn: document.getElementById("pauseBtn"),
    pause: document.getElementById("pause"),
    resumeBtn: document.getElementById("resumeBtn"),
    restartBtn: document.getElementById("restartBtn"),
    pauseQuitBtn: document.getElementById("pauseQuitBtn"),
    songList: document.getElementById("songList"),
    menuBtn: document.getElementById("menuBtn"),
    resultsQuitBtn: document.getElementById("resultsQuitBtn"),
    byeBackBtn: document.getElementById("byeBackBtn"),
  };

  // Paw tip (beans) at hit line — leg stays VERTICAL like a dino neck
  const HIT_Y = 455;
  const LEG_BOTTOM = 705;
  const SPAWN_Y = -40;
  const TREAT_R = 14;
  const PERFECT_PX = 42;
  const GOOD_PX = 64;
  const HOLD_PX = 78; // more forgiving while holding
  const LANES = [0.2, 0.35, 0.5, 0.65, 0.8].map((p) => p * W);
  const LOOKAHEAD_STEPS = 9;
  const COUNTDOWN_SECS = 3;
  const HOLD_START_EARLY = 0.12;
  const HOLD_START_LATE = 0.18;
  const HOLD_END_GRACE = 0.06;

  // Active song (from songs.json)
  let songsCatalog = [];
  let selectedSongId = null;
  let selectedSong = null;
  let TRACK_BPM = 120;
  let TRACK_OFFSET = 0;
  let AUDIO_LATENCY = 0.04;
  let chart = { notes: [] };
  let chartCursor = 0;
  let countdownLeft = 0;
  let countdownFlash = "";
  let pauseSongTime = 0;
  let resumeState = "play";
  const TAP_EARLY = 0.11;
  const TAP_LATE = 0.13;
  let songReady = false;

  // Pixel skins from your paw reference
  const SKINS = [
    { name: "orange", fur: "#f0a04a", stripe: "#d97828", pad: "#f5b8b0" },
    { name: "cream", fur: "#e8d4b8", stripe: null, pad: "#6b4a3a" },
    { name: "charcoal", fur: "#5a5a5e", stripe: "#3e3e42", pad: "#f0c4bc" },
    { name: "brown", fur: "#c4a06a", stripe: "#9a7340", pad: "#f0c4bc" },
    { name: "mauve", fur: "#9a8fa0", stripe: "#6e6578", pad: "#f0b8b8" },
    { name: "silver", fur: "#c8c8cc", stripe: "#9a9aa0", pad: "#ff8aa0" },
  ];

  let skinIndex = 0;
  let state = "title";
  let pointerX = W / 2;
  let displayX = W / 2; // smoothed follow (dino feel)
  let dragging = false;
  let lastT = 0;
  let shake = 0;
  let judgementTimer = 0;

  let score = 0;
  let lives = 3;
  let combo = 0;
  let maxCombo = 0;
  let perfects = 0;
  let misses = 0;
  let elapsed = 0;
  let songTime = 0;
  let stepPhase = 0;
  let musicStep = 0;
  let treats = [];
  let particles = [];
  let flash = 0;
  let beatPulse = 0;
  let idleT = 0;
  let lastLane = 2;

  let audioCtx = null;
  let musicGain = null;
  let sfxGain = null;
  let track = null; // HTMLAudioElement for real song
  let useTrack = false;
  let trackPulseAcc = 0;
  let boundAudioPath = "";

  const CUTE_MELODY = [
    72, null, 74, null, 76, null, 74, null, 76, 79, 76, null, 74, null, 72, null,
    72, null, 74, null, 76, null, 79, null, 81, null, 79, 76, 74, null, 72, null,
    69, null, 72, null, 74, null, 72, null, 69, 67, 69, null, 72, null, 74, null,
    76, null, 74, null, 72, null, 69, null, 67, null, 69, 72, 74, 76, 74, 72,
  ];
  const CUTE_BASS = [
    36, null, null, null, 36, null, 43, null, 41, null, null, null, 41, null, 38, null,
    36, null, null, null, 36, null, 43, null, 41, null, null, null, 38, null, 43, null,
  ];
  const CUTE_CHORD = [
    [60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67],
  ];
  const LANE_CHART = [
    2, -1, 1, -1, 3, -1, 2, -1, 4, 3, 2, -1, 1, -1, 0, -1,
    0, -1, 1, -1, 2, -1, 4, -1, 4, -1, 3, 2, 1, -1, 0, -1,
    1, -1, 2, -1, 3, -1, 2, -1, 0, 1, 2, -1, 3, -1, 4, -1,
    4, -1, 3, -1, 2, -1, 1, -1, 0, -1, 1, 2, 3, 4, 3, 2,
  ];

  function skin() {
    return SKINS[skinIndex];
  }

  function ensureAudio() {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    musicGain = audioCtx.createGain();
    sfxGain = audioCtx.createGain();
    musicGain.gain.value = 0.24;
    sfxGain.gain.value = 0.2;
    musicGain.connect(audioCtx.destination);
    sfxGain.connect(audioCtx.destination);
  }

  function bindTrack(src) {
    if (track) {
      track.pause();
      track.removeAttribute("src");
      track.load();
      track = null;
    }
    useTrack = false;
    songReady = false;
    boundAudioPath = src;
    track = new Audio(src);
    track.loop = false;
    track.preload = "auto";
    track.volume = 0.55;
    track.addEventListener("canplaythrough", () => {
      useTrack = true;
      songReady = true;
    }, { once: true });
    track.addEventListener("error", () => {
      useTrack = false;
      songReady = false;
    });
    track.load();
  }

  async function loadChartFor(song) {
    try {
      const res = await fetch(song.chart);
      chart = await res.json();
      if (chart.bpm) TRACK_BPM = chart.bpm;
      if (typeof chart.offset === "number") TRACK_OFFSET = chart.offset;
    } catch {
      chart = { notes: [] };
    }
  }

  let songsReturnTo = "title"; // where BACK from song list goes

  async function selectSong(id, { startAfter = false } = {}) {
    const song = songsCatalog.find((s) => s.id === id) || songsCatalog[0];
    if (!song) return;
    selectedSongId = song.id;
    selectedSong = song;
    ensureAudio();
    bindTrack(song.audio);
    await loadChartFor(song);
    renderSongList();
    if (startAfter) beginRun();
  }

  function hideMenus() {
    el.title?.classList.add("hidden");
    el.songs?.classList.add("hidden");
    el.results?.classList.add("hidden");
    el.pause?.classList.add("hidden");
    el.bye?.classList.add("hidden");
  }

  function showTitle() {
    stopTrack();
    state = "title";
    hideMenus();
    el.hud?.classList.add("hidden");
    if (el.pauseBtn) el.pauseBtn.classList.add("hidden");
    el.title?.classList.remove("hidden");
    countdownFlash = "";
  }

  function openSongsPanel(from = "title") {
    songsReturnTo = from;
    if (from === "pause") {
      // already paused
    } else if (state === "play" || state === "countdown") {
      pauseGame();
      songsReturnTo = "pause";
    }
    el.songs?.classList.remove("hidden");
    el.title?.classList.add("hidden");
    el.results?.classList.add("hidden");
    el.pause?.classList.add("hidden");
    el.bye?.classList.add("hidden");
    renderSongList();
  }

  function closeSongsPanel() {
    el.songs?.classList.add("hidden");
    if (songsReturnTo === "results") {
      el.results?.classList.remove("hidden");
      state = "over";
    } else {
      showTitle();
    }
  }

  function showBye() {
    stopTrack();
    state = "bye";
    hideMenus();
    el.hud?.classList.add("hidden");
    if (el.pauseBtn) el.pauseBtn.classList.add("hidden");
    el.bye?.classList.remove("hidden");
  }

  function renderSongList() {
    if (!el.songList) return;
    el.songList.innerHTML = "";
    if (!songsCatalog.length) {
      const empty = document.createElement("p");
      empty.className = "song-meta";
      empty.textContent = "No songs yet — add entries in songs.json";
      el.songList.appendChild(empty);
      return;
    }
    for (const song of songsCatalog) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "song-btn" + (song.id === selectedSongId ? " active" : "");
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", song.id === selectedSongId ? "true" : "false");
      b.innerHTML = `<span class="song-title">${escapeHtml(song.title)}</span>`;
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        // From Start Game flow → pick song and play
        if (songsReturnTo === "title" || songsReturnTo === "start") {
          await selectSong(song.id, { startAfter: true });
          return;
        }
        await selectSong(song.id);
        el.songs?.classList.add("hidden");
        if (songsReturnTo === "results") {
          el.results?.classList.remove("hidden");
          state = "over";
        } else {
          showTitle();
        }
      });
      el.songList.appendChild(b);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function loadSongsCatalog() {
    try {
      const res = await fetch("songs.json");
      const data = await res.json();
      songsCatalog = Array.isArray(data.songs) ? data.songs : [];
      const prefer = data.default || songsCatalog[0]?.id;
      await selectSong(prefer);
    } catch {
      songsCatalog = [];
      chart = { notes: [] };
      renderSongList();
    }
  }

  function startTrack() {
    if (!track) return;
    track.currentTime = 0;
    track.playbackRate = 1;
    const p = track.play();
    if (p && typeof p.then === "function") {
      p.then(() => { useTrack = true; }).catch(() => { useTrack = false; });
    } else {
      useTrack = true;
    }
  }

  function stopTrack() {
    if (!track) return;
    track.pause();
    track.currentTime = 0;
  }

  function tone(freq, dur, type, dest, vol, when = 0, slideTo = null) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + when;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function softNoise(dur, vol) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const frames = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    const buf = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = audioCtx.createBufferSource();
    const g = audioCtx.createGain();
    const f = audioCtx.createBiquadFilter();
    src.buffer = buf;
    f.type = "highpass";
    f.frequency.value = 4200;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(musicGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function playCatch() {
    tone(659, 0.07, "sine", sfxGain, 0.16);
    tone(988, 0.12, "triangle", sfxGain, 0.12, 0.04);
  }

  function playMiss() {
    tone(220, 0.18, "triangle", sfxGain, 0.12, 0, 140);
  }

  function playMeowSad() {
    tone(480, 0.4, "sine", sfxGain, 0.18, 0, 200);
  }

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // NORMAL → MID → HIGH → MAX — song + falls speed up together
  function speedPhase() {
    const t = trackPlaying() ? (track?.currentTime || elapsed) : elapsed;
    if (t < 28) return "NORMAL";
    if (t < 55) return "MID";
    if (t < 85) return "HIGH";
    return "MAX";
  }

  function speedLabel() {
    return speedPhase();
  }

  function playbackRate() {
    switch (speedPhase()) {
      case "NORMAL": return 1.0;
      case "MID": return 1.12;
      case "HIGH": return 1.25;
      default: return 1.38; // MAX
    }
  }

  function travelTime() {
    switch (speedPhase()) {
      case "NORMAL": return 1.85;
      case "MID": return 1.5;
      case "HIGH": return 1.22;
      default: return 1.0; // falls in quicker
    }
  }

  function currentBpm() {
    if (trackPlaying()) return TRACK_BPM * playbackRate();
    const t = elapsed;
    if (t < 28) return 100 + t * 0.25;
    if (t < 55) return 108 + (t - 28) * 0.55;
    if (t < 85) return 123 + (t - 55) * 0.4;
    return Math.min(155, 135 + (t - 85) * 0.35);
  }

  function applySongSpeed() {
    if (!track) return;
    const rate = playbackRate();
    if (Math.abs(track.playbackRate - rate) > 0.001) {
      track.playbackRate = rate;
    }
  }

  function stepDuration() {
    return 60 / currentBpm() / 4;
  }

  function density() {
    if (elapsed < 20) return 0.5;
    if (elapsed < 45) return 0.68;
    if (elapsed < 75) return 0.82;
    return 0.95;
  }

  function trackPlaying() {
    return !!(useTrack && track && !track.paused && !track.ended);
  }

  function songTimeNow() {
    if (!track) return 0;
    // Small latency pad so notes line up with what you hear
    let lat = AUDIO_LATENCY;
    if (audioCtx) {
      const reported = (audioCtx.outputLatency || 0) + (audioCtx.baseLatency || 0);
      if (reported > 0) lat = Math.min(0.08, Math.max(AUDIO_LATENCY, reported * 0.5));
    }
    return Math.max(0, track.currentTime - TRACK_OFFSET - lat);
  }

  function trackStepFloat() {
    return songTimeNow() / (60 / TRACK_BPM / 4);
  }

  function laneForNote(i) {
    // gentle zig-zag, not chaotic
    const pattern = [2, 1, 3, 2, 0, 2, 4, 3, 1, 2];
    return LANES[pattern[i % pattern.length]];
  }

  function spawnChartNote(note, index) {
    const isHold = note.type === "hold" && note.len >= 0.4;
    treats.push({
      x: laneForNote(index),
      y: SPAWN_Y,
      r: TREAT_R,
      alive: true,
      judged: false,
      kind: isHold ? "hold" : "fish",
      hitTime: note.t,
      travel: travelTime(),
      holdLen: isHold ? Math.min(1.0, note.len) : 0,
      holding: false,
      holdAcc: 0,
      awayFrames: 0,
      chartIndex: index,
    });
  }

  function spawnDueChartNotes() {
    if (!chart.notes || !chart.notes.length) return;
    const now = songTimeNow();
    while (chartCursor < chart.notes.length) {
      const n = chart.notes[chartCursor];
      // spawn early so it arrives on the note time
      if (n.t - travelTime() <= now) {
        spawnChartNote(n, chartCursor);
        chartCursor++;
      } else break;
    }
  }

  function resetRun() {
    score = 0;
    lives = 3;
    combo = 0;
    maxCombo = 0;
    perfects = 0;
    misses = 0;
    elapsed = 0;
    songTime = 0;
    stepPhase = 0;
    musicStep = 0;
    treats = [];
    particles = [];
    flash = 0;
    shake = 0;
    beatPulse = 0;
    lastLane = 2;
    pointerX = W / 2;
    displayX = W / 2;
    chartCursor = 0;
    countdownLeft = 0;
    countdownFlash = "";
    updateHud();
  }

  function updateHud() {
    el.score.textContent = String(score);
    el.lives.textContent = "♥".repeat(Math.max(0, lives)) + "♡".repeat(Math.max(0, 3 - lives));
    if (combo >= 2) {
      el.combo.textContent = `x${combo}`;
      el.combo.classList.add("show");
    } else {
      el.combo.classList.remove("show");
    }
  }

  function showJudgement(text, cls) {
    el.judgement.textContent = text;
    el.judgement.className = `judgement show ${cls}`;
    judgementTimer = 0.45;
  }

  function pickLane(hitStep) {
    let lane = LANE_CHART[hitStep % LANE_CHART.length];
    if (lane < 0) lane = lastLane;
    if (lane === lastLane && Math.random() < 0.35) {
      lane = Math.max(0, Math.min(4, lane + (Math.random() < 0.5 ? -1 : 1)));
    }
    lastLane = lane;
    return LANES[lane];
  }

  function spawnSyncedTreat(hitStep, spawnStep) {
    treats.push({
      x: pickLane(hitStep),
      y: SPAWN_Y,
      r: TREAT_R,
      alive: true,
      judged: false,
      kind: hitStep % 16 === 8 && elapsed > 25 ? "yarn" : "fish",
      spawnStep,
      hitStep,
    });
  }

  function shouldSpawnForStep(hitStep) {
    const dens = density();
    const onBeat = hitStep % 4 === 0;   // quarters — matches song kicks
    const onEighth = hitStep % 2 === 0;

    // When playing Cupid, chart to the beat grid (not the old chiptune melody)
    if (trackPlaying() || useTrack) {
      if (dens < 0.55) return onBeat;
      if (dens < 0.72) return onEighth;
      if (dens < 0.85) return onEighth || hitStep % 4 === 1;
      return onEighth || hitStep % 4 === 1 || hitStep % 4 === 3;
    }

    const mel = CUTE_MELODY[hitStep % CUTE_MELODY.length];
    if (mel == null) return false;
    if (dens < 0.5) return onBeat;
    if (dens < 0.75) return onEighth;
    if (dens < 0.95) return onEighth || hitStep % 4 === 1;
    return true;
  }

  function playMusicStep(step) {
    // Real track handles melody — only pulse the hit line on beats
    if (trackPlaying()) {
      if (step % 4 === 0) beatPulse = 1;
      return;
    }

    const i = step % CUTE_MELODY.length;
    const mel = CUTE_MELODY[i];
    const bass = CUTE_BASS[i % CUTE_BASS.length];

    if (i % 4 === 0) {
      tone(140, 0.11, "sine", musicGain, 0.15, 0, 55);
      beatPulse = 1;
    }
    if (i % 2 === 0) softNoise(0.035, 0.03);
    if (bass != null) tone(midiToFreq(bass), 0.2, "triangle", musicGain, 0.1);
    if (i % 8 === 0) {
      const chord = CUTE_CHORD[(Math.floor(i / 8)) % CUTE_CHORD.length];
      for (const n of chord) tone(midiToFreq(n), 0.5, "sine", musicGain, 0.032);
    }
    if (mel != null) {
      tone(midiToFreq(mel), 0.16, "sine", musicGain, 0.12);
      tone(midiToFreq(mel), 0.1, "triangle", musicGain, 0.035);
    }
  }

  function onMusicStep(step) {
    playMusicStep(step);
    const hitStep = step + LOOKAHEAD_STEPS;
    if (shouldSpawnForStep(hitStep)) spawnSyncedTreat(hitStep, step);
  }

  function burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.35 + Math.random() * 0.25,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function catchTreat(t, quality) {
    t.alive = false;
    t.judged = true;
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    if (quality === "perfect") {
      perfects++;
      score += 100 * combo;
      showJudgement("PERFECT!", "perfect");
    } else {
      score += 60 * Math.max(1, combo);
      showJudgement("YUM", "good");
    }
    if (t.kind === "hold") score += Math.round(40 * t.holdLen * combo);
    playCatch();
    burst(t.x, HIT_Y, t.kind === "hold" ? "#ffb347" : "#ff8b8b");
    flash = 0.12;
    updateHud();
  }

  function startHold(t) {
    t.holding = true;
    t.holdAcc = 0;
    t.awayFrames = 0;
    t.endTime = t.hitTime + t.holdLen;
    showJudgement("HOLD!", "good");
    playCatch();
    beatPulse = 1;
  }

  function finishHold(t) {
    if (t.judged) return;
    t.alive = false;
    t.judged = true;
    t.holding = false;
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    perfects++;
    score += 120 * combo + Math.round(50 * t.holdLen * combo);
    showJudgement("PERFECT!", "perfect");
    playCatch();
    burst(t.x, HIT_Y, "#ffb347");
    flash = 0.12;
    updateHud();
  }

  function missTreat(t) {
    if (t.judged) return;
    t.alive = false;
    t.judged = true;
    t.holding = false;
    misses++;
    combo = 0;
    lives--;
    shake = 8;
    playMiss();
    showJudgement("MISS", "miss");
    updateHud();
    if (lives <= 0) endGame();
  }

  function gradeFor() {
    const attempts = perfects + misses;
    const acc = attempts ? perfects / attempts : 0;
    if (score >= 12000 && acc >= 0.85) return "S";
    if (score >= 7000 && acc >= 0.75) return "A";
    if (score >= 3500) return "B";
    if (score >= 1200) return "C";
    return "F";
  }

  function endGame() {
    state = "over";
    stopTrack();
    hideMenus();
    if (el.pauseBtn) el.pauseBtn.classList.add("hidden");
    playMeowSad();
    el.hud.classList.add("hidden");
    el.results.classList.remove("hidden");
    const g = gradeFor();
    const attempts = perfects + misses;
    const acc = attempts ? Math.round((perfects / attempts) * 100) : 0;
    el.grade.textContent = g;
    el.rScore.textContent = String(score);
    el.rPerfects.textContent = String(perfects);
    el.rCombo.textContent = String(maxCombo);
    el.rAcc.textContent = `${acc}%`;
    const moods = {
      S: ["legendary paws", "beat perfect"],
      A: ["super cat rhythm", "on the beat"],
      B: ["nice groove", "treats secured"],
      C: ["warming up", "feel the beat"],
      F: ["sleepy kitty", "try again, cutie"],
    };
    el.resultMood.textContent = moods[g][0];
    el.resultTitle.textContent = moods[g][1];
  }

  function pauseGame() {
    if (state !== "play" && state !== "countdown") return;
    resumeState = state;
    pauseSongTime = track ? track.currentTime : 0;
    if (track) track.pause();
    state = "paused";
    el.songs?.classList.add("hidden");
    el.pause.classList.remove("hidden");
  }

  function resumeGame() {
    if (state !== "paused") return;
    el.pause.classList.add("hidden");
    el.songs?.classList.add("hidden");
    ensureAudio();
    if (audioCtx?.state === "suspended") audioCtx.resume();
    state = resumeState || "play";
    if (state === "play" && track && useTrack) {
      track.currentTime = pauseSongTime;
      track.play().catch(() => {});
    }
    if (state !== "countdown") countdownFlash = "";
  }

  function beginRun() {
    ensureAudio();
    if (audioCtx.state === "suspended") audioCtx.resume();
    if (selectedSong && (!track || boundAudioPath !== selectedSong.audio)) {
      bindTrack(selectedSong.audio);
    }
    resetRun();
    hideMenus();
    el.hud.classList.remove("hidden");
    if (el.pauseBtn) el.pauseBtn.classList.remove("hidden");
    state = "countdown";
    countdownLeft = COUNTDOWN_SECS;
    countdownFlash = String(Math.ceil(countdownLeft));
    stopTrack();
  }

  function startGame() {
    // Home → choose song first
    if (state === "title" || state === "bye" || state === "over") {
      songsReturnTo = "start";
      openSongsPanel("start");
      return;
    }
    beginRun();
  }

  function beginPlayAfterCountdown() {
    state = "play";
    countdownFlash = "GO!";
    setTimeout(() => { if (state === "play") countdownFlash = ""; }, 450);
    startTrack();
  }

  function setPointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    pointerX = ((clientX - rect.left) / rect.width) * W;
    pointerX = Math.max(36, Math.min(W - 36, pointerX));
  }

  function setSkin(i) {
    skinIndex = (i + SKINS.length) % SKINS.length;
    document.querySelectorAll(".skin-btn").forEach((btn, idx) => {
      btn.classList.toggle("active", idx === skinIndex);
    });
  }

  function buildSkinRow() {
    if (!el.skinRow) return;
    el.skinRow.innerHTML = "";
    SKINS.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "skin-btn" + (i === skinIndex ? " active" : "");
      b.title = s.name;
      b.style.background = s.fur;
      b.style.borderColor = s.stripe || "#2b2a28";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        setSkin(i);
      });
      el.skinRow.appendChild(b);
    });
  }

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    canvas.setPointerCapture?.(e.pointerId);
    setPointerFromEvent(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (state === "play" || dragging || state === "title") setPointerFromEvent(e);
  });
  canvas.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("pointercancel", () => { dragging = false; });

  window.addEventListener("mousemove", (e) => {
    if (state !== "play") return;
    const rect = canvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right) return;
    setPointerFromEvent(e);
  });

  el.playBtn?.addEventListener("click", startGame);
  el.retryBtn?.addEventListener("click", () => beginRun());
  el.songsBackBtn?.addEventListener("click", closeSongsPanel);
  el.quitBtn?.addEventListener("click", showBye);
  el.menuBtn?.addEventListener("click", showTitle);
  el.resultsQuitBtn?.addEventListener("click", showBye);
  el.byeBackBtn?.addEventListener("click", showTitle);
  el.pauseBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    pauseGame();
  });
  el.resumeBtn?.addEventListener("click", resumeGame);
  el.restartBtn?.addEventListener("click", () => beginRun());
  el.pauseQuitBtn?.addEventListener("click", showBye);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" || e.code === "KeyP") {
      if (state === "play" || state === "countdown") pauseGame();
      else if (state === "paused") resumeGame();
    }
  });

  buildSkinRow();
  loadSongsCatalog();

  function update(dt) {
    idleT += dt;
    if (beatPulse > 0) beatPulse = Math.max(0, beatPulse - dt * 4);
    if (flash > 0) flash = Math.max(0, flash - dt);
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
    if (judgementTimer > 0) {
      judgementTimer -= dt;
      if (judgementTimer <= 0) el.judgement.classList.remove("show");
    }

    displayX += (pointerX - displayX) * Math.min(1, dt * 14);

    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
    }
    particles = particles.filter((p) => p.life > 0);

    if (state === "countdown") {
      countdownLeft -= dt;
      const n = Math.ceil(countdownLeft);
      countdownFlash = n > 0 ? String(n) : "GO!";
      if (countdownLeft <= 0) beginPlayAfterCountdown();
      return;
    }

    if (state !== "play") return;

    elapsed += dt;
    songTime += dt;

    const tipX = displayX;
    const usingChart = !!(useTrack && chart.notes && chart.notes.length);

    if (usingChart && trackPlaying()) {
      applySongSpeed();
      spawnDueChartNotes();
      const now = songTimeNow();
      if (Math.floor(now * TRACK_BPM / 60) !== Math.floor((now - dt) * TRACK_BPM / 60)) {
        beatPulse = 1;
      }

      for (const t of treats) {
        if (t.judged) continue;

        // Visual fall based on song clock (arrives at hitTime)
        const travel = t.travel || travelTime();
        const progress = (now - (t.hitTime - travel)) / travel;
        t.y = SPAWN_Y + (HIT_Y - SPAWN_Y) * Math.min(1.0, Math.max(0, progress));

        const dx = Math.abs(t.x - tipX);
        const underTap = dx <= PERFECT_PX ? "perfect" : dx <= GOOD_PX ? "good" : null;
        const underHold = dx <= HOLD_PX;

        if (t.kind === "hold") {
          const endTime = t.hitTime + t.holdLen;
          if (now >= t.hitTime - HOLD_START_EARLY) t.y = HIT_Y;

          if (!t.holding) {
            if (now > t.hitTime + HOLD_START_LATE) {
              missTreat(t);
            } else if (now >= t.hitTime - HOLD_START_EARLY && underHold) {
              startHold(t);
            }
          } else {
            t.holdAcc = Math.max(0, now - t.hitTime);
            // Must finish cleanly at endTime (no stuck leftovers)
            if (now >= endTime) {
              finishHold(t);
            } else if (now >= endTime - HOLD_END_GRACE && underHold) {
              finishHold(t);
            } else if (!underHold) {
              t.awayFrames = (t.awayFrames || 0) + 1;
              if (t.awayFrames > 12) missTreat(t);
            } else {
              t.awayFrames = 0;
            }
          }
          continue;
        }

        // Tap: judge by absolute song time (more accurate than progress alone)
        if (!t.judged) {
          if (now >= t.hitTime - TAP_EARLY && now <= t.hitTime + TAP_LATE) {
            if (underTap === "perfect" || (underTap === "good" && Math.abs(now - t.hitTime) <= 0.07)) {
              catchTreat(t, "perfect");
              continue;
            }
            if (underTap) {
              catchTreat(t, "good");
              continue;
            }
          }
          if (now > t.hitTime + TAP_LATE) missTreat(t);
        }
      }

      treats = treats.filter((t) => {
        if (!t.judged) return true;
        return now < t.hitTime + (t.holdLen || 0) + 0.25;
      });

      if (track && track.ended) endGame();
      return;
    }

    // Fallback procedural mode (no chart / no mp3)
    let stepFrac;
    stepPhase += dt;
    let guard = 0;
    while (stepPhase >= stepDuration() && guard++ < 8) {
      stepPhase -= stepDuration();
      onMusicStep(musicStep++);
    }
    stepFrac = musicStep + stepPhase / stepDuration();

    for (const t of treats) {
      if (!t.alive && t.judged) continue;
      const progress = (stepFrac - t.spawnStep) / LOOKAHEAD_STEPS;
      t.y = SPAWN_Y + (HIT_Y - SPAWN_Y) * Math.min(1.2, Math.max(0, progress));
      if (t.alive && !t.judged && progress >= 0.9 && progress <= 1.1) {
        const dx = Math.abs(t.x - tipX);
        if (dx <= PERFECT_PX) { catchTreat(t, "perfect"); continue; }
        if (dx <= GOOD_PX) { catchTreat(t, "good"); continue; }
      }
      if (t.alive && !t.judged && progress > 1.12) missTreat(t);
    }
    treats = treats.filter((t) => t.alive || stepFrac < (t.hitStep || 0) + 2);
  }

  function pfill(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /**
   * Vertical pixel paw (Like A Dino neck):
   * - always upright
   * - beans / toes at TOP = catch zone
   * - moves left/right only
   */
  function drawVerticalPaw(x, pulse = 0) {
    const s = skin();
    const S = 4;
    const bounce = Math.round(Math.sin(idleT * 5) * 1 + pulse * 2);
    const cx = Math.round(x);
    const top = HIT_Y + bounce;
    const bottom = LEG_BOTTOM;
    const legW = 9 * S; // 36px

    // --- leg column (vertical only) ---
    pfill(cx - legW / 2 - 2, top + 20, legW + 4, bottom - top - 20, "#2b2a28");
    pfill(cx - legW / 2, top + 22, legW, bottom - top - 24, s.fur);

    // tabby stripes
    if (s.stripe) {
      const stripeH = 3 * S;
      for (let y = top + 50; y < bottom - 30; y += 7 * S) {
        pfill(cx - legW / 2 + 4, y, legW - 8, stripeH, s.stripe);
      }
    }

    // --- paw tip at TOP (catch surface) ---
    const pawW = 14 * S;
    const pawH = 11 * S;
    const py = top - 8;

    // outline
    pfill(cx - pawW / 2 - 2, py - 2, pawW + 4, pawH + 4, "#2b2a28");
    // main pad block
    pfill(cx - pawW / 2, py, pawW, pawH, s.fur);

    // four toes along the top edge
    const toeY = py - 3 * S;
    const toeOffsets = [-18, -6, 6, 18];
    for (const ox of toeOffsets) {
      pfill(cx + ox - 5, toeY - 2, 12, 14, "#2b2a28");
      pfill(cx + ox - 3, toeY, 8, 12, s.fur);
    }

    // toe beans (small)
    const bean = s.pad;
    pfill(cx - 18, toeY + 2, 5, 5, bean);
    pfill(cx - 6, toeY + 1, 5, 5, bean);
    pfill(cx + 6, toeY + 1, 5, 5, bean);
    pfill(cx + 18, toeY + 2, 5, 5, bean);
    // big center bean
    pfill(cx - 8, py + 14, 16, 14, bean);
    pfill(cx - 6, py + 16, 12, 10, bean);

    // soft highlight
    pfill(cx - legW / 2 + 4, top + 30, 4, bottom - top - 80, "rgba(255,255,255,0.12)");
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#e7f7ef");
    g.addColorStop(0.55, "#f4efe4");
    g.addColorStop(1, "#efe2cf");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 18; i++) {
      const x = (i * 97 + elapsed * 12) % W;
      const y = (i * 53) % (H * 0.4);
      ctx.fillRect(x, y, 3, 3);
    }

    if (state === "play" || state === "countdown") {
      const pulse = beatPulse * 0.25;
      ctx.strokeStyle = `rgba(228, 120, 70, ${0.35 + pulse})`;
      ctx.lineWidth = 2 + beatPulse * 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(24, HIT_Y);
      ctx.lineTo(W - 24, HIT_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      if (state === "play") {
        ctx.strokeStyle = "rgba(43,42,40,0.05)";
        ctx.lineWidth = 1;
        for (const lx of LANES) {
          ctx.beginPath();
          ctx.moveTo(lx, 40);
          ctx.lineTo(lx, HIT_Y);
          ctx.stroke();
        }

        ctx.fillStyle = "#6d6a63";
        ctx.font = "8px 'Press Start 2P', monospace";
        const bpmShow = Math.round(currentBpm());
        const rate = trackPlaying() ? playbackRate() : 1;
        const rateTxt = rate > 1.01 ? `  x${rate.toFixed(2)}` : "";
        ctx.fillText(`${speedLabel()}${rateTxt}  ${bpmShow}`, 16, H - 16);
      }
    }
  }

  function drawFishAt(x, y, r, color = "#ff8b8b") {
    ctx.fillStyle = "#2b2a28";
    ctx.beginPath();
    ctx.ellipse(x, y, r + 4, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, r + 2, r - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb4b4";
    ctx.beginPath();
    ctx.ellipse(x - 3, y - 2, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e45757";
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + r + 10, y - 7);
    ctx.lineTo(x + r + 10, y + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2b2a28";
    ctx.fillRect(x - 5, y - 3, 3, 3);
  }

  function drawTreat(t) {
    const x = Math.round(t.x);
    let y = Math.round(t.y);
    const r = t.r || 14;

    // Long note = long fish (body stretches up, shrinks as you hold)
    if (t.kind === "hold") {
      const remain = t.holding
        ? Math.max(0.08, t.holdLen - (t.holdAcc || 0))
        : Math.max(0.4, t.holdLen || 0.6);
      const holdPx = Math.max(28, remain * 90);
      if (t.holding || (typeof songTimeNow === "function" && songTimeNow() >= (t.hitTime || 0) - 0.14)) {
        y = HIT_Y;
      }

      ctx.fillStyle = "#2b2a28";
      ctx.fillRect(x - 10, y - holdPx, 20, holdPx + 8);
      ctx.fillStyle = "#ffb347";
      ctx.fillRect(x - 8, y - holdPx + 2, 16, holdPx + 4);
      ctx.fillStyle = "#ffd08a";
      ctx.fillRect(x - 4, y - holdPx + 6, 5, Math.max(8, holdPx - 10));
      drawFishAt(x, y, r + 1, "#ffb347");
      return;
    }

    if (t.kind === "yarn") {
      ctx.fillStyle = "#2b2a28";
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7ec8ff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3e8ec4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, r - 4, 0.2, Math.PI * 1.5);
      ctx.stroke();
      return;
    }

    drawFishAt(x, y, r, "#ff8b8b");
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawBackground();

    const x = state === "title"
      ? W / 2 + Math.sin(idleT * 1.2) * 40
      : displayX;

    if (state !== "title") {
      for (const t of treats) if (t.alive || t.holding) drawTreat(t);
    } else {
      drawTreat({ x: W * 0.3, y: 160 + Math.sin(idleT * 2) * 8, r: 12, kind: "fish" });
      drawTreat({ x: W * 0.7, y: 200 + Math.cos(idleT * 1.6) * 8, r: 12, kind: "hold", holdLen: 0.8, holdAcc: 0, holding: false });
    }

    drawVerticalPaw(x, state === "play" ? beatPulse : 0);
    drawParticles();

    if (countdownFlash && (state === "countdown" || countdownFlash === "GO!")) {
      ctx.fillStyle = "rgba(255,248,238,0.35)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#c46f28";
      ctx.font = "48px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(countdownFlash, W / 2, H * 0.38);
      if (state === "countdown") {
        ctx.font = "10px 'Press Start 2P', monospace";
        ctx.fillStyle = "#6d6a63";
        ctx.fillText("get ready...", W / 2, H * 0.48);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  function frame(t) {
    const dt = Math.min(0.033, (t - lastT) / 1000 || 0.016);
    lastT = t;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  updateHud();
  requestAnimationFrame(frame);
})();
