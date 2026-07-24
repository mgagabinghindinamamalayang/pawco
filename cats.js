/**
 * Maxwell the Cat dancers — green-screen WebM with chroma key + light crop.
 */
(() => {
  const SRC = "assets/maxwell.webm";
  const OUT_W = 220;
  const OUT_H = 260;

  function isGreenScreen(r, g, b) {
    const greenDominant = g > 85 && g > r * 1.3 && g > b * 1.2;
    const veryGreen = g > 130 && r < 125 && b < 125;
    return greenDominant || veryGreen;
  }

  function makeDancer({ flip = false, opacity = 1 } = {}) {
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    canvas.className = "dance-canvas maxwell-canvas";
    if (flip) canvas.classList.add("flip");
    canvas.style.opacity = String(opacity);

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const video = document.createElement("video");
    video.src = SRC;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");

    let ready = false;
    let started = false;

    const tryPlay = () => {
      if (started) return;
      const p = video.play();
      if (p && typeof p.then === "function") {
        p.then(() => { started = true; }).catch(() => {});
      } else {
        started = true;
      }
    };

    video.addEventListener("loadeddata", () => {
      ready = true;
      tryPlay();
    });
    video.addEventListener("canplay", tryPlay);

    const kick = () => tryPlay();
    window.addEventListener("pointerdown", kick, { once: true });
    window.addEventListener("keydown", kick, { once: true });

    function tick() {
      if (!ready || video.readyState < 2) return;
      const vw = video.videoWidth || 1;
      const vh = video.videoHeight || 1;

      // Light crop only — trim a thin bottom bar, keep the full cat body
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

      const frame = ctx.getImageData(0, 0, OUT_W, OUT_H);
      const d = frame.data;
      const bottomBand = Math.floor(OUT_H * 0.92); // only touch the very bottom edge

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const y = Math.floor((i / 4) / OUT_W);

        if (isGreenScreen(r, g, b)) {
          d[i + 3] = 0;
          continue;
        }

        // Soft green fringe
        const greenish = g - Math.max(r, b);
        if (greenish > 35 && g > 75) {
          d[i + 3] = Math.max(0, d[i + 3] - greenish * 1.6);
        }

        // Only strip a thin pure-black underline at the extreme bottom
        // (do NOT remove black fur — Maxwell's body is black)
        if (y >= bottomBand && r < 28 && g < 28 && b < 28) {
          d[i + 3] = 0;
        }
      }
      ctx.putImageData(frame, 0, 0);
    }

    return { el: canvas, tick, tryPlay };
  }

  const dancers = [];
  const left = document.querySelector(".side-cat-left");
  const right = document.querySelector(".side-cat-right");
  const mobile = document.querySelector(".mobile-cat");

  if (left) {
    const d = makeDancer({ flip: false });
    left.innerHTML = "";
    left.appendChild(d.el);
    dancers.push(d);
  }
  if (right) {
    const d = makeDancer({ flip: true });
    right.innerHTML = "";
    right.appendChild(d.el);
    dancers.push(d);
  }
  if (mobile) {
    const d = makeDancer({ flip: false, opacity: 0.4 });
    mobile.innerHTML = "";
    mobile.appendChild(d.el);
    dancers.push(d);
  }

  function loop() {
    for (const d of dancers) d.tick();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  document.getElementById("playBtn")?.addEventListener("click", () => {
    for (const d of dancers) d.tryPlay();
  });
})();
