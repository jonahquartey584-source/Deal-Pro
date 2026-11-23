// Moving liquid background: soft colour blobs drifting and merging, drawn at
// low resolution and scaled up so it stays smooth and light on a phone battery.
let colours = ["#ff2f86", "#ff8cc0", "#7a1748"], bg = "#0b0709";
export function setLiquidColours(c, b) { colours = c; bg = b; }

export function startLiquid(canvas) {
  const ctx = canvas.getContext("2d");
  const W = 96, H = 160; // tiny buffer, scaled up by CSS = natural blur
  canvas.width = W; canvas.height = H;
  canvas.style.filter = "blur(18px) saturate(1.15)";
  canvas.style.transform = "scale(1.15)";
  const blobs = Array.from({ length: 7 }, (_, i) => ({
    x: Math.random() * W, y: Math.random() * H, r: 34 + Math.random() * 34,
    a: Math.random() * Math.PI * 2, s: 0.0025 + Math.random() * 0.004, c: i % 3,
    ox: 18 + Math.random() * 30, oy: 26 + Math.random() * 46,
  }));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t = 0, last = 0;
  function frame(ts) {
    if (ts - last > 33) { // ~30fps is plenty for a slow liquid
      last = ts; t += reduce ? 0 : 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (const b of blobs) {
        const x = b.x + Math.cos(b.a + t * b.s) * b.ox;
        const y = b.y + Math.sin(b.a * 1.3 + t * b.s * 0.8) * b.oy;
        const r = b.r * (1 + 0.15 * Math.sin(t * b.s * 2 + b.a));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, hexA(colours[b.c], 0.85));
        g.addColorStop(0.55, hexA(colours[b.c], 0.35));
        g.addColorStop(1, hexA(colours[b.c], 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // darken/lighten veil so text stays readable
      ctx.fillStyle = hexA(bg, 0.35); ctx.fillRect(0, 0, W, H);
    }
    if (!document.hidden && !canvas.hidden) requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !canvas.hidden) requestAnimationFrame(frame); });
  requestAnimationFrame(frame);
}

function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
