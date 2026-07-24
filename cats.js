/**
 * Maxwell the Cat dancers — green-screen WebM with chroma key.
 */
(() => {
  const SRC = "assets/maxwell.webm";
  const OUT_W = 160;
  const OUT_H = 200;

  function isGreenScreen(r, g, b) {
    // Key bright green backdrop; keep black/white cat fur
    const greenDominant = g > 90 && g > r * 1.35 && g > b * 1.25;
    const veryGreen = g > 140 && r < 120 && b < 120;
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

    // Autoplay often needs a user gesture — also kick on first click/tap
    const kick = () => tryPlay();
    window.addEventListener("pointerdown", kick, { once: true });
    window.addEventListener("keydown", kick, { once: true });

    function tick() {
      if (!ready || video.readyState < 2) return;
      const vw = video.videoWidth || 1;
      const vh = video.videoHeight || 1;

      // Cover-fit into canvas
      const scale = Math.max(OUT_W / vw, OUT_H / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (OUT_W - dw) / 2;
      const dy = (OUT_H - dh) / 2;

      ctx.clearRect(0, 0, OUT_W, OUT_H);
      ctx.drawImage(video, dx, dy, dw, dh);

      const frame = ctx.getImageData(0, 0, OUT_W, OUT_H);
      const d = frame.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        if (isGreenScreen(r, g, b)) {
          d[i + 3] = 0;
        } else {
          // Soft edge: reduce alpha near green
          const greenish = g - Math.max(r, b);
          if (greenish > 40 && g > 80) {
            d[i + 3] = Math.max(0, d[i + 3] - greenish * 1.5);
          }
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
    const d = makeDancer({ flip: false, opacity: 0.35 });
    mobile.innerHTML = "";
    mobile.appendChild(d.el);
    dancers.push(d);
  }

  function loop() {
    for (const d of dancers) d.tick();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Also try play when Start is clicked
  document.getElementById("playBtn")?.addEventListener("click", () => {
    for (const d of dancers) d.tryPlay();
  });
})();
