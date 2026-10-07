// Records the one-minute "what Deal Pro does" video: every strategy, a search,
// the top picks, the numbers and verdict, then saving and the deal pack, timed
// to the narration (see scripts/walkthrough/lib.mjs).
//
//   node scripts/record_overview.mjs [narration.mp3]
//
// Writes assets/deal-pro-overview.mp4 and assets/deal-pro-overview-poster.png.
import path from "node:path";
import { ROOT, LISTINGS, audioSeconds, premiumState, start } from "./walkthrough/lib.mjs";

const AUDIO = path.resolve(process.argv[2] || path.join(ROOT, "scripts", "overview-narration.mp3"));

/* ---------- demo data ---------- */
// The live search returns these W2 listings (from the saved sample) as its results.
// Each one is marked as checked live, as a real search confirms them.
const LIVE = LISTINGS.filter((l) => /^W2/.test(l.postcode)).map((l) => ({ ...l, title: `${l.type} to rent, ${l.area.split(",")[0]}`, verified: "available", checkedAt: "2026-10-07T09:00:00Z" }));
const idx = (id) => String(LIVE.findIndex((l) => l.id === id));
const SEARCH_SITES = ["OpenRent", "SpareRoom", "Gumtree", "Rightmove", "Zoopla", "Facebook"];
const CREDITS = { plan: "Pro", free: false, creditsLeft: 92, weeklyCredits: 100, resetsAt: "2026-10-10T09:00:00Z" };
const RANK = {
  summary: "Three W2 studios and one-beds stand out: rents well below the area median, close to Hyde Park and Paddington, where short-stay demand holds up all year.",
  picks: [
    { id: idx("1802560654"), score: 82, verdict: "Strong", reason: "The lowest studio rent in W2 in this search. Comparable Bayswater studios take around £165 a night.", monthly_profit_80: "£1,330 a month" },
    { id: idx("2873501"), score: 74, verdict: "Potential", reason: "A one-bed at a studio price on Queensway, which suits couples and longer stays.", monthly_profit_80: "£1,010 a month" },
    { id: idx("16851649"), score: 66, verdict: "Potential", reason: "The same landlord has three studios in Bayswater, so you could take more than one.", monthly_profit_80: "£750 a month" },
  ],
  watch_outs: ["London's 90-night limit applies without planning permission", "Get the landlord's written consent for serviced accommodation"],
};
const ANALYSIS = {
  verdict: "Strong",
  score: 82,
  summary: "Comparable Bayswater studios take about £165 a night, above the £150 estimate. At a realistic 62% occupancy that leaves about £705 a month, but London's 90-night limit means it needs planning permission or a company-let fallback.",
  monthly_profit: "£705 a month (62% occupancy)",
  upfront_cash: "£4,300",
  break_even: "45% occupancy",
  occupancy_scenarios: [
    { occupancy: "62% (realistic)", monthly_profit: "£705" },
    { occupancy: "80%", monthly_profit: "£1,330" },
    { occupancy: "100%", monthly_profit: "£2,080" },
  ],
  stress_tests: [
    { scenario: "Nightly rate 20% lower", monthly_profit: "£170 a month", still_works: true },
    { scenario: "Capped at 90 nights a year", monthly_profit: "−£735 a month", still_works: false },
  ],
  risks: [
    "London's 90-night limit applies unless there is planning permission for year-round use.",
    "No written consent for serviced accommodation from the landlord yet.",
  ],
  assumptions: ["15% platform fees, £45 cleaning per stay, 3-night average stay and £150 a month other costs."],
  missing_information: ["Whether bills are included in the rent.", "The length of tenancy the landlord will offer."],
  next_actions: ["Ask the landlord for a signed agreement permitting serviced accommodation.", "Check the planning position with Westminster Council."],
};

let searchStart = 0;
const { page, until, move, click, moveClick, type, scroll, finish, now } = await start({
  state: premiumState(),
  signedIn: true,
  api: (url, method, body) => {
    if (url.pathname === "/api/community") return [200, { posts: [] }];
    if (url.pathname === "/api/refunds") return [200, { requests: [] }];
    if (url.pathname === "/api/analyze-deal") {
      if (method === "POST") { if (body.kind === "search") searchStart = now(); return [202, { jobId: body.kind, credits: CREDITS }]; }
      const job = url.searchParams.get("job");
      if (job === "search") return [200, searchPoll()];
      if (job) return [200, { status: "done", analysis: ANALYSIS, credits: CREDITS }];
      return [200, CREDITS];
    }
    return [200, {}];
  },
});

// A short search on the video clock: the sites fill in, the best listings are checked, then results.
function searchPoll() {
  const t = now() - searchStart, ROUNDS = 4, k = Math.min(1, t / 1.2);
  const sites = Object.fromEntries(SEARCH_SITES.map((site, i) => {
    const round = Math.min(ROUNDS, Math.floor(k * ROUNDS + (i % 3) * 0.3));
    return [site, { status: round >= ROUNDS ? "done" : "searching", found: Math.min(round * 2 + i, 10), round, rounds: ROUNDS }];
  }));
  const total = Object.values(sites).reduce((a, x) => a + x.found, 0);
  if (t < 1.2) return { status: "running", credits: CREDITS, progress: { phase: "search", sites, found: total } };
  if (t < 1.9) return { status: "running", credits: CREDITS, progress: { phase: "verify", sites, found: total, verified: Math.round((t - 1.2) * 10) } };
  return { status: "done", credits: CREDITS, analysis: { listings: LIVE, sites: Object.fromEntries(SEARCH_SITES.map((x) => [x, { status: "done", found: LIVE.filter((l) => l.site === x).length }])), ranking: RANK } };
}

// Strategy chips shown beside the filters, lit one by one as each strategy is named.
const STRATS = [["R2R", "Rent to rent"], ["R2SA", "Serviced accommodation"], ["BTL", "Buy to let"], ["HMO", "HMOs"], ["BRRR", "BRRR"], ["Flip", "Flips"], ["LeaseOption", "Lease options"], ["Commercial", "Commercial"]];
async function showStrategies() {
  await page.evaluate((items) => {
    const s = document.createElement("style");
    s.textContent = "#stratWall{position:fixed;left:600px;top:150px;width:620px;z-index:80;padding:24px 26px;border:1px solid var(--line-2);border-radius:14px;background:color-mix(in srgb,var(--surface) 92%,transparent);backdrop-filter:blur(6px);box-shadow:0 30px 80px rgba(0,0,0,.55);opacity:0;transform:translateY(8px);transition:opacity .35s,transform .35s}" +
      "#stratWall.on{opacity:1;transform:none}#stratWall h3{margin:0 0 4px;font-size:20px}#stratWall p{margin:0 0 16px;color:var(--muted);font-size:13px}" +
      "#stratWall ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:10px}#stratWall li{padding:10px 16px;border:1px solid var(--line-2);border-radius:999px;font-size:15px;font-weight:600;color:var(--muted);opacity:.35;transition:all .3s}" +
      "#stratWall li.on{opacity:1;color:#fff;border-color:rgba(224,20,43,.75);background:rgba(224,20,43,.16);box-shadow:0 0 0 4px rgba(224,20,43,.1)}";
    const d = document.createElement("div");
    d.id = "stratWall";
    d.innerHTML = "<h3>Every strategy</h3><p>Choose one, or describe what you're looking for.</p><ul>" + items.map(([v, t]) => `<li data-s="${v}">${t}</li>`).join("") + "</ul>";
    document.head.append(s);
    document.body.append(d);
    requestAnimationFrame(() => d.classList.add("on"));
  }, STRATS);
}
async function pickStrategy(value) {
  await page.selectOption("#fStrategy", value);
  await page.evaluate((v) => document.querySelector(`#stratWall li[data-s="${v}"]`).classList.add("on"), value);
}

/* ---------- the walkthrough, timed to the narration ---------- */
// 0.0  "Finding a good property deal takes hours of scrolling and sums, and most deals still aren't worth it."
await until(1.0);
await move(".hero-copy h1", 1.4);
await until(4.4);
await move("#homePreview", 1.4);
// 7.0  "Deal Pro does that work for you."
await until(7.0);
await moveClick('.hero-cta [data-go="find"]', 1.0);
// 9.5  "It finds property deals on the market for whichever strategy you use:"
await until(9.6);
await scroll("#fStrategy", 0.8, 330);
await move("#fStrategy", 0.9);
await click(false);
await showStrategies();
// 13.5 "rent to rent, serviced accommodation, buy to let, HMOs, BRRR, flips, lease options and commercial."
for (const [value, at] of [["R2R", 13.5], ["R2SA", 14.5], ["BTL", 15.85], ["HMO", 16.8], ["BRRR", 17.45], ["Flip", 18.15], ["LeaseOption", 19.05], ["Commercial", 20.3]]) {
  await until(at);
  if (value === "BTL") { await moveClick('label[for="fModeBuy"]', 0.4); await move("#fStrategy", 0.4); }
  await pickStrategy(value);
}
// 21.9 "Every deal comes with the full details and a link to the listing."
// Back to a rental search in W2 (set without the cursor, to keep up with the narration), then search.
await until(20.9);
await page.evaluate(() => document.getElementById("stratWall").remove());
await page.evaluate(() => { const r = document.getElementById("fModeRent"); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); });
await page.selectOption("#fStrategy", "R2SA");
await page.fill("#fLoc", "W2");
await scroll("#fSearch", 0.4, 420);
await moveClick("#fSearch", 0.5);
await until(24.9); // the page checks the search every 2 seconds; results land just before this
await scroll(".sheet", 0.5, 120);
await move(".sheet tbody tr:nth-child(2) td.clip", 0.4);
await move(".sheet tbody tr:nth-child(2) .xlink", 0.4);
// 25.7 "But Deal Pro doesn't just find deals."
await until(26.4);
await scroll(".rank", 0.8, 110);
await move(".rank-list li:first-child .rank-top b", 0.8);
// 28.3 "It picks out the strongest ones and does the numbers for you:"
await until(28.3);
await move(".rank-list li:first-child .rank-score", 0.6);
await moveClick(".rank-list li:first-child [data-build]", 0.6);
// 31.9 "the realistic monthly profit, the cash you need upfront, your return and the break-even point, stress-tested ..."
await until(31.4);
await scroll("#aiDealOutput", 0.5, 80);
await move("#aiDealOutput .ai-metric:first-child", 0.5);
await until(33.6);
await move("#aiDealOutput .ai-metric:nth-child(2)", 0.6);
await until(35.25);
await move("#aiDealOutput .ai-metric:nth-child(3)", 0.6);
await until(37.4);
await page.evaluate(() => { const sec = [...document.querySelectorAll("#aiDealOutput .ai-section")].find((e) => /Stress tests/.test(e.textContent)); if (sec) sec.id = "stressSec"; });
await scroll("#stressSec", 0.6, 160);
await move('#aiDealOutput .ai-section:has-text("Stress tests") li', 0.6);
// 40.65 "Every deal gets a clear verdict, so you know straight away which ones are worth your time."
await until(40.6);
await scroll("#aiDealOutput", 0.7, 80);
await move("#aiDealOutput .ai-verdict", 0.6);
await until(42.6);
await move("#aiDealOutput .ai-score strong", 0.7);
// 45.9 "Then save it, check it and turn it into a deal pack you can share."
await until(45.7);
await scroll(0, 0.3);
await moveClick("#saveDealTop", 0.5);
await moveClick("#advancedToggle", 0.5);
await scroll(".stepbar", 0.3, 20);
await moveClick('.stp[data-step="dd"]', 0.4);
await until(47.9);
await moveClick('.stp[data-step="pack"]', 0.5);
// 50.3 "Deal Pro. Every deal, every strategy, with the numbers done for you." on a closing card
await until(50.2);
await page.evaluate(() => {
  const s = document.createElement("style");
  s.textContent = "#endCard{position:fixed;inset:0;z-index:95;display:grid;place-items:center;align-content:center;gap:22px;background:radial-gradient(ellipse at 50% 40%,#1d1013 0%,#0b0b0c 70%);opacity:0;transition:opacity .5s}" +
    "#endCard.on{opacity:1}#endCard .ec-logo{display:flex;align-items:center;gap:16px;font:700 54px/1 var(--sans);letter-spacing:-.03em;color:#fff;transform:scale(.94);transition:transform .8s cubic-bezier(.2,.8,.2,1)}#endCard.on .ec-logo{transform:none}" +
    "#endCard .ec-line{display:flex;gap:.35em;font:500 26px/1.3 var(--sans);color:var(--ink-2)}#endCard .ec-line span{opacity:0;transform:translateY(8px);transition:opacity .45s,transform .45s}#endCard .ec-line span.on{opacity:1;transform:none}#endCard .ec-line b{color:#fff;font-weight:600}" +
    "#demoCursor{opacity:0;transition:opacity .4s}";
  const d = document.createElement("div");
  d.id = "endCard";
  d.innerHTML = '<div class="ec-logo"><svg width="58" height="58" viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="4" fill="#E0142B"/><path d="M6 5h3.6a5 5 0 0 1 0 10H6z" fill="#fff"/><rect x="6" y="9" width="4" height="2" fill="#E0142B"/></svg>Deal Pro</div>' +
    '<div class="ec-line"><span>Every deal,</span><span>every strategy,</span><span>with the <b>numbers done for you.</b></span></div>';
  document.head.append(s);
  document.body.append(d);
  requestAnimationFrame(() => d.classList.add("on"));
});
for (const [i, at] of [[0, 51.35], [1, 52.3], [2, 53.5]]) {
  await until(at);
  await page.evaluate((n) => document.querySelectorAll("#endCard .ec-line span")[n].classList.add("on"), i);
}
await until(audioSeconds(AUDIO) + 0.6);

await finish({ audio: AUDIO, video: "deal-pro-overview.mp4", poster: "deal-pro-overview-poster.png", posterAt: 16.2 });
