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

  window.CTA_REPLY = () => 'Thanks. You will hear first when the seasonal loaves come out.';
  const L = [['assets/s1.jpg', 'Dark rye', 17], ['assets/s2.jpg', 'Country sourdough', 9], ['assets/s3.jpg', 'Seeded spelt', 12]];
  let li = 0;
  setInterval(() => { li = (li + 1) % L.length; swapImg(document.getElementById('lcImg'), L[li][0], L[li][1]); document.getElementById('lcName').textContent = L[li][1]; document.getElementById('lcLeft').textContent = L[li][2] + ' left on the shelf'; }, 3800);
  setInterval(() => { const p = 30 * 60000, left = p - (Date.now() % p); document.getElementById('lcBake').textContent = String(Math.floor(left / 60000)).padStart(2, '0') + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0'); }, 500);
  document.getElementById('lcSave').onclick = () => { L[li][2] = Math.max(0, L[li][2] - 1); document.getElementById('lcLeft').textContent = L[li][2] + ' left on the shelf'; toast(`${L[li][1]} reserved. Collect by noon.`); };
  const st = { p: 5.2, q: 2, how: 0 };
  const calc = () => { const w = st.p * st.q * 0.9 + st.how; document.getElementById('dWeek').textContent = '£' + w.toFixed(2); document.getElementById('dMonth').textContent = `a week, about £${(w * 4.33).toFixed(0)} a month`; };
  document.getElementById('dLoaf').addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (!b) return; document.querySelectorAll('#dLoaf .opt').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); st.p = +b.dataset.p; swapImg(document.getElementById('dImg'), b.querySelector('img').src); calc(); });
  document.getElementById('dQty').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.q = +b.dataset.v; calc(); });
  document.getElementById('dHow').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.how = +b.dataset.v; calc(); });
  calc();
  document.getElementById('dGo').onclick = () => toast(`Welcome to the bread club. ${document.getElementById('dWeek').textContent} a week. Demo only, nothing is charged.`);

})();
