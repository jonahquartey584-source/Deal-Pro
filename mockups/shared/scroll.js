/*
  Shared scroll engine for the website mockups.
  - Scroll-scrubbed hero video (Blob fetch, eased time, gated seeks, caption bands)
  - Static hero fallback for phones, reduced motion, Save-Data and failed loads
  - Reveal on scroll, staggered children, split-word headlines
  - Parallax, horizontal scroll rails, self-drawing SVG lines, counters
  - Tilt cards, magnetic buttons, progress bar, toasts
*/
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smooth = (p, e0, e1) => {
    const t = clamp((p - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  root.classList.add('js');
  if (reduce) root.classList.add('reduce');

  /* ---------- Toast ---------- */
  let toastEl;
  window.toast = (msg) => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
  };

  /* ---------- Split words ---------- */
  document.querySelectorAll('[data-split]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words
      .map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`)
      .join(' ');
  });

  /* ---------- Reveal on scroll ---------- */
  document.querySelectorAll('[data-stagger]').forEach((g) => {
    [...g.children].forEach((c, i) => c.style.setProperty('--d', i * 90 + 'ms'));
  });
  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          revealIO.unobserve(e.target);
        }
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
  );
  document.querySelectorAll('[data-reveal],[data-split],[data-stagger]').forEach((el) => revealIO.observe(el));

  /* ---------- Counters ---------- */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countIO.unobserve(e.target);
      const el = e.target;
      const end = parseFloat(el.dataset.count);
      const dec = (el.dataset.count.split('.')[1] || '').length;
      const pre = el.dataset.prefix || '';
      const suf = el.dataset.suffix || '';
      if (reduce) { el.textContent = pre + end.toFixed(dec) + suf; return; }
      const t0 = performance.now();
      const dur = 1600;
      const step = (now) => {
        const k = clamp((now - t0) / dur, 0, 1);
        const v = end * (1 - Math.pow(1 - k, 3));
        el.textContent = pre + v.toFixed(dec) + suf;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach((el) => countIO.observe(el));

  /* ---------- Scroll-linked effects (parallax, rails, draw, progress) ---------- */
  const parallax = [...document.querySelectorAll('[data-speed]')];
  const rails = [...document.querySelectorAll('[data-hscroll]')].map((sec) => ({
    sec,
    track: sec.querySelector('.rail-track'),
    last: -1,
  }));
  const draws = [...document.querySelectorAll('[data-draw]')].map((svg) => {
    const paths = [...svg.querySelectorAll('path,line,polyline,circle')];
    paths.forEach((p) => {
      let len = 1000;
      try { len = p.getTotalLength() || 1000; } catch (e) { /* hidden at this width */ }
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      p._len = len;
    });
    return { svg, paths, last: -1 };
  });
  const bar = document.querySelector('.scroll-progress');
  const header = document.querySelector('[data-header]');
  let lastBar = -1;
  let fxQueued = false;

  function sizeRails() {
    rails.forEach((r) => {
      if (!r.track) return;
      const extra = Math.max(0, r.track.scrollWidth - innerWidth);
      r.extra = extra;
      r.sec.style.height = innerWidth < 760 ? 'auto' : extra + innerHeight + 'px';
    });
  }

  function runFx() {
    fxQueued = false;
    const vh = innerHeight;
    if (!reduce) {
      parallax.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const mid = r.top + r.height / 2 - vh / 2;
        const y = (-mid * parseFloat(el.dataset.speed)).toFixed(1);
        if (el._y !== y) { el._y = y; el.style.transform = `translate3d(0,${y}px,0)`; }
      });
    }
    rails.forEach((r) => {
      if (!r.track || innerWidth < 760) return;
      const rect = r.sec.getBoundingClientRect();
      const p = clamp(-rect.top / Math.max(1, rect.height - vh), 0, 1);
      const x = Math.round(p * r.extra);
      if (x !== r.last) { r.last = x; r.track.style.transform = `translate3d(${-x}px,0,0)`; }
    });
    draws.forEach((d) => {
      const rect = d.svg.getBoundingClientRect();
      const p = reduce ? 1 : clamp((vh - rect.top) / (vh * 0.8 + rect.height * 0.5), 0, 1);
      const q = Math.round(p * 200) / 200;
      if (q === d.last) return;
      d.last = q;
      d.paths.forEach((path) => (path.style.strokeDashoffset = path._len * (1 - q)));
    });
    if (bar) {
      const p = scrollY / Math.max(1, root.scrollHeight - vh);
      const q = Math.round(p * 500) / 500;
      if (q !== lastBar) { lastBar = q; bar.style.transform = `scaleX(${q})`; }
    }
    if (header) {
      const s = scrollY > 40;
      if (s !== header._s) { header._s = s; header.classList.toggle('scrolled', s); }
    }
  }
  const queueFx = () => { if (!fxQueued) { fxQueued = true; requestAnimationFrame(runFx); } };
  addEventListener('scroll', queueFx, { passive: true });
  addEventListener('resize', () => { sizeRails(); queueFx(); });
  addEventListener('load', () => { sizeRails(); queueFx(); });
  sizeRails();
  runFx();

  /* ---------- Tilt cards + magnetic buttons (fine pointers only) ---------- */
  if (!reduce && matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateY(-4px)`;
        card.style.setProperty('--mx', (x + 0.5) * 100 + '%');
        card.style.setProperty('--my', (y + 0.5) * 100 + '%');
      });
      card.addEventListener('pointerleave', () => (card.style.transform = ''));
    });
    document.querySelectorAll('[data-magnetic]').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        b.style.transform = `translate(${x * 0.18}px,${y * 0.25}px)`;
      });
      b.addEventListener('pointerleave', () => (b.style.transform = ''));
    });
  }

  /* ---------- Brand intro curtain (once per visit) ---------- */
  const intro = document.querySelector('.curtain');
  let introSeen = false;
  try { introSeen = sessionStorage.getItem('intro:' + location.pathname) === '1'; sessionStorage.setItem('intro:' + location.pathname, '1'); } catch (e) {}
  if (intro && (introSeen || reduce)) intro.remove();
  root.style.setProperty('--hd', intro && intro.isConnected ? '1.45s' : '0.1s');
  if (intro && intro.isConnected) setTimeout(() => intro.remove(), 2300);

  /* ---------- Live headline: words blur in one by one ---------- */
  document.querySelectorAll('[data-words]').forEach((el) => {
    let i = 0;
    const wrap = (node) => {
      [...node.childNodes].forEach((c) => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = part; frag.appendChild(s);
          });
          c.replaceWith(frag);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') {
          c.classList.add('w'); c.style.setProperty('--i', i++);
        }
      });
    };
    wrap(el);
  });

  /* ---------- Scroll-scrubbed hero ---------- */
  const hero = document.querySelector('[data-scrub]');
  if (!hero) return;
  const stage = hero.querySelector('.stage');
  const video = hero.querySelector('video.scrub');
  const loop = hero.querySelector('video.loop');
  const playLoop = () => { if (loop && !reduce && loop.dataset.ready) { const p = loop.play(); if (p) p.catch(() => {}); } };

  // The trailer is fetched whole and played from a Blob URL. Safari (and some hosts) will not play
  // a video file served without HTTP Range support, but a Blob always plays.
  const trailerReady = (async () => {
    if (!loop || reduce) return;
    const probeV = document.createElement('video');
    const srcEl = [...loop.querySelectorAll('source')].find((x) => probeV.canPlayType(x.type));
    if (!srcEl) return;
    const url = srcEl.getAttribute('src');
    loop.muted = true; loop.defaultMuted = true; loop.playsInline = true; loop.setAttribute('muted', '');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('trailer ' + res.status);
      const blob = await res.blob();
      loop.querySelectorAll('source').forEach((x) => x.remove());
      loop.src = URL.createObjectURL(new Blob([blob], { type: srcEl.type }));
    } catch (e) {
      loop.src = url; // fall back to a direct load
    }
    loop.load();
    await new Promise((r) => { loop.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 8000); });
    loop.dataset.ready = '1';
    hero.classList.add('trailer-on');
    if (hero.classList.contains('at-top')) playLoop();
  })();

  // Sound toggle for the trailer: browsers only autoplay muted, so sound is the viewer's choice
  if (loop) {
    const sb = document.createElement('button');
    sb.type = 'button'; sb.className = 'sound-btn'; sb.setAttribute('aria-pressed', 'false');
    sb.innerHTML = '<i aria-hidden="true"></i><span>Sound on</span>';
    sb.addEventListener('click', () => {
      loop.muted = !loop.muted;
      if (!loop.muted) { loop.volume = 0.6; playLoop(); }
      sb.setAttribute('aria-pressed', String(!loop.muted));
      sb.querySelector('span').textContent = loop.muted ? 'Sound on' : 'Sound off';
    });
    stage.appendChild(sb);
  }

  /* ---------- Live panning background (the Deal Pro hero, scene for scene) ----------
     Wide panoramas glide slowly sideways behind the title, then crossfade to the next scene. */
  const panoWrap = hero.querySelector('.panos');
  if (panoWrap) {
    const scenes = JSON.parse(panoWrap.dataset.scenes);
    const place = panoWrap.dataset.place || '';
    const [A, B] = panoWrap.querySelectorAll('.pano');
    const RATIO = 21 / 9;
    const mobile = matchMedia('(max-width:760px),(pointer:coarse)').matches;
    const SWEEP = mobile ? 38 : 46;
    const tag = hero.querySelector('.scene-tag');
    let cur = A, nxt = B, si = 0, start = performance.now(), W = 0, H = 0, iw = 0, off = 0;
    const setTag = (sc) => {
      if (!tag) return;
      tag.classList.add('swap');
      setTimeout(() => { tag.innerHTML = `<i></i>${place} &middot; <b>${sc.name}</b>`; tag.classList.remove('swap'); }, 350);
    };
    const preload = (sc) => { const im = new Image(); im.src = sc.src; };
    const size = () => {
      W = stage.offsetWidth; H = stage.offsetHeight;
      const ih = H * 1.15; iw = ih * RATIO;
      [A, B].forEach((el) => { el.style.width = iw + 'px'; el.style.height = ih + 'px'; });
    };
    cur.style.backgroundImage = `url('${scenes[0].src}')`;
    cur.style.opacity = 1;
    setTag(scenes[0]);
    if (scenes[1]) preload(scenes[1]);
    size();
    addEventListener('resize', size);
    function frame(now) {
      const t = (now - start) / 1000;
      const k = Math.min(1, t / SWEEP), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const span = Math.max(0, iw - W);
      off = reduce ? span / 2 : span * e;
      if (scrollY < innerHeight * 1.2 || hero.classList.contains('static')) {
        cur.style.transform = `translate3d(${-off}px,0,0)`;
      }
      if (!reduce && t > SWEEP + 0.4 && scenes.length > 1) {
        si = (si + 1) % scenes.length;
        nxt.style.backgroundImage = `url('${scenes[si].src}')`;
        nxt.style.transform = 'translate3d(0,0,0)';
        nxt.style.opacity = 1; cur.style.opacity = 0;
        [cur, nxt] = [nxt, cur];
        setTag(scenes[si]);
        preload(scenes[(si + 1) % scenes.length]);
        start = now;
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Cursor spotlight + gentle parallax on the live background (fine pointers only)
  if (!reduce && matchMedia('(pointer: fine)').matches) {
    let pq = false, ex = 0, ey = 0;
    stage.addEventListener('pointermove', (e) => {
      ex = e.clientX; ey = e.clientY;
      if (pq) return; pq = true;
      requestAnimationFrame(() => {
        pq = false;
        stage.style.setProperty('--sx', ex + 'px'); stage.style.setProperty('--sy', ey + 'px');
        stage.style.setProperty('--px', ((ex / innerWidth - 0.5) * -18).toFixed(1) + 'px');
        stage.style.setProperty('--py', ((ey / innerHeight - 0.5) * -12).toFixed(1) + 'px');
      });
    });
  }
  const posterLayer = hero.querySelector('.poster');
  const ring = hero.querySelector('.ring');
  const bands = [...hero.querySelectorAll('.band')].map((el, n, all) => ({
    el,
    a: parseFloat(el.dataset.a),
    b: parseFloat(el.dataset.b),
    first: n === 0,
    last: n === all.length - 1,
    o: -1,
    k: -1,
  }));
  // MP4 (H.264) first; a VP9 WebM twin covers browsers built without H.264.
  const probe = document.createElement('video');
  const VIDEO_URL = probe.canPlayType('video/mp4; codecs="avc1.640028"')
    ? hero.dataset.scrub
    : hero.dataset.scrub.replace(/\.mp4$/, '.webm');
  const POSTER = hero.dataset.poster;
  const ENDING = hero.dataset.ending || POSTER;

  // The five static-hero gates: small screen, coarse pointer, reduced motion, Save-Data, no fetch/streams.
  const conn = navigator.connection || {};
  const isStatic =
    reduce ||
    conn.saveData ||
    innerWidth < 760 ||
    matchMedia('(pointer: coarse)').matches ||
    !('fetch' in window) ||
    location.protocol === 'file:';

  if (isStatic) {
    // Phones and reduced motion: the live loop (or its first frame) with the opening card, no scrub.
    hero.classList.add('static', 'at-top');
    posterLayer.style.backgroundImage = `url('${POSTER}')`;
    playLoop();
    if (video) video.remove();
    bands.forEach((b) => {
      const show = b.el.hasAttribute('data-static');
      b.el.style.opacity = show ? 1 : 0;
      b.el.style.setProperty('--k', 1);
      b.el.classList.toggle('on', show);
    });
    if (ring) ring.remove();
    return;
  }

  posterLayer.style.backgroundImage = `url('${POSTER}')`;
  hero.classList.add('at-top');
  playLoop();
  let atTop = true;
  // At the very top the live loop plays; the moment scrolling starts it hands over to the scrub video.
  function setTop(v) {
    if (v === atTop) return;
    atTop = v;
    hero.classList.toggle('at-top', v);
    if (v) playLoop(); else if (loop) loop.pause();
  }
  let heroOnScreen = true;
  new IntersectionObserver((e) => { heroOnScreen = e[0].isIntersecting; if (heroOnScreen) onScroll(); }).observe(hero);

  function heroProgress() {
    const r = hero.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
  }

  // Gated seeks: never overlap, keep only the newest target.
  let seekBusy = false;
  let pendingTime = null;
  function requestSeek(t) {
    if (!video.duration || !hero.classList.contains('video-ready')) return;
    t = clamp(t, 0, video.duration - 0.04);
    if (seekBusy) { pendingTime = t; return; }
    if (Math.abs(video.currentTime - t) < 0.008) return;
    seekBusy = true;
    video.currentTime = t;
  }
  video.addEventListener('seeked', () => {
    seekBusy = false;
    if (pendingTime !== null) { const t = pendingTime; pendingTime = null; requestSeek(t); }
  });
  video.addEventListener('error', () => { seekBusy = false; pendingTime = null; });

  function updateBands(p) {
    bands.forEach((b) => {
      const f = Math.min(0.03, (b.b - b.a) / 3);
      // First band starts settled, last band ends settled.
      const o = (b.first ? 1 : smooth(p, b.a, b.a + f)) * (b.last ? 1 : 1 - smooth(p, b.b - f, b.b));
      const k = b.first ? 1 : clamp((p - b.a) / Math.min(0.04, (b.b - b.a) * 0.35), 0, 1);
      const oq = Math.round(o * 100) / 100;
      const kq = Math.round(k * 100) / 100;
      if (oq !== b.o) {
        b.o = oq;
        b.el.style.opacity = oq;
        const on = oq > 0.5;
        if (on !== b.on) { b.on = on; b.el.classList.toggle('on', on); }
        b.el.style.visibility = oq === 0 ? 'hidden' : 'visible';
      }
      if (kq !== b.k) { b.k = kq; b.el.style.setProperty('--k', kq); }
    });
  }

  let target = 0, shown = 0, rafId = null, lastTick = 0;
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    shown += (target - shown) * (1 - Math.pow(1 - 0.14, dt / 16.667));
    if (Math.abs(target - shown) < 0.0005) { shown = target; rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
    if (video.duration) requestSeek(shown * video.duration);
    updateBands(shown);
    setTop(shown < 0.004);
    const hint = Math.round(clamp(1 - shown * 12, 0, 1) * 100) / 100;
    if (hint !== hero._hint) { hero._hint = hint; hero.style.setProperty('--hint', hint); }
  }
  function onScroll() {
    target = heroProgress();
    if (rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick);
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  updateBands(heroProgress());
  onScroll();

  // Paint poster first, then stream the video as a Blob behind an honest ring.
  let started = false;
  function startFetch() {
    if (started) return;
    started = true;
    loadBlob().catch(failVideo);
  }
  const pi = new Image();
  trailerReady.then(() => { pi.src = POSTER; });
  pi.onload = startFetch;
  pi.onerror = startFetch;
  setTimeout(startFetch, 9000);

  async function loadBlob() {
    const ctrl = new AbortController();
    let watchdog = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(VIDEO_URL, { priority: 'low', signal: ctrl.signal });
    if (!res.ok || !res.body) throw new Error('video ' + res.status);
    const total = Number(res.headers.get('Content-Length')) || Number(hero.dataset.bytes) || 4e6;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0, lastRing = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      clearTimeout(watchdog);
      watchdog = setTimeout(() => ctrl.abort(), 20000);
      chunks.push(value);
      got += value.length;
      const frac = Math.min(1, got / total);
      const now = performance.now();
      if (ring && (now - lastRing > 100 || frac === 1)) {
        lastRing = now;
        ring.style.setProperty('--ld', Math.round(126 * (1 - frac)));
      }
    }
    clearTimeout(watchdog);
    if (ring) ring.style.setProperty('--ld', 0);
    video.src = URL.createObjectURL(new Blob(chunks, { type: VIDEO_URL.endsWith('.webm') ? 'video/webm' : 'video/mp4' }));
    video.load();
    video.addEventListener('loadeddata', () => {
      hero.classList.add('video-ready');
      requestSeek(heroProgress() * video.duration);
      setTimeout(() => ring && ring.classList.add('done'), 300);
    }, { once: true });
    video.addEventListener('error', failVideo, { once: true });
  }
  function failVideo() {
    hero.classList.add('video-failed');
    posterLayer.style.backgroundImage = `url('${ENDING}')`;
    if (ring) ring.classList.add('done');
  }
})();
