(() => {
  addEventListener('pointermove', (e) => { document.body.style.setProperty('--cx', e.clientX + 'px'); document.body.style.setProperty('--cy', e.clientY + 'px'); }, { passive: true });
  const parts = {
    GPU: [['RTX 5060', '8 GB', 320, 1.0], ['RTX 5070 Ti', '16 GB', 780, 1.65], ['RTX 5090', '32 GB', 2050, 2.6]],
    CPU: [['Ryzen 5 9600X', '6 cores', 210, 1.0], ['Ryzen 7 9800X3D', '8 cores', 450, 1.2], ['Ryzen 9 9950X', '16 cores', 560, 1.15]],
    RAM: [['32 GB', 'DDR5 6000', 110, 1.0], ['64 GB', 'DDR5 6000', 210, 1.03], ['96 GB', 'DDR5 6400', 320, 1.05]],
    Storage: [['1 TB', 'NVMe Gen4', 70, 1.0], ['2 TB', 'NVMe Gen4', 130, 1.02], ['4 TB', 'NVMe Gen5', 380, 1.04]],
  };
  const pick = { GPU: 1, CPU: 1, RAM: 0, Storage: 1 };
  const host = document.getElementById('parts');
  host.innerHTML = Object.entries(parts).map(([k, list]) => `<div class="part"><h4>${k}</h4><div class="opts" data-k="${k}">${list.map(([n, s, p], i) => `<button class="opt" type="button" data-i="${i}" aria-pressed="${pick[k] === i}"><b>${n}</b><small>${s} &middot; £${p}</small></button>`).join('')}</div></div>`).join('');
  host.addEventListener('click', (e) => {
    const b = e.target.closest('.opt'); if (!b) return;
    const k = b.parentElement.dataset.k; pick[k] = +b.dataset.i;
    b.parentElement.querySelectorAll('.opt').forEach((x) => x.setAttribute('aria-pressed', x === b));
    calc();
  });
  const anim = (el, to, fmt) => {
    const from = parseFloat(el.dataset.v || 0); el.dataset.v = to;
    const t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / 700), v = from + (to - from) * (1 - Math.pow(1 - k, 3)); el.textContent = fmt(v); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  function calc() {
    const g = parts.GPU[pick.GPU], c = parts.CPU[pick.CPU], r = parts.RAM[pick.RAM], s = parts.Storage[pick.Storage];
    const bi = document.getElementById('buildImg'), want = `assets/build-${pick.GPU + 1}.jpg`;
    if (!bi.src.endsWith(want)) { bi.style.opacity = 0; setTimeout(() => { bi.src = want; bi.onload = () => (bi.style.opacity = 1); }, 220); }
    const tag = ['Compact build', 'Mid tower', 'Full tower, liquid cooled'][pick.GPU];
    document.getElementById('buildTag').textContent = tag; bi.alt = tag;
    const base = 420; // case, board, PSU, cooling, build
    const price = base + g[2] + c[2] + r[2] + s[2];
    const f1 = Math.round(88 * g[3] * (pick.CPU === 1 ? 1.12 : 1) * r[3]);
    const f2 = Math.round(f1 * 0.52);
    const ex = +(c[3] * (pick.CPU === 2 ? 1.9 : 1.2) * (1 + pick.RAM * 0.12) * (1 + pick.GPU * 0.15)).toFixed(1);
    anim(document.getElementById('price'), price, (v) => '£' + Math.round(v).toLocaleString('en-GB'));
    anim(document.getElementById('m1'), f1, (v) => Math.round(v) + ' fps');
    anim(document.getElementById('m2'), f2, (v) => Math.round(v) + ' fps');
    anim(document.getElementById('m3'), ex, (v) => v.toFixed(1) + 'x');
    document.getElementById('b1').style.width = Math.min(100, f1 / 260 * 100) + '%';
    document.getElementById('b2').style.width = Math.min(100, f2 / 140 * 100) + '%';
    document.getElementById('b3').style.width = Math.min(100, ex / 4 * 100) + '%';
  }
  const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { calc(); io.disconnect(); } }, { threshold: 0.3 });
  io.observe(document.getElementById('config'));
  // Live bench card in the hero
  let hrs = 31.0;
  setInterval(() => {
    hrs = hrs >= 47.9 ? 12 : hrs + 0.1;
    document.getElementById('lcHrs').textContent = hrs.toFixed(1);
    document.getElementById('lcProg').style.setProperty('--w', (hrs / 48 * 100).toFixed(1) + '%');
    document.getElementById('lcTemp').textContent = 60 + Math.round(Math.random() * 4);
    document.getElementById('lcFps').textContent = `Holding ${208 + Math.round(Math.random() * 12)} fps, zero crashes`;
  }, 1200);
  document.getElementById('reserve').onclick = () => toast(`Build reserved at ${document.getElementById('price').textContent}. We'll confirm stock within a day. Demo only, nothing is charged.`);
})();
