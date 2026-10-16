(() => {
  const chips = document.querySelectorAll('.chip');
  const cards = document.querySelectorAll('.card');
  chips.forEach((c) => c.addEventListener('click', () => {
    chips.forEach((x) => x.setAttribute('aria-pressed', x === c));
    const f = c.dataset.f;
    cards.forEach((card, i) => {
      const show = f === 'all' || card.dataset.cat === f;
      card.classList.toggle('hide', !show);
      if (show) { card.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: i * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }); }
    });
  }));
  // Live reel behind the intro: each site's looping hero, crossfaded in turn
  const reel = [['harlow-finch', 'Harlow & Finch'], ['ember-oat', 'Ember & Oat'], ['fade-theory', 'Fade Theory'], ['forno-rosso', 'Forno Rosso'], ['greenwick', 'Greenwick'], ['northlight', 'Northlight'], ['little-tern', 'Little Tern'], ['flowright', 'Flowright'], ['koji', 'Kōji'], ['daybreak', 'Daybreak'], ['sharp-co', 'Sharp & Co.'], ['crumb', 'Crumb'], ['nest-key', 'Nest & Key'], ['volt', 'Volt Supply'], ['mow-better', 'Mow Better'], ['copperline', 'Copperline']];
  const va = document.getElementById('reelA'), vb = document.getElementById('reelB');
  let ri = 0, front = va;
  function nextReel() {
    const [slug, name] = reel[ri % reel.length];
    const back = front === va ? vb : va;
    const im = new Image();
    im.onload = () => {
      back.style.backgroundImage = `url('${slug}/assets/pano-1.jpg')`;
      back.classList.remove('on'); void back.offsetWidth; back.classList.add('on');
      front.classList.remove('on'); front = back;
    };
    im.src = `${slug}/assets/pano-1.jpg`;
    const tag = document.getElementById('reelTag');
    tag.style.opacity = 0; setTimeout(() => { tag.querySelector('b').textContent = name; tag.style.opacity = 1; }, 500);
    ri++;
  }
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { nextReel(); setInterval(nextReel, 8000); }
  else { nextReel(); }

  // Services: while the stage is pinned, each service pops onto the screen in turn as you scroll.
  // On phones (no pinning) each card pops in as it reaches the screen instead.
  const svc = document.getElementById('services');
  if (svc) {
    const sc = [...svc.querySelectorAll('.svc-card')];
    const num = document.getElementById('svcN');
    const glow = svc.querySelector('.svc-glow');
    const reduced = document.documentElement.classList.contains('reduce');
    let shown = -1;
    const show = (n) => {
      if (n === shown) return;
      shown = n;
      sc.forEach((c, i) => { c.classList.toggle('on', i < n); c.classList.toggle('live', i === n - 1); });
      if (num) num.textContent = String(n).padStart(2, '0');
      const live = sc[n - 1];
      if (live && glow) {
        const r = live.getBoundingClientRect(), sr = svc.querySelector('.svc-stage').getBoundingClientRect();
        glow.style.setProperty('--gx', ((r.left + r.width / 2 - sr.left) / sr.width * 100) + '%');
        glow.style.setProperty('--gy', ((r.top + r.height / 2 - sr.top) / sr.height * 100) + '%');
      }
    };
    const pinned = () => !reduced && matchMedia('(min-width: 761px)').matches;
    if (reduced) show(sc.length);
    else {
      const io = new IntersectionObserver((es) => es.forEach((e) => {
        if (!pinned() && e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
      }), { threshold: 0.35 });
      sc.forEach((c) => io.observe(c));
      let ticking = false;
      const onScroll = () => {
        ticking = false;
        if (!pinned()) return;
        const r = svc.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
        // The first card lands as the stage pins; the last with room to spare before it unpins
        show(r.top > innerHeight * 0.25 ? 0 : Math.min(sc.length, 1 + Math.floor(p * (sc.length + 0.6))));
      };
      addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
      addEventListener('resize', onScroll);
      onScroll();
    }
  }

  // "Try a random one"
  const rnd = document.querySelector('.btn.ghost');
  rnd.addEventListener('click', (e) => { e.preventDefault(); window.open(cards[Math.floor(Math.random() * cards.length)].getAttribute('href'), '_blank', 'noopener'); });
  // Touch screens have no hover: scroll the preview while the card is on screen
  if (matchMedia('(hover: none)').matches) {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('peeking', e.isIntersecting)), { threshold: 0.7 });
    cards.forEach((c) => io.observe(c));
  }
})();
