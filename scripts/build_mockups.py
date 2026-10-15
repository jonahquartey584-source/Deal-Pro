"""Generate the data-driven mockup sites in mockups/<slug>/ (index.html + site.js).

Each spec sets the brand (tokens, fonts, copy), the live card in the hero, and one working
feature. Shared look and behaviour live in mockups/shared/{base.css,site.css,scroll.js}.
Run: python3 scripts/build_mockups.py
"""
import json, os, html

ROOT = os.path.join(os.path.dirname(__file__), '..', 'mockups')


def page(s):
    f = s['fonts']
    scenes = json.dumps([{'src': 'assets/pano-%d.jpg' % (i + 1), 'name': n} for i, n in enumerate(s['scenes'])], ensure_ascii=False)
    nav = ''.join('<a href="#%s">%s</a>' % (a, t) for a, t in s['nav'])
    stats = ''.join('<div data-reveal="up" style="--d:%dms"><b data-count="%s"%s>0</b><small>%s</small></div>'
                    % (i * 110, n, (' data-suffix="%s"' % suf) if suf else '', lab) for i, (n, suf, lab) in enumerate(s['stats']))
    steps = ''.join('<div><h3>%s</h3><p>%s</p></div>' % st for st in s['steps'])
    b2, b3 = s['band2'], s['band3']
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{s['title']}</title>
<meta name="description" content="{s['desc']}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?{f}&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../shared/base.css">
<link rel="stylesheet" href="../shared/site.css">
<style>
:root{{
  color-scheme:{s['scheme']};
{s['tokens']}
}}
{s.get('css', '')}
</style>
</head>
<body>
<div class="curtain" aria-hidden="true"><span class="mark">{s['brand']}<small>{s['tagline']}</small></span></div>
<div class="env" aria-hidden="true"></div>
<div class="scroll-progress" aria-hidden="true"></div>
<a class="back-link" href="../index.html">&larr; All mockups</a>

<header class="site-header" data-header>
  <div class="wrap">
    <a class="logo" href="#top">{s['logo']}</a>
    <nav aria-label="Main">{nav}</nav>
    <a class="btn" href="#{s['cta_target']}" data-magnetic>{s['cta']}</a>
  </div>
</header>

<main id="top">
  <section class="hero" data-scrub="assets/hero-scrub.mp4" data-poster="assets/hero-poster.jpg" data-ending="assets/hero-ending.jpg" data-bytes="{s['bytes']}" aria-label="{html.escape(s['name'])}">
    <div class="stage">
      <div class="media"><div class="poster" role="img" aria-label="{s['poster_alt']}"></div><div class="panos" data-place="{s['brand']}" data-scenes='{scenes}'><div class="pano"></div><div class="pano"></div></div><video class="scrub" muted playsinline preload="none" aria-hidden="true" tabindex="-1"></video></div>
      <div class="scrim"></div>
      <div class="band live-band" data-a="0" data-b="0.33" data-static>
        <div class="copy">
          <span class="kick rise" style="--rd:.05s">{s['kick']}</span>
          <span class="big" data-words>{s['headline']}</span>
          <span class="sub rise">{s['sub']}</span>
          <div class="ctas rise" style="--rd:.75s"><a class="btn" href="#{s['cta_target']}" data-magnetic>{s['hero_cta']}</a><a class="btn ghost" href="#cards">{s['hero_cta2']}</a></div>
          <div class="rise" style="--rd:.95s"><div class="scene-tag" aria-hidden="true"></div></div>
        </div>
        <aside class="live-card" data-tilt aria-label="{s['card_label']}">
{s['card']}
        </aside>
      </div>
      <div class="band pos-right" data-a="0.31" data-b="0.71">
        <span class="kick">{b2[0]}</span>
        <span class="big">{b2[1]}</span>
        <span class="sub">{b2[2]}</span>
      </div>
      <div class="band {s.get('band3_pos', 'pos-top')}" data-a="0.68" data-b="1">
        <span class="kick">{b3[0]}</span>
        <span class="big">{b3[1]}</span>
        <span class="sub">{b3[2]}</span>
      </div>
      <div class="hint" aria-hidden="true">Scroll<i></i></div>
      <svg class="ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="126" style="stroke-dashoffset:var(--ld,126)"/></svg>
    </div>
  </section>

  <section class="s-intro" id="about">
    <div class="wrap">
      <div>
        <span class="kicker" data-reveal="up">{s['intro'][0]}</span>
        <h2 class="h2" data-split>{s['intro'][1]}</h2>
        <p class="lede" data-reveal="up">{s['intro'][2]}</p>
        <div class="stats">{stats}</div>
      </div>
      <figure data-reveal="clip"><img src="assets/{s['intro_img']}" alt="{s['intro_alt']}" loading="lazy"></figure>
    </div>
  </section>

  <section class="s-feature" id="{s['feature_id']}">
    <div class="wrap">
      <span class="kicker" data-reveal="up">{s['feature_kicker']}</span>
      <h2 class="h2" data-split>{s['feature_title']}</h2>
      <div class="panel" data-reveal="up">
{s['feature']}
      </div>
    </div>
  </section>

  <section class="s-cards" id="cards">
    <div class="wrap">
      <span class="kicker" data-reveal="up">{s['cards_kicker']}</span>
      <h2 class="h2" data-split>{s['cards_title']}</h2>
      {s.get('cards_extra', '')}
      <div class="cards" id="cardGrid" data-stagger>
{s['cards']}
      </div>
    </div>
  </section>

  <section class="s-steps">
    <div class="wrap">
      <span class="kicker" data-reveal="up">How it works</span>
      <h2 class="h2" data-split>{s['steps_title']}</h2>
      <div class="steps" data-stagger>{steps}</div>
      <p class="quote" data-reveal="blur">&ldquo;{s['quote'][0]}&rdquo;<small>{s['quote'][1]}</small></p>
    </div>
  </section>

  <section class="s-cta" id="contact">
    <div class="wrap">
      <div class="cta-box" data-reveal="up">
        <img src="assets/hero-ending.jpg" alt="{s['ending_alt']}" loading="lazy">
        <div class="t">
          <span class="kicker">{s['cta_kicker']}</span>
          <h2 class="h2" style="margin:0">{s['cta_title']}</h2>
          <p class="lede" style="margin:0">{s['cta_text']}</p>
          <form id="ctaForm"><label class="sr-only" for="ctaInput">{s['cta_label']}</label><input id="ctaInput" placeholder="{s['cta_placeholder']}" required><button class="btn" type="submit">{s['cta_button']}</button></form>
          <p class="msg" id="ctaMsg" aria-live="polite"></p>
        </div>
      </div>
    </div>
  </section>
</main>
<footer class="foot"><div class="wrap"><span>{s['address']}</span><span class="fiction">{s['name']} is a fictional business made for a design mockup. Imagery is AI generated.</span></div></footer>

<script src="../shared/scroll.js"></script>
<script src="site.js"></script>
</body>
</html>
'''


COMMON_JS = r'''
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
'''


def write(s):
    d = os.path.join(ROOT, s['slug'])
    mp4 = os.path.join(d, 'assets', 'hero-scrub.mp4')
    if os.path.exists(mp4):
        s['bytes'] = os.path.getsize(mp4)
    os.makedirs(os.path.join(d, 'assets'), exist_ok=True)
    open(os.path.join(d, 'index.html'), 'w').write(page(s))
    open(os.path.join(d, 'site.js'), 'w').write('(() => {' + COMMON_JS + s['js'] + '\n})();\n')


if __name__ == '__main__':
    from mockup_specs import SPECS
    for s in SPECS:
        write(s)
        print('built', s['slug'])
