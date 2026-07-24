/**
 * Maxwell the Cat dancers — one shared WebM, drawn left + right (chroma keyed).
 */
(() => {
  const SRC = "assets/maxwell.webm";
  const OUT_W = 220;
  const OUT_H = 260;
  const END_TRIM_SEC = 0.55;
  const LOOP_START_SEC = 0.05;

  function isGreenScreen(r, g, b) {
    const greenDominant = g > 85 && g > r * 1.3 && g > b * 1.2;
    const veryGreen = g > 130 && r < 125 && b < 125;
    return greenDominant || veryGreen;
  }

  function chromaKeyFrame(ctx) {
    const frame = ctx.getImageData(0, 0, OUT_W, OUT_H);
    const d = frame.data;
    const bottomBand = Math.floor(OUT_H * 0.92);
    let darkCount = 0;
    let opaqueCount = 0;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const y = Math.floor((i / 4) / OUT_W);

      if (isGreenScreen(r, g, b)) {
        d[i + 3] = 0;
        continue;
      }

      const greenish = g - Math.max(r, b);
      if (greenish > 35 && g > 75) {
        d[i + 3] = Math.max(0, d[i + 3] - greenish * 1.6);
      }

      if (y >= bottomBand && r < 28 && g < 28 && b < 28) {
        d[i + 3] = 0;
      }

      if (d[i + 3] > 40) {
        opaqueCount++;
        if (r < 40 && g < 40 && b < 40) darkCount++;
      }
    }

    const mostlyBlack = opaqueCount > 80 && darkCount / opaqueCount > 0.92;
    if (!mostlyBlack) ctx.putImageData(frame, 0, 0);
    return mostlyBlack;
  }

  function drawVideoTo(ctx, video) {
    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;
    const cropL = vw * 0.04;
    const cropR = vw * 0.04;
    const cropT = vh * 0.02;
    const cropB = vh * 0.045;
    const sw = Math.max(1, vw - cropL - cropR);
    const sh = Math.max(1, vh - cropT - cropB);
    const scale = Math.min(OUT_W / sw, OUT_H / sh) * 1.05;
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (OUT_W - dw) / 2;
    const dy = (OUT_H - dh) / 2;
    ctx.clearRect(0, 0, OUT_W, OUT_H);
    ctx.drawImage(video, cropL, cropT, sw, sh, dx, dy, dw, dh);
  }

  function makeCanvas(flip = false) {
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    canvas.className = "dance-canvas maxwell-canvas" + (flip ? " flip" : "");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    return { canvas, ctx };
  }

  // Single shared video — multiple <video> copies often leave one side blank
  const video = document.createElement("video");
  video.src = SRC;
  video.muted = true;
  video.loop = false;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");

  let ready = false;
  let endLimit = Infinity;

  function tryPlay() {
    const p = video.play();
    if (p && typeof p.then === "function") p.catch(() => {});
  }

  function restartLoop() {
    try { video.currentTime = LOOP_START_SEC; } catch { /* */ }
    tryPlay();
  }

  function updateEndLimit() {
    if (video.duration && Number.isFinite(video.duration)) {
      endLimit = Math.max(LOOP_START_SEC + 0.2, video.duration - END_TRIM_SEC);
    }
  }

  video.addEventListener("loadedmetadata", updateEndLimit);
  video.addEventListener("durationchange", updateEndLimit);
  video.addEventListener("loadeddata", () => { ready = true; updateEndLimit(); tryPlay(); });
  video.addEventListener("canplay", tryPlay);
  video.addEventListener("ended", restartLoop);
  video.addEventListener("timeupdate", () => {
    if (video.currentTime >= endLimit) restartLoop();
  });

  window.addEventListener("pointerdown", tryPlay, { once: true });
  window.addEventListener("keydown", tryPlay, { once: true });
  document.getElementById("playBtn")?.addEventListener("click", tryPlay);

  const surfaces = [];
  const left = document.querySelector(".side-cat-left");
  const right = document.querySelector(".side-cat-right");
  const mobile = document.querySelector(".mobile-cat");

  if (left) {
    const s = makeCanvas(false);
    left.innerHTML = "";
    left.appendChild(s.canvas);
    surfaces.push(s);
  }
  if (right) {
    const s = makeCanvas(true);
    right.innerHTML = "";
    right.appendChild(s.canvas);
    surfaces.push(s);
  }
  if (mobile) {
    const s = makeCanvas(false);
    mobile.innerHTML = "";
    mobile.appendChild(s.canvas);
    surfaces.push(s);
  }

  function loop() {
    if (ready && video.readyState >= 2) {
      if (video.currentTime >= endLimit) {
        restartLoop();
      } else {
        // Draw once to first canvas, then copy pixels to others (same frame)
        const primary = surfaces[0];
        if (primary) {
          drawVideoTo(primary.ctx, video);
          const black = chromaKeyFrame(primary.ctx);
          if (black) {
            restartLoop();
            for (const s of surfaces) s.ctx.clearRect(0, 0, OUT_W, OUT_H);
          } else {
            for (let i = 1; i < surfaces.length; i++) {
              surfaces[i].ctx.clearRect(0, 0, OUT_W, OUT_H);
              surfaces[i].ctx.drawImage(primary.canvas, 0, 0);
            }
          }
        }
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
