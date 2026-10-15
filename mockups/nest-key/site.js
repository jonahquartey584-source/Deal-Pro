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

  window.CTA_REPLY = (v) => `Lovely. We will text three valuation times for ${v.toUpperCase()} shortly.`;
  const L = [['assets/s1.jpg', 'Ashgrove Road, BS6', '3 bed semi · £525,000'], ['assets/s2.jpg', 'Clifton garden flat', '2 bed · £385,000'], ['assets/s3.jpg', 'Wapping Wharf', '4 bed to let · £2,450 pcm']];
  let li = 0;
  setInterval(() => { li = (li + 1) % L.length; swapImg(document.getElementById('lcImg'), L[li][0], L[li][1]); document.getElementById('lcName').textContent = L[li][1]; document.getElementById('lcMeta').textContent = L[li][2]; }, 4000);
  document.getElementById('lcBook').onclick = () => toast(`Viewing request sent for ${L[li][1]}.`);
  let term = 25;
  const g = (id) => document.getElementById(id);
  const calc = () => {
    const price = +g('mPrice').value, dep = +g('mDep').value, rate = +g('mRate').value / 100 / 12, n = term * 12;
    const loan = price * (1 - dep / 100);
    const pay = loan * rate / (1 - Math.pow(1 + rate, -n));
    g('mPriceL').textContent = money(price); g('mDepL').textContent = dep + '%'; g('mRateL').textContent = (+g('mRate').value).toFixed(1) + '%';
    g('mOut').textContent = money(pay); g('mLoan').textContent = money(loan); g('mDeposit').textContent = money(price - loan); g('mIncome').textContent = money(loan / 4.5);
  };
  ['mPrice', 'mDep', 'mRate'].forEach((id) => g(id).addEventListener('input', calc));
  g('mTerm').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); term = +b.dataset.v; calc(); });
  calc();
  g('mAip').onclick = () => toast('Our adviser will call you to talk through an agreement in principle.');
  document.querySelectorAll('.fav').forEach((f) => f.addEventListener('click', () => { const on = f.getAttribute('aria-pressed') !== 'true'; f.setAttribute('aria-pressed', on); f.innerHTML = on ? '&#9829;' : '&#9825;'; toast(on ? 'Saved to your favourites' : 'Removed'); }));

})();
