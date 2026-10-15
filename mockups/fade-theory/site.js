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

  window.CTA_REPLY = () => 'Nice. We will text you when the queue drops below two.';
  const S = [['assets/s1.jpg', 'Skin fade'], ['assets/s2.jpg', 'Textured crop'], ['assets/s3.jpg', 'Buzz cut']];
  let si = 0, ahead = 3, joined = false;
  setInterval(() => { si = (si + 1) % S.length; swapImg(document.getElementById('lcImg'), S[si][0], S[si][1]); document.getElementById('lcName').textContent = S[si][1]; }, 3600);
  setInterval(() => { ahead = Math.max(joined ? 0 : 1, Math.min(6, ahead + (Math.random() < .55 ? -1 : 1))); document.getElementById('lcAhead').textContent = ahead; document.getElementById('lcMins').textContent = ahead * 6 + 4; }, 4500);
  document.getElementById('lcJoin').onclick = (e) => { if (joined) return toast('You are already in the queue.'); joined = true; ahead++; document.getElementById('lcAhead').textContent = ahead; e.target.textContent = 'In queue'; toast(`You are in. ${ahead} ahead of you, about ${ahead * 6 + 4} minutes.`); };
  let base = 25, mins = 35; const add = new Set();
  const calc = () => { let p = base, m = mins; document.querySelectorAll('#fAdd button[aria-pressed="true"]').forEach((b) => { p += +b.dataset.p; m += +b.dataset.m; }); document.getElementById('fPrice').textContent = '£' + p; document.getElementById('fTime').textContent = m + ' minutes in the chair'; };
  document.getElementById('fStyle').addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (!b) return; document.querySelectorAll('#fStyle .opt').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); base = +b.dataset.p; mins = +b.dataset.m; swapImg(document.getElementById('fImg'), b.querySelector('img').src); calc(); });
  document.getElementById('fAdd').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); calc(); });
  document.getElementById('fGo').onclick = () => toast(`Queued for ${document.querySelector('#fStyle [aria-pressed="true"] span').textContent}, ${document.getElementById('fPrice').textContent}. We will text when you are two away.`);

})();
