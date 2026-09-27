// Records the homepage tutorial as a real walkthrough of the site: a headless
// browser plays through each feature while an on-screen cursor clicks, types
// and scrolls in time with the narration (see scripts/walkthrough/lib.mjs).
//
//   node scripts/record_walkthrough.mjs [narration.mp3]
//
// Writes assets/deal-pro-tutorial.mp4 and assets/deal-pro-tutorial-poster.png.
import path from "node:path";
import { ROOT, LISTINGS, audioSeconds, premiumState, start } from "./walkthrough/lib.mjs";

const AUDIO = path.resolve(process.argv[2] || path.join(ROOT, "scripts", "tutorial-narration.mp3"));

/* ---------- demo data ---------- */
// Deal Finder's live search returns these W2 listings (from the saved sample) as its results.
const LIVE = LISTINGS.filter((l) => /^W2/.test(l.postcode)).map((l) => ({ ...l, title: `${l.type} to rent, ${l.area.split(",")[0]}`, url: l.url }));
const idx = (id) => String(LIVE.findIndex((l) => l.id === id));
const SEARCH_SITES = ["OpenRent", "SpareRoom", "Gumtree", "Rightmove", "Zoopla", "Facebook"];

const CREDITS = { plan: "Pro", free: false, creditsLeft: 92, weeklyCredits: 100, resetsAt: "2026-10-01T09:00:00Z" };
const RANK = {
  summary: "Three W2 units stand out: rents well below the area median, close to Hyde Park and Paddington, where short-stay demand holds up all year.",
  picks: [
    { id: idx("1802560654"), score: 84, verdict: "Strong", reason: "The lowest studio rent in W2 in this search. Similar Bayswater studios take around £150 a night.", monthly_profit_80: "£1,025 a month", notes: ["London's 90-night limit applies", "Ask the landlord about company lets"] },
    { id: idx("2873501"), score: 78, verdict: "Good", reason: "A one-bed at a studio price on Queensway, which suits couples and longer stays.", monthly_profit_80: "£1,008 a month" },
    { id: idx("16851649"), score: 71, verdict: "Worth a look", reason: "Same landlord has three studios in Bayswater, so you could take more than one.", monthly_profit_80: "£750 a month" },
  ],
  watch_outs: ["London's 90-night limit applies without planning permission", "Get written consent for serviced accommodation"],
};
const ANALYSIS = {
  verdict: "Promising, with conditions",
  score: 71,
  summary: "Profitable from about 43% occupancy. It is in London, so the 90-night limit and the landlord's written consent decide whether it works.",
  monthly_profit: "£1,512 at 80%",
  upfront_cash: "£4,300",
  break_even: "43% occupancy",
  occupancy_scenarios: [
    { occupancy: "60%", monthly_profit: "£684" },
    { occupancy: "80%", monthly_profit: "£1,512" },
    { occupancy: "100%", monthly_profit: "£2,340" },
  ],
  stress_tests: [
    { scenario: "Nightly rate 15% lower", monthly_profit: "£824 at 80%", still_works: true },
    { scenario: "Capped at 90 nights a year", monthly_profit: "−£765 a month", still_works: false },
  ],
  risks: [
    "London's 90-night limit applies unless there is planning permission for year-round use.",
    "No written consent for serviced accommodation from the landlord, freeholder or lender yet.",
    "Islington's selective licensing may apply. Check whether it allows subletting.",
  ],
  assumptions: ["Platform fees of 15%, £45 cleaning per stay and a 3-night average stay.", "£150 a month for other running costs."],
  missing_information: ["The exact address and council tax band.", "Comparable N4 studio nightly rates and occupancy.", "Whether the bills include council tax."],
  next_actions: ["Ask the landlord for a signed agreement permitting serviced accommodation.", "Check the planning position with Islington Council.", "Pull N4 studio comparables before making an offer."],
};
const POSTS = [
  { id: "c1", title: "2 bed flat, landlord open to R2SA", strategy: "R2SA", propertyType: "Flat", beds: 2, contacted: "Landlord", location: "Ancoats, Manchester", postcode: "M4", price: 1350, priceType: "pcm", status: "Viewing booked", description: "Landlord is happy with a company let and serviced accommodation. Furnished, with parking.", contactName: "Priya S.", contactEmail: "priya@example.com", createdAt: "2026-09-22T10:00:00Z" },
  { id: "c2", title: "4 bed house, HMO-ready", strategy: "HMO", propertyType: "House", beds: 4, contacted: "Agent", location: "Headingley, Leeds", postcode: "LS6", price: 1600, priceType: "pcm", status: "Agent waiting on offers", description: "Two bathrooms, licence in place. Agent confirmed the landlord accepts sharers.", contactName: "Daniel O.", contactEmail: "daniel@example.com", createdAt: "2026-09-21T15:30:00Z" },
  { id: "c3", title: "3 bed terrace below market value", strategy: "BTL", propertyType: "House", beds: 3, contacted: "Landlord", location: "Wavertree, Liverpool", postcode: "L15", price: 145000, priceType: "purchase", status: "Owner wants a quick sale", description: "Needs a new kitchen. Similar terraces on the street sold for £170,000 this year.", contactName: "Sam K.", contactEmail: "sam@example.com", createdAt: "2026-09-20T09:10:00Z" },
];
const SAMPLE_AD = `Studio flat to rent, Islington N4 (Zone 2)
Fully furnished studio, open-plan bedroom
Rent + bills £1,650 a month (£19,800 a year)
Deposit £1,650
Nightly rate £180 (est.)
Landlord open to company lets`;

// The Islington studio from the advert above, so the Numbers step matches the AI's figures.
const STATE = premiumState({ name: "Islington N4 studio", area: "Islington, London N4", london: true, units: [{ label: "Studio", rent: 1650, dep: 1650, rate: 180 }] });

const { page, until, move, click, moveClick, type, scroll, finish, now } = await start({
  state: STATE,
  api: (url, method, body) => {
    if (url.pathname === "/api/community") return [200, { posts: POSTS }];
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

// Expert search, driven by the video clock: sites move through their rounds, then the
// best listings are checked, and results arrive just as the "Your results" narration starts.
let searchStart = 0;
const SEARCH_DONE = 142.4, VERIFY_FROM = 136.5;
function searchPoll() {
  const t = now(), ROUNDS = 8, k = Math.min(1, (t - searchStart) / (VERIFY_FROM - searchStart));
  const sites = Object.fromEntries(SEARCH_SITES.map((site, i) => {
    const round = Math.min(ROUNDS, Math.floor(k * ROUNDS + (i % 3) * 0.3));
    const found = i < 3 ? Math.min(LIVE.filter((l) => l.site === site).length + 6, round * 2 + i) : Math.min(round * 2 + i, 12);
    return [site, { status: round >= ROUNDS ? "done" : "searching", found, round, rounds: ROUNDS }];
  }));
  const total = Object.values(sites).reduce((a, x) => a + x.found, 0);
  if (t < VERIFY_FROM) return { status: "running", credits: CREDITS, progress: { phase: "search", sites, found: total } };
  if (t < SEARCH_DONE) return { status: "running", credits: CREDITS, progress: { phase: "verify", sites, found: total, verified: Math.round((t - VERIFY_FROM) * 6) } };
  return { status: "done", credits: CREDITS, analysis: { listings: LIVE, sites: Object.fromEntries(SEARCH_SITES.map((x) => [x, { status: "done", found: LIVE.filter((l) => l.site === x).length }])), ranking: RANK } };
}

/* ---------- the walkthrough, timed to the narration ---------- */
// Times are the start of each narration sentence in scripts/tutorial-narration.mp3.

// 0:00 Welcome
await until(1.2);
await move({ x: 640, y: 300 }, 1.2);
await until(3.0);
await move(".hero-copy h1", 1.2);
await until(10.8);
await move("#homePreview", 1.4);
await until(16.0);
await move('.hero-cta [data-go="find"]', 1.0);

// 0:21 Signing in
await until(21.5);
await moveClick("#homeSignIn", 1.0);
await until(25.1);
await move("#authGoogle", 0.9);
await until(30.3);
await move("#forgotPassword", 0.9);
await until(36.9);
await moveClick("#authEmail", 0.5);
await type("alex@example.com", 0.9);
await moveClick("#authPassword", 0.4);
await type("password12", 0.5);
await moveClick("#authSubmit", 0.5);

// 0:43 Power levels
await until(43.8);
await moveClick('.tab[data-v="analyser"]', 0.8);
await until(46.2);
await scroll("#aiLevelOpts", 0.8, 260);
await move("#aiLevelOpts", 0.8, 0, -8);
await until(48.8);
await moveClick("#aiLevelOpts .lv-quick", 0.6);
await until(54.1);
await moveClick("#aiLevelOpts .lv-standard", 0.6);
await until(58.8);
await moveClick("#aiLevelOpts .lv-deep", 0.6);
await until(68.6);
await move("#aiLevelOpts .lv-quick", 0.8);
await until(71.4);
await move("#aiLevelOpts .lv-deep", 0.8);
await until(74.6);
await move("#aiCredits", 0.8);

// 1:18 Filters and sites
await until(78.3);
await moveClick('.tab[data-v="find"]', 0.8);
await until(80.3);
await moveClick('label[for="fModeRent"]', 0.7);
await move('label[for="fBedsAny"]', 0.7);
await move("#fMin", 0.6);
await move("#fMax", 0.6);
await until(85.4);
await moveClick("#fLoc", 0.6);
await type("W2", 0.4);
await until(89.6);
await move("#fFurn", 0.7);
await click(false);
await until(92.0);
await move("#fPrivate", 0.7);
await until(94.6);
await scroll("#fSiteGumtree", 0.8, 300);
for (const site of ["Gumtree", "SpareRoom", "OpenRent", "Rightmove", "Zoopla", "Facebook"]) await move(`#fSite${site}`, 0.9);
await until(103.9);
await move("#fSiteRightmoveCommercial", 0.8);
await move("#fSiteRealla", 0.7);
await move("#fSiteNovaLoca", 0.7);
await move("#fSiteLoopNet", 0.7);

// 1:52 Searching with AI
await until(112.4);
await scroll("#fSearch", 0.7, 420);
await moveClick("#fLevelOpts .lv-deep", 0.7);
await moveClick("#fSearch", 0.7);
await until(117.0);
await scroll("#fResults", 0.8, 120);
await move("#fResults .fprog li:nth-child(1)", 0.9);
await until(123.4);
await move("#fResults .fprog li:nth-child(4)", 0.9);
await until(126.0);
await move("#fResults .fprog-t", 0.9);
await until(136.0);
await move("#fResults .fprog .fnote:last-child", 0.9);

// 2:23 Results and AI picks
await until(143.2);
await scroll(".sheet", 0.9, 120);
await move(".sheet tbody tr:nth-child(2) td.clip", 0.8);
await until(148.5);
await move(".sheet tbody tr:nth-child(2) .xlink", 0.8);
await until(154.8);
await scroll(".rank", 0.9, 110);
await move(".rank-list li:first-child .rank-top b", 0.8);
await until(157.3);
await move(".rank-list li:first-child .rank-score", 0.7);
await until(162.8);
await move(".rank-list li:first-child .rank-notes", 0.8);
await until(168.1);
await move(".rank-list li:first-child [data-build]", 0.8);
await until(173.0);
await scroll(".sheet", 0.8, 160);
await moveClick(".sheet tbody tr:nth-child(1) [data-sel]", 0.6);
await moveClick(".sheet tbody tr:nth-child(3) [data-sel]", 0.5);
await move("#fBuildSel", 0.6);
await until(176.8);
await moveClick("#fViewCards", 0.7);
await until(179.5);
await moveClick("#fViewSheet", 0.6);
await until(181.5);
await move('.sheet th [data-sort="price"]', 0.7);
await until(184.0);
await moveClick("#fCopy", 0.8);

// 3:09 Analysing a deal
await until(189.8);
await moveClick('.tab[data-v="analyser"]', 0.8);
await until(191.0);
await moveClick("#aiDealInput", 0.6);
await page.keyboard.insertText(SAMPLE_AD);
if (!(await page.inputValue("#aiDealInput"))) await page.fill("#aiDealInput", SAMPLE_AD);
await until(193.5);
await move("#aiDealInput", 0.8, 80, 10);
await until(198.4);
await scroll("#aiLevelOpts", 0.7, 300);
await moveClick("#aiLevelOpts .lv-deep", 0.6);
await moveClick("#analyseWithAI", 0.7);
await until(202.1);
await scroll("#aiDealOutput", 0.9, 80);
await until(204.8);
await move("#aiDealOutput .ai-verdict", 0.7);
await move("#aiDealOutput .ai-metric:first-child", 0.7);
await move("#aiDealOutput .ai-metric:nth-child(3)", 0.7);
await until(210.6);
await scroll("#aiDealOutput .ai-metrics", 1.0, 20);
await move('#aiDealOutput .ai-section:has-text("Occupancy scenarios") li', 0.8);
await until(214.5);
await move('#aiDealOutput .ai-section:has-text("Important risks") li', 0.8);
await until(218.0);
await move('#aiDealOutput .ai-section:has-text("Missing information") li', 0.8);
await until(221.6);
await move('#aiDealOutput .ai-section:has-text("Stress tests") li', 0.8);
await until(226.0);
await move('#aiDealOutput .ai-section:has-text("Stress tests") li:nth-child(2)', 0.8);
await until(230.5);
await scroll("#aiDealOutput", 1.0, 80);
await move("#aiDealOutput .ai-score strong", 0.8);

// 3:56 Due diligence and deal packs
await until(236.1);
await moveClick("#advancedToggle", 0.8);
await scroll(".stepbar", 0.6, 20);
await until(239.8);
await moveClick('.stp[data-step="numbers"]', 0.6);
await until(243.5);
await moveClick('.stp[data-step="dd"]', 0.6);
await until(247.0);
await moveClick('.stp[data-step="pack"]', 0.6);
await until(250.3);
await scroll(0, 0.6);
await moveClick("#saveDealTop", 0.7);
await until(252.6);
await moveClick('.tab[data-v="deals"]', 0.8);

// 4:15 Deal Community
await until(255.8);
await moveClick('.tab[data-v="community"]', 0.8);
await until(259.0);
await move("#cResults .dcard:first-child h3", 0.8);
await until(262.5);
await move("#cPostToggle", 0.8);
await until(265.5);
await move("#cResults .dcard:first-child .dc-act .btn", 0.8);
await until(267.9);
await move("#cTut summary", 0.9);

// 4:31 Plans, credits and refunds
await until(271.8);
await moveClick('.tab[data-v="plans"]', 0.8);
await move("#plans .plan:nth-child(1) .price", 0.8);
await until(277.0);
await move("#plans .plan:nth-child(2) .price", 0.8);
await until(283.8);
await move("#plans .plan:nth-child(3) .price", 0.8);
await moveClick("#maxT20", 0.6);
await until(287.5);
await moveClick("#maxT5", 0.6);
await until(294.1);
await scroll("#refunds", 1.0, 120);
await move("#rfOpen", 0.8);

// 5:02 Final reminder
await until(302.6);
await moveClick('.tab[data-v="home"]', 0.8);
await until(304.5);
await scroll(".home-foot", 1.8, 440);
await move(".home-foot p", 0.9);
await until(audioSeconds(AUDIO) + 0.4);

await finish({ audio: AUDIO, video: "deal-pro-tutorial.mp4", poster: "deal-pro-tutorial-poster.png", posterAt: 3.2 });
