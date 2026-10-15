(() => {
  const daysEl = document.getElementById('days'), seatsEl = document.getElementById('seats');
  const dn = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const today = new Date();
  let party = 2, picked = [], day = null;
  // Seed taken seats per day so each night looks different
  const taken = (d) => { const s = new Set(); let x = d.getDate() * 7 + d.getMonth(); for (let i = 0; i < 4 + (x % 4); i++) { x = (x * 31 + 11) % 97; s.add(x % 10); } return s; };
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const closed = d.getDay() === 0 || d.getDay() === 1;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'day'; b.disabled = closed; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<small>${dn[d.getDay()]}</small><b>${d.getDate()}</b>`;
    b.setAttribute('aria-label', d.toDateString() + (closed ? ', closed' : ''));
    b.onclick = () => { daysEl.querySelectorAll('.day').forEach((x) => x.setAttribute('aria-pressed', x === b)); day = d; picked = []; drawSeats(); };
    daysEl.appendChild(b);
    if (!closed && !day) { day = d; b.setAttribute('aria-pressed', 'true'); }
  }
  function drawSeats() {
    const t = taken(day);
    seatsEl.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('button');
      s.type = 'button'; s.className = 'seat'; s.textContent = i + 1;
      s.disabled = t.has(i);
      s.setAttribute('aria-label', `Seat ${i + 1}${t.has(i) ? ', taken' : ''}`);
      s.setAttribute('aria-pressed', picked.includes(i));
      s.onclick = () => {
        if (picked.includes(i)) picked = picked.filter((p) => p !== i);
        else { picked.push(i); if (picked.length > party) picked.shift(); }
        drawSeats();
      };
      seatsEl.appendChild(s);
    }
    update();
  }
  function update() {
    const words = ['', 'One guest', 'Two guests', 'Three guests', 'Four guests'];
    document.getElementById('seatHint').textContent = `(choose ${party})`;
    const ds = day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const need = party - picked.length;
    document.getElementById('sumText').innerHTML = need > 0
      ? `${need} more seat${need > 1 ? 's' : ''} to pick<small>${words[party]} &middot; ${ds}, 7pm</small>`
      : `Seats ${picked.map((p) => p + 1).sort((a, b) => a - b).join(' & ')} &middot; £${party * 145}<small>${words[party]} &middot; ${ds}, 7pm</small>`;
  }
  document.getElementById('party').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#party button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    party = +b.dataset.n; picked = picked.slice(-party); drawSeats();
  });
  document.getElementById('confirm').onclick = () => {
    if (picked.length < party) return toast(`Pick ${party - picked.length} more seat${party - picked.length > 1 ? 's' : ''} at the counter first.`);
    toast('Held for 10 minutes. A card is needed to confirm. This is a demo, so nothing is charged.');
  };
  drawSeats();

  // Live counter card: cycles through what is being served right now
  const serving = [['assets/course-1.jpg', 'Sakizuke', 2], ['assets/course-2.jpg', 'Sea bream sashimi', 5], ['assets/course-3.jpg', 'Kinmedai', 9], ['assets/nigiri.jpg', 'Otoro', 14], ['assets/course-4.jpg', 'Red miso & tamago', 17]];
  let si = 2;
  const lcImg = document.getElementById('lcImg');
  function serve() {
    const [src, name, n] = serving[si];
    lcImg.style.opacity = 0;
    setTimeout(() => { lcImg.src = src; lcImg.alt = name; lcImg.onload = () => (lcImg.style.opacity = 1); }, 300);
    document.getElementById('lcName').textContent = name;
    document.getElementById('lcNum').textContent = `COURSE ${n} OF 18`;
    document.getElementById('lcProg').style.setProperty('--w', (n / 18 * 100).toFixed(0) + '%');
    si = (si + 1) % serving.length;
  }
  serve();
  setInterval(serve, 4200);
  const t = new Date(); const next = new Date(t); next.setHours(19, 0, 0, 0); if (next < t) next.setDate(next.getDate() + 1);
  const mins = Math.round((next - t) / 60000);
  document.getElementById('lcNext').textContent = `Next sitting in ${Math.floor(mins / 60)}h ${mins % 60}m`;
  document.getElementById('lcSeats').textContent = (10 - taken(next).size) + ' seats left';
})();
