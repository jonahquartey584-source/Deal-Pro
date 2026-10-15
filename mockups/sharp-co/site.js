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

  window.CTA_REPLY = () => 'Done. We will text you the moment a chair frees up today.';
  let wait = 15;
  const status = ['Cutting', 'Free now', 'Shaving', 'Beard trim', 'Cutting'];
  setInterval(() => {
    wait = Math.max(0, Math.min(35, wait + (Math.random() < .5 ? -5 : 5))); document.getElementById('lcWait').textContent = wait;
    document.querySelectorAll('#lcBarbers i').forEach((i) => (i.textContent = status[Math.floor(Math.random() * status.length)]));
    const d = new Date(Date.now() + wait * 60000); document.getElementById('lcNext').textContent = 'Next free chair ' + d.toTimeString().slice(0, 5);
  }, 4000);
  document.getElementById('lcBook').onclick = () => document.getElementById('book').scrollIntoView({ behavior: 'smooth' });
  // Booking
  const st = { svc: 'Cut', price: 28, who: 'Anyone', day: '', time: '' };
  const imgs = ['assets/s3.jpg', 'assets/s2.jpg', 'assets/s1.jpg', 'assets/s3.jpg'];
  const days = document.getElementById('bDay'), slots = document.getElementById('bSlots');
  const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let n = 0;
  for (let i = 0; n < 5 && i < 9; i++) { const d = new Date(); d.setDate(d.getDate() + i); if (d.getDay() === 0 || d.getDay() === 1) continue; days.insertAdjacentHTML('beforeend', `<button class="chip" type="button" aria-pressed="${n === 0}" data-d="${dn[d.getDay()]} ${d.getDate()}">${i === 0 ? 'Today' : dn[d.getDay()] + ' ' + d.getDate()}</button>`); if (n === 0) st.day = i === 0 ? 'Today' : dn[d.getDay()] + ' ' + d.getDate(); n++; }
  const drawSlots = () => { let h = ''; ['9:00', '9:40', '10:20', '11:00', '11:40', '12:20', '13:40', '14:20', '15:00', '15:40', '16:20', '17:00'].forEach((t, i) => { const off = ((i * 7 + st.day.length * 3 + st.who.length) % 5) === 0; h += `<button class="slot" type="button" ${off ? 'disabled' : ''} aria-pressed="${t === st.time}">${t}</button>`; }); slots.innerHTML = h; };
  const sum = () => { document.getElementById('bSum1').textContent = st.svc; document.getElementById('bSum2').textContent = st.who; document.getElementById('bSum3').textContent = st.time ? `${st.day}, ${st.time}` : 'Pick a time'; document.getElementById('bSum4').textContent = '£' + st.price; };
  document.getElementById('bSvc').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.svc = b.textContent.split(' ·')[0]; st.price = +b.dataset.p; swapImg(document.getElementById('bImg'), imgs[[...e.currentTarget.children].indexOf(b)]); sum(); });
  document.getElementById('bWho').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.who = b.textContent; st.time = ''; drawSlots(); sum(); });
  days.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(days, b); st.day = b.textContent; st.time = ''; drawSlots(); sum(); });
  slots.addEventListener('click', (e) => { const b = e.target.closest('.slot'); if (!b || b.disabled) return; st.time = b.textContent; drawSlots(); sum(); });
  document.getElementById('bGo').onclick = () => toast(st.time ? `Booked: ${st.svc} with ${st.who}, ${st.day} at ${st.time}. See you then.` : 'Pick a time first.');
  drawSlots(); sum();

})();
