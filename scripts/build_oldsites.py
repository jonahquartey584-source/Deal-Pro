"""Build deliberately dated, low-quality 'before' versions of the sixteen mockup businesses.

Each business gets a site in one of four tired web eras, with its own photos from mockups/<slug>/assets
shrunk and over-compressed. No new imagery is generated and nothing is drawn in code.
Run: python3 scripts/build_oldsites.py   ->  mockups-old/<slug>/index.html (+ img/) and mockups-old/index.html
"""
import html, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'mockups')
OUT = os.path.join(ROOT, 'mockups-old')

# slug: (name, trade, era, town, phone, est, blurb, [(service, price)], [photos], banner)
SITES = {
 'harlow-finch': ('Harlow & Finch', 'Estate Agents', '2007', 'Chelsea, London', '020 7946 0182', 1998,
   'Harlow & Finch are a leading estate agents in the Chelsea area with many years experiance. We sell and let properties of all types. Please browse our properties below or call the office.',
   [('Sales valuation', 'FREE'), ('Lettings (full management)', '15% + VAT'), ('Tenant find only', '1 months rent'), ('Inventory', 'from £95')], ['s1.jpg', 's2.jpg', 's3.jpg'], 'hero-poster.jpg'),
 'nest-key': ('Nest & Key', 'Estate & Letting Agents', '2012', 'Bristol', '0117 496 0733', 2009,
   'Welcome to the Nest and Key website. We are a independant estate agents covering Bristol and surrounding areas. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
   [('Selling your home', '1.2% + VAT'), ('Letting your property', 'Call for price'), ('Mortgage advice', 'Ask in branch'), ('Free valuation', 'FREE')], ['s1.jpg', 's2.jpg', 's3.jpg'], 'hero-poster.jpg'),
 'sharp-co': ('Sharp & Co.', 'Gents Barbers', '1999', 'Market Street', '01632 960 418', 1962,
   'Welcome to Sharp & Co. Traditional gents barbers since 1962!!! No appointment necessary just walk in. We are open Monday to Saturday. Cash only.',
   [('Gents cut', '£12.00'), ('Cut and beard trim', '£16.00'), ('Hot towel shave', '£15.00'), ('OAP (Tues & Weds)', '£8.00')], ['s1.jpg', 's2.jpg', 's3.jpg'], 'hero-poster.jpg'),
 'fade-theory': ('Fade Theory', 'Barber Studio', '2003', 'Peckham', '07700 900 466', 2014,
   'FADE THEORY BARBERS.. THE BEST FADES IN PECKHAM!! skin fades, designs, beard work. walk ins welcome. follow us on bebo and myspace',
   [('Skin fade', '£20'), ('Scissor cut', '£18'), ('Kids cut (under 12)', '£12'), ('Line up', '£5')], ['s1.jpg', 's2.jpg', 's3.jpg'], 'hero-poster.jpg'),
 'little-tern': ('Little Tern', 'Cafe', '2012', 'Harbour Wall', '01632 960 207', 2011,
   'Welcome to Little Tern Cafe on the harbour. We serve breakfast, lunch, cakes and coffee. Dogs welcome. Check out our Facebook page for opening times as they change in winter.',
   [('Full breakfast', '£7.50'), ('Crab sandwich', '£8.95'), ('Cream tea', '£5.50'), ('Latte', '£2.80')], ['s1.jpg', 's2.jpg', 's4.jpg'], 'hero-poster.jpg'),
 'daybreak': ('Daybreak Bakehouse', 'Bakery', '1999', 'Mill Street', '01632 960 351', 1987,
   'Welcome to the Daybreak Bakehouse web site! We bake fresh bread every morning. Celebration cakes made to order, please give 3 days notice. Now taking orders for Christmas!!',
   [('White bloomer', '£1.95'), ('Rye loaf', '£3.20'), ('Sourdough', '£3.50'), ('Celebration cakes', 'POA')], ['s1.jpg', 's2.jpg', 's3.jpg'], 'hero-poster.jpg'),
 'greenwick': ('Greenwick Gardens', 'Garden Design & Landscaping', '2007', 'Woodstock, Oxon', '01632 960 588', 1995,
   'Greenwick Gardens offer a complete garden design and landscaping service to the Oxfordshire area. From small patio gardens to large country estates. Please see our gallery for examples of our work.',
   [('Garden design', 'from £450'), ('Patios & paving', 'Free quote'), ('Turfing', 'per m2'), ('Ponds & water features', 'Free quote')], ['s1.jpg', 's2.jpg', 's3.jpg'], 'hero-poster.jpg'),
 'mow-better': ('Mow Better', 'Lawn & Garden Maintenance', '2012', 'Leeds', '07700 900 812', 2010,
   'Mow Better Garden Services Leeds. We provide grass cutting, hedge trimming and garden tidys. Fully insured. Reasonable rates. No job too small!',
   [('Grass cutting', 'from £15'), ('Hedge trimming', 'from £30'), ('Garden tidy', 'from £45'), ('Waste removal', 'POA')], ['s1.jpg', 's2.jpg', 's3.jpg'], 'hero-poster.jpg'),
 'flowright': ('Flowright Plumbing', 'Plumbing & Heating', '2003', 'Manchester', '0161 496 0950', 2001,
   '24 HOUR EMERGENCY PLUMBER MANCHESTER!!! No call out charge*. Burst pipes, leaks, blocked toilets, boiler repairs. CORGI registered. Call now!!!',
   [('Call out', 'NO CHARGE*'), ('Leak repair', 'from £60'), ('Unblock toilet/sink', 'from £50'), ('Tap washer', 'from £35')], ['s1.jpg', 's2.jpg', 's3.jpg'], 'hero-poster.jpg'),
 'copperline': ('Copperline Heating', 'Heating Engineers', '2007', 'Harrogate', '01423 496 044', 2004,
   'Copperline Heating Ltd are Gas Safe registered heating engineers serving Harrogate and North Yorkshire. We install and service all makes of boiler. Free quotations.',
   [('Boiler service', '£65'), ('New boiler installed', 'from £1,800'), ('Gas safety certificate', '£55'), ('Powerflush', '£350')], ['s1.jpg', 's2.jpg', 's3.jpg'], 'hero-poster.jpg'),
 'ember-oat': ('Ember & Oat', 'Coffee House', '2012', 'Leeds', '0113 496 0761', 2013,
   'Welcome to Ember and Oat coffee house! We serve speciality coffee, homemade cakes and light lunches. Free wifi. Ask for the password at the counter.',
   [('Flat white', '£2.60'), ('Cortado', '£2.40'), ('Filter coffee', '£2.20'), ('Croissant', '£1.90')], ['drink-flat.jpg', 'croissant.jpg', 'room.jpg'], 'hero-poster.jpg'),
 'koji': ('Koji', 'Japanese Restaurant', '2003', 'Soho', '020 7946 0315', 2008,
   'KOJI JAPANESE RESTAURANT. Authentic sushi and sashimi. Omakase tasting menu available. Bookings recommended at weekends. Sorry we do not take bookings by email.',
   [('Omakase (12 courses)', '£85pp'), ('Nigiri set', '£24'), ('Sashimi platter', '£28'), ('Sake flight', '£18')], ['nigiri.jpg', 'course-2.jpg', 'sake.jpg'], 'hero-poster.jpg'),
 'forno-rosso': ('Forno Rosso', 'Pizzeria', '1999', 'Bristol', '0117 496 0592', 2005,
   'WELCOME TO FORNO ROSSO PIZZERIA!!! Real wood fired pizzas. Eat in or take away. Phone your order through and collect in 20 minutes. Tuesday 2 for 1 on all pizzas!!!',
   [('Margherita 12"', '£8.50'), ('Pepperoni 12"', '£9.95'), ('Garlic bread', '£3.50'), ('Tiramisu', '£4.50')], ['margherita.jpg', 'tiramisu.jpg', 'room.jpg'], 'hero-poster.jpg'),
 'volt': ('Volt Supply', 'Electronics Store', '2007', 'Online', '0800 046 0199', 2006,
   'Volt Supply - your one stop shop for headphones, speakers and gadgets! Free UK delivery on orders over £50. Secure online ordering (we accept Visa, Mastercard, Switch and Solo).',
   [('Studio headphones', '£129.99'), ('Wireless earbuds', '£79.99'), ('Bluetooth speaker', '£59.99'), ('Smart watch', '£149.99')], ['hp-graphite.jpg', 'buds.jpg', 'speaker.jpg'], 'hero-poster.jpg'),
 'northlight': ('Northlight PCs', 'Custom PCs & Repairs', '2003', 'Sheffield', '0114 496 0877', 2002,
   'NORTHLIGHT CUSTOM GAMING PCs AND COMPUTER REPAIRS. Virus removal, upgrades, laptop screens, data recovery. Build your dream gaming rig!! Phone for a quote.',
   [('Virus removal', '£40'), ('Laptop screen replacement', 'from £70'), ('Gaming PC build', 'from £799'), ('Data recovery', 'from £60')], ['tower.jpg', 'build-2.jpg', 'desk.jpg'], 'hero-poster.jpg'),
 'crumb': ('Crumb', 'Cake Shop & Bakery', '2012', 'Brighton', '01273 496 015', 2012,
   'Hi and welcome to Crumb! We are a small family bakery making cakes, buns and macarons. We do wedding cakes and birthday cakes. Contact us for a price list.',
   [('Cinnamon bun', '£2.50'), ('Box of 6 macarons', '£9.00'), ('Birthday cake', 'from £35'), ('Wedding cakes', 'POA')], ['buns.jpg', 'macarons.jpg', 'shop.jpg'], 'hero-poster.jpg'),
}

E = html.escape


def degrade(slug, name, size, out_name, distort=None, q=22):
    """Copy a mockup photo, shrunk and over-compressed. distort=(w, h) squashes it to a wrong aspect."""
    im = Image.open(os.path.join(SRC, slug, 'assets', name)).convert('RGB')
    if distort:
        im = im.resize((distort[0] // 2, distort[1] // 2)).resize(distort)  # soft, upscaled and squashed
    else:
        im.thumbnail((size, size))
    os.makedirs(os.path.join(OUT, slug, 'img'), exist_ok=True)
    im.save(os.path.join(OUT, slug, 'img', out_name), quality=q)
    return 'img/' + out_name


def extra(d, imgs, h='h2'):
    """More of the same old-site filler so each page runs well past one screen."""
    name, trade, _, town, phone, est = d[:6]
    pics = ''.join(f'<img src="{i}" width="200" height="150" style="margin:4px">' for i in imgs + imgs[::-1])
    return f'''
<{h}>Opening Hours</{h}>
<table border="1" cellpadding="4" cellspacing="0"><tr><td>Monday - Friday</td><td>9:00am - 5:30pm</td></tr><tr><td>Saturday</td><td>9:00am - 4:00pm</td></tr><tr><td>Sunday</td><td>CLOSED</td></tr><tr><td>Bank Holidays</td><td>Please phone</td></tr></table>
<{h}>What Our Customers Say</{h}>
<p><i>"Excellent service, would definately recommend to anyone!!"</i> - Mrs J. Smith</p>
<p><i>"Very professional and friendly. Will be using {E(name)} again."</i> - Dave, {E(town)}</p>
<p><i>"Great value for money. 10/10"</i> - Anonymous</p>
<{h}>More Photos</{h}>
<div>{pics}</div>
<{h}>Frequently Asked Questions</{h}>
<p><b>Q: Do you take card payments?</b><br>A: Yes we now accept all major credit and debit cards (minimum spend £10).</p>
<p><b>Q: Where can I park?</b><br>A: There is a pay and display car park nearby.</p>
<p><b>Q: Do you have a website?</b><br>A: Yes, you are on it!</p>
<{h}>How To Find Us</{h}>
<p>{E(name)}<br>{E(town)}<br>Tel: {E(phone)}<br><br>[ Map coming soon ]</p>
<{h}>Useful Links</{h}>
<p><a href="#">Yell.com listing</a> | <a href="#">Our Facebook page</a> | <a href="#">Link to us</a> | <a href="#">Webring</a></p>
<p>Trading since {est}. Registered in England and Wales.</p>
'''


def page(title, body, css, viewport=False):
    # No viewport meta on purpose: these sites predate phones and shrink to a postage stamp on one.
    return f'''<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>{title}</title>
<style>
{css}
.backbar{{position:fixed;left:8px;bottom:8px;font:12px Arial,sans-serif;background:#000;color:#fff;padding:4px 8px;opacity:.8}}
.backbar a{{color:#fff}}
</style>
</head>
<body>
<div class="backbar"><a href="../index.html">&larr; All old sites</a></div>
{body}
</body>
</html>
'''


def era_1999(slug, d, imgs, banner):
    name, trade, _, town, phone, est, blurb, svc, *_ = d
    rows = ''.join(f'<tr><td>{E(s)}</td><td align="right"><b>{E(p)}</b></td></tr>' for s, p in svc)
    pics = ''.join(f'<td><img src="{i}" width="180" height="140" border="3"></td>' for i in imgs)
    css = '''body{background:#ffffcc;font-family:"Times New Roman",serif;margin:8px}
.wrap{width:760px;margin:0 auto;background:#fff;border:3px ridge #999}
h1{font-family:"Comic Sans MS",cursive;color:#cc0000;text-align:center;font-size:34px;margin:10px 0}
.nav{background:#000080;text-align:center;padding:4px}.nav a{color:#ffff00;font-weight:bold;margin:0 6px}
a{color:#0000ee}a:visited{color:#551a8b}
marquee{background:#ff0;color:#c00;font-weight:bold;font-family:Arial}
table.svc{border:2px outset #ccc;background:#eee;font-size:15px}table.svc td{padding:3px 10px;border:1px inset #ccc}
.foot{font-size:11px;text-align:center;color:#666;padding:10px}
.counter{display:inline-block;background:#000;color:#0f0;font-family:"Courier New",monospace;padding:1px 6px;letter-spacing:2px}'''
    body = f'''<div class="wrap">
<h1>~*~ Welcome to {E(name)} ~*~</h1>
<div class="nav"><a href="#">HOME</a>|<a href="#">ABOUT US</a>|<a href="#">PRICES</a>|<a href="#">GUESTBOOK</a>|<a href="#">CONTACT</a></div>
<marquee scrollamount="6">*** {E(trade.upper())} IN {E(town.upper())} SINCE {est} *** CALL US ON {E(phone)} *** NEW WEBSITE!!! ***</marquee>
<center><img src="{banner}" width="740" height="150" border="1"></center>
<table width="100%" cellpadding="8"><tr><td valign="top" width="60%">
<p><font size="4" color="#008000"><b>About Us</b></font></p>
<p>{E(blurb)}</p>
<p><font size="4" color="#008000"><b>Our Prices</b></font></p>
<table class="svc" cellspacing="0">{rows}</table>
<p><i>Prices correct as of March 2009</i></p>
</td><td valign="top" bgcolor="#eeeeff">
<p><b><u>Contact Us</u></b></p>
<p>{E(name)}<br>{E(town)}<br>Tel: {E(phone)}</p>
<p><a href="#">Click here to email us!</a></p>
<p><a href="#">Sign our Guestbook</a></p>
</td></tr></table>
<center><table cellpadding="4"><tr>{pics}</tr></table></center>
<div style="padding:0 12px">{extra(d, imgs, "h3")}</div>
<div class="foot">You are visitor number <span class="counter">004213</span><br>
This site is best viewed in Internet Explorer 6 at 800 x 600 resolution<br>
&copy; {E(name)} 2009. Last updated 14/03/2009. Site by Dave's Web Designs</div>
</div>'''
    return page(f'{name} - {trade} - {town}', body, css)


def era_2003(slug, d, imgs, banner):
    name, trade, _, town, phone, est, blurb, svc, *_ = d
    rows = ''.join(f'<tr><td>&raquo; {E(s)}</td><td class="pr">{E(p)}</td></tr>' for s, p in svc)
    pics = ''.join(f'<img src="{i}" width="200" height="150">' for i in imgs)
    css = '''body{background:#000;color:#ccc;font-family:Verdana,Arial,sans-serif;font-size:11px;margin:0}
.intro{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;border-bottom:1px solid #333}
.intro h1{font-family:Impact,"Arial Black",sans-serif;font-size:64px;color:#00ffff;text-shadow:0 0 12px #00ffff,3px 3px 0 #f0f;letter-spacing:4px;margin:0}
.intro a{color:#ff0;font-size:13px}
.wrap{width:780px;margin:20px auto;border:1px solid #444}
.top{background:#111;padding:10px;border-bottom:2px solid #f0f}
.top b{font-family:Impact,sans-serif;font-size:30px;color:#0ff}
.nav{background:#222;padding:6px;font-weight:bold}.nav a{color:#ff0;margin-right:14px;text-decoration:none}.nav a:hover{color:#f0f}
.main{padding:12px}h2{font-family:Impact,sans-serif;color:#f0f;font-size:22px;letter-spacing:1px;margin:14px 0 6px}
table{width:100%;border-collapse:collapse}td{border-bottom:1px dotted #444;padding:5px}.pr{color:#0f0;text-align:right;font-weight:bold}
.pics img{border:2px solid #0ff;margin:4px}
.foot{font-size:10px;color:#666;text-align:center;padding:10px}'''
    body = f'''<div class="intro"><h1>{E(name.upper())}</h1><div>[ loading . . . ]</div><a href="#site">&gt;&gt; SKIP INTRO &lt;&lt;</a><div style="font-size:10px;color:#555">Requires Macromedia Flash Player 6</div></div>
<div class="wrap" id="site">
<div class="top"><b>{E(name.upper())}</b> &nbsp; :: {E(trade)} :: {E(town)}</div>
<div class="nav"><a href="#">HOME</a><a href="#">ABOUT</a><a href="#">SERVICES</a><a href="#">GALLERY</a><a href="#">LINKS</a><a href="#">CONTACT</a></div>
<div class="main">
<center><img src="{banner}" width="756" height="200"></center>
<h2>WELCOME!!</h2><p>{E(blurb)}</p>
<h2>SERVICES &amp; PRICES</h2><table>{rows}</table>
<h2>GALLERY</h2><div class="pics">{pics}</div>
{extra(d, imgs)}
<h2>CONTACT</h2><p>PHONE: <b style="color:#0f0">{E(phone)}</b> &nbsp; | &nbsp; ESTABLISHED {est}</p>
</div>
<div class="foot">&copy; 2004 {E(name)} :: All Rights Reserved :: Website by XtremeDesignz :: Add us to your favourites!</div>
</div>'''
    return page(f':: {name} :: {trade} ::', body, css)


def era_2007(slug, d, imgs, banner):
    name, trade, _, town, phone, est, blurb, svc, *_ = d
    rows = ''.join(f'<li><span>{E(s)}</span> <b>{E(p)}</b></li>' for s, p in svc)
    pics = ''.join(f'<img src="{i}" width="150" height="110">' for i in imgs)
    css = '''body{background:#d9e6f2 linear-gradient(#b8cfe6,#eef4fa 400px) no-repeat;font:11px Verdana,Tahoma,sans-serif;color:#333;margin:0}
.wrap{width:900px;margin:0 auto;background:#fff;box-shadow:0 0 8px #8aa}
.head{height:90px;background:linear-gradient(#6fb3e8,#2a6fb5);color:#fff;padding:0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid #9fd04a}
.head h1{font:bold 30px "Trebuchet MS",sans-serif;margin:0;text-shadow:1px 1px 2px #134}
.head h1 small{display:block;font-size:12px;font-weight:normal}
.new{background:#ff3300;color:#fff;font:bold 13px Arial;padding:10px;border-radius:50%;transform:rotate(-12deg);box-shadow:0 2px 4px #300}
.nav{background:linear-gradient(#fafafa,#d6d6d6);border-bottom:1px solid #aaa;padding:0 10px}
.nav a{display:inline-block;padding:8px 14px;color:#2a6fb5;font-weight:bold;text-decoration:none;border-right:1px solid #bbb}
.cols{display:flex}.main{flex:1;padding:14px}.side{width:220px;background:#f2f6fa;border-left:1px solid #dde;padding:12px}
h2{font:bold 16px "Trebuchet MS";color:#2a6fb5;border-bottom:1px dashed #9cc;padding-bottom:3px}
.ban{width:640px;height:160px;border:4px solid #fff;outline:1px solid #ccc}
ul.svc{list-style:none;padding:0}ul.svc li{padding:6px;border-bottom:1px solid #eee;display:flex;justify-content:space-between}ul.svc b{color:#c30}
.btn{display:inline-block;padding:8px 20px;border-radius:14px;background:linear-gradient(#a9e061,#5c9a14);color:#fff;font:bold 13px Arial;text-shadow:0 -1px 0 #360;border:1px solid #4a7a10;text-decoration:none}
.pics img{border:1px solid #999;padding:3px;background:#fff;margin:3px}
.news p{border-bottom:1px dotted #bbb;padding-bottom:6px}.news b{color:#2a6fb5}
.foot{background:#2a6fb5;color:#cde;text-align:center;padding:10px;font-size:10px}'''
    body = f'''<div class="wrap">
<div class="head"><h1>{E(name)}<small>{E(trade)} &bull; {E(town)}</small></h1><div class="new">NEW!!</div></div>
<div class="nav"><a href="#">Home</a><a href="#">About Us</a><a href="#">Services</a><a href="#">Gallery</a><a href="#">Testimonials</a><a href="#">Contact Us</a></div>
<div class="cols"><div class="main">
<img class="ban" src="{banner}">
<h2>Welcome to {E(name)}</h2><p>{E(blurb)}</p>
<h2>Our Services</h2><ul class="svc">{rows}</ul>
<p><a class="btn" href="#">Request a Quote &raquo;</a></p>
<h2>Photo Gallery</h2><div class="pics">{pics}</div>
{extra(d, imgs)}
</div><div class="side news">
<h2>Latest News</h2>
<p><b>12/11/2011</b><br>We have a new website! Please let us know what you think.</p>
<p><b>03/06/2011</b><br>Summer opening hours now in effect.</p>
<p><b>18/01/2011</b><br>Happy New Year from all the team!</p>
<h2>Contact</h2><p>Tel: <b>{E(phone)}</b><br>Est. {est}</p>
<p>Follow us on <u>Twitter</u> and <u>Facebook</u>!</p>
</div></div>
<div class="foot">Copyright &copy; 2011 {E(name)}. All rights reserved. | <a href="#" style="color:#fff">Sitemap</a> | Valid XHTML 1.0</div>
</div>'''
    return page(f'{name} | {trade} | {town}', body, css)


def era_2012(slug, d, imgs, banner):
    name, trade, _, town, phone, est, blurb, svc, *_ = d
    rows = ''.join(f'<tr><td>{E(s)}</td><td>{E(p)}</td></tr>' for s, p in svc)
    pics = ''.join(f'<div class="box"><img src="{i}"><h4>Lorem Ipsum</h4><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p><a href="#">Read More</a></div>' for i in imgs)
    css = '''body{background:#e8e8e8;font:13px Arial,Helvetica,sans-serif;color:#555;margin:0}
.wrap{width:960px;margin:0 auto;background:#fff}
.top{display:flex;justify-content:space-between;align-items:center;padding:16px 20px}
.top h1{font:normal 28px Georgia,serif;color:#333;margin:0}.top .ph{font-size:18px;color:#e67e22}
.nav{background:#333}.nav a{display:inline-block;color:#fff;padding:12px 16px;text-decoration:none;text-transform:uppercase;font-size:12px}.nav a:first-child{background:#e67e22}
.slider{position:relative}.slider img{display:block;width:960px;height:300px}
.slider .cap{position:absolute;left:30px;bottom:30px;background:rgba(0,0,0,.6);color:#fff;padding:12px 18px;font-size:20px}
.dots{text-align:center;padding:6px;color:#bbb;letter-spacing:4px}
.main{padding:10px 20px}h2{font:normal 22px Georgia,serif;color:#333}
.boxes{display:flex;gap:20px}.box{flex:1;border:1px solid #ddd;padding:10px;background:#fafafa}.box img{width:100%;height:120px}
.box a{color:#e67e22}
table{border-collapse:collapse;width:60%}td{border:1px solid #ddd;padding:6px}
.fb{display:inline-block;background:#3b5998;color:#fff;padding:3px 8px;font-size:11px;border-radius:2px}
.foot{background:#333;color:#999;padding:14px 20px;font-size:11px;display:flex;justify-content:space-between;margin-top:20px}'''
    body = f'''<div class="wrap">
<div class="top"><h1>{E(name)}</h1><span class="ph">Call: {E(phone)}</span></div>
<div class="nav"><a href="#">Home</a><a href="#">About Us</a><a href="#">Services</a><a href="#">Gallery</a><a href="#">Blog</a><a href="#">Contact Us</a></div>
<div class="slider"><img src="{banner}"><div class="cap">Welcome To {E(name)}!</div></div>
<div class="dots">&#9679; &#9675; &#9675; &#9675;</div>
<div class="main">
<h2>About Us</h2><p>{E(blurb)}</p>
<div class="boxes">{pics}</div>
<h2>Price List</h2><table>{rows}</table>
{extra(d, imgs)}
<p><span class="fb">f Like</span> 23 people like this. Be the first of your friends.</p>
</div>
<div class="foot"><span>&copy; 2013 {E(name)}, {E(town)}. All Rights Reserved.</span><span>Powered by WordPress | Theme: Business Pro Lite by FreeThemes4U</span></div>
</div>'''
    return page(f'{name} – Just another WordPress site', body, css)


ERAS = {'1999': (era_1999, (740, 150), 180), '2003': (era_2003, (756, 200), 200),
        '2007': (era_2007, (640, 160), 150), '2012': (era_2012, (960, 300), 300)}

ORDER = ['harlow-finch', 'nest-key', 'crumb', 'daybreak', 'sharp-co', 'fade-theory', 'ember-oat', 'little-tern',
         'koji', 'forno-rosso', 'volt', 'northlight', 'greenwick', 'mow-better', 'flowright', 'copperline']


def main():
    items = []
    for slug in ORDER:
        d = SITES[slug]
        fn, bsize, tsize = ERAS[d[2]]
        banner = degrade(slug, d[9], 0, 'banner.jpg', distort=bsize, q=18)
        imgs = [degrade(slug, p, tsize, f'p{i + 1}.jpg') for i, p in enumerate(d[8])]
        os.makedirs(os.path.join(OUT, slug), exist_ok=True)
        open(os.path.join(OUT, slug, 'index.html'), 'w').write(fn(slug, d, imgs, banner))
        items.append(f'<li><a href="{slug}/index.html">{E(d[0])}</a> <small>{E(d[1])} &middot; {d[2]} style</small> &middot; <a class="new" href="../mockups/{slug}/index.html">see the new version &rarr;</a></li>')
        print('built', slug, d[2])
    open(os.path.join(OUT, 'index.html'), 'w').write(f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Old Websites</title>
<style>body{{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;background:#fff;color:#222}}
li{{margin:6px 0}}small{{color:#777}}a.new{{color:#a9803f}}</style></head>
<body><h1>Old websites</h1>
<p>Deliberately dated "before" versions of the sixteen mockup businesses, each in an old web style, with low-quality copies of the same photos. Fictional businesses.</p>
<ul>{''.join(items)}</ul></body></html>
''')


if __name__ == '__main__':
    main()
