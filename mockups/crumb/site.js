(() => {
  // Next tray countdown (every 40 minutes)
  const tm = document.getElementById('tm'), ts = document.getElementById('ts');
  let lastS = '';
  setInterval(function t() {
    const now = Date.now(), period = 40 * 60 * 1000, left = period - (now % period);
    const m = String(Math.floor(left / 60000)).padStart(2, '0'), s = String(Math.floor(left / 1000) % 60).padStart(2, '0');
    if (s !== lastS) { lastS = s; tm.textContent = m; ts.textContent = s; }
    return t;
  }(), 250);

  // Box builder
  const treats = [
    ['Cinnamon bun', 3.2, 'assets/treat-bun.jpg'], ['Sourdough slice', 1.5, 'assets/treat-sour.jpg'], ['Peach macarons', 1.8, 'assets/treat-peach.jpg'],
    ['Pistachio macarons', 1.8, 'assets/treat-pist.jpg'], ['Strawberry slice', 4.2, 'assets/treat-straw.jpg'], ['Little loaf', 3.5, 'assets/treat-loaf.jpg'],
  ];
  const box = [];
  const tEl = document.getElementById('treats'), sEl = document.getElementById('slots');
  tEl.innerHTML = treats.map(([n, p, img], i) => `<button class="treat" type="button" data-i="${i}"><span class="dot" style="background-image:url('${img}')"></span><b>${n}</b><small>£${p.toFixed(2)}</small></button>`).join('');
  function draw(fresh) {
    sEl.innerHTML = Array.from({ length: 6 }, (_, i) => {
      const t = box[i];
      return t !== undefined
        ? `<button class="slot filled" type="button" data-s="${i}" aria-label="Remove ${treats[t][0]}" style="${i === fresh ? '' : 'animation:none'}"><span style="background-image:url('${treats[t][2]}')"></span></button>`
        : `<button class="slot" type="button" tabindex="-1" aria-label="Empty slot"></button>`;
    }).join('');
    const total = box.reduce((s, t) => s + treats[t][1], 0) * (box.length === 6 ? 0.9 : 1);
    document.getElementById('boxTotal').textContent = '£' + total.toFixed(2);
    document.getElementById('boxCount').textContent = box.length === 6 ? 'Full box, 10% off' : `${box.length} of 6`;
  }
  tEl.addEventListener('click', (e) => {
    const b = e.target.closest('.treat'); if (!b) return;
    if (box.length >= 6) return toast('Your box is full. Tap a treat in the box to swap it out.');
    box.push(+b.dataset.i); draw(box.length - 1);
  });
  sEl.addEventListener('click', (e) => { const s = e.target.closest('.slot.filled'); if (s) { box.splice(+s.dataset.s, 1); draw(-1); } });
  document.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => {
    const i = treats.findIndex((t) => t[0].startsWith(b.dataset.quick.split(' ')[0]));
    if (box.length < 6) { box.push(i < 0 ? 0 : i); draw(box.length - 1); }
    toast(`${b.dataset.quick} saved in your box`);
  }));
  document.getElementById('reserve').onclick = () => toast(box.length ? `Box of ${box.length} reserved for ${document.getElementById('pick').value}. Pay when you collect.` : 'Your box is empty. Tap a treat to add it.');
  draw(-1);

  // Live "fresh now" card in the hero: rotates through what just came out
  let li = 0; const left = [14, 22, 9, 11, 6, 8];
  const lcImg = document.getElementById('lcImg');
  function fresh() {
    li = (li + 1) % treats.length;
    lcImg.style.opacity = 0;
    setTimeout(() => { lcImg.src = treats[li][2]; lcImg.alt = treats[li][0]; lcImg.onload = () => (lcImg.style.opacity = 1); }, 250);
    document.getElementById('lcName').textContent = treats[li][0];
    document.getElementById('lcLeft').textContent = left[li] + ' left on the counter';
  }
  setInterval(fresh, 3800);
  setInterval(() => { document.getElementById('lcTray').textContent = tm.textContent + ':' + ts.textContent; }, 500);
  document.getElementById('lcSave').onclick = () => {
    if (box.length < 6) { box.push(li); draw(box.length - 1); }
    left[li] = Math.max(0, left[li] - 1);
    document.getElementById('lcLeft').textContent = left[li] + ' left on the counter';
    toast(`${treats[li][0]} saved in your box`);
  };
})();
