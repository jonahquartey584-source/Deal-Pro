(() => {
  // Closing form: a demo, so it answers on the page and sends nothing anywhere
  const f = document.getElementById('ctaForm');
  if (f) f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = document.getElementById('ctaInput').value.trim();
    document.getElementById('ctaMsg').textContent = window.CTA_REPLY ? window.CTA_REPLY(v) : 'Thanks, we will be in touch today.';
  });
  const swapImg = (img, src, alt) => { img.style.opacity = 0; setTimeout(() => { img.src = src; if (alt) img.alt = alt; img.onload = () => (img.style.opacity = 1); }, 220); };
  const press = (group, btn) => group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  const money = (n) => '£' + Math.round(n).toLocaleString('en-GB');

  window.CTA_REPLY = () => 'Lovely. The specials land in your inbox every Friday.';
  const M = [['assets/s1.jpg', 'Crab sandwich', 9.5], ['assets/s2.jpg', 'Iced latte', 3.8], ['assets/s3.jpg', 'Avocado toast', 8.5], ['assets/s4.jpg', 'Lemon cake', 3.6]];
  let lc = 0, q = 8;
  const tray = new Map();
  const drawTray = () => {
    const el = document.getElementById('tTray'); let tot = 0;
    el.innerHTML = tray.size ? [...tray].map(([n, { p, c }]) => { tot += p * c; return `<div><span>${n}</span><span><button type="button" data-n="${n}" data-d="-1" aria-label="One fewer">&minus;</button> ${c} <button type="button" data-n="${n}" data-d="1" aria-label="One more">+</button></span></div>`; }).join('') : '<p style="color:var(--muted);margin:0">Tap something tasty to add it.</p>';
    document.getElementById('tTotal').textContent = '£' + tot.toFixed(2);
  };
  const addItem = (n, p) => { const c = tray.get(n) || { p, c: 0 }; c.c++; tray.set(n, c); drawTray(); toast(`${n} added to your beach box`); };
  document.getElementById('lcPills').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); lc = +b.dataset.i; swapImg(document.getElementById('lcImg'), M[lc][0], M[lc][1]); document.getElementById('lcAdd').textContent = 'Add £' + M[lc][2].toFixed(2); });
  document.getElementById('lcAdd').onclick = () => addItem(M[lc][1], M[lc][2]);
  setInterval(() => { q = Math.max(4, Math.min(15, q + (Math.random() < .5 ? -1 : 1))); document.getElementById('lcMins').textContent = q; }, 4000);
  const t = new Date(); t.setMinutes(t.getMinutes() + 137); document.getElementById('lcTide').textContent = t.toTimeString().slice(0, 5);
  document.getElementById('tItems').addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (b) addItem(b.dataset.n, +b.dataset.p); });
  document.getElementById('tTray').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const it = tray.get(b.dataset.n); it.c += +b.dataset.d; if (it.c <= 0) tray.delete(b.dataset.n); drawTray(); });
  document.getElementById('tTime').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) press(e.currentTarget, b); });
  document.getElementById('tGo').onclick = () => toast(tray.size ? `Ordered for ${document.querySelector('#tTime [aria-pressed="true"]').textContent.toLowerCase()}. Collect from the hatch. Demo only, nothing is charged.` : 'Your box is empty.');

})();
