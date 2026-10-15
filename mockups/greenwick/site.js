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

  window.CTA_REPLY = (v) => `Thank you. Ellie will email two visit dates for ${v.toUpperCase()}.`;
  const P = [['assets/s1.jpg', 'Cottage border'], ['assets/s2.jpg', 'Family lawn'], ['assets/s3.jpg', 'Wildlife pond']];
  let pi = 0, temp = 17;
  setInterval(() => { pi = (pi + 1) % P.length; swapImg(document.getElementById('lcImg'), P[pi][0], P[pi][1]); }, 4200);
  setInterval(() => { temp = Math.max(13, Math.min(22, temp + (Math.random() < .5 ? -1 : 1))); document.getElementById('lcTemp').textContent = temp; document.getElementById('lcWx').textContent = temp > 18 ? 'Sunny, water new plants tonight' : 'Light breeze, good for planting'; }, 5000);
  document.getElementById('lcBook').onclick = () => toast(`Consultation pencilled in for ${document.getElementById('lcSlot').textContent}. We will confirm by email.`);
  const st = { rate: 95 };
  const calc = () => { const m = +document.getElementById('gSize').value; let x = 0; document.querySelectorAll('#gExtra [aria-pressed="true"]').forEach((b) => (x += +b.dataset.v)); const v = 6000 + m * st.rate + x; document.getElementById('gSizeL').textContent = m + ' m²'; document.getElementById('gOut').textContent = money(Math.round(v / 500) * 500); document.getElementById('gRange').textContent = `Typically ${money(Math.round(v * .85 / 500) * 500)} to ${money(Math.round(v * 1.15 / 500) * 500)}, design included`; document.getElementById('gWeeks').textContent = Math.max(2, Math.round(m / 60) + (x ? 1 : 0)) + ' weeks'; };
  document.getElementById('gStyle').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.rate = +b.dataset.r; swapImg(document.getElementById('gImg'), 'assets/' + b.dataset.i); calc(); });
  document.getElementById('gExtra').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); calc(); });
  document.getElementById('gSize').addEventListener('input', calc); calc();
  document.getElementById('gGo').onclick = () => document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });

})();
