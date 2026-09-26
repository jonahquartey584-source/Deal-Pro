// Records the Deal Community tutorial: browsing and filtering deals, posting one
// by pasting it in, replying, analysing, the region chat, and a checklist of
// things not to do, timed to the narration (see scripts/walkthrough/lib.mjs).
//
//   node scripts/record_community.mjs [narration.mp3]
//
// Writes assets/deal-community-tutorial.mp4 and assets/deal-community-tutorial-poster.png.
import path from "node:path";
import { ROOT, audioSeconds, premiumState, start } from "./walkthrough/lib.mjs";

const AUDIO = path.resolve(process.argv[2] || path.join(ROOT, "scripts", "community-narration.mp3"));

/* ---------- demo community: deals, replies and region chat kept in memory ---------- */
const member = (name, extra) => ({ contactName: name, contactEmail: `${name.split(" ")[0].toLowerCase()}@example.com`, mine: false, canDelete: false, ...extra });
const posts = [
  member("Priya S.", { id: "c1", title: "2 bed flat, landlord open to R2SA", region: "North West", strategy: "R2SA", propertyType: "Flat", beds: 2, contacted: "Landlord", location: "Ancoats, Manchester", postcode: "M4", price: 1350, priceType: "pcm", status: "Viewing booked", description: "Landlord is happy with a company let and serviced accommodation. Furnished, with parking.", createdAt: "2026-09-25T10:00:00Z" }),
  member("Daniel O.", { id: "c2", title: "4 bed house, HMO-ready", region: "Yorkshire and Humber", strategy: "HMO", propertyType: "House", beds: 4, contacted: "Agent", location: "Headingley, Leeds", postcode: "LS6", price: 1600, priceType: "pcm", status: "Agent waiting on offers", description: "Two bathrooms, licence in place. Agent confirmed the landlord accepts sharers.", createdAt: "2026-09-24T15:30:00Z" }),
  member("Sam K.", { id: "c3", title: "3 bed terrace below market value", region: "North West", strategy: "BTL", propertyType: "House", beds: 3, contacted: "Landlord", location: "Wavertree, Liverpool", postcode: "L15", price: 145000, priceType: "purchase", status: "Owner wants a quick sale", description: "Needs a new kitchen. Similar terraces on the street sold for £170,000 this year.", createdAt: "2026-09-23T09:10:00Z" }),
  member("Leah T.", { id: "c4", title: "Studio near King's Cross, agent open to SA", region: "London", strategy: "R2SA", propertyType: "Studio", beds: 0, contacted: "Agent", location: "King's Cross, London", postcode: "WC1X", price: 1700, priceType: "pcm", status: "Agent chasing the landlord", description: "Top-floor studio, recently refurbished. Agent says the landlord has let to operators before.", createdAt: "2026-09-22T12:00:00Z" }),
];
const note = (id, authorName, text, createdAt, deal) => ({ id, authorName, text, createdAt, mine: false, canDelete: false, ...(deal ? { deal } : {}) });
const replies = { c1: [note("r1", "Sam K.", "Does the rent include bills?", "2026-09-25T12:40:00Z")] };
const card = (p) => ({ id: p.id, title: p.title, location: p.location, postcode: p.postcode, price: p.price, priceType: p.priceType, strategy: p.strategy, propertyType: p.propertyType, beds: p.beds });
const rooms = {
  london: [note("m1", "Leah T.", "Anyone sourcing around King's Cross? Happy to share comparables.", "2026-09-26T08:15:00Z"), note("m2", "Omar R.", "Yes, mostly N1 and N7. Agents there are open to company lets.", "2026-09-26T08:32:00Z")],
  "north-west": [note("m3", "Priya S.", "Landlord in Ancoats is keen, viewing booked for Friday.", "2026-09-25T10:05:00Z", card(posts[0])), note("m4", "Sam K.", "Nice one. Is there parking?", "2026-09-25T11:20:00Z")],
};
const CREDITS = { plan: "Pro", free: false, creditsLeft: 88, weeklyCredits: 100, resetsAt: "2026-10-01T09:00:00Z" };
const ANALYSIS = {
  verdict: "Worth pursuing, thin margin", score: 64,
  summary: "Profitable from about 57% occupancy at an estimated £120 a night. Parking and a company let help, but check Manchester comparables before offering.",
  monthly_profit: "£588 at 80%", upfront_cash: "£3,700", break_even: "57% occupancy",
  occupancy_scenarios: [{ occupancy: "60%", monthly_profit: "£66" }, { occupancy: "80%", monthly_profit: "£588" }, { occupancy: "100%", monthly_profit: "£1,110" }],
  risks: ["The nightly rate is an estimate. Ancoats two-beds need checking against live listings.", "No written consent for serviced accommodation yet."],
  missing_information: ["Whether bills are included in the rent.", "The length of the tenancy the landlord will offer."],
  next_actions: ["Get the landlord's consent to serviced accommodation in writing.", "Check comparable Ancoats two-beds before offering."],
};
let nextId = 10;
const now = () => new Date(Date.parse("2026-09-26T10:00:00Z") + nextId * 60e3).toISOString();

const PASTE = `3 bed house, landlord open to R2SA
📍 Edgbaston, Birmingham B15
💷 Rent £1,450 pcm, deposit £1,450
Spoke to the landlord today, viewing booked for Friday`;

const { page, until, move, click, moveClick, type, scroll, finish } = await start({
  state: premiumState(),
  signedIn: true,
  api: (url, method, body) => {
    if (url.pathname === "/api/analyze-deal") {
      if (method === "POST") return [200, { jobId: "analyse", credits: CREDITS }];
      if (url.searchParams.get("job")) return [200, { status: "done", analysis: ANALYSIS, credits: CREDITS }];
      return [200, CREDITS];
    }
    if (url.pathname !== "/api/community") return [200, {}];
    if (method === "GET") {
      const room = url.searchParams.get("room"), rep = url.searchParams.get("replies");
      if (room) return [200, { messages: rooms[room] || [] }];
      if (rep) return [200, { replies: replies[rep] || [] }];
      return [200, { posts: posts.map((p) => ({ ...p, replyCount: (replies[p.id] || []).length })) }];
    }
    if (method === "POST" && body.kind === "reply") {
      const r = { ...note(`r${nextId++}`, "Alex Morgan", body.text, now()), mine: true, canDelete: true };
      (replies[body.postId] ||= []).push(r);
      return [201, { reply: r }];
    }
    if (method === "POST" && body.kind === "message") {
      const m = { ...note(`m${nextId++}`, "Alex Morgan", body.text, now()), mine: true, canDelete: true };
      (rooms[body.room] ||= []).push(m);
      return [201, { message: m }];
    }
    if (method === "POST") {
      const post = { ...body, id: `c${nextId++}`, price: +body.price, beds: body.beds === "" ? null : +body.beds, createdAt: now(), replyCount: 0, mine: true, canDelete: true };
      posts.unshift(post);
      return [201, { post }];
    }
    return [200, {}];
  },
});

// The "things not to do" checklist drawn over the page, revealed one point at a time.
const DONTS = [
  ["Don't post a deal unless you've spoken to the landlord or agent yourself", "x"],
  ["Don't share anyone else's deal or contact details without their permission", "x"],
  ["Never post a tenant's personal information or an exact address", "x"],
  ["Keep prices and details accurate", "ok"],
  ["Don't post the same deal twice", "x"],
  ["Delete your deal once it's gone", "ok"],
  ["Be respectful in replies and chat", "ok"],
  ["Deal Pro doesn't verify community deals. Do your own checks before you pay anyone or sign anything.", "warn"],
];
async function showDonts() {
  await page.evaluate((items) => {
    const s = document.createElement("style");
    s.textContent = "#donts{position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:rgba(8,8,9,.72);backdrop-filter:blur(3px);opacity:0;transition:opacity .4s}" +
      "#donts.on{opacity:1}#donts .dl{width:min(640px,86vw);background:var(--surface);border:1px solid var(--line-2);border-radius:12px;padding:26px 28px;box-shadow:0 30px 80px rgba(0,0,0,.6)}" +
      "#donts h2{font-size:22px;margin:0 0 4px}#donts p{margin:0 0 16px;color:var(--muted);font-size:13.5px}#donts ol{list-style:none;margin:0;padding:0;display:grid;gap:9px}" +
      "#donts li{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;font-size:15px;line-height:1.4;opacity:.18;transform:translateX(-6px);transition:opacity .35s,transform .35s}" +
      "#donts li.on{opacity:1;transform:none}#donts li i{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;font:700 12px/1 var(--sans);font-style:normal;margin-top:1px}" +
      "#donts li.x i{background:rgba(224,20,43,.16);color:#ff5b6e;border:1px solid rgba(224,20,43,.5)}#donts li.ok i{background:rgba(95,185,138,.15);color:#7fd3a5;border:1px solid rgba(95,185,138,.5)}" +
      "#donts li.warn{margin-top:6px;padding-top:12px;border-top:1px solid var(--line);color:var(--ink-2)}#donts li.warn i{background:rgba(245,158,11,.15);color:#fbbf24;border:1px solid rgba(245,158,11,.5)}";
    const d = document.createElement("div");
    d.id = "donts";
    d.innerHTML = '<div class="dl"><h2>Deal Community: things not to do</h2><p>Keep the community useful and safe for everyone.</p><ol>' +
      items.map(([t, k]) => `<li class="${k}"><i>${k === "x" ? "✕" : k === "ok" ? "✓" : "!"}</i><span>${t}</span></li>`).join("") + "</ol></div>";
    document.head.append(s);
    document.body.append(d);
    requestAnimationFrame(() => d.classList.add("on"));
  }, DONTS);
}
const tick = (i) => page.evaluate((n) => document.querySelectorAll("#donts li")[n].classList.add("on"), i);

/* ---------- the walkthrough, timed to the narration ---------- */
// 0.0  "Welcome to the Deal Community, where Deal Pro members share deals they've already spoken to the landlord or agent about."
await until(1.8);
await move({ x: 640, y: 360 }, 1.4);
await until(5.2);
await move('.tab[data-v="community"]', 1.4);
// 8.7  "Open Deal Community from the menu."
await until(8.8);
await click();
// 10.6 "The Deals tab lists every posted deal."
await until(10.9);
await move("#cTabDeals", 0.8);
await until(12.2);
await move('#cResults .dcard[data-cid="c1"] h3', 0.9);
// 14.3 "Filter by region, location, price, property type and strategy to find the ones that suit you."
await until(14.4);
// Dropdowns: show the click, then set the value (a real click opens a native menu).
await move("#cfRegion", 0.7);
await click(false);
await page.selectOption("#cfRegion", "North West");
await until(16.6);
await move("#cfLoc", 0.5);
await move("#cfStrat", 0.7);
await click(false);
await page.selectOption("#cfStrat", "R2SA");
await until(18.8);
await move('#cResults .dcard[data-cid="c1"] h3', 0.8);
await until(19.9);
await moveClick("#cReset", 0.7);
// 20.9 "To post a deal, press Post a deal and paste in your advert or notes."
await until(21.2);
await moveClick("#cPostToggle", 0.8);
await page.waitForTimeout(900); // the form scrolls into view in real time; let it settle before aiming
await until(23.0);
await moveClick("#cPaste", 0.8);
await page.focus("#cPaste");
await until(24.4);
await page.keyboard.insertText(PASTE);
// 26.2 "Deal Pro fills in the form for you."
await until(25.4);
await move("#cFill", 0.6);
await until(26.3);
await click();
// 28.5 "Check every detail, choose your region, then post."
await until(28.4);
await move('#cForm [name="title"]', 0.6);
await scroll('#cForm [name="region"]', 0.8, 260);
await move('#cForm [name="region"]', 0.6);
await until(30.6);
await scroll("#cSubmit", 0.8, 520);
await move("#cSubmit", 0.6);
await until(32.2);
await click();
// 33.0 "Each deal has a reply button, so members can ask questions and share what they know."
await until(33.3);
await scroll(".ph", 0.6, 20);
await moveClick('#cResults .dcard[data-cid="c1"] [data-creplies]', 0.8);
await until(35.4);
await moveClick("#cr-c1", 0.6);
await type("Is the landlord open to a company let?", 1.4);
await until(38.3);
await moveClick('#cResults .dcard[data-cid="c1"] .creply-form button', 0.6);
// 39.5 "And if a deal catches your eye, press Analyse to get the AI's view of the numbers and risks."
await until(40.4);
await move('#cResults .dcard[data-cid="c1"] [data-canalyse]', 0.9);
await until(42.3);
await click();
await until(44.6);
await move("#aiDealOutput .ai-score", 0.8);
// 45.6 "Switch to Region chat to talk to members in your area."
await until(45.7);
await moveClick('.tab[data-v="community"]', 0.8);
await until(47.0);
await moveClick("#cTabChat", 0.7);
await until(48.6);
await moveClick('[data-room="north-west"]', 0.7);
// 49.8 "You can post a deal straight into the chat, and anyone can open it with View deal."
await until(50.4);
await move("#chPost", 0.9);
await until(52.6);
await move("#chLog [data-viewdeal]", 0.9);
await until(54.2);
await click();
// 56.1 "Now, a few things not to do." then each point as it is read
await until(56.4);
await showDonts();
await move({ x: 980, y: 600 }, 1.2);
for (const [i, at] of [[0, 58.9], [1, 65.6], [2, 69.9], [3, 74.6], [4, 76.9], [5, 78.9], [6, 81.05], [7, 84.1]]) {
  await until(at);
  await tick(i);
}
// 92.4 "That's the Deal Community. Happy sourcing."
await until(92.4);
await page.evaluate(() => document.getElementById("donts").classList.remove("on"));
await move({ x: 760, y: 360 }, 1.2);
await until(audioSeconds(AUDIO) + 0.4);

await finish({ audio: AUDIO, video: "deal-community-tutorial.mp4", poster: "deal-community-tutorial-poster.png", posterAt: 13 });
