/**
 * Multi-step dancing cats (Go Kitty Go vibe)
 * 4 clear poses: rest → pump-L → pump-both → pump-R
 */
(() => {
  const W = 72;
  const H = 96;

  function drawPose(ctx, pose, palette) {
    const { fur, stripe, belly, pad, outline, blush } = palette;
    const px = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };

    ctx.clearRect(0, 0, W, H);

    // ground shadow
    ctx.fillStyle = "rgba(43,42,40,0.12)";
    ctx.beginPath();
    ctx.ellipse(36, 90, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // arm offsets by pose (Go Kitty: paws pump)
    // pose 0 rest, 1 left high, 2 both high, 3 right high
    const arms = [
      { lx: 8, ly: 48, rx: 56, ry: 48 },
      { lx: 4, ly: 18, rx: 54, ry: 46 },
      { lx: 6, ly: 14, rx: 58, ry: 14 },
      { lx: 10, ly: 46, rx: 60, ry: 18 },
    ][pose];

    const legLift = [0, -2, 0, -2][pose];
    const bodyY = [50, 48, 46, 48][pose];
    const headY = [26, 24, 22, 24][pose];
    const lean = [0, -2, 0, 2][pose];

    // tail
    px(48 + lean, bodyY + 2, 4, 14, outline);
    px(50 + lean, bodyY - 6, 4, 12, fur);
    px(52 + lean, bodyY - 12, 4, 8, fur);

    // back arm
    px(arms.lx - 1, arms.ly - 1, 10, 18, outline);
    px(arms.lx, arms.ly, 8, 16, fur);
    px(arms.lx - 1, arms.ly - 6, 10, 10, outline);
    px(arms.lx, arms.ly - 5, 8, 8, fur);
    // beans
    px(arms.lx + 1, arms.ly - 3, 2, 2, pad);
    px(arms.lx + 4, arms.ly - 4, 2, 2, pad);
    px(arms.lx + 5, arms.ly - 1, 2, 2, pad);

    // body
    px(20 + lean, bodyY - 2, 28, 30, outline);
    px(22 + lean, bodyY, 24, 26, fur);
    px(26 + lean, bodyY + 8, 16, 14, belly);
    px(24 + lean, bodyY + 4, 20, 3, stripe);
    px(25 + lean, bodyY + 12, 18, 3, stripe);

    // front arm
    px(arms.rx - 1, arms.ry - 1, 10, 18, outline);
    px(arms.rx, arms.ry, 8, 16, fur);
    px(arms.rx - 1, arms.ry - 6, 10, 10, outline);
    px(arms.rx, arms.ry - 5, 8, 8, fur);
    px(arms.rx + 1, arms.ry - 3, 2, 2, pad);
    px(arms.rx + 4, arms.ry - 4, 2, 2, pad);
    px(arms.rx + 5, arms.ry - 1, 2, 2, pad);

    // legs
    px(24 + lean, 72 + legLift, 10, 14, outline);
    px(26 + lean, 72 + legLift, 8, 12, fur);
    px(38 + lean, 72 - legLift, 10, 14, outline);
    px(40 + lean, 72 - legLift, 8, 12, fur);
    px(24 + lean, 84 + legLift, 12, 5, outline);
    px(26 + lean, 84 + legLift, 10, 4, fur);
    px(36 + lean, 84 - legLift, 12, 5, outline);
    px(38 + lean, 84 - legLift, 10, 4, fur);

    // head
    px(20 + lean, headY - 2, 28, 26, outline);
    px(22 + lean, headY, 24, 22, fur);
    // ears
    px(22 + lean, headY - 10, 8, 12, outline);
    px(24 + lean, headY - 8, 6, 10, fur);
    px(25 + lean, headY - 6, 3, 5, pad);
    px(38 + lean, headY - 10, 8, 12, outline);
    px(40 + lean, headY - 8, 6, 10, fur);
    px(42 + lean, headY - 6, 3, 5, pad);
    // face
    px(28 + lean, headY + 6, 3, 3, outline);
    px(41 + lean, headY + 6, 3, 3, outline);
    px(34 + lean, headY + 10, 4, 3, pad);
    px(32 + lean, headY + 14, 8, 2, outline);
    px(24 + lean, headY + 10, 4, 3, blush);
    px(44 + lean, headY + 10, 4, 3, blush);
  }

  const PAL_ORANGE = {
    fur: "#f0a04a",
    stripe: "#d97828",
    belly: "#ffe0c2",
    pad: "#ffb0a8",
    outline: "#2b2a28",
    blush: "#ffc0b8",
  };
  const PAL_GRAY = {
    fur: "#9aa3ad",
    stripe: "#6d7682",
    belly: "#e8eef2",
    pad: "#f0c4bc",
    outline: "#2b2a28",
    blush: "#e8b4b0",
  };

  function makeDancer(palette, speed = 140) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvas.className = "dance-canvas";
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    let frame = 0;
    let acc = 0;
    const order = [0, 1, 2, 3, 2, 1]; // few clear dance steps loop

    function tick(dt) {
      acc += dt;
      if (acc >= speed) {
        acc = 0;
        frame = (frame + 1) % order.length;
        drawPose(ctx, order[frame], palette);
      }
    }

    drawPose(ctx, 0, palette);
    return { el: canvas, tick };
  }

  const dancers = [];
  const left = document.querySelector(".side-cat-left");
  const right = document.querySelector(".side-cat-right");
  const mobile = document.querySelector(".mobile-cat");

  if (left) {
    const d = makeDancer(PAL_ORANGE, 130);
    left.innerHTML = "";
    left.appendChild(d.el);
    dancers.push(d);
  }
  if (right) {
    const d = makeDancer(PAL_GRAY, 145);
    right.innerHTML = "";
    right.appendChild(d.el);
    dancers.push(d);
  }
  if (mobile) {
    const d = makeDancer(PAL_ORANGE, 130);
    mobile.innerHTML = "";
    mobile.appendChild(d.el);
    dancers.push(d);
  }

  let last = performance.now();
  function loop(now) {
    const dt = now - last;
    last = now;
    for (const d of dancers) d.tick(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
