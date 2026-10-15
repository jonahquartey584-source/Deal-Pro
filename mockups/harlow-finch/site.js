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

  window.CTA_REPLY = (v) => `Thanks. A local agent will call about ${v.toUpperCase()} today.`;
  const L = [['assets/s1.jpg', 'Cheyne Walk, SW3', '5 bed townhouse · £6,950,000'], ['assets/s2.jpg', 'Marylebone Penthouse', '3 bed to let · £4,250 pw'], ['assets/s3.jpg', 'Eaton Mews North, SW1', '3 bed mews · £3,475,000']];
  let li = 0, views = 6;
  setInterval(() => { li = (li + 1) % L.length; swapImg(document.getElementById('lcImg'), L[li][0], L[li][1]); document.getElementById('lcName').textContent = L[li][1]; document.getElementById('lcMeta').textContent = L[li][2]; }, 4000);
  setInterval(() => { if (Math.random() < .5) { views++; document.getElementById('lcViews').textContent = views + ' viewings today'; } }, 5000);
  document.getElementById('lcBook').onclick = () => toast(`Viewing request sent for ${L[li][1]}. We will confirm a time by phone.`);
  // Valuation
  const val = { area: 2150, type: 1, garden: 1.08 };
  const beds = document.getElementById('vBeds');
  const calc = () => {
    const b = +beds.value; document.getElementById('vBedsL').textContent = b;
    const sqft = 650 + b * 520;
    const v = sqft * val.area * val.type * val.garden;
    document.getElementById('vOut').textContent = money(Math.round(v / 5000) * 5000);
    document.getElementById('vRange').textContent = `Likely between ${money(Math.round(v * .94 / 5000) * 5000)} and ${money(Math.round(v * 1.06 / 5000) * 5000)}`;
    document.getElementById('vSqft').textContent = money(val.area * val.type * val.garden);
    document.getElementById('vWeeks').textContent = (val.area > 2000 ? 7 : 5) + b + ' weeks';
  };
  [['vArea', 'area'], ['vType', 'type'], ['vGarden', 'garden']].forEach(([id, k]) => document.getElementById(id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); val[k] = +b.dataset.v; calc(); }));
  beds.addEventListener('input', calc); calc();
  document.getElementById('vBook').onclick = () => toast('Valuation requested. An agent will call within the hour.');
  // Listing filter and favourites
  document.getElementById('lFilter').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); document.querySelectorAll('#cardGrid .card').forEach((c) => c.classList.toggle('hide', b.dataset.f !== 'all' && c.dataset.kind !== b.dataset.f)); });
  document.querySelectorAll('.fav').forEach((f) => f.addEventListener('click', () => { const on = f.getAttribute('aria-pressed') !== 'true'; f.setAttribute('aria-pressed', on); f.innerHTML = on ? '&#9829;' : '&#9825;'; toast(on ? 'Saved to your shortlist' : 'Removed from your shortlist'); }));

})();
