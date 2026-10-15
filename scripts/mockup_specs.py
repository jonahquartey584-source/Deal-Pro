# Specs for the generated mockup sites. Copy is plain and in each brand's own voice.
# Assets each site needs in mockups/<slug>/assets/: hero-scrub.mp4/.webm, hero-poster.jpg,
# hero-ending.jpg, pano-1.jpg, pano-2.jpg, s1.jpg, s2.jpg, s3.jpg (+ s4.jpg where used).

DARK_SCRIM = "radial-gradient(ellipse 120% 90% at 50% 45%,rgba(0,0,0,0) 40%,rgba(0,0,0,.55) 100%)"


def card_cycle(head_l, head_r_id, head_r, img, alt, name_id, name, meta_id, meta, btn_id, btn, pills=''):
    return f'''          <div class="lc-head"><span class="live-dot">{head_l}</span><span id="{head_r_id}">{head_r}</span></div>
          <img class="lc-img" id="lcImg" src="assets/{img}" alt="{alt}">
{pills}          <div class="lc-row"><div><b id="{name_id}" style="font-family:var(--display);font-size:20px">{name}</b><br><small id="{meta_id}" style="opacity:.8">{meta}</small></div><button class="btn" type="button" id="{btn_id}">{btn}</button></div>'''


SPECS = [
# ───────────────────────────── Estate agents ─────────────────────────────
dict(
  slug='harlow-finch', name='Harlow & Finch', brand='Harlow &amp; Finch', title='Harlow &amp; Finch | Prime London Property',
  desc='Prime London homes for sale and to let, with free valuations from agents who live in the neighbourhood.',
  tagline='Prime London property', logo='Harlow <b>&amp;</b> Finch', scheme='dark', bytes=3000000,
  fonts='family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600&family=DM+Mono:wght@400;500',
  tokens='''  --bg:#0f1626;--ink:#f1ece2;--muted:#a9afbd;--accent:#c9a45c;--on-accent:#141006;
  --card:rgba(241,236,226,.04);--line:rgba(241,236,226,.12);--line-strong:rgba(241,236,226,.3);
  --display:'Cormorant Garamond',serif;--body:'Jost',system-ui,sans-serif;--mono:'DM Mono',monospace;
  --display-weight:600;--header-bg:rgba(15,22,38,.78);--radius:2px;--panel-radius:4px;--img-radius:2px;
  --scrim:radial-gradient(ellipse 120% 90% at 50% 45%,rgba(15,22,38,0) 40%,rgba(15,22,38,.7) 100%);--band-scrim:rgba(15,22,38,.5);
  --env:radial-gradient(40% 35% at 15% 15%,rgba(201,164,92,.1),transparent 70%),#0f1626;
  --glass:rgba(15,22,38,.58);--live:#c9a45c;--live-scrim:linear-gradient(90deg,rgba(15,22,38,.78),rgba(15,22,38,.25) 60%,transparent)''',
  css='.btn{letter-spacing:.14em;text-transform:uppercase;font-size:12px}.hero .big{font-size:clamp(48px,7vw,104px);line-height:.95}',
  nav=[('about', 'About'), ('valuation', 'Valuation'), ('cards', 'For sale'), ('contact', 'Contact')], cta='Book a valuation', cta_target='valuation',
  poster_alt='Twilight over a London Georgian terrace',
  scenes=['Belgravia Square', 'The drawing room'],
  kick='Est. 1998 &middot; Chelsea, Belgravia, Marylebone', headline='Homes with a <em>story.</em>',
  sub='Prime London property, sold and let by people who live on the streets they sell.',
  hero_cta='Free valuation', hero_cta2='Homes for sale', card_label='New to market',
  card=card_cycle('New to market', 'lcViews', '6 viewings today', 's1.jpg', 'A white stucco townhouse', 'lcName', 'Cheyne Walk, SW3', 'lcMeta', '5 bed townhouse &middot; &pound;6,950,000', 'lcBook', 'Book a viewing'),
  band2=('Sold by 2,140 families', 'Asking price,<br>or close.', 'Last year we achieved 98.4% of asking price across every home we sold.'),
  band3=('Harlow &amp; Finch', 'Welcome home.', 'A free valuation takes 40 minutes and comes with an honest number.'),
  intro=('Who we are', 'Two agents, one corner of London, twenty seven years.', 'Clara Harlow and James Finch opened on the King&rsquo;s Road in 1998. We still walk every viewing ourselves, and we only take on as many homes as we can sell well.'),
  intro_img='pano-2.jpg', intro_alt='A townhouse drawing room in lamplight',
  stats=[(2140, '', 'Homes sold'), (27, '', 'Years on the King&rsquo;s Road'), (98.4, '%', 'Of asking price')],
  feature_id='valuation', feature_kicker='Instant valuation', feature_title='What is your home worth today?',
  feature='''        <div>
          <div class="step"><h4>Area</h4><div class="chips" id="vArea"><button class="chip" type="button" data-v="2150" aria-pressed="true">Chelsea</button><button class="chip" type="button" data-v="2050" aria-pressed="false">Belgravia</button><button class="chip" type="button" data-v="1650" aria-pressed="false">Marylebone</button><button class="chip" type="button" data-v="1480" aria-pressed="false">Notting Hill</button></div></div>
          <div class="step"><h4>Type</h4><div class="chips" id="vType"><button class="chip" type="button" data-v="0.82" aria-pressed="false">Flat</button><button class="chip" type="button" data-v="1" aria-pressed="true">Townhouse</button><button class="chip" type="button" data-v="0.94" aria-pressed="false">Mews house</button></div></div>
          <div class="step"><h4>Bedrooms <span id="vBedsL" style="color:var(--ink)">3</span></h4><input class="range" type="range" id="vBeds" min="1" max="6" value="3" aria-label="Bedrooms"><div class="range-row"><span>1</span><span>6</span></div></div>
          <div class="step"><h4>Outside space</h4><div class="chips" id="vGarden"><button class="chip" type="button" data-v="1.08" aria-pressed="true">Garden</button><button class="chip" type="button" data-v="1.03" aria-pressed="false">Terrace</button><button class="chip" type="button" data-v="1" aria-pressed="false">None</button></div></div>
        </div>
        <div class="result">
          <h4>Estimated value</h4>
          <div class="big-num" id="vOut">&pound;0</div>
          <div class="sub-num" id="vRange">Range</div>
          <div class="line"><span>Price per sq ft</span><b id="vSqft">&pound;0</b></div>
          <div class="line"><span>Typical time to sell</span><b id="vWeeks">0 weeks</b></div>
          <button class="btn" type="button" id="vBook">Book an exact valuation</button>
        </div>''',
  cards_kicker='For sale and to let', cards_title='A few of this week&rsquo;s homes.',
  cards_extra='<div class="chips" id="lFilter" style="margin-top:20px"><button class="chip" type="button" data-f="all" aria-pressed="true">All</button><button class="chip" type="button" data-f="sale" aria-pressed="false">For sale</button><button class="chip" type="button" data-f="let" aria-pressed="false">To let</button></div>',
  cards='''        <article class="card" data-kind="sale"><div class="im"><img src="assets/s1.jpg" alt="White stucco townhouse" loading="lazy"><span class="badge">For sale</span><button class="fav" type="button" aria-pressed="false" aria-label="Save Cheyne Walk">&#9825;</button></div><div class="t"><h3>Cheyne Walk, SW3</h3><p>5 bed townhouse, garden, 4,120 sq ft</p><div class="row"><b>&pound;6,950,000</b><span class="kicker">Freehold</span></div></div></article>
        <article class="card" data-kind="let"><div class="im"><img src="assets/s2.jpg" alt="Penthouse living room with city view" loading="lazy"><span class="badge">To let</span><button class="fav" type="button" aria-pressed="false" aria-label="Save Marylebone penthouse">&#9825;</button></div><div class="t"><h3>Marylebone Penthouse</h3><p>3 bed, wraparound terrace, porter</p><div class="row"><b>&pound;4,250 pw</b><span class="kicker">Furnished</span></div></div></article>
        <article class="card" data-kind="sale"><div class="im"><img src="assets/s3.jpg" alt="Pastel mews house with wisteria" loading="lazy"><span class="badge">For sale</span><button class="fav" type="button" aria-pressed="false" aria-label="Save Eaton Mews">&#9825;</button></div><div class="t"><h3>Eaton Mews North, SW1</h3><p>3 bed mews house, garage</p><div class="row"><b>&pound;3,475,000</b><span class="kicker">Freehold</span></div></div></article>''',
  steps_title='From valuation to the keys.',
  steps=[('Valuation', 'We visit, measure and give you one honest number, with the sales to back it up.'), ('Launch', 'Photography, film and a floorplan within five days, then a quiet preview to our buyers.'), ('Sale', 'We negotiate, chase the solicitors weekly and hand over the keys on completion day.')],
  quote=('They told us what our house was worth, not what we wanted to hear. It sold in nineteen days.', 'Seller, Chelsea'),
  ending_alt='A glossy black Georgian front door with lanterns', cta_kicker='Free valuation', cta_title='Thinking of selling?',
  cta_text='Tell us your postcode and we will call to arrange a time this week.', cta_label='Your postcode', cta_placeholder='Your postcode, e.g. SW3 5RS', cta_button='Request a call',
  address='Harlow &amp; Finch, 212 King&rsquo;s Road, London SW3',
  js=r'''
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
'''),

dict(
  slug='nest-key', name='Nest & Key', brand='Nest &amp; Key', title='Nest &amp; Key | Friendly Estate Agents',
  desc='Homes to buy and rent in Bristol, a mortgage calculator, and agents who answer the phone.',
  tagline='Estate agents &middot; Bristol', logo='nest<b>&amp;</b>key', scheme='light', bytes=3000000,
  fonts='family=Lexend:wght@400;600;700&family=Nunito+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500',
  tokens='''  --bg:#f3f7fb;--ink:#13273d;--muted:#5a6b80;--accent:#ffb703;--on-accent:#13273d;
  --card:#ffffff;--line:rgba(19,39,61,.1);--line-strong:rgba(19,39,61,.25);
  --display:'Lexend',system-ui,sans-serif;--body:'Nunito Sans',system-ui,sans-serif;--mono:'IBM Plex Mono',monospace;
  --display-weight:700;--display-track:-.035em;--header-bg:rgba(243,247,251,.85);--radius:14px;--panel-radius:28px;--img-radius:22px;
  --scrim:linear-gradient(90deg,rgba(243,247,251,.5),rgba(243,247,251,0) 50%);--band-scrim:rgba(243,247,251,.7);--shadow:rgba(255,255,255,.6);
  --env:radial-gradient(40% 35% at 85% 10%,rgba(255,183,3,.14),transparent 70%),radial-gradient(40% 35% at 10% 90%,rgba(58,134,255,.1),transparent 70%),#f3f7fb;
  --glass:rgba(255,255,255,.66);--glass-line:rgba(19,39,61,.12);--glass-ink:#13273d;--glass-on:#fff;--live:#2fbf71;--spot:rgba(255,255,255,.3);
  --live-scrim:linear-gradient(90deg,rgba(243,247,251,.82),rgba(243,247,251,.3) 60%,transparent)''',
  css='.hero{color:var(--ink)}.hero .btn.ghost{color:var(--ink);border-color:rgba(19,39,61,.3);background:rgba(255,255,255,.5)}.hero .big{font-size:clamp(46px,6.6vw,96px);line-height:.98}.hero .big em{color:#3a86ff}.scene-tag{background:rgba(255,255,255,.75);color:var(--ink);border-color:rgba(19,39,61,.1)}.scene-tag b{color:var(--ink)}',
  nav=[('about', 'About'), ('mortgage', 'Mortgages'), ('cards', 'Homes'), ('contact', 'Valuation')], cta='Free valuation', cta_target='contact',
  poster_alt='Blue summer sky above a modern family home',
  scenes=['Clifton', 'Open house'],
  kick='Bristol &middot; Sales and lettings', headline='Find the one that <em>feels like home.</em>',
  sub='Friendly agents, honest fees, and a phone that gets answered by a person.',
  hero_cta='Find a home', hero_cta2='See homes', card_label='Homes near you',
  card=card_cycle('2 new today', 'lcViews', 'Bristol', 's1.jpg', 'A family semi-detached home', 'lcName', 'Ashgrove Road, BS6', 'lcMeta', '3 bed semi &middot; &pound;525,000', 'lcBook', 'Arrange viewing'),
  band2=('No sale, no fee', 'One flat fee.<br>No surprises.', '0.9% including VAT, and you only pay when the keys change hands.'),
  band3=('Nest &amp; Key', 'Your next chapter.', 'Book a free valuation, or tell us what you are looking for and we will call.'),
  intro=('Hello', 'Estate agents who actually call you back.', 'We are a team of eight in Clifton. Every seller gets one agent from valuation to completion, with a weekly update whether there is news or not.'),
  intro_img='pano-2.jpg', intro_alt='A bright open plan family kitchen',
  stats=[(612, '', 'Homes moved last year'), (4.9, '&#9733;', 'From 830 reviews'), (24, ' days', 'Average time to offer')],
  feature_id='mortgage', feature_kicker='Mortgage calculator', feature_title='What would your monthly payment be?',
  feature='''        <div>
          <div class="step"><h4>Home price <span id="mPriceL" style="color:var(--ink)"></span></h4><input class="range" type="range" id="mPrice" min="150000" max="900000" step="5000" value="425000" aria-label="Home price"><div class="range-row"><span>&pound;150k</span><span>&pound;900k</span></div></div>
          <div class="step"><h4>Deposit <span id="mDepL" style="color:var(--ink)"></span></h4><input class="range" type="range" id="mDep" min="5" max="40" value="15" aria-label="Deposit percent"><div class="range-row"><span>5%</span><span>40%</span></div></div>
          <div class="step"><h4>Term</h4><div class="chips" id="mTerm"><button class="chip" type="button" data-v="25" aria-pressed="true">25 years</button><button class="chip" type="button" data-v="30" aria-pressed="false">30 years</button><button class="chip" type="button" data-v="35" aria-pressed="false">35 years</button></div></div>
          <div class="step"><h4>Interest rate <span id="mRateL" style="color:var(--ink)"></span></h4><input class="range" type="range" id="mRate" min="3" max="7" step="0.1" value="4.6" aria-label="Interest rate"></div>
        </div>
        <div class="result">
          <h4>Monthly repayment</h4>
          <div class="big-num" id="mOut">&pound;0</div>
          <div class="line"><span>Mortgage amount</span><b id="mLoan">&pound;0</b></div>
          <div class="line"><span>Deposit</span><b id="mDeposit">&pound;0</b></div>
          <div class="line"><span>Income usually needed</span><b id="mIncome">&pound;0</b></div>
          <button class="btn" type="button" id="mAip">Talk to our mortgage adviser</button>
          <small style="color:var(--muted)">Illustration only. Your home may be repossessed if you do not keep up repayments.</small>
        </div>''',
  cards_kicker='Homes', cards_title='Fresh on the market this week.',
  cards='''        <article class="card"><div class="im"><img src="assets/s1.jpg" alt="Three bed semi-detached home" loading="lazy"><span class="badge">New</span><button class="fav" type="button" aria-pressed="false" aria-label="Save Ashgrove Road">&#9825;</button></div><div class="t"><h3>Ashgrove Road</h3><p>3 bed semi, garden, off-road parking</p><div class="row"><b>&pound;525,000</b><span class="kicker">BS6</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s2.jpg" alt="Garden flat with patio" loading="lazy"><span class="badge">Price cut</span><button class="fav" type="button" aria-pressed="false" aria-label="Save Clifton garden flat">&#9825;</button></div><div class="t"><h3>Clifton garden flat</h3><p>2 bed, private patio, share of freehold</p><div class="row"><b>&pound;385,000</b><span class="kicker">BS8</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s3.jpg" alt="New build townhouse" loading="lazy"><span class="badge">To let</span><button class="fav" type="button" aria-pressed="false" aria-label="Save Wapping Wharf townhouse">&#9825;</button></div><div class="t"><h3>Wapping Wharf</h3><p>4 bed townhouse, roof terrace</p><div class="row"><b>&pound;2,450 pcm</b><span class="kicker">BS1</span></div></div></article>''',
  steps_title='Moving, minus the stress.',
  steps=[('Free valuation', 'We visit, look at recent sales on your street and give you a fair asking price.'), ('Photos and viewings', 'Bright photos, a video tour and Saturday open houses, all booked online.'), ('Offer to keys', 'One agent chases the chain every week until moving day.')],
  quote=('Sarah answered every message, even on a Sunday. We had an offer in two weeks.', 'Seller, Redland'),
  ending_alt='A bright modern family home with an open front door', cta_kicker='Free valuation', cta_title='Ready to make a move?',
  cta_text='Pop in your postcode and we will text you three times that suit our local agent.', cta_label='Your postcode', cta_placeholder='Your postcode, e.g. BS6 6AA', cta_button='Get times',
  address='Nest &amp; Key, 14 Whiteladies Road, Bristol BS8',
  js=r'''
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
'''),

# ───────────────────────────── Barbers ─────────────────────────────
dict(
  slug='sharp-co', name='Sharp & Co.', brand='Sharp &amp; Co.', title='Sharp &amp; Co. | Traditional Barbers',
  desc='Traditional barbershop for cuts, beard trims and hot towel shaves. Book a chair online in under a minute.',
  tagline='Traditional barbers &middot; Since 1962', logo='Sharp <b>&amp;</b> Co.', scheme='dark', bytes=3000000,
  fonts='family=Abril+Fatface&family=Libre+Franklin:wght@400;500;600&family=Courier+Prime:wght@400;700',
  tokens='''  --bg:#17110f;--ink:#f3e9dc;--muted:#b3a495;--accent:#c8a165;--on-accent:#17110f;--red:#b3202a;
  --card:rgba(243,233,220,.04);--line:rgba(243,233,220,.12);--line-strong:rgba(243,233,220,.3);
  --display:'Abril Fatface',serif;--body:'Libre Franklin',system-ui,sans-serif;--mono:'Courier Prime',monospace;
  --display-weight:400;--header-bg:rgba(23,17,15,.82);--radius:4px;--panel-radius:6px;--img-radius:4px;
  --scrim:radial-gradient(ellipse 120% 90% at 50% 45%,rgba(23,17,15,0) 40%,rgba(23,17,15,.7) 100%);--band-scrim:rgba(23,17,15,.5);
  --env:radial-gradient(40% 35% at 85% 20%,rgba(179,32,42,.12),transparent 70%),#17110f;
  --glass:rgba(23,17,15,.6);--live:#b3202a;--live-scrim:linear-gradient(90deg,rgba(23,17,15,.8),rgba(23,17,15,.25) 60%,transparent)''',
  css='.hero .big{font-size:clamp(50px,7.4vw,112px);line-height:.95}.hero .big em{color:#e8c48a}.card .badge{background:var(--red);color:#fff}.barbers{display:grid;gap:8px;margin-top:6px}.barbers div{display:flex;justify-content:space-between;font-size:14px}.barbers i{font-style:normal;font-family:var(--mono);font-size:12px}',
  nav=[('about', 'The shop'), ('book', 'Book'), ('cards', 'Services'), ('contact', 'Find us')], cta='Book a chair', cta_target='book',
  poster_alt='Pressed tin ceiling and brass lamps in a vintage barbershop',
  scenes=['The shop floor', 'High Street'],
  kick='Since 1962 &middot; Walk-ins welcome', headline='A proper cut. <em>No rush.</em>',
  sub='Scissor cuts, beard work and hot towel shaves in the same chairs since 1962.',
  hero_cta='Book a chair', hero_cta2='Prices', card_label='Chairs right now',
  card='''          <div class="lc-head"><span class="live-dot">Open now</span><span>Walk-in wait <b id="lcWait">15</b> min</span></div>
          <img class="lc-img" id="lcImg" src="assets/s3.jpg" alt="Scissors and comb on leather">
          <div class="barbers" id="lcBarbers"><div><span>Tom</span><i>Cutting</i></div><div><span>Ade</span><i>Free now</i></div><div><span>Luca</span><i>Shaving</i></div></div>
          <div class="lc-row"><small style="opacity:.8" id="lcNext">Next free chair 10:40</small><button class="btn" type="button" id="lcBook">Book a chair</button></div>''',
  band2=('Hot towel shave', 'Three towels.<br>One razor.', 'Thirty minutes, hot lather and a cold finish. The best half hour of your week.'),
  band3=('Sharp &amp; Co.', 'Take a seat.', 'Book online, or walk in and we will put the kettle on.'),
  intro=('The shop', 'Three chairs, sixty years, one way of doing it.', 'Grandad opened Sharp &amp; Co. in 1962. The chairs are the same, the tools are better, and nobody leaves until the neckline is right.'),
  intro_img='pano-1.jpg', intro_alt='A row of vintage barber chairs and mirrors',
  stats=[(1962, '', 'Opened'), (3, '', 'Chairs, every day'), (41000, '+', 'Cuts last decade')],
  feature_id='book', feature_kicker='Book a chair', feature_title='Pick a service, a barber and a time.',
  feature='''        <div>
          <div class="step"><h4>Service</h4><div class="chips" id="bSvc"><button class="chip" type="button" data-p="28" data-m="30" aria-pressed="true">Cut &middot; &pound;28</button><button class="chip" type="button" data-p="38" data-m="45" aria-pressed="false">Cut &amp; beard &middot; &pound;38</button><button class="chip" type="button" data-p="32" data-m="30" aria-pressed="false">Hot towel shave &middot; &pound;32</button><button class="chip" type="button" data-p="18" data-m="20" aria-pressed="false">Under 12s &middot; &pound;18</button></div></div>
          <div class="step"><h4>Barber</h4><div class="chips" id="bWho"><button class="chip" type="button" aria-pressed="true">Anyone</button><button class="chip" type="button" aria-pressed="false">Tom</button><button class="chip" type="button" aria-pressed="false">Ade</button><button class="chip" type="button" aria-pressed="false">Luca</button></div></div>
          <div class="step"><h4>Day</h4><div class="chips" id="bDay"></div></div>
          <div class="step"><h4>Time</h4><div class="slots" id="bSlots"></div></div>
        </div>
        <div class="result">
          <h4>Your booking</h4>
          <img src="assets/s1.jpg" alt="Straight razor and shaving brush" id="bImg">
          <div class="line"><span>Service</span><b id="bSum1">Cut</b></div>
          <div class="line"><span>With</span><b id="bSum2">Anyone</b></div>
          <div class="line"><span>When</span><b id="bSum3">Pick a time</b></div>
          <div class="line"><span>Price</span><b id="bSum4">&pound;28</b></div>
          <button class="btn" type="button" id="bGo">Confirm booking</button>
        </div>''',
  cards_kicker='Services', cards_title='The menu has not changed much.',
  cards='''        <article class="card"><div class="im"><img src="assets/s3.jpg" alt="Scissors and comb on leather" loading="lazy"></div><div class="t"><h3>Classic cut</h3><p>Scissors or clippers, hot towel, neck shave and a style.</p><div class="row"><b>&pound;28</b><span class="kicker">30 min</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s2.jpg" alt="Hot towels and a lather bowl" loading="lazy"><span class="badge">Most booked</span></div><div class="t"><h3>Cut and beard</h3><p>The full cut, plus a beard shaped and lined with a razor.</p><div class="row"><b>&pound;38</b><span class="kicker">45 min</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s1.jpg" alt="Straight razor and shaving brush" loading="lazy"></div><div class="t"><h3>Hot towel shave</h3><p>Three hot towels, warm lather, a straight razor and a cold finish.</p><div class="row"><b>&pound;32</b><span class="kicker">30 min</span></div></div></article>''',
  steps_title='In the chair in three taps.',
  steps=[('Pick a service', 'Cut, beard or shave. Prices on the board, nothing extra at the till.'), ('Pick your barber', 'Or choose anyone and take the first free chair.'), ('Turn up', 'We text a reminder the night before. Running late? Just reply.')],
  quote=('Been coming since I was six. Tom cut my dad&rsquo;s hair, now he cuts my son&rsquo;s.', 'Regular, three generations'),
  ending_alt='A vintage oxblood barber chair in front of an ornate mirror', cta_kicker='Find us', cta_title='14 Market Street. Kettle&rsquo;s on.',
  cta_text='Open Tuesday to Saturday, 9 till 6. Late on Thursdays until 8. Leave your number and we will text if a chair frees up today.', cta_label='Your mobile number', cta_placeholder='Your mobile number', cta_button='Text me',
  address='Sharp &amp; Co., 14 Market Street',
  js=r'''
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
'''),

dict(
  slug='fade-theory', name='Fade Theory', brand='FADE THEORY', title='Fade Theory | Barber Studio',
  desc='Skin fades, crops and line-ups in a concrete studio in Peckham. Join the live queue or book a slot.',
  tagline='Barber studio &middot; Peckham', logo='FADE<b>/</b>THEORY', scheme='dark', bytes=3000000,
  fonts='family=Anton&family=Archivo:wght@400;500;700&family=Azeret+Mono:wght@400;600',
  tokens='''  --bg:#151515;--ink:#ededed;--muted:#9a9a9a;--accent:#ff6a1a;--on-accent:#140700;
  --card:rgba(237,237,237,.04);--line:rgba(237,237,237,.1);--line-strong:rgba(237,237,237,.28);
  --display:'Anton',Impact,sans-serif;--body:'Archivo',system-ui,sans-serif;--mono:'Azeret Mono',monospace;
  --display-weight:400;--display-case:uppercase;--display-track:.01em;--logo-track:.06em;--header-bg:rgba(21,21,21,.82);--radius:0;--panel-radius:0;--img-radius:0;
  --scrim:radial-gradient(ellipse 120% 90% at 50% 45%,rgba(21,21,21,0) 40%,rgba(21,21,21,.7) 100%);--band-scrim:rgba(21,21,21,.5);
  --env:radial-gradient(35% 30% at 90% 10%,rgba(255,106,26,.12),transparent 70%),#151515;
  --glass:rgba(21,21,21,.62);--live:#ff6a1a;--spot:rgba(255,106,26,.16);--live-scrim:linear-gradient(90deg,rgba(21,21,21,.8),rgba(21,21,21,.2) 60%,transparent)''',
  css='.hero .big{font-size:clamp(56px,8.4vw,128px);line-height:.9}.btn{text-transform:uppercase;letter-spacing:.08em;font-family:var(--mono);font-size:13px}.chip,.slot{border-radius:0}',
  nav=[('about', 'Studio'), ('styles', 'Styles'), ('cards', 'Lookbook'), ('contact', 'Visit')], cta='Join the queue', cta_target='styles',
  poster_alt='Concrete barber studio with an orange neon strip',
  scenes=['The studio', 'Rye Lane'],
  kick='Peckham &middot; Open till 9pm', headline='Sharp lines. <em>Clean fades.</em>',
  sub='Skin fades, crops and line-ups by barbers who sweat the details.',
  hero_cta='Pick a style', hero_cta2='Lookbook', card_label='Live queue',
  card='''          <div class="lc-head"><span class="live-dot">Live queue</span><span><b id="lcAhead">3</b> ahead</span></div>
          <img class="lc-img" id="lcImg" src="assets/s1.jpg" alt="A skin fade from behind">
          <div class="lc-row"><div><b id="lcName" style="font-family:var(--display);font-size:22px;text-transform:uppercase">Skin fade</b><br><small style="opacity:.8">Next chair in <b id="lcMins">12</b> min</small></div><button class="btn" type="button" id="lcJoin">Join queue</button></div>''',
  band2=('Every line, by hand', 'Zero guards.<br>Zero guesswork.', 'Foil shavers, a steady hand and a mirror check before you stand up.'),
  band3=('Fade Theory', 'Your chair is ready.', 'Join the live queue from your phone and turn up when it is your turn.'),
  intro=('The studio', 'Built for one thing: the perfect fade.', 'Four chairs, good lighting, no small talk unless you want it. We cut from 10 till 9, seven days a week, on Rye Lane.'),
  intro_img='pano-1.jpg', intro_alt='Black barber chairs and orange light strips in a concrete studio',
  stats=[(4, '', 'Chairs'), (90, '', 'Cuts a day'), (4.9, '&#9733;', 'From 1,900 reviews')],
  feature_id='styles', feature_kicker='Pick your cut', feature_title='Choose a style. See the price.',
  feature='''        <div>
          <div class="step"><h4>Style</h4><div class="opts" id="fStyle">
            <button class="opt" type="button" data-p="25" data-m="35" aria-pressed="true"><img src="assets/s1.jpg" alt="Skin fade"><span>Skin fade</span><small>&pound;25 &middot; 35 min</small></button>
            <button class="opt" type="button" data-p="28" data-m="40" aria-pressed="false"><img src="assets/s2.jpg" alt="Textured crop"><span>Textured crop</span><small>&pound;28 &middot; 40 min</small></button>
            <button class="opt" type="button" data-p="18" data-m="20" aria-pressed="false"><img src="assets/s3.jpg" alt="Buzz cut"><span>Buzz cut</span><small>&pound;18 &middot; 20 min</small></button>
          </div></div>
          <div class="step"><h4>Add-ons</h4><div class="chips" id="fAdd"><button class="chip" type="button" data-p="8" data-m="10" aria-pressed="false">Beard line-up +&pound;8</button><button class="chip" type="button" data-p="6" data-m="5" aria-pressed="false">Hot towel +&pound;6</button><button class="chip" type="button" data-p="10" data-m="15" aria-pressed="false">Hair design +&pound;10</button></div></div>
        </div>
        <div class="result">
          <h4>Your cut</h4>
          <img id="fImg" src="assets/s1.jpg" alt="Chosen style">
          <div class="big-num" id="fPrice">&pound;25</div>
          <div class="sub-num" id="fTime">35 minutes in the chair</div>
          <button class="btn" type="button" id="fGo">Join the queue for this</button>
        </div>''',
  cards_kicker='Lookbook', cards_title='Cut this week.',
  cards='''        <article class="card"><div class="im"><img src="assets/s1.jpg" alt="Skin fade" loading="lazy"><span class="badge">#1 this week</span></div><div class="t"><h3>Skin fade</h3><p>Bald at the sides, blended to length on top.</p><div class="row"><b>&pound;25</b><span class="kicker">35 min</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s2.jpg" alt="Textured crop" loading="lazy"></div><div class="t"><h3>Textured crop</h3><p>Choppy on top, low fade, sharp fringe.</p><div class="row"><b>&pound;28</b><span class="kicker">40 min</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s3.jpg" alt="Buzz cut" loading="lazy"></div><div class="t"><h3>Buzz cut</h3><p>One length all over, edges lined up by razor.</p><div class="row"><b>&pound;18</b><span class="kicker">20 min</span></div></div></article>''',
  steps_title='Skip the waiting room.',
  steps=[('Join the queue', 'Tap once on your phone. We hold your place.'), ('Get a text', 'We message when you are two away, so you can grab a coffee.'), ('Sit down', 'Show us a photo or tell us the vibe. Pay by card or cash.')],
  quote=('Best fade in South London and I did not wait a minute. The queue thing is genius.', 'Google review'),
  ending_alt='A black barber chair under orange light', cta_kicker='Visit', cta_title='88 Rye Lane, SE15.',
  cta_text='Open every day, 10 till 9. Leave your number and we will text you when the queue is short.', cta_label='Your mobile number', cta_placeholder='Your mobile number', cta_button='Text me',
  address='Fade Theory, 88 Rye Lane, London SE15',
  js=r'''
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
'''),

# ───────────────────────────── Café ─────────────────────────────
dict(
  slug='little-tern', name='Little Tern', brand='Little Tern', title='Little Tern | Seaside Café',
  desc='A seaside café on the harbour: coffee, crab sandwiches and cake, packed for the beach if you like.',
  tagline='Seaside caf&eacute; &middot; St Ives', logo='Little <b>Tern</b>', scheme='light', bytes=3000000,
  fonts='family=Young+Serif&family=Karla:wght@400;500;700&family=DM+Mono:wght@400;500',
  tokens='''  --bg:#f1f6f7;--ink:#11364a;--muted:#5c7682;--accent:#ff7a59;--on-accent:#fff;
  --card:#ffffff;--line:rgba(17,54,74,.1);--line-strong:rgba(17,54,74,.25);
  --display:'Young Serif',Georgia,serif;--body:'Karla',system-ui,sans-serif;--mono:'DM Mono',monospace;
  --display-weight:400;--header-bg:rgba(241,246,247,.85);--radius:999px;--panel-radius:32px;--img-radius:28px;
  --scrim:linear-gradient(90deg,rgba(241,246,247,.45),rgba(241,246,247,0) 50%);--band-scrim:rgba(241,246,247,.7);--shadow:rgba(255,255,255,.6);
  --env:radial-gradient(40% 35% at 85% 10%,rgba(255,122,89,.12),transparent 70%),radial-gradient(40% 35% at 10% 90%,rgba(42,127,168,.12),transparent 70%),#f1f6f7;
  --glass:rgba(255,255,255,.68);--glass-line:rgba(17,54,74,.12);--glass-ink:#11364a;--glass-on:#fff;--live:#2a7fa8;--spot:rgba(255,255,255,.3);
  --live-scrim:linear-gradient(90deg,rgba(241,246,247,.8),rgba(241,246,247,.25) 60%,transparent)''',
  css='.hero{color:var(--ink)}.hero .btn.ghost{color:var(--ink);border-color:rgba(17,54,74,.3);background:rgba(255,255,255,.5)}.hero .big{font-size:clamp(46px,6.6vw,96px);line-height:1}.scene-tag{background:rgba(255,255,255,.75);color:var(--ink);border-color:rgba(17,54,74,.1)}.scene-tag b{color:var(--ink)}.tray{display:grid;gap:8px;margin:6px 0}.tray div{display:flex;justify-content:space-between;align-items:center;font-size:15px}.tray button{width:28px;height:28px;border-radius:50%;border:1px solid var(--line-strong);background:transparent;cursor:pointer}',
  nav=[('about', 'The caf&eacute;'), ('order', 'Beach box'), ('cards', 'Menu'), ('contact', 'Find us')], cta='Order ahead', cta_target='order',
  poster_alt='Sea mist and sun over a calm sea through a cafe window',
  scenes=['The harbour window', 'Porthminster Beach'],
  kick='On the harbour &middot; Open 8 till 5', headline='Coffee with a <em>sea view.</em>',
  sub='Crab sandwiches, good coffee and lemon cake, eaten in or packed for the beach.',
  hero_cta='Pack a beach box', hero_cta2='Menu', card_label='Order for the beach',
  card='''          <div class="lc-head"><span class="live-dot">Open now</span><span>High tide <b id="lcTide">14:32</b></span></div>
          <img class="lc-img" id="lcImg" src="assets/s1.jpg" alt="Crab sandwich">
          <div class="lc-pills" id="lcPills"><button type="button" data-i="0" aria-pressed="true">Crab sandwich</button><button type="button" data-i="1" aria-pressed="false">Iced latte</button><button type="button" data-i="2" aria-pressed="false">Avo toast</button><button type="button" data-i="3" aria-pressed="false">Lemon cake</button></div>
          <div class="lc-row"><div><small style="opacity:.75">Ready in about</small><div class="lc-big"><span id="lcMins">8</span> min</div></div><button class="btn" type="button" id="lcAdd">Add &pound;9.50</button></div>''',
  band2=('Caught this morning', 'Crab from<br>the harbour.', 'Landed at six, picked by nine, in your sandwich by ten.'),
  band3=('Little Tern', 'Pull up a stool.', 'Window seats go first. Or take a beach box and find your own spot.'),
  intro=('The caf&eacute;', 'Small, bright, and two steps from the sand.', 'Jess and Kit run Little Tern from an old net loft on the harbour. Everything is made in the back kitchen, and the coffee comes from a roaster four miles up the coast.'),
  intro_img='pano-1.jpg', intro_alt='A bright seaside cafe interior',
  stats=[(4, ' miles', 'To our roaster'), (300, '+', 'Crab sandwiches a week'), (12, '', 'Window seats')],
  feature_id='order', feature_kicker='Beach box', feature_title='Pack a box for the beach.',
  feature='''        <div>
          <div class="step"><h4>Tap to add</h4><div class="opts" id="tItems" style="grid-template-columns:repeat(4,1fr)">
            <button class="opt" type="button" data-n="Crab sandwich" data-p="9.5"><img src="assets/s1.jpg" alt="Crab sandwich"><span>Crab sandwich</span><small>&pound;9.50</small></button>
            <button class="opt" type="button" data-n="Iced latte" data-p="3.8"><img src="assets/s2.jpg" alt="Iced latte"><span>Iced latte</span><small>&pound;3.80</small></button>
            <button class="opt" type="button" data-n="Avocado toast" data-p="8.5"><img src="assets/s3.jpg" alt="Avocado toast"><span>Avo toast</span><small>&pound;8.50</small></button>
            <button class="opt" type="button" data-n="Lemon cake" data-p="3.6"><img src="assets/s4.jpg" alt="Lemon drizzle cake"><span>Lemon cake</span><small>&pound;3.60</small></button>
          </div></div>
          <div class="step"><h4>Pick up</h4><div class="chips" id="tTime"><button class="chip" type="button" aria-pressed="true">In 15 min</button><button class="chip" type="button" aria-pressed="false">11:30</button><button class="chip" type="button" aria-pressed="false">12:30</button><button class="chip" type="button" aria-pressed="false">13:30</button></div></div>
        </div>
        <div class="result">
          <h4>Your beach box</h4>
          <div class="tray" id="tTray"><p style="color:var(--muted);margin:0">Tap something tasty to add it.</p></div>
          <div class="line"><span>Total</span><b id="tTotal">&pound;0.00</b></div>
          <button class="btn" type="button" id="tGo">Order for pick up</button>
        </div>''',
  cards_kicker='Menu', cards_title='Small menu. All made here.',
  cards='''        <article class="card"><div class="im"><img src="assets/s1.jpg" alt="Crab sandwich" loading="lazy"><span class="badge">Local crab</span></div><div class="t"><h3>Crab sandwich</h3><p>Brown and white meat, lemon mayo, sourdough.</p><div class="row"><b>&pound;9.50</b><span class="kicker">Until it is gone</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s3.jpg" alt="Avocado toast" loading="lazy"></div><div class="t"><h3>Avo toast</h3><p>Chilli, lime, a poached egg if you like.</p><div class="row"><b>&pound;8.50</b><span class="kicker">All day</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s4.jpg" alt="Lemon drizzle cake" loading="lazy"></div><div class="t"><h3>Lemon drizzle</h3><p>Baked at seven, usually gone by two.</p><div class="row"><b>&pound;3.60</b><span class="kicker">Gluten free option</span></div></div></article>''',
  steps_title='From our kitchen to your towel.',
  steps=[('Pick', 'Choose from today&rsquo;s menu. It changes with the catch.'), ('Pay', 'Pay online and pick a time. We pack it in paper, no plastic.'), ('Collect', 'Grab it from the hatch on the harbour wall and head for the sand.')],
  quote=('The crab sandwich on the harbour wall is my favourite twenty minutes of the whole holiday.', 'Visitor review'),
  ending_alt='A cappuccino on a white windowsill with the sea behind', cta_kicker='Find us', cta_title='On the harbour, by the blue door.',
  cta_text='Open every day, 8 till 5. Dogs welcome inside. Leave your email for the weekly specials.', cta_label='Your email', cta_placeholder='Your email', cta_button='Send me specials',
  address='Little Tern, The Old Net Loft, Harbour Wall',
  js=r'''
  window.CTA_REPLY = () => 'Lovely. The specials land in your inbox every Friday.';
  const M = [['assets/s1.jpg', 'Crab sandwich', 9.5], ['assets/s2.jpg', 'Iced latte', 3.8], ['assets/s3.jpg', 'Avocado toast', 8.5], ['assets/s4.jpg', 'Lemon cake', 3.6]];
  let lc = 0, q = 8;
  const tray = new Map();
  const drawTray = () => {
    const el = document.getElementById('tTray'); let tot = 0;
    el.innerHTML = tray.size ? [...tray].map(([n, { p, c }]) => { tot += p * c; return `<div><span>${n}</span><span><button type="button" data-n="${n}" data-d="-1" aria-label="One fewer">&minus;</button> ${c} <button type="button" data-n="${n}" data-d="1" aria-label="One more">+</button></span></div>`; }).join('') : '<p style="color:var(--muted);margin:0">Tap something tasty to add it.</p>';
    document.getElementById('tTotal').textContent = '£' + tot.toFixed(2);
  };
  const addItem = (n, p) => { const c = tray.get(n) || { p, c: 0 }; c.c++; tray.set(n, c); drawTray(); toast(`${n} added to your beach box`); };
  document.getElementById('lcPills').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); lc = +b.dataset.i; swapImg(document.getElementById('lcImg'), M[lc][0], M[lc][1]); document.getElementById('lcAdd').textContent = 'Add £' + M[lc][2].toFixed(2); });
  document.getElementById('lcAdd').onclick = () => addItem(M[lc][1], M[lc][2]);
  setInterval(() => { q = Math.max(4, Math.min(15, q + (Math.random() < .5 ? -1 : 1))); document.getElementById('lcMins').textContent = q; }, 4000);
  const t = new Date(); t.setMinutes(t.getMinutes() + 137); document.getElementById('lcTide').textContent = t.toTimeString().slice(0, 5);
  document.getElementById('tItems').addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (b) addItem(b.dataset.n, +b.dataset.p); });
  document.getElementById('tTray').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const it = tray.get(b.dataset.n); it.c += +b.dataset.d; if (it.c <= 0) tray.delete(b.dataset.n); drawTray(); });
  document.getElementById('tTime').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) press(e.currentTarget, b); });
  document.getElementById('tGo').onclick = () => toast(tray.size ? `Ordered for ${document.querySelector('#tTime [aria-pressed="true"]').textContent.toLowerCase()}. Collect from the hatch. Demo only, nothing is charged.` : 'Your box is empty.');
'''),

# ───────────────────────────── Bakery ─────────────────────────────
dict(
  slug='daybreak', name='Daybreak Bakehouse', brand='Daybreak', title='Daybreak Bakehouse | Rye &amp; Sourdough',
  desc='Dark rye, sourdough and seeded loaves baked through the night. Subscribe and collect fresh each week.',
  tagline='Bakehouse &middot; Baked overnight', logo='Day<b>break</b>', scheme='dark', bytes=3000000,
  fonts='family=Alegreya:wght@500;800&family=Alegreya+Sans:wght@400;500;700&family=Courier+Prime:wght@400;700',
  tokens='''  --bg:#1b1410;--ink:#f2e6d6;--muted:#b5a28c;--accent:#e0a03c;--on-accent:#1b1410;
  --card:rgba(242,230,214,.04);--line:rgba(242,230,214,.12);--line-strong:rgba(242,230,214,.3);
  --display:'Alegreya',Georgia,serif;--body:'Alegreya Sans',system-ui,sans-serif;--mono:'Courier Prime',monospace;
  --display-weight:800;--header-bg:rgba(27,20,16,.82);--radius:8px;--panel-radius:14px;--img-radius:10px;
  --scrim:radial-gradient(ellipse 120% 90% at 50% 45%,rgba(27,20,16,0) 40%,rgba(27,20,16,.72) 100%);--band-scrim:rgba(27,20,16,.5);
  --env:radial-gradient(40% 35% at 20% 15%,rgba(224,160,60,.1),transparent 70%),#1b1410;
  --glass:rgba(27,20,16,.6);--live:#e0a03c;--live-scrim:linear-gradient(90deg,rgba(27,20,16,.8),rgba(27,20,16,.25) 60%,transparent)''',
  css='.hero .big{font-size:clamp(48px,7vw,104px);line-height:.98}.hero .big em{color:#f4c06a}',
  nav=[('about', 'The bakehouse'), ('subscribe', 'Bread club'), ('cards', 'Loaves'), ('contact', 'Visit')], cta='Join the bread club', cta_target='subscribe',
  poster_alt='Glowing deck oven in a dark rustic bakery',
  scenes=['The oven room', 'The shop'],
  kick='Baked overnight &middot; Open from 7am', headline='Bread worth <em>waking up for.</em>',
  sub='Dark rye, slow sourdough and seeded loaves, baked through the night in a deck oven.',
  hero_cta='Join the bread club', hero_cta2='Today&rsquo;s loaves', card_label='Out of the oven',
  card='''          <div class="lc-head"><span class="live-dot">Oven on</span><span>Next bake <b id="lcBake">00:00</b></span></div>
          <img class="lc-img" id="lcImg" src="assets/s1.jpg" alt="Sliced dark rye loaf">
          <div class="lc-row"><div><b id="lcName" style="font-family:var(--display);font-size:22px">Dark rye</b><br><small id="lcLeft" style="opacity:.8">17 left on the shelf</small></div><button class="btn" type="button" id="lcSave">Reserve one</button></div>''',
  band2=('48 hours', 'Slow dough.<br>Deep flavour.', 'Two days of cold fermentation before a loaf ever sees the oven.'),
  band3=('Daybreak Bakehouse', 'Still warm.', 'Join the bread club and collect your loaves fresh every week.'),
  intro=('The bakehouse', 'We bake while the street sleeps.', 'Mo and Hana start at midnight. By seven the shelves are full of rye, sourdough and spelt, all made with stoneground flour from one mill in Somerset.'),
  intro_img='pano-1.jpg', intro_alt='A rustic bakery workshop with proofing baskets',
  stats=[(48, 'h', 'Cold ferment'), (11, '', 'Loaves on the shelf daily'), (640, '', 'Bread club members')],
  feature_id='subscribe', feature_kicker='Bread club', feature_title='Your loaves, every week.',
  feature='''        <div>
          <div class="step"><h4>Your loaf</h4><div class="opts" id="dLoaf">
            <button class="opt" type="button" data-p="5.2" aria-pressed="true"><img src="assets/s1.jpg" alt="Dark rye"><span>Dark rye</span><small>&pound;5.20</small></button>
            <button class="opt" type="button" data-p="4.8" aria-pressed="false"><img src="assets/s2.jpg" alt="Country sourdough"><span>Sourdough</span><small>&pound;4.80</small></button>
            <button class="opt" type="button" data-p="5.6" aria-pressed="false"><img src="assets/s3.jpg" alt="Seeded spelt"><span>Seeded spelt</span><small>&pound;5.60</small></button>
          </div></div>
          <div class="step"><h4>Loaves a week</h4><div class="chips" id="dQty"><button class="chip" type="button" data-v="1" aria-pressed="false">1</button><button class="chip" type="button" data-v="2" aria-pressed="true">2</button><button class="chip" type="button" data-v="3" aria-pressed="false">3</button></div></div>
          <div class="step"><h4>How</h4><div class="chips" id="dHow"><button class="chip" type="button" data-v="0" aria-pressed="true">Collect</button><button class="chip" type="button" data-v="2.5" aria-pressed="false">Deliver +&pound;2.50</button></div></div>
        </div>
        <div class="result">
          <h4>Bread club</h4>
          <img id="dImg" src="assets/s1.jpg" alt="Chosen loaf">
          <div class="big-num" id="dWeek">&pound;0</div>
          <div class="sub-num" id="dMonth">a week</div>
          <div class="line"><span>Members save</span><b>10% on every loaf</b></div>
          <button class="btn" type="button" id="dGo">Start my bread club</button>
        </div>''',
  cards_kicker='Loaves', cards_title='On the shelf this morning.',
  cards='''        <article class="card"><div class="im"><img src="assets/s1.jpg" alt="Dark rye" loading="lazy"><span class="badge">House loaf</span></div><div class="t"><h3>Dark rye</h3><p>Danish style, packed with seeds, keeps for a week.</p><div class="row"><b>&pound;5.20</b><span class="kicker">800g</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s2.jpg" alt="Country sourdough" loading="lazy"></div><div class="t"><h3>Country sourdough</h3><p>Crackly crust, open crumb, 48 hour ferment.</p><div class="row"><b>&pound;4.80</b><span class="kicker">900g</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s3.jpg" alt="Seeded spelt" loading="lazy"></div><div class="t"><h3>Seeded spelt</h3><p>Sunflower, pumpkin and linseed, nutty and soft.</p><div class="row"><b>&pound;5.60</b><span class="kicker">750g</span></div></div></article>''',
  steps_title='How the bread club works.',
  steps=[('Choose', 'Pick your loaf and how many you want each week.'), ('Collect or deliver', 'Grab it from the shop or we bring it on our bike by 9.'), ('Pause any time', 'Away for a week? Skip with one tap. No minimum term.')],
  quote=('The rye is the best I have had outside Copenhagen. I have not bought supermarket bread in a year.', 'Bread club member'),
  ending_alt='Dark crusty rye and sourdough loaves on a floured board', cta_kicker='Visit', cta_title='Mill Street, from 7am.',
  cta_text='Tuesday to Sunday until we sell out. Leave your email and we will tell you when the seasonal loaves land.', cta_label='Your email', cta_placeholder='Your email', cta_button='Keep me posted',
  address='Daybreak Bakehouse, 3 Mill Street',
  js=r'''
  window.CTA_REPLY = () => 'Thanks. You will hear first when the seasonal loaves come out.';
  const L = [['assets/s1.jpg', 'Dark rye', 17], ['assets/s2.jpg', 'Country sourdough', 9], ['assets/s3.jpg', 'Seeded spelt', 12]];
  let li = 0;
  setInterval(() => { li = (li + 1) % L.length; swapImg(document.getElementById('lcImg'), L[li][0], L[li][1]); document.getElementById('lcName').textContent = L[li][1]; document.getElementById('lcLeft').textContent = L[li][2] + ' left on the shelf'; }, 3800);
  setInterval(() => { const p = 30 * 60000, left = p - (Date.now() % p); document.getElementById('lcBake').textContent = String(Math.floor(left / 60000)).padStart(2, '0') + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0'); }, 500);
  document.getElementById('lcSave').onclick = () => { L[li][2] = Math.max(0, L[li][2] - 1); document.getElementById('lcLeft').textContent = L[li][2] + ' left on the shelf'; toast(`${L[li][1]} reserved. Collect by noon.`); };
  const st = { p: 5.2, q: 2, how: 0 };
  const calc = () => { const w = st.p * st.q * 0.9 + st.how; document.getElementById('dWeek').textContent = '£' + w.toFixed(2); document.getElementById('dMonth').textContent = `a week, about £${(w * 4.33).toFixed(0)} a month`; };
  document.getElementById('dLoaf').addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (!b) return; document.querySelectorAll('#dLoaf .opt').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); st.p = +b.dataset.p; swapImg(document.getElementById('dImg'), b.querySelector('img').src); calc(); });
  document.getElementById('dQty').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.q = +b.dataset.v; calc(); });
  document.getElementById('dHow').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.how = +b.dataset.v; calc(); });
  calc();
  document.getElementById('dGo').onclick = () => toast(`Welcome to the bread club. ${document.getElementById('dWeek').textContent} a week. Demo only, nothing is charged.`);
'''),

# ───────────────────────────── Gardeners ─────────────────────────────
dict(
  slug='greenwick', name='Greenwick Gardens', brand='Greenwick', title='Greenwick Gardens | Garden Design &amp; Build',
  desc='Garden design and build: cottage borders, modern courtyards and wildlife ponds, planned and planted by one team.',
  tagline='Garden design &amp; build', logo='Green<b>wick</b>', scheme='dark', bytes=3000000,
  fonts='family=Marcellus&family=Mulish:wght@400;600;700&family=DM+Mono:wght@400;500',
  tokens='''  --bg:#0f1d16;--ink:#eef2e6;--muted:#a3b1a0;--accent:#c9d77a;--on-accent:#0f1d16;
  --card:rgba(238,242,230,.04);--line:rgba(238,242,230,.12);--line-strong:rgba(238,242,230,.3);
  --display:'Marcellus',Georgia,serif;--body:'Mulish',system-ui,sans-serif;--mono:'DM Mono',monospace;
  --display-weight:400;--header-bg:rgba(15,29,22,.8);--radius:999px;--panel-radius:30px;--img-radius:26px;
  --scrim:radial-gradient(ellipse 120% 90% at 50% 45%,rgba(15,29,22,0) 40%,rgba(15,29,22,.7) 100%);--band-scrim:rgba(15,29,22,.5);
  --env:radial-gradient(40% 35% at 85% 15%,rgba(201,215,122,.1),transparent 70%),#0f1d16;
  --glass:rgba(15,29,22,.58);--live:#c9d77a;--live-scrim:linear-gradient(90deg,rgba(15,29,22,.8),rgba(15,29,22,.25) 60%,transparent)''',
  css='.hero .big{font-size:clamp(48px,7vw,104px);line-height:1}.wx{display:flex;gap:14px;align-items:baseline;margin:12px 0 2px}',
  nav=[('about', 'Studio'), ('estimate', 'Estimate'), ('cards', 'Gardens'), ('contact', 'Consult')], cta='Book a consult', cta_target='contact',
  poster_alt='Sunlight through a green tree canopy',
  scenes=['Cotswold terrace', 'City courtyard'],
  kick='Garden design &amp; build &middot; Oxfordshire', headline='Gardens that <em>grow on you.</em>',
  sub='We design it, build it and plant it, then come back each season to help it settle in.',
  hero_cta='Estimate my garden', hero_cta2='Our gardens', card_label='This week in the garden',
  card='''          <div class="lc-head"><span class="live-dot">This week</span><span>Plant now: <b>tulip bulbs</b></span></div>
          <img class="lc-img" id="lcImg" src="assets/s1.jpg" alt="A cottage garden border">
          <div class="wx"><span class="lc-big"><span id="lcTemp">17</span>&deg;C</span><small style="opacity:.8" id="lcWx">Light breeze, good for planting</small></div>
          <div class="lc-row"><small style="opacity:.8">Next free consult <b id="lcSlot">Thu 10:00</b></small><button class="btn" type="button" id="lcBook">Book it</button></div>''',
  band2=('Design to planting', 'One team.<br>Start to finish.', 'The designer who draws your garden is on site the day it is built.'),
  band3=('Greenwick Gardens', 'Step outside.', 'A consultation takes an hour in your garden and costs nothing.'),
  intro=('The studio', 'Gardens designed for how you actually live.', 'Ellie Greenwick trained at Kew and has designed over three hundred gardens across Oxfordshire. Her team builds every one, from the first stone to the last bulb.'),
  intro_img='pano-1.jpg', intro_alt='A designed English garden with stone terraces',
  stats=[(312, '', 'Gardens designed'), (3, '', 'RHS medals'), (100, '%', 'Built by our own team')],
  feature_id='estimate', feature_kicker='Instant estimate', feature_title='How much would your garden cost?',
  feature='''        <div>
          <div class="step"><h4>Style</h4><div class="chips" id="gStyle"><button class="chip" type="button" data-r="95" data-i="s1.jpg" aria-pressed="true">Cottage</button><button class="chip" type="button" data-r="160" data-i="pano-2.jpg" aria-pressed="false">Modern courtyard</button><button class="chip" type="button" data-r="120" data-i="s3.jpg" aria-pressed="false">Wildlife and pond</button><button class="chip" type="button" data-r="80" data-i="s2.jpg" aria-pressed="false">Family lawn</button></div></div>
          <div class="step"><h4>Garden size <span id="gSizeL" style="color:var(--ink)">120 m&sup2;</span></h4><input class="range" type="range" id="gSize" min="20" max="500" step="10" value="120" aria-label="Garden size in square metres"><div class="range-row"><span>20 m&sup2;</span><span>500 m&sup2;</span></div></div>
          <div class="step"><h4>Extras</h4><div class="chips" id="gExtra"><button class="chip" type="button" data-v="4500" aria-pressed="false">Lighting</button><button class="chip" type="button" data-v="6500" aria-pressed="false">Patio</button><button class="chip" type="button" data-v="3200" aria-pressed="false">Irrigation</button></div></div>
        </div>
        <div class="result">
          <h4>Design and build</h4>
          <img id="gImg" src="assets/s1.jpg" alt="Garden style">
          <div class="big-num" id="gOut">&pound;0</div>
          <div class="sub-num" id="gRange">range</div>
          <div class="line"><span>Time on site</span><b id="gWeeks">0 weeks</b></div>
          <button class="btn" type="button" id="gGo">Book a free consultation</button>
        </div>''',
  cards_kicker='Gardens', cards_title='A few we have planted.',
  cards='''        <article class="card"><div class="im"><img src="assets/s1.jpg" alt="Cottage garden border" loading="lazy"><span class="badge">RHS silver</span></div><div class="t"><h3>The Old Rectory</h3><p>Deep cottage borders, roses and a hidden bench.</p><div class="row"><b>Witney</b><span class="kicker">2024</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s2.jpg" alt="Family lawn garden" loading="lazy"></div><div class="t"><h3>Long Acre</h3><p>A family garden with a play lawn and fruit trees.</p><div class="row"><b>Abingdon</b><span class="kicker">2025</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s3.jpg" alt="Wildlife pond garden" loading="lazy"></div><div class="t"><h3>Mill Pond</h3><p>A natural pond with marginal planting for wildlife.</p><div class="row"><b>Woodstock</b><span class="kicker">2025</span></div></div></article>''',
  steps_title='From first visit to first bloom.',
  steps=[('Consultation', 'An hour in your garden talking about how you want to use it.'), ('Design', 'Plans, planting lists and a fixed price within three weeks.'), ('Build and plant', 'Our own team builds it, then we visit each season for a year.')],
  quote=('We had no idea what to do with the space. Now we eat outside every evening from May to September.', 'Client, Woodstock'),
  ending_alt='A landscaped garden with a stone path and pond', cta_kicker='Free consultation', cta_title='Let us walk your garden.',
  cta_text='Tell us your postcode and we will book an hour on site with Ellie.', cta_label='Your postcode', cta_placeholder='Your postcode, e.g. OX20 1TA', cta_button='Book a visit',
  address='Greenwick Gardens, The Potting Shed, Woodstock',
  js=r'''
  window.CTA_REPLY = (v) => `Thank you. Ellie will email two visit dates for ${v.toUpperCase()}.`;
  const P = [['assets/s1.jpg', 'Cottage border'], ['assets/s2.jpg', 'Family lawn'], ['assets/s3.jpg', 'Wildlife pond']];
  let pi = 0, temp = 17;
  setInterval(() => { pi = (pi + 1) % P.length; swapImg(document.getElementById('lcImg'), P[pi][0], P[pi][1]); }, 4200);
  setInterval(() => { temp = Math.max(13, Math.min(22, temp + (Math.random() < .5 ? -1 : 1))); document.getElementById('lcTemp').textContent = temp; document.getElementById('lcWx').textContent = temp > 18 ? 'Sunny, water new plants tonight' : 'Light breeze, good for planting'; }, 5000);
  document.getElementById('lcBook').onclick = () => toast(`Consultation pencilled in for ${document.getElementById('lcSlot').textContent}. We will confirm by email.`);
  const st = { rate: 95 };
  const calc = () => { const m = +document.getElementById('gSize').value; let x = 0; document.querySelectorAll('#gExtra [aria-pressed="true"]').forEach((b) => (x += +b.dataset.v)); const v = 6000 + m * st.rate + x; document.getElementById('gSizeL').textContent = m + ' m²'; document.getElementById('gOut').textContent = money(Math.round(v / 500) * 500); document.getElementById('gRange').textContent = `Typically ${money(Math.round(v * .85 / 500) * 500)} to ${money(Math.round(v * 1.15 / 500) * 500)}, design included`; document.getElementById('gWeeks').textContent = Math.max(2, Math.round(m / 60) + (x ? 1 : 0)) + ' weeks'; };
  document.getElementById('gStyle').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.rate = +b.dataset.r; swapImg(document.getElementById('gImg'), 'assets/' + b.dataset.i); calc(); });
  document.getElementById('gExtra').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); calc(); });
  document.getElementById('gSize').addEventListener('input', calc); calc();
  document.getElementById('gGo').onclick = () => document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
'''),

dict(
  slug='mow-better', name='Mow Better', brand='Mow Better', title='Mow Better | Lawn Care &amp; Garden Maintenance',
  desc='Lawn mowing, hedge trimming and garden tidy-ups on a plan that suits you. Check your postcode and price in seconds.',
  tagline='Lawn care &middot; Leeds', logo='mow<b>better</b>', scheme='light', bytes=3000000,
  fonts='family=Rubik:wght@400;500;700;800&family=IBM+Plex+Mono:wght@400;500',
  tokens='''  --bg:#f3f8ec;--ink:#17331d;--muted:#5d735f;--accent:#2fbf4a;--on-accent:#fff;--yellow:#ffd23f;
  --card:#ffffff;--line:rgba(23,51,29,.1);--line-strong:rgba(23,51,29,.25);
  --display:'Rubik',system-ui,sans-serif;--body:'Rubik',system-ui,sans-serif;--mono:'IBM Plex Mono',monospace;
  --display-weight:800;--display-track:-.03em;--header-bg:rgba(243,248,236,.85);--radius:16px;--panel-radius:28px;--img-radius:24px;
  --scrim:linear-gradient(90deg,rgba(243,248,236,.4),rgba(243,248,236,0) 50%);--band-scrim:rgba(243,248,236,.7);--shadow:rgba(255,255,255,.6);
  --env:radial-gradient(40% 35% at 85% 10%,rgba(255,210,63,.18),transparent 70%),radial-gradient(40% 35% at 10% 90%,rgba(47,191,74,.12),transparent 70%),#f3f8ec;
  --glass:rgba(255,255,255,.7);--glass-line:rgba(23,51,29,.12);--glass-ink:#17331d;--glass-on:#fff;--live:#2fbf4a;--spot:rgba(255,255,255,.3);
  --live-scrim:linear-gradient(90deg,rgba(243,248,236,.82),rgba(243,248,236,.3) 60%,transparent)''',
  css='.hero{color:var(--ink)}.hero .btn.ghost{color:var(--ink);border-color:rgba(23,51,29,.3);background:rgba(255,255,255,.5)}.hero .big{font-size:clamp(48px,7vw,104px);line-height:.95}.hero .big em{color:var(--accent)}.scene-tag{background:rgba(255,255,255,.75);color:var(--ink);border-color:rgba(23,51,29,.1)}.scene-tag b{color:var(--ink)}.btn{box-shadow:0 5px 0 #1f8a33}',
  nav=[('about', 'About'), ('plans', 'Plans'), ('cards', 'Services'), ('contact', 'Postcode check')], cta='Get a price', cta_target='plans',
  poster_alt='Blue summer sky over neat green hedges',
  scenes=['Headingley gardens', 'Harewood lawns'],
  kick='Leeds &middot; Weekly, fortnightly or monthly', headline='Stripes your neighbours <em>will notice.</em>',
  sub='Mowing, edging, hedges and tidy-ups on a plan that suits your garden. Cancel any time.',
  hero_cta='Price my lawn', hero_cta2='Services', card_label='Crews out today',
  card='''          <div class="lc-head"><span class="live-dot">Crews out</span><span><b id="lcDone">27</b> lawns done today</span></div>
          <img class="lc-img" id="lcImg" src="assets/s1.jpg" alt="Freshly striped lawn">
          <div class="lc-row"><div><b style="font-family:var(--display);font-size:20px" id="lcArea">Headingley</b><br><small style="opacity:.8">Next free visit <b id="lcNext">tomorrow AM</b></small></div><button class="btn" type="button" id="lcCheck">Price mine</button></div>''',
  band2=('Same crew every visit', 'Your lawn.<br>Your gardener.', 'You get the same two people every time, so they know the bits you care about.'),
  band3=('Mow Better', 'Sorted.', 'Pick a plan, pop in your postcode and we will be there this week.'),
  intro=('About', 'Garden care that turns up when it says it will.', 'Mow Better started with one mower and a van in 2016. Now eleven crews look after 1,800 gardens across Leeds, and we still text you before we arrive.'),
  intro_img='pano-1.jpg', intro_alt='A row of back gardens with striped lawns',
  stats=[(1800, '', 'Gardens on a plan'), (11, '', 'Local crews'), (4.8, '&#9733;', 'From 2,300 reviews')],
  feature_id='plans', feature_kicker='Plans', feature_title='Build your plan. See the price.',
  feature='''        <div>
          <div class="step"><h4>How often</h4><div class="chips" id="mFreq"><button class="chip" type="button" data-p="18" data-n="4.3" aria-pressed="true">Weekly</button><button class="chip" type="button" data-p="22" data-n="2.2" aria-pressed="false">Fortnightly</button><button class="chip" type="button" data-p="30" data-n="1" aria-pressed="false">Monthly</button></div></div>
          <div class="step"><h4>Lawn size <span id="mSizeL" style="color:var(--ink)">Medium</span></h4><input class="range" type="range" id="mSize" min="1" max="4" value="2" aria-label="Lawn size"><div class="range-row"><span>Small</span><span>Huge</span></div></div>
          <div class="step"><h4>Extras each visit</h4><div class="chips" id="mExtra"><button class="chip" type="button" data-v="8" aria-pressed="false">Hedge trim</button><button class="chip" type="button" data-v="6" aria-pressed="false">Weed and feed</button><button class="chip" type="button" data-v="5" aria-pressed="false">Leaf clear</button></div></div>
        </div>
        <div class="result">
          <h4>Your plan</h4>
          <div class="big-num" id="mOut">&pound;0</div>
          <div class="sub-num" id="mPer">a month</div>
          <div class="line"><span>Per visit</span><b id="mVisit">&pound;0</b></div>
          <div class="line"><span>Visits a month</span><b id="mVisits">0</b></div>
          <button class="btn" type="button" id="mGo">Start my plan</button>
        </div>''',
  cards_kicker='Services', cards_title='Everything outside the back door.',
  cards='''        <article class="card"><div class="im"><img src="assets/s1.jpg" alt="Striped lawn" loading="lazy"><span class="badge">Most popular</span></div><div class="t"><h3>Mowing and edging</h3><p>Cut, striped, edged and the clippings taken away.</p><div class="row"><b>From &pound;18</b><span class="kicker">Per visit</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s2.jpg" alt="Neatly trimmed hedge" loading="lazy"></div><div class="t"><h3>Hedges and shrubs</h3><p>Shaped by hand, tidied and the cuttings recycled.</p><div class="row"><b>From &pound;35</b><span class="kicker">Per visit</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s3.jpg" alt="Clean patio and cleared borders" loading="lazy"></div><div class="t"><h3>Seasonal tidy</h3><p>Leaves, weeds and a patio jet wash, spring and autumn.</p><div class="row"><b>From &pound;89</b><span class="kicker">One off</span></div></div></article>''',
  steps_title='Three steps to a tidy garden.',
  steps=[('Price it', 'Pick a plan above. The price is the price, no surprises.'), ('First visit', 'Your crew comes this week and texts before they arrive.'), ('Relax', 'Pause, skip or cancel from your phone whenever you like.')],
  quote=('They text before they come, they are always on time, and the lawn has never looked this good.', 'Customer, Roundhay'),
  ending_alt='A perfectly striped lawn with a flower border', cta_kicker='Postcode check', cta_title='Do we cover you?',
  cta_text='We look after most of Leeds and the surrounding villages. Pop your postcode in to check.', cta_label='Your postcode', cta_placeholder='Your postcode, e.g. LS6 3HN', cta_button='Check',
  address='Mow Better, Unit 2, Kirkstall Road, Leeds',
  js=r'''
  window.CTA_REPLY = (v) => /^LS/i.test(v) ? `Yes, we cover ${v.toUpperCase()}. Your first visit could be tomorrow.` : `${v.toUpperCase()} is just outside our crews' patch for now. We will let you know when we expand.`;
  const A = [['assets/s1.jpg', 'Headingley'], ['assets/s2.jpg', 'Roundhay'], ['assets/s3.jpg', 'Chapel Allerton']];
  let ai = 0, done = 27;
  setInterval(() => { ai = (ai + 1) % A.length; swapImg(document.getElementById('lcImg'), A[ai][0], A[ai][1]); document.getElementById('lcArea').textContent = A[ai][1]; }, 4000);
  setInterval(() => { done++; document.getElementById('lcDone').textContent = done; }, 3200);
  document.getElementById('lcCheck').onclick = () => document.getElementById('plans').scrollIntoView({ behavior: 'smooth' });
  const sizes = ['Small', 'Medium', 'Large', 'Huge'], mult = [0.85, 1, 1.35, 1.8];
  const st = { p: 18, n: 4.3 };
  const calc = () => { const s = +document.getElementById('mSize').value - 1; let x = 0; document.querySelectorAll('#mExtra [aria-pressed="true"]').forEach((b) => (x += +b.dataset.v)); const visit = st.p * mult[s] + x; document.getElementById('mSizeL').textContent = sizes[s]; document.getElementById('mVisit').textContent = '£' + visit.toFixed(2); document.getElementById('mVisits').textContent = st.n; document.getElementById('mOut').textContent = money(visit * st.n); document.getElementById('mPer').textContent = 'a month, March to October'; };
  document.getElementById('mFreq').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.p = +b.dataset.p; st.n = +b.dataset.n; calc(); });
  document.getElementById('mExtra').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); calc(); });
  document.getElementById('mSize').addEventListener('input', calc); calc();
  document.getElementById('mGo').onclick = () => document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
'''),

# ───────────────────────────── Plumbers ─────────────────────────────
dict(
  slug='flowright', name='Flowright Plumbing', brand='FLOWRIGHT', title='Flowright Plumbing | 24/7 Plumbers',
  desc='Emergency plumbers across Manchester, on the way in under an hour. Fixed prices before we start.',
  tagline='24/7 plumbers &middot; Manchester', logo='FLOW<b>RIGHT</b>', scheme='dark', bytes=3000000,
  fonts='family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;600',
  tokens='''  --bg:#0b1a2e;--ink:#eaf2fb;--muted:#93a7bf;--accent:#ff7a1a;--on-accent:#fff;--cool:#4cc3ff;
  --card:rgba(234,242,251,.04);--line:rgba(234,242,251,.1);--line-strong:rgba(234,242,251,.28);
  --display:'Barlow Condensed',system-ui,sans-serif;--body:'Barlow',system-ui,sans-serif;--mono:'JetBrains Mono',monospace;
  --display-weight:700;--display-case:uppercase;--display-track:.005em;--logo-track:.06em;--header-bg:rgba(11,26,46,.82);--radius:8px;--panel-radius:14px;--img-radius:12px;
  --scrim:radial-gradient(ellipse 120% 90% at 50% 45%,rgba(11,26,46,0) 40%,rgba(11,26,46,.72) 100%);--band-scrim:rgba(11,26,46,.5);
  --env:radial-gradient(40% 35% at 85% 15%,rgba(76,195,255,.1),transparent 70%),#0b1a2e;
  --glass:rgba(11,26,46,.6);--live:#2fbf71;--spot:rgba(76,195,255,.14);--live-scrim:linear-gradient(90deg,rgba(11,26,46,.82),rgba(11,26,46,.25) 60%,transparent)''',
  css='.hero .big{font-size:clamp(54px,8vw,124px);line-height:.92}.hero .big em{color:var(--accent)}.btn{text-transform:uppercase;letter-spacing:.06em;font-family:var(--display);font-size:16px}',
  nav=[('about', 'About'), ('quote', 'Price a job'), ('cards', 'Services'), ('contact', 'Call out')], cta='Call out now', cta_target='quote',
  poster_alt='Water droplets falling toward a chrome tap',
  scenes=['Bathrooms', 'Kitchens'],
  kick='24/7 &middot; Gas Safe &middot; Fixed prices', headline='Leak? <em>We are on the way.</em>',
  sub='Emergency plumbers across Manchester, usually with you in under an hour, day or night.',
  hero_cta='Price my job', hero_cta2='Services', card_label='Engineers near you',
  card='''          <div class="lc-head"><span class="live-dot"><b id="lcFree">4</b>&nbsp;engineers free</span><span>Manchester</span></div>
          <div class="lc-pills" id="lcIssue"><button type="button" data-m="38" aria-pressed="true">Leak</button><button type="button" data-m="45" aria-pressed="false">No hot water</button><button type="button" data-m="52" aria-pressed="false">Blocked drain</button></div>
          <div class="lc-row" style="margin-top:18px"><div><small style="opacity:.75">Nearest engineer</small><div class="lc-big"><span id="lcEta">38</span> min</div></div><div style="text-align:right"><small style="opacity:.75">Call-out</small><div class="lc-big">&pound;69</div></div></div>
          <div class="lc-bar"><i id="lcBar" style="--w:62%"></i></div>
          <button class="btn" type="button" id="lcCall" style="width:100%;justify-content:center;margin-top:14px">Send an engineer</button>''',
  band2=('Fixed price, upfront', 'No surprises<br>on the bill.', 'We tell you the price before we pick up a spanner. If it costs more, that is on us.'),
  band3=('Flowright', 'Back to normal.', 'Text a photo of the problem and we will price it in minutes.'),
  intro=('About', 'Plumbers who turn up, fix it and clean up.', 'Flowright has eighteen Gas Safe engineers across Greater Manchester, each in a fully stocked van. Most jobs are fixed on the first visit.'),
  intro_img='pano-1.jpg', intro_alt='A modern navy tiled bathroom',
  stats=[(52, ' min', 'Average arrival'), (18, '', 'Gas Safe engineers'), (94, '%', 'Fixed first visit')],
  feature_id='quote', feature_kicker='Price a job', feature_title='What needs fixing?',
  feature='''        <div>
          <div class="step"><h4>The problem</h4><div class="opts" id="pIssue">
            <button class="opt" type="button" data-p="89" data-n="Dripping tap" aria-pressed="true"><img src="assets/s1.jpg" alt="Dripping tap"><span>Dripping tap</span><small>From &pound;89</small></button>
            <button class="opt" type="button" data-p="129" data-n="Leaking pipe" aria-pressed="false"><img src="assets/s2.jpg" alt="Leaking pipe under a sink"><span>Leaking pipe</span><small>From &pound;129</small></button>
            <button class="opt" type="button" data-p="99" data-n="Blocked sink" aria-pressed="false"><img src="assets/s3.jpg" alt="Blocked sink"><span>Blocked sink</span><small>From &pound;99</small></button>
          </div></div>
          <div class="step"><h4>When</h4><div class="chips" id="pWhen"><button class="chip" type="button" data-v="40" aria-pressed="true">Right now</button><button class="chip" type="button" data-v="0" aria-pressed="false">Tomorrow</button><button class="chip" type="button" data-v="-10" aria-pressed="false">This week</button></div></div>
          <div class="step"><h4>Time of day</h4><div class="chips" id="pTime"><button class="chip" type="button" data-v="0" aria-pressed="true">Daytime</button><button class="chip" type="button" data-v="45" aria-pressed="false">Evening or weekend</button></div></div>
        </div>
        <div class="result">
          <h4>Your fixed price</h4>
          <img id="pImg" src="assets/s1.jpg" alt="The problem">
          <div class="big-num" id="pOut">&pound;0</div>
          <div class="sub-num" id="pWhenL">including parts and labour for a standard fix</div>
          <button class="btn" type="button" id="pGo">Book this price</button>
        </div>''',
  cards_kicker='Services', cards_title='From drips to disasters.',
  cards='''        <article class="card"><div class="im"><img src="assets/s1.jpg" alt="Dripping tap" loading="lazy"></div><div class="t"><h3>Taps and toilets</h3><p>Drips, running cisterns and wobbly taps, fixed in an hour.</p><div class="row"><b>From &pound;89</b><span class="kicker">Fixed price</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s2.jpg" alt="Leaking pipe" loading="lazy"><span class="badge">24/7</span></div><div class="t"><h3>Leaks and bursts</h3><p>Water off fast, the damage stopped, the pipe repaired.</p><div class="row"><b>From &pound;129</b><span class="kicker">Under an hour</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s3.jpg" alt="Blocked sink" loading="lazy"></div><div class="t"><h3>Blocked drains</h3><p>Sinks, showers and toilets cleared, with a camera check.</p><div class="row"><b>From &pound;99</b><span class="kicker">Same day</span></div></div></article>''',
  steps_title='Fixed in three steps.',
  steps=[('Tell us', 'Pick the problem or text a photo. You get a fixed price straight away.'), ('Track us', 'Watch your engineer on the map and get a text when they are close.'), ('Done', 'Fixed, cleaned up and a 12 month guarantee on the work.')],
  quote=('Pipe burst at 11pm. Engineer arrived at 11:40, water off, fixed by midnight. Cannot ask for more.', 'Customer, Didsbury'),
  ending_alt='A chrome tap over a white basin with a drop forming', cta_kicker='Call out', cta_title='Need us right now?',
  cta_text='Leave your number and the nearest engineer will call you back within five minutes.', cta_label='Your phone number', cta_placeholder='Your phone number', cta_button='Call me back',
  address='Flowright Plumbing, 40 Oxford Road, Manchester',
  js=r'''
  window.CTA_REPLY = () => 'Got it. The nearest engineer will call you within five minutes.';
  let free = 4, eta = 38, base = 38;
  document.getElementById('lcIssue').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); base = +b.dataset.m; eta = base; document.getElementById('lcEta').textContent = eta; });
  setInterval(() => { eta = Math.max(base - 8, Math.min(base + 8, eta + (Math.random() < .5 ? -1 : 1))); document.getElementById('lcEta').textContent = eta; document.getElementById('lcBar').style.setProperty('--w', (100 - eta) + '%'); if (Math.random() < .3) { free = Math.max(2, Math.min(6, free + (Math.random() < .5 ? -1 : 1))); document.getElementById('lcFree').textContent = free; } }, 2500);
  document.getElementById('lcCall').onclick = () => toast(`Engineer booked. About ${eta} minutes away. Demo only, no one is coming.`);
  const st = { p: 89, n: 'Dripping tap', when: 40, time: 0 };
  const calc = () => { document.getElementById('pOut').textContent = '£' + (st.p + st.when + st.time); };
  document.getElementById('pIssue').addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (!b) return; document.querySelectorAll('#pIssue .opt').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); st.p = +b.dataset.p; st.n = b.dataset.n; swapImg(document.getElementById('pImg'), b.querySelector('img').src); calc(); });
  document.getElementById('pWhen').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.when = +b.dataset.v; calc(); });
  document.getElementById('pTime').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; press(e.currentTarget, b); st.time = +b.dataset.v; calc(); });
  calc();
  document.getElementById('pGo').onclick = () => toast(`${st.n} booked at ${document.getElementById('pOut').textContent}. We will text your engineer's name.`);
'''),

dict(
  slug='copperline', name='Copperline Heating', brand='Copperline', title='Copperline Heating | Boilers &amp; Heating',
  desc='New boilers, servicing, underfloor heating and smart controls. Get a fixed boiler quote in a minute.',
  tagline='Boilers &amp; heating', logo='copper<b>line</b>', scheme='dark', bytes=3000000,
  fonts='family=Syne:wght@600;700;800&family=Work+Sans:wght@400;500;600&family=DM+Mono:wght@400;500',
  tokens='''  --bg:#161311;--ink:#f3ebe2;--muted:#b0a397;--accent:#d9813f;--on-accent:#1a0f06;
  --card:rgba(243,235,226,.04);--line:rgba(243,235,226,.1);--line-strong:rgba(243,235,226,.28);
  --display:'Syne',system-ui,sans-serif;--body:'Work Sans',system-ui,sans-serif;--mono:'DM Mono',monospace;
  --display-weight:700;--display-track:-.03em;--header-bg:rgba(22,19,17,.82);--radius:10px;--panel-radius:18px;--img-radius:14px;
  --scrim:radial-gradient(ellipse 120% 90% at 50% 45%,rgba(22,19,17,0) 40%,rgba(22,19,17,.72) 100%);--band-scrim:rgba(22,19,17,.5);
  --env:radial-gradient(40% 35% at 15% 20%,rgba(217,129,63,.12),transparent 70%),#161311;
  --glass:rgba(22,19,17,.6);--live:#d9813f;--live-scrim:linear-gradient(90deg,rgba(22,19,17,.82),rgba(22,19,17,.25) 60%,transparent)''',
  css='.hero .big{font-size:clamp(48px,7vw,104px);line-height:.95}.hero .big em{color:#f0a868}',
  nav=[('about', 'About'), ('boiler', 'Boiler quote'), ('cards', 'Services'), ('contact', 'Contact')], cta='Get a boiler quote', cta_target='boiler',
  poster_alt='Warm steam rising over copper pipes',
  scenes=['The plant room', 'Warm at home'],
  kick='Gas Safe &middot; 10 year warranties', headline='Warm home. <em>Lower bills.</em>',
  sub='New boilers fitted in a day, servicing that catches problems early, and heating controls that pay for themselves.',
  hero_cta='Get a fixed quote', hero_cta2='Services', card_label='Your heating, live',
  card='''          <div class="lc-head"><span class="live-dot">Heating on</span><span>Service slots this week: <b id="lcSlots">5</b></span></div>
          <img class="lc-img" id="lcImg" src="assets/s3.jpg" alt="A smart thermostat on a wall">
          <div class="lc-row"><div><small style="opacity:.75">Living room</small><div class="lc-big"><span id="lcTemp">19.6</span>&deg;C</div></div><div style="text-align:right"><small style="opacity:.75">Target</small><div class="lc-big"><button type="button" id="lcDown" aria-label="Lower target" style="background:none;border:0;color:inherit;font-size:22px;cursor:pointer">&minus;</button><span id="lcTarget">21</span>&deg;<button type="button" id="lcUp" aria-label="Raise target" style="background:none;border:0;color:inherit;font-size:22px;cursor:pointer">+</button></div></div></div>
          <button class="btn" type="button" id="lcBook" style="width:100%;justify-content:center;margin-top:14px">Book a boiler service &middot; &pound;79</button>''',
  band2=('Fitted in a day', 'Old one out.<br>New one on.', 'Most boiler swaps take one day, with the old one taken away and the system flushed.'),
  band3=('Copperline', 'Feel the difference.', 'Answer four questions and get a fixed boiler price, fitted this month.'),
  intro=('About', 'Heating engineers, not salespeople.', 'Copperline was started by two Gas Safe engineers in 2011. We recommend the right boiler for your home, not the biggest one, and every install comes with a ten year warranty.'),
  intro_img='pano-1.jpg', intro_alt='Copper pipework in a tidy plant room',
  stats=[(3900, '+', 'Boilers fitted'), (10, ' yr', 'Warranty'), (1, ' day', 'Typical install')],
  feature_id='boiler', feature_kicker='Boiler quote', feature_title='Find the right boiler for your home.',
  feature='''        <div>
          <div class="step"><h4>Home</h4><div class="chips" id="cHome"><button class="chip" type="button" data-v="0" aria-pressed="false">Flat</button><button class="chip" type="button" data-v="1" aria-pressed="true">Terrace</button><button class="chip" type="button" data-v="2" aria-pressed="false">Semi</button><button class="chip" type="button" data-v="3" aria-pressed="false">Detached</button></div></div>
          <div class="step"><h4>Bedrooms <span id="cBedsL" style="color:var(--ink)">3</span></h4><input class="range" type="range" id="cBeds" min="1" max="6" value="3" aria-label="Bedrooms"></div>
          <div class="step"><h4>Bathrooms</h4><div class="chips" id="cBath"><button class="chip" type="button" data-v="1" aria-pressed="true">1</button><button class="chip" type="button" data-v="2" aria-pressed="false">2</button><button class="chip" type="button" data-v="3" aria-pressed="false">3 or more</button></div></div>
          <div class="step"><h4>Smart thermostat</h4><div class="chips" id="cSmart"><button class="chip" type="button" data-v="190" aria-pressed="true">Add it</button><button class="chip" type="button" data-v="0" aria-pressed="false">No thanks</button></div></div>
        </div>
        <div class="result">
          <h4>We recommend</h4>
          <img src="assets/s1.jpg" alt="A white wall-hung boiler" id="cImg">
          <div class="line"><span>Boiler</span><b id="cType">Combi 30kW</b></div>
          <div class="big-num" id="cOut">&pound;0</div>
          <div class="sub-num" id="cMonth">or from &pound;0 a month over 5 years</div>
          <button class="btn" type="button" id="cGo">Lock in this price</button>
        </div>''',
  cards_kicker='Services', cards_title='Everything that keeps you warm.',
  cards='''        <article class="card"><div class="im"><img src="assets/s1.jpg" alt="Wall-hung boiler" loading="lazy"><span class="badge">10 yr warranty</span></div><div class="t"><h3>New boilers</h3><p>Combi, system or heat-pump ready, fitted in a day.</p><div class="row"><b>From &pound;2,195</b><span class="kicker">Fixed price</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s2.jpg" alt="Underfloor heating pipes" loading="lazy"></div><div class="t"><h3>Underfloor heating</h3><p>Wet systems for kitchens, bathrooms and extensions.</p><div class="row"><b>From &pound;85/m&sup2;</b><span class="kicker">Survey free</span></div></div></article>
        <article class="card"><div class="im"><img src="assets/s3.jpg" alt="Smart thermostat" loading="lazy"></div><div class="t"><h3>Smart controls</h3><p>Room by room control from your phone. Typically saves 12%.</p><div class="row"><b>From &pound;190</b><span class="kicker">Fitted</span></div></div></article>''',
  steps_title='A new boiler, the easy way.',
  steps=[('Quote', 'Four questions, one fixed price. A short video call confirms it.'), ('Install', 'One day. Old boiler out, system flushed, new one on and tested.'), ('Warranty', 'Ten years, plus a free first service and a reminder every year.')],
  quote=('Quote in the morning, fitted on Thursday, and our gas bill is down by a fifth.', 'Customer, Harrogate'),
  ending_alt='Polished copper pipes and brass valves on a charcoal wall', cta_kicker='Contact', cta_title='Talk to an engineer.',
  cta_text='Leave your number and a Gas Safe engineer, not a call centre, will ring you back today.', cta_label='Your phone number', cta_placeholder='Your phone number', cta_button='Call me back',
  address='Copperline Heating, 7 Station Parade, Harrogate',
  js=r'''
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
'''),
]
