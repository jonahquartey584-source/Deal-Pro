(() => {
  const tops = document.getElementById('tops'), baseImg = document.getElementById('pzBase');
  const on = new Set(['mozz', 'basil']);
  let base = 'rosso';
  // Deterministic scatter so toppings land in the same spots every time (percent of the pizza)
  const rnd = (seed) => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  function pts(seed, n, rmax) {
    const r = rnd(seed), out = [];
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rmax; out.push([50 + Math.cos(a) * d, 50 + Math.sin(a) * d, r()]); }
    return out;
  }
  // Photographed topping cut-outs, sized as a share of the pizza's width
  const spec = { mozz: [3, 8, 30, 15], nduja: [11, 11, 32, 7.5], mush: [19, 9, 31, 10], olive: [23, 13, 33, 5.5], basil: [7, 7, 30, 9], honey: [31, 2, 14, 46] };
  const order = ['mozz', 'nduja', 'mush', 'olive', 'basil', 'honey'];
  function draw() {
    tops.innerHTML = '';
    const want = base === 'rosso' ? 'assets/build/rossa.jpg' : 'assets/build/bianca.jpg';
    if (!baseImg.src.endsWith(want)) baseImg.src = want;
    let n = 0;
    order.forEach((t) => {
      if (!on.has(t)) return;
      const [seed, count, rmax, size] = spec[t];
      pts(seed, count, rmax).forEach(([x, y, k]) => {
        const im = document.createElement('img');
        im.src = 'assets/build/' + t + '.webp'; im.alt = ''; im.className = 'sprite';
        im.style.cssText = `left:${x}%;top:${y}%;width:${size * (0.85 + k * 0.3)}%;rotate:${Math.round(k * 360)}deg;--n:${n++}`;
        tops.appendChild(im);
      });
    });
    let total = 9 + (base === 'bianca' ? 0.5 : 0) - 1.5 - 0.5; // margherita includes mozz and basil
    document.querySelectorAll('#toppings .tp').forEach((b) => { if (on.has(b.dataset.t)) total += +b.dataset.p; });
    document.getElementById('tot').textContent = total.toFixed(2);
    document.getElementById('pizza').style.transform = `rotate(${on.size * 24}deg)`;
  }
  document.getElementById('toppings').addEventListener('click', (e) => {
    const b = e.target.closest('.tp'); if (!b) return;
    const t = b.dataset.t; on.has(t) ? on.delete(t) : on.add(t);
    b.setAttribute('aria-pressed', on.has(t)); draw();
  });
  document.querySelectorAll('[data-base]').forEach((b) => b.addEventListener('click', () => {
    base = b.dataset.base; document.querySelectorAll('[data-base]').forEach((x) => x.setAttribute('aria-pressed', x === b)); draw();
  }));
  document.getElementById('addPizza').onclick = () => toast(`Into the oven. Your pizza is £${document.getElementById('tot').textContent} and ready in about 12 minutes.`);
  draw();

  // Live oven card in the hero
  let qty = 1, inOven = 7;
  const setQty = (d) => { qty = Math.max(1, Math.min(9, qty + d)); document.getElementById('qN').textContent = qty; document.getElementById('lcOrder').textContent = `Order ${qty} for £${qty * 9}`; };
  document.getElementById('qMinus').onclick = () => setQty(-1);
  document.getElementById('qPlus').onclick = () => setQty(1);
  document.getElementById('lcOrder').onclick = () => toast(`${qty} Margherita${qty > 1 ? 's' : ''} into the oven. Ready in about 12 minutes.`);
  setInterval(() => {
    const t = 480 + Math.round(Math.random() * 9);
    document.getElementById('lcTemp').textContent = t;
    document.getElementById('lcHeat').style.setProperty('--w', (t - 400) + '%');
    inOven = Math.max(3, Math.min(11, inOven + (Math.random() < .5 ? -1 : 1)));
    document.getElementById('lcOven').textContent = inOven + ' in the oven';
  }, 1800);

  document.getElementById('pcForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = document.getElementById('pc').value.trim().toUpperCase();
    const eta = document.getElementById('eta');
    if (!/^[A-Z]{1,2}\d/.test(v)) { eta.textContent = 'That postcode looks a bit off. Try something like NW1 8AH.'; return; }
    const near = /^(NW1|NW3|NW5|N1|N7|N19|WC1)\b/.test(v);
    eta.textContent = near ? `Good news. We reach ${v} in about ${22 + (v.charCodeAt(v.length - 1) % 12)} minutes.` : `${v} is just outside our bikes' range. Come and eat in, we will save you a seat.`;
  });
})();
