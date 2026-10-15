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

  window.CTA_REPLY = () => 'Got it. The nearest engineer will call you within five minutes.';
  let free = 4, eta = 38, base = 38;
  document.getElementById('lcIssue').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); base = +b.dataset.m; eta = base; document.getElementById('lcEta').textContent = eta; });
  setInterval(() => { eta = Math.max(base - 8, Math.min(base + 8, eta + (Math.random() < .5 ? -1 : 1))); document.getElementById('lcEta').textContent = eta; document.getElementById('lcBar').style.setProperty('--w', (100 - eta) + '%'); if (Math.random() < .3) { free = Math.max(2, Math.min(6, free + (Math.random() < .5 ? -1 : 1))); document.getElementById('lcFree').textContent = free; } }, 2500);
  document.getElementById('lcCall').onclick = () => toast(`Engineer booked. About ${eta} minutes away. Demo only, no one is coming.`);
  const st = { p: 89, n: 'Dripping tap', when: 40, time: 0 };
  const calc = () => { document.getElementById('pOut').textContent = '£' + (st.p + st.when + st.time); };
  document.getElementById('pIssue').addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (!b) return; document.querySelectorAll('#pIssue .opt').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); st.p = +b.dataset.p; st.n = b.dataset.n; swapImg(document.getElementById('pImg'), b.querySelector('img').src); calc(); });
  document.getElementById('pWhen').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.when = +b.dataset.v; calc(); });
  document.getElementById('pTime').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.time = +b.dataset.v; calc(); });
  calc();
  document.getElementById('pGo').onclick = () => toast(`${st.n} booked at ${document.getElementById('pOut').textContent}. We will text your engineer's name.`);

})();
