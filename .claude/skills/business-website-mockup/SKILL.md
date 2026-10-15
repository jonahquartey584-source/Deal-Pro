---
name: business-website-mockup
description: Build a premium, interactive single-page website mockup for a local business (estate agent, bakery, barber, cafe, restaurant, tech shop, gardener, plumber, or any other trade). The page opens on a live, slowly panning photographic scene with the business name and a live info card, then plays a scroll-driven film with caption bands, then scroll-animated sections and one working feature. All imagery is AI generated (Higgsfield) or real photography; code-drawn art is banned. Use when asked to make a website mockup, concept site, demo site or example website for a business.
---

# Business website mockup

You are building a mockup website for an invented (or named) local business. It must look like a
£10k bespoke site: photographic, moving, and genuinely usable. Follow every step in order.

## Non-negotiable rules

1. **No code-drawn art. Ever.** Every picture of a thing (food, rooms, people, tools, buildings,
   products, scenery) must be an AI-generated image/video or a real photograph. Banned:
   - SVG or canvas illustrations of objects, scenes, food, people, buildings or icons-as-pictures
   - CSS shapes, gradients or emoji arranged to depict an object
   - Placeholder boxes, "image here" blocks, stock clip-art, flat vector cartoons
   Allowed: gradients/scrims as overlays on photos, thin UI lines, tiny UI glyphs (arrows, a close
   ×, a heart on a favourite button), and decorative text.
2. **The top of the page is live before any scrolling.** A slowly panning photographic panorama
   (like a film camera drifting sideways) sits behind the title, plus a live glass card. Never a
   still hero.
3. **Scroll animations are kept** under the live top: scroll-scrubbed film, caption bands,
   word-by-word reveals, image wipes, counters, staggered cards.
4. **The page always opens at the very top**, including on reload and back/forward.
5. **No location pins or map-marker labels** anywhere (no "📍 Fresh roast" style chips on images).
6. **Copy:** British English, short sentences, no em dashes, no stock words (seamless, elevate,
   unlock, leverage, cutting-edge, world-class, bespoke, nestled, curated). Specific details beat
   adjectives ("Baked at seven, usually gone by two").
7. **Honesty:** footer says the business is fictional (if invented) and imagery is AI generated.
8. **One business = one look.** Fonts, palette, layout rhythm, button shapes and motion must come
   from the business type and its personality (see the style table). Never reuse one template
   skin across different businesses.

## Step 1: Brief and art direction

Collect or invent: business name, trade, town/area, personality (premium, friendly, bold, rustic,
technical), one signature product or service, price level. Then pick the direction.

### Style table (starting points, adapt to the brief)

| Trade | Personality examples | Palette | Display / body fonts | Hero scene | Working feature |
|---|---|---|---|---|---|
| Estate agent (premium) | Prime London, dusk | Navy #0f1626, gold #c9a45c, cream | Cormorant Garamond / Inter | Stucco terrace at blue hour | Home valuation estimator + listing filter with favourites |
| Estate agent (friendly) | Family homes, bright | Off-white #f3f7fb, yellow #ffb703, navy | Lexend / Inter | Sunny new-build street | Mortgage calculator (deposit, term, rate sliders) |
| Barber (heritage) | Brass, leather, checkerboard | Espresso #17110f, brass #c8a165, red | Playfair Display / DM Sans | Vintage barber shop | Booking: service → barber → day → time slots |
| Barber (studio) | Concrete, neon | Charcoal #151515, orange #ff6a1a | Anton / Inter | Concrete studio with orange light strips | Style picker with price/time + live queue |
| Cafe (warm) | Editorial, slow mornings | Dark roast, cream, sage | Fraunces / Inter | Sunlit cafe counter | Build a drink, cup fills |
| Cafe (coastal) | Bright seaside | White-blue #f1f6f7, coral #ff7a59, deep teal | Young Serif / Plus Jakarta Sans | Harbour window, sea view | Order tray (beach box) with pickup time |
| Restaurant (fine) | Dark, quiet, minimal | Ink #0e0f14, rice paper, vermilion | Cormorant / Noto Sans JP | Hinoki counter in low light | Course timeline + seat map booking |
| Restaurant (casual) | Loud, playful | Cream, tomato red, char | Bricolage Grotesque / Inter | Wood-fired oven glow | Build-your-own with toppings dropping on |
| Bakery (pastel) | Friendly, sweet | Butter, apricot, pistachio | Recoleta-style serif / Nunito | Flour in sunbeams | Fill a box of six |
| Bakery (rustic) | Artisan, dark crust | Burnt crust #1b1410, amber #e0a03c | Alegreya / Work Sans | Bakehouse with proofing baskets | Bread club subscription with monthly price |
| Tech shop (clean) | Product store | Light grey, graphite, acid lime | Inter Tight / Inter | Product on a studio plinth | Filter/sort + colourway switcher + cart |
| Tech shop (gaming) | Neon, technical | Deep navy, violet, cyan | Space Grotesk / JetBrains Mono | Light ribbons over a PC build | PC spec builder with live FPS |
| Gardener (design) | Botanical, calm | Forest #0f1d16, lime-sage #c9d77a | Marcellus / Karla | English garden terraces | Garden estimate (style + size) |
| Gardener (maintenance) | Fresh, sporty | Mint white, grass green #2fbf4a, sun yellow | Rubik / Inter | Striped lawns in back gardens | Lawn plan pricing + postcode check |
| Plumber (emergency) | Bold, urgent | Navy #0b1a2e, safety orange #ff7a1a, cyan | Barlow Condensed / Barlow | Navy tiled bathroom | Fixed-price job picker + live ETA |
| Heating engineer | Warm, technical | Charcoal #161311, copper #d9813f | Syne / Manrope | Copper pipework plant room | Boiler finder quiz + fitted price |

Write down: palette tokens (`--bg --ink --muted --accent --on-accent --card --line`), two Google
Fonts, button radius, display weight/case, and 2 scene names for the panoramas.

## Step 2: Generate the imagery (Higgsfield, credit-efficient)

Use Higgsfield MCP tools. Submit image jobs in batches of about 4 (rate limit ~8 concurrent), keep
every job ID in a notes file, then `jobs_wait` and download. Every prompt ends with
**"No text, no logos."** and names the real materials, light and camera.

| Asset | Model / settings | Count | Use |
|---|---|---|---|
| Start frame | gpt_image_2_5, 16:9, medium, 1k (~0.5 credit) | 1 | First frame of the scroll film |
| Scroll film | kling3_0 std, 5 s, silent, start image = start frame job ID (~7.5 credits) | 1 | Scroll-scrubbed hero film. Prompt a slow, steady camera move (push-in, crane, pan) with a calm final frame |
| Panoramas | gpt_image_2_5, 21:9, medium, 2k (~1 credit) | 2 | The live panning backgrounds at the top |
| Stills | gpt_image_2_5, 4:3 or 1:1, medium, 1k | 3–4 | Intro image, feature options, cards |
| Laptop scene (for a showcase grid) | gpt_image_2_5, 16:9, image_references = start frame job ID | 1 | Laptop on a table in the business setting, screen showing the site with the exact headline |

Panorama prompt template: "Ultra-wide cinematic panorama of [place] in [light], [materials],
[details along the whole width so it pans well], photographic, shallow haze. No text, no logos."

Batch video calls may need `use_unlim:false` and `declined_preset_id` if a preset is suggested.
Job IDs can be passed directly as media values (no upload needed).

## Step 3: Process the assets (ffmpeg)

```bash
# Scroll film: keyframe every 8 frames, or scrubbing stutters
ffmpeg -i raw.mp4 -vf scale=1280:-2 -c:v libx264 -crf 22 -preset slow -g 8 -keyint_min 8 \
  -pix_fmt yuv420p -movflags +faststart -an assets/hero-scrub.mp4
# VP9 fallback for browsers without H.264
ffmpeg -i raw.mp4 -vf scale=1280:-2 -c:v libvpx-vp9 -crf 38 -b:v 0 -g 8 -an assets/hero-scrub.webm
# First and last frames
ffmpeg -i raw.mp4 -frames:v 1 -q:v 4 assets/hero-poster.jpg
ffmpeg -sseof -0.1 -i raw.mp4 -frames:v 1 -update 1 -q:v 4 assets/hero-ending.jpg
# Panoramas
ffmpeg -i pano.png -vf "scale=2400:1029:force_original_aspect_ratio=increase,crop=2400:1029" -q:v 5 assets/pano-1.jpg
# Stills
ffmpeg -i still.png -vf "scale='min(1000,iw)':-2" -q:v 4 assets/s1.jpg
```

Targets: film 1.5–4 MB, panoramas under 700 KB, stills under 250 KB.

## Step 4: Build the page

Folder: `<slug>/index.html`, `<slug>/site.js`, `<slug>/assets/`. Keep JS in external files (no
inline scripts) so the page survives strict Content-Security-Policies.

### Section order

1. **Curtain** (once per session): brand name fades in, lifts away.
2. **Hero** (`section.hero`, ~400vh tall, sticky stage):
   - two `.pano` layers panning the panoramas (live top)
   - glass **live card** on the right with real-feeling live data (open now, slots left, ETA,
     queue, today's bake) that ticks and is clickable
   - title band: kicker, headline with one accented word, sub, two buttons, scene tag
     ("Brand · Scene name")
   - the scroll film fades in as you scroll; two more caption bands appear in turn
   - scroll hint + loading ring
3. **Intro**: kicker, split-word heading, lede, 3 counting stats, clip-wipe image.
4. **Feature**: the working tool for this trade (see table). Real maths, real state, instant result.
5. **Cards**: 3 products/services/listings with images, prices, badges, favourite buttons, filters.
6. **Steps**: 3 numbered steps + one quote.
7. **CTA**: image + short form that answers on the page (sends nothing).
8. **Footer**: address, fictional/AI disclaimer.

### Core engine (put in a shared `scroll.js`)

```js
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');
  if (reduce) root.classList.add('reduce');

  // Always open at the very top
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) scrollTo(0, 0);
  addEventListener('pageshow', (e) => { if (e.persisted && !location.hash) scrollTo(0, 0); });

  // Reveal on scroll
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.15 });
  document.querySelectorAll('[data-reveal],[data-split],[data-stagger]').forEach((el) => io.observe(el));

  // Split headings into words that rise in
  document.querySelectorAll('[data-split]').forEach((h) => {
    h.setAttribute('aria-label', h.textContent);
    h.innerHTML = h.textContent.split(' ').map((w, i) =>
      `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(' ');
  });

  // Count-up numbers
  document.querySelectorAll('[data-count]').forEach((el) => {
    const to = +el.dataset.count, suf = el.dataset.suffix || '';
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return; o.disconnect();
      const t0 = performance.now();
      const tick = (t) => { const k = Math.min(1, (t - t0) / 1400);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }).observe(el);
  });

  const hero = document.querySelector('.hero');
  if (!hero) return;
  const stage = hero.querySelector('.stage');

  // Live panning background: wide panoramas glide sideways, then crossfade to the next scene
  const wrap = hero.querySelector('.panos');
  if (wrap) {
    const scenes = JSON.parse(wrap.dataset.scenes); // [{src, name}]
    const [A, B] = wrap.querySelectorAll('.pano');
    const SWEEP = matchMedia('(max-width:760px)').matches ? 38 : 46; // seconds per scene
    let cur = A, nxt = B, si = 0, start = performance.now(), W = 0, iw = 0;
    const size = () => { W = stage.offsetWidth; const ih = stage.offsetHeight * 1.15; iw = ih * 21 / 9;
      [A, B].forEach((el) => { el.style.width = iw + 'px'; el.style.height = ih + 'px'; }); };
    cur.style.backgroundImage = `url('${scenes[0].src}')`; cur.style.opacity = 1;
    size(); addEventListener('resize', size);
    const frame = (now) => {
      const t = (now - start) / 1000, k = Math.min(1, t / SWEEP);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
      const span = Math.max(0, iw - W);
      cur.style.transform = `translate3d(${-(reduce ? span / 2 : span * e)}px,0,0)`;
      if (!reduce && t > SWEEP + 0.4 && scenes.length > 1) {
        si = (si + 1) % scenes.length;
        nxt.style.backgroundImage = `url('${scenes[si].src}')`;
        nxt.style.transform = 'translate3d(0,0,0)'; nxt.style.opacity = 1; cur.style.opacity = 0;
        [cur, nxt] = [nxt, cur]; start = now;
      }
      if (!reduce) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // Scroll-scrubbed film with eased seeking and caption bands paced by scroll progress
  const video = hero.querySelector('video.scrub');
  const bands = [...hero.querySelectorAll('.band')];
  const progress = () => { const r = hero.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / (hero.offsetHeight - innerHeight))); };
  const mp4 = hero.dataset.scrub;
  const src = document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"')
    ? mp4 : mp4.replace(/\.mp4$/, '.webm');
  const isStatic = reduce || matchMedia('(max-width:760px)').matches; // phones keep the live pan only
  if (!isStatic && video) {
    fetch(src).then((r) => (r.headers.get('Accept-Ranges') === 'bytes' ? src : r.blob().then((b) => URL.createObjectURL(b))))
      .then((url) => { video.src = url; video.load(); video.addEventListener('loadeddata', () => hero.classList.add('video-ready'), { once: true }); })
      .catch(() => hero.classList.add('video-failed'));
    video.addEventListener('error', () => { if (!video.dataset.direct) { video.dataset.direct = 1; video.src = src; } });
  } else hero.classList.add('static');
  let shown = 0;
  const loop = () => {
    const p = progress();
    hero.classList.toggle('at-top', p < 0.02);
    if (video && video.duration && !isStatic) {
      shown += (p * video.duration - shown) * 0.12; // ease toward the target time
      if (Math.abs(video.currentTime - shown) > 0.03 && !video.seeking) video.currentTime = shown;
    }
    bands.forEach((b) => {
      const a = +b.dataset.a, z = +b.dataset.b, fade = 0.06;
      const o = p < a ? 0 : p < a + fade ? (p - a) / fade : p < z - fade ? 1 : p < z ? (z - p) / fade : 0;
      b.style.opacity = b.hasAttribute('data-static') && p < a + fade ? 1 : o;
    });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
```

### Key CSS

```css
html{overflow-x:hidden} body{overflow-x:clip;background:var(--bg);color:var(--ink);font-family:var(--body)}
.hero{height:400vh;position:relative}
.stage{position:sticky;top:0;height:100vh;overflow:hidden}
.panos{position:absolute;inset:0;overflow:hidden;transition:opacity .8s}
.hero:not(.at-top).video-ready .panos{opacity:0}        /* film takes over once scrolling starts */
.pano{position:absolute;left:0;top:0;background:0 0/100% 100% no-repeat;opacity:0;transition:opacity 1.6s;will-change:transform,opacity}
video.scrub{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s}
.hero.video-ready:not(.at-top) video.scrub{opacity:1}
.scrim{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.65),rgba(0,0,0,.15) 60%),linear-gradient(0deg,rgba(0,0,0,.5),transparent 40%)}
.band{position:absolute;inset:0;display:flex;align-items:center;padding:0 6vw;opacity:0;color:#fff}
.live-card{backdrop-filter:blur(16px);background:rgba(15,15,18,.55);border:1px solid rgba(255,255,255,.14);border-radius:20px}
[data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .8s,transform .8s cubic-bezier(.2,.8,.2,1)}
[data-reveal].in{opacity:1;transform:none}
[data-split] .w{display:inline-block;overflow:hidden}
[data-split] .w>span{display:inline-block;transform:translateY(110%);transition:transform .9s cubic-bezier(.2,.8,.2,1);transition-delay:calc(var(--i)*60ms)}
[data-split].in .w>span{transform:none}
html.reduce *{animation:none!important;transition:none!important}
```

Hero markup skeleton:

```html
<section class="hero" data-scrub="assets/hero-scrub.mp4" aria-label="Business name">
  <div class="stage">
    <div class="media">
      <div class="panos" data-scenes='[{"src":"assets/pano-1.jpg","name":"The shop floor"},{"src":"assets/pano-2.jpg","name":"The back room"}]'>
        <div class="pano"></div><div class="pano"></div>
      </div>
      <video class="scrub" muted playsinline preload="none" aria-hidden="true"></video>
    </div>
    <div class="scrim"></div>
    <div class="band" data-a="0" data-b="0.33" data-static><!-- title, sub, buttons, scene tag, live card --></div>
    <div class="band" data-a="0.31" data-b="0.71"><!-- caption 2 --></div>
    <div class="band" data-a="0.68" data-b="1"><!-- caption 3 --></div>
  </div>
</section>
```

Keep the caption bands contiguous (each starts just before the last ends) so there is never a gap
with no title on screen.

## Step 5: Make it genuinely interactive

- The live card updates on its own (a countdown, a queue number, slots left, a rotating listing)
  and its button scrolls to the feature.
- The feature does real calculations with real-looking UK prices (£) and updates instantly.
  Selected options use `aria-pressed`; results swap matching photos.
- Cards: hover zoom, favourites toggle, a filter that animates cards in.
- The CTA form answers on the page in the business's voice and sends nothing.
- Buttons get a magnetic hover on fine pointers; the live card tilts slightly with the cursor.

## Step 6: Test before showing anyone

Run a local server and a Playwright check at 1440×900 and 390×844:

- [ ] Opens at scrollY 0, and still at 0 after scrolling down and reloading
- [ ] Panorama transform changes over 1.5 s (it is moving)
- [ ] No `.pin` or map-marker elements; no images that are code-drawn
- [ ] Mid-hero: film frame advances with scroll and captions swap without a gap
- [ ] Every feature button changes the result; form shows a reply
- [ ] No console errors, no broken images
- [ ] Phone: `document.documentElement.scrollWidth` equals the viewport width (no sideways scroll)
- [ ] Reduced motion: everything visible, nothing animating
- [ ] Copy check: no em dashes, no stock words, British spelling

Take screenshots of the top, mid-scroll and each section, and look at them before you report back.

## Step 7: Deploying

- If the host has a strict CSP: no inline scripts (use external files); if `blob:` media is
  blocked, the engine falls back to the direct file URL; hosts that send `Accept-Ranges: bytes`
  get the direct file anyway.
- Add `X-Robots-Tag: noindex` for fictional demo businesses.
- Before deploying into an existing site, compare the live site with the branch you deploy from.
  Never publish someone's unreleased work along with the mockups: build the deploy from exactly
  what is live, add only the mockup folder and the links to it.
- Keep total upload size in mind (compress the film to crf 26–27 and photos to quality ~72 if an
  uploader has a size cap).
