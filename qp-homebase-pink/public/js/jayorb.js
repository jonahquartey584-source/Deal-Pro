// Jay's holographic orb, from Qp Homebase (public/jayorb.js): layers of spinning
// data rings around a fiery particle core, drawn live in the theme colour
// (--jay-rgb) and reacting to what Jay is doing (idle/listening/thinking/speaking).
const TAU = Math.PI * 2;

// small seeded random, so the rings look the same every time
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function mount(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");
  const state = opts.state || (() => "idle");
  const level = opts.level || (() => 0);
  const detail = opts.detail ?? 1;
  const rand = rng(7);
  let rgb = [200, 222, 255], rgbAt = 0, dpr = 1, W = 0, H = 0, raf = 0;
  let energy = 0.4, spin = 0, lastT = performance.now();
  const ripples = [];
  let rippleAt = 0;

  // --- the flat HUD rings (facing you) ---
  const KINDS = ["arcs", "ticks", "arcs", "dots", "double", "arcs", "ticks", "blocks"];
  const ringCount = detail < 0.6 ? 7 : 13;
  const hud = [];
  for (let i = 0; i < ringCount; i++) {
    const kind = KINDS[i % KINDS.length];
    const r = 0.5 + (i / (ringCount - 1)) * 0.9;
    const segs = [];
    let a = rand() * TAU;
    const n = kind === "blocks" ? 10 + Math.floor(rand() * 10) : 2 + Math.floor(rand() * 5);
    for (let k = 0; k < n; k++) {
      const len = kind === "blocks" ? 0.04 + rand() * 0.08 : 0.2 + rand() * 1.4;
      segs.push([a, len]);
      a += len + 0.08 + rand() * (kind === "blocks" ? 0.25 : 0.9);
    }
    hud.push({
      kind, r, segs,
      sp: (rand() * 0.45 + 0.05) * (i % 2 ? -1 : 1),
      w: kind === "double" ? 1 : kind === "blocks" ? 4 + rand() * 4 : 0.8 + rand() * 2.2,
      a: 0.35 + rand() * 0.5,
      ticks: 60 + Math.floor(rand() * 4) * 30,
    });
  }

  // --- particle streams orbiting on tilted paths ---
  const bands = [
    { tilt: 1.2, yaw: 0.3, r: 0.95, sp: 0.55, n: 260 },
    { tilt: 0.55, yaw: 1.4, r: 1.1, sp: -0.38, n: 220 },
    { tilt: 1.45, yaw: 2.4, r: 0.78, sp: 0.8, n: 200 },
  ].map((b) => ({
    ...b,
    pts: Array.from({ length: Math.round(b.n * detail) }, () => ({ a: rand() * TAU, dr: (rand() - 0.5) * 0.09, dy: (rand() - 0.5) * 0.05, s: 0.5 + rand() * 1.3, tw: rand() * TAU })),
  }));

  // --- the fiery core: a dense ball of points ---
  const core = Array.from({ length: Math.round(520 * detail) }, () => {
    const u = rand() * 2 - 1, th = rand() * TAU, rr = Math.cbrt(rand()) * 0.42, k = Math.sqrt(1 - u * u);
    return { x: k * Math.cos(th) * rr, y: u * rr, z: k * Math.sin(th) * rr, s: 0.5 + rand() * 1.2, tw: rand() * TAU };
  });

  function readColour(now) {
    if (now - rgbAt < 600) return;
    rgbAt = now;
    const m = getComputedStyle(canvas).getPropertyValue("--jay-rgb").match(/(\d+)\D+(\d+)\D+(\d+)/);
    if (m) rgb = [+m[1], +m[2], +m[3]];
  }
  const col = (a, white = 0) => {
    const r = Math.round(rgb[0] + (255 - rgb[0]) * white), g = Math.round(rgb[1] + (255 - rgb[1]) * white), b = Math.round(rgb[2] + (255 - rgb[2]) * white);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  };
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w !== W || h !== H) { W = canvas.width = w; H = canvas.height = h; }
  }
  function rot(x, y, z, a, b) {
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
    return [x1, y * cb - z1 * sb, y * sb + z1 * cb];
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden || !canvas.offsetWidth) { lastT = now; return; }
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    size();
    readColour(now);
    const st = state();
    const lv = level();
    const target = { idle: 0.45, listening: 1, thinking: 0.9, speaking: 0.72 + lv * 0.28 }[st] ?? 0.45;
    energy += (target - energy) * Math.min(1, dt * 4);
    const speed = st === "thinking" ? 3.4 : st === "listening" ? 1.7 : st === "speaking" ? 1.3 : 0.6;
    spin += dt * speed;
    const t = now / 1000;
    if (st === "listening" && now - rippleAt > 700) { ripples.push(now); rippleAt = now; }

    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.33;
    const small = W < 240 * dpr;
    const lw = dpr * (small ? 0.75 : 1);
    const E = 0.45 + energy * 0.75;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    // soft glow behind everything
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
    halo.addColorStop(0, col(0.22 * E));
    halo.addColorStop(0.5, col(0.07 * E));
    halo.addColorStop(1, col(0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    // flat HUD rings
    for (const g of hud) {
      const rr = R * g.r * (1 + lv * 0.03);
      const rotA = spin * g.sp;
      const flick = 0.85 + 0.15 * Math.sin(t * 7 + g.r * 20);
      if (g.kind === "ticks") {
        ctx.lineWidth = lw;
        ctx.strokeStyle = col(g.a * 0.7 * E * flick);
        ctx.beginPath();
        for (let i = 0; i < g.ticks; i++) {
          const a = rotA + (i / g.ticks) * TAU;
          const len = (i % 5 === 0 ? 0.055 : 0.025) * R;
          ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
          ctx.lineTo(cx + Math.cos(a) * (rr - len), cy + Math.sin(a) * (rr - len));
        }
        ctx.stroke();
      } else if (g.kind === "dots") {
        ctx.fillStyle = col(g.a * 0.8 * E * flick, 0.3);
        const n = 120, s = lw * 1.4;
        for (let i = 0; i < n; i++) {
          if (i % 12 > 8) continue;
          const a = rotA + (i / n) * TAU;
          ctx.fillRect(cx + Math.cos(a) * rr - s / 2, cy + Math.sin(a) * rr - s / 2, s, s);
        }
      } else {
        ctx.lineWidth = g.w * lw;
        ctx.strokeStyle = col(g.a * E * flick, g.kind === "blocks" ? 0.1 : 0.25);
        for (const [a0, len] of g.segs) {
          ctx.beginPath(); ctx.arc(cx, cy, rr, rotA + a0, rotA + a0 + len); ctx.stroke();
          if (g.kind === "double") { ctx.beginPath(); ctx.arc(cx, cy, rr + 4 * lw, rotA + a0 + 0.05, rotA + a0 + len - 0.05); ctx.stroke(); }
        }
      }
    }

    // radial data spokes that flicker in and out
    ctx.lineWidth = lw;
    for (let i = 0; i < 16; i++) {
      const on = Math.sin(t * 1.7 + i * 2.3) > 0.55;
      if (!on) continue;
      const a = (i / 16) * TAU + spin * 0.05;
      ctx.strokeStyle = col(0.35 * E);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55);
      ctx.lineTo(cx + Math.cos(a) * R * 0.75, cy + Math.sin(a) * R * 0.75);
      ctx.stroke();
    }

    // orbiting particle streams
    for (const b of bands) {
      const yaw = b.yaw + t * 0.04;
      for (const p of b.pts) {
        const a = p.a + spin * b.sp;
        const q = rot(Math.cos(a) * (b.r + p.dr), p.dy, Math.sin(a) * (b.r + p.dr), yaw, b.tilt);
        const depth = (q[2] + 1) / 2;
        const tw = 0.6 + 0.4 * Math.sin(t * 3 + p.tw);
        const s = p.s * lw * (0.6 + depth);
        ctx.fillStyle = col((0.15 + 0.85 * depth) * tw * 0.8 * E, depth > 0.7 ? 0.45 : 0.05);
        ctx.fillRect(cx + q[0] * R - s / 2, cy + q[1] * R - s / 2, s, s);
      }
    }

    // the fiery core
    const ay = spin * 0.6, ax = 0.5 + Math.sin(t * 0.4) * 0.15;
    const swell = 1 + lv * 0.12;
    for (const p of core) {
      const q = rot(p.x, p.y, p.z, ay, ax);
      const depth = (q[2] + 0.42) / 0.84;
      const tw = 0.5 + 0.5 * Math.sin(t * 4 + p.tw);
      const s = p.s * lw * 1.1;
      ctx.fillStyle = col((0.25 + 0.75 * depth) * tw * 0.75 * E, 0.35 + depth * 0.4);
      ctx.fillRect(cx + q[0] * R * swell - s / 2, cy + q[1] * R * swell - s / 2, s, s);
    }
    const heart = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.45 * swell);
    heart.addColorStop(0, col(0.85 * E, 0.8));
    heart.addColorStop(0.3, col(0.4 * E, 0.4));
    heart.addColorStop(1, col(0));
    ctx.fillStyle = heart;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.45 * swell, 0, TAU); ctx.fill();

    // listening ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const age = (now - ripples[i]) / 1500;
      if (age > 1) { ripples.splice(i, 1); continue; }
      ctx.lineWidth = lw * 1.4;
      ctx.strokeStyle = col(0.55 * (1 - age), 0.3);
      ctx.beginPath(); ctx.arc(cx, cy, R * (0.5 + age * 1.0), 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  raf = requestAnimationFrame(frame);
  return { stop() { cancelAnimationFrame(raf); } };
}
export { mount };
