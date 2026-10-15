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

  window.CTA_REPLY = (v) => /^LS/i.test(v) ? `Yes, we cover ${v.toUpperCase()}. Your first visit could be tomorrow.` : `${v.toUpperCase()} is just outside our crews' patch for now. We will let you know when we expand.`;
  const A = [['assets/s1.jpg', 'Headingley'], ['assets/s2.jpg', 'Roundhay'], ['assets/s3.jpg', 'Chapel Allerton']];
  let ai = 0, done = 27;
  setInterval(() => { ai = (ai + 1) % A.length; swapImg(document.getElementById('lcImg'), A[ai][0], A[ai][1]); document.getElementById('lcArea').textContent = A[ai][1]; }, 4000);
  setInterval(() => { done++; document.getElementById('lcDone').textContent = done; }, 3200);
  document.getElementById('lcCheck').onclick = () => document.getElementById('plans').scrollIntoView({ behavior: 'smooth' });
  const sizes = ['Small', 'Medium', 'Large', 'Huge'], mult = [0.85, 1, 1.35, 1.8];
  const st = { p: 18, n: 4.3 };
  const calc = () => { const s = +document.getElementById('mSize').value - 1; let x = 0; document.querySelectorAll('#mExtra [aria-pressed="true"]').forEach((b) => (x += +b.dataset.v)); const visit = st.p * mult[s] + x; document.getElementById('mSizeL').textContent = sizes[s]; document.getElementById('mVisit').textContent = '£' + visit.toFixed(2); document.getElementById('mVisits').textContent = st.n; document.getElementById('mOut').textContent = money(visit * st.n); document.getElementById('mPer').textContent = 'a month, March to October'; };
  document.getElementById('mFreq').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.p = +b.dataset.p; st.n = +b.dataset.n; calc(); });
  document.getElementById('mExtra').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); calc(); });
  document.getElementById('mSize').addEventListener('input', calc); calc();
  document.getElementById('mGo').onclick = () => document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });

})();
