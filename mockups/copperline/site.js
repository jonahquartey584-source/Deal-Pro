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

  window.CTA_REPLY = () => 'Thanks. One of our engineers will call you back today.';
  let temp = 19.6, target = 21, slots = 5;
  const setT = () => (document.getElementById('lcTarget').textContent = target);
  document.getElementById('lcUp').onclick = () => { target = Math.min(25, target + 0.5); setT(); };
  document.getElementById('lcDown').onclick = () => { target = Math.max(15, target - 0.5); setT(); };
  setInterval(() => { temp += (target - temp) * 0.12 + (Math.random() - .5) * 0.05; document.getElementById('lcTemp').textContent = temp.toFixed(1); }, 1500);
  document.getElementById('lcBook').onclick = () => { if (slots > 0) { slots--; document.getElementById('lcSlots').textContent = slots; } toast('Service booked. We will text you a two hour slot.'); };
  const st = { home: 1, bath: 1, smart: 190 };
  const calc = () => {
    const beds = +document.getElementById('cBeds').value; document.getElementById('cBedsL').textContent = beds;
    const system = st.bath >= 2 && beds >= 4;
    const kw = system ? (beds >= 5 ? 32 : 28) : (beds + st.home <= 3 ? 25 : beds + st.home <= 5 ? 30 : 35);
    const price = (system ? 3195 : 2195) + (kw - 25) * 40 + st.home * 150 + st.smart;
    document.getElementById('cType').textContent = (system ? 'System ' : 'Combi ') + kw + 'kW';
    document.getElementById('cOut').textContent = money(price);
    document.getElementById('cMonth').textContent = `or from ${money(price * 1.099 / 60)} a month over 5 years`;
  };
  [['cHome', 'home'], ['cBath', 'bath'], ['cSmart', 'smart']].forEach(([id, k]) => document.getElementById(id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st[k] = +b.dataset.v; calc(); }));
  document.getElementById('cBeds').addEventListener('input', calc); calc();
  document.getElementById('cGo').onclick = () => toast(`Price locked for 30 days: ${document.getElementById('cType').textContent}, ${document.getElementById('cOut').textContent}.`);

})();
