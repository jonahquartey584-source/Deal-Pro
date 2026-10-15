(() => {
  const products = [
    { id: 'studio', n: 'Studio One', d: 'Over-ear, noise cancelling', p: 249, c: 'audio', img: 'assets/hp-graphite.jpg', tag: 'New', pop: 1 },
    { id: 'buds', n: 'Volt Buds Air', d: 'Wireless earbuds, 30h with case', p: 129, c: 'audio', img: 'assets/buds.jpg', pop: 2 },
    { id: 'watch', n: 'Pulse Watch 2', d: 'Heart rate, GPS, 7 day battery', p: 199, c: 'wear', img: 'assets/watch.jpg', tag: 'Staff pick', pop: 3 },
    { id: 'speaker', n: 'Roam Mini', d: 'Waterproof speaker, 20h', p: 89, c: 'audio', img: 'assets/speaker.jpg', pop: 4 },
    { id: 'pad', n: 'Halo Pad', d: 'Wireless charging pad, 15W', p: 39, c: 'power', img: 'assets/pad.jpg', pop: 5 },
    { id: 'plug', n: 'Volt 65W Plug', d: 'Charges a laptop and a phone', p: 45, c: 'power', img: 'assets/plug.jpg', pop: 6 },
  ];
  const grid = document.getElementById('grid');
  function render() {
    const f = document.querySelector('#filters [aria-pressed="true"]').dataset.f;
    const s = document.getElementById('sort').value;
    const list = products.filter((p) => f === 'all' || p.c === f).sort((a, b) => s === 'low' ? a.p - b.p : s === 'high' ? b.p - a.p : a.pop - b.pop);
    grid.innerHTML = list.map((p, i) => `<article class="prod" style="animation:slidein .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:${i * 60}ms">
      <div class="ph">${p.img ? `<img src="${p.img}" alt="${p.n}" loading="lazy">` : p.html}${p.tag ? `<span class="tag">${p.tag}</span>` : ''}</div>
      <div class="meta"><h3>${p.n}</h3><p>${p.d}</p><div class="row"><b>£${p.p}</b><button type="button" data-add="${p.id}">Add to cart</button></div></div></article>`).join('');
  }
  document.getElementById('filters').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#filters button').forEach((x) => x.setAttribute('aria-pressed', x === b)); render();
  });
  document.getElementById('sort').onchange = render;
  render();

  // Cart
  const cart = new Map();
  const drawer = document.getElementById('drawer');
  const open = (v) => { drawer.classList.toggle('open', v); drawer.setAttribute('aria-hidden', !v); };
  document.getElementById('cartBtn').onclick = () => open(true);
  drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) open(false); });
  addEventListener('keydown', (e) => e.key === 'Escape' && open(false));
  function add(id, label) {
    const p = products.find((x) => x.id === id);
    const key = label ? id + ':' + label : id;
    const cur = cart.get(key) || { p, q: 0, label };
    cur.q++; cart.set(key, cur); drawCart();
    const b = document.getElementById('cartCount'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    toast(`${p.n}${label ? ' in ' + label : ''} added to your cart`);
  }
  function drawCart() {
    let total = 0, count = 0;
    const lines = document.getElementById('lines');
    lines.innerHTML = cart.size ? [...cart].map(([k, { p, q, label }]) => { total += p.p * q; count += q; return `<div class="line">${p.img ? `<img src="${p.img}" alt="">` : `<div class="ic">${p.html}</div>`}<div><b>${p.n}${label ? ', ' + label : ''}</b><small>£${p.p} each</small></div><div class="qty"><button type="button" data-k="${k}" data-d="-1" aria-label="One fewer">&minus;</button>${q}<button type="button" data-k="${k}" data-d="1" aria-label="One more">+</button></div></div>`; }).join('') : '<p class="empty">Nothing here yet.</p>';
    document.getElementById('cartCount').textContent = count;
    document.getElementById('total').textContent = '£' + total;
    const left = Math.max(0, 50 - total);
    document.getElementById('freeText').textContent = left ? `Spend £${left} more for free delivery` : 'Free next day delivery is yours';
    document.getElementById('freeBar').style.width = Math.min(100, total / 50 * 100) + '%';
  }
  document.getElementById('lines').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const it = cart.get(b.dataset.k); it.q += +b.dataset.d; if (it.q <= 0) cart.delete(b.dataset.k); drawCart();
  });
  grid.addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (b) add(b.dataset.add); });
  document.getElementById('checkout').onclick = () => toast(cart.size ? 'This is a demo shop, so checkout stops here. Nothing is charged.' : 'Add something first.');
  drawCart();

  // Colourways
  let colour = 'Graphite';
  document.querySelectorAll('.sw').forEach((s) => s.addEventListener('click', () => {
    document.querySelectorAll('.sw').forEach((x) => x.setAttribute('aria-pressed', x === s));
    document.getElementById('glow').style.setProperty('--glow', s.dataset.c);
    colour = s.dataset.n;
    const si = document.getElementById('spotImg'); si.style.opacity = 0;
    setTimeout(() => { si.src = 'assets/hp-' + colour.toLowerCase() + '.jpg'; si.alt = 'Volt Studio One headphones in ' + colour; si.onload = () => (si.style.opacity = 1); }, 250);
    document.getElementById('addHero').textContent = `Add ${colour}, £249`;
  }));
  document.getElementById('addHero').onclick = () => add('studio', colour);

  // Live quick-buy card in the hero
  let lcColour = 'Graphite', stock = 23;
  const lcImg = document.getElementById('lcImg');
  document.getElementById('lcPills').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#lcPills button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    lcColour = b.textContent; lcImg.style.opacity = 0;
    setTimeout(() => { lcImg.src = 'assets/hp-' + b.dataset.c + '.jpg'; lcImg.alt = 'Studio One headphones in ' + lcColour; lcImg.onload = () => (lcImg.style.opacity = 1); }, 200);
  });
  document.getElementById('lcAdd').onclick = () => { add('studio', lcColour); stock = Math.max(1, stock - 1); document.getElementById('lcStock').textContent = stock + ' left today'; };
  setInterval(() => { if (Math.random() < .4 && stock > 4) { stock--; document.getElementById('lcStock').textContent = stock + ' left today'; } }, 6000);
})();
