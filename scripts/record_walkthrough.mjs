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
const idx = (id) => String(LISTINGS.findIndex((l) => l.id === id));

const CREDITS = { plan: "Pro", free: false, creditsLeft: 92, weeklyCredits: 100, resetsAt: "2026-10-01T09:00:00Z" };
const RANK = {
  summary: "Three W2 units stand out: rents well below the area median, close to Hyde Park and Paddington, where short-stay demand holds up all year.",
  picks: [
    { id: idx("1802560654"), score: 84, verdict: "Strong", reason: "The lowest studio rent in W2 in this search. Similar Bayswater studios take around £150 a night.", monthly_profit_80: "£1,025 a month" },
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

const { page, until, move, click, moveClick, type, scroll, finish } = await start({
  state: STATE,
  api: (url, method, body) => {
    if (url.pathname === "/api/community") return [200, { posts: POSTS }];
    if (url.pathname === "/api/analyze-deal") {
      if (method === "POST") return [200, { jobId: body.kind, credits: CREDITS }];
      const job = url.searchParams.get("job");
      if (job) return [200, { status: "done", analysis: job === "rank" ? RANK : ANALYSIS, credits: CREDITS }];
      return [200, CREDITS];
    }
    return [200, {}];
  },
});

/* ---------- the walkthrough, timed to the narration ---------- */
// 0.0  "Hi, and welcome to Deal Pro. Here's how to get started."
await until(1.9);
await move({ x: 700, y: 330 }, 1.1);
// 4.6  "Sign in with Google or your email, and you'll stay signed in on your device."
await until(3.4);
await moveClick("#homeSignIn", 1.0);
await move("#authGoogle", 0.9);
await until(6.7);
await moveClick("#authEmail", 0.5);
await type("alex@example.com", 0.7);
await moveClick("#authPassword", 0.35);
await type("password12", 0.3);
await moveClick("#authSubmit", 0.4);
// 9.3  "Before you search or analyse, choose a power level."
await until(9.6);
await moveClick('.tab[data-v="analyser"]', 0.8);
await until(11.2);
await move("#aiLevelOpts", 0.9, 0, -8);
// 12.7 "Scout gives you a fast first look and uses the least credits."
await until(12.9);
await moveClick("#aiLevelOpts .lv-quick", 0.5);
// 17.3 "Analyst gives you a full analysis and uses more."
await until(17.3);
await moveClick("#aiLevelOpts .lv-standard", 0.6);
// 20.5 "And Expert is thorough and stress-tested, and uses the most."
await until(20.6);
await moveClick("#aiLevelOpts .lv-deep", 0.6);
await until(23.1);
await moveClick("#aiLevelOpts .lv-standard", 0.6);
// 24.9 "Open Deal Finder, set your filters and search."
await until(24.9);
await moveClick('.tab[data-v="find"]', 0.7);
await until(25.9);
await moveClick("#fLoc", 0.6);
await type("W2", 0.3);
await scroll("#fSearch", 0.6, 520);
await moveClick("#fSearch", 0.6);
// 28.8 "Every result shows the full property details and a link to the listing, and the AI picks out the best deals for you."
await until(29.6);
await scroll(".sheet", 0.9, 150);
await move(".sheet tbody tr:nth-child(2) td.wide", 0.8);
await until(31.6);
await move(".sheet tbody tr:nth-child(2) .xlink", 0.7);
await until(33.4);
await scroll("#fResults", 0.8, 70);
await move(".rank-list li:first-child .rank-top b", 0.8);
await until(35.2);
await move(".rank-list li:first-child .rank-score", 0.6);
// 36.1 "You can copy them straight into Google Sheets."
await until(36.3);
await moveClick("#fCopy", 0.8);
// 39.6 "Next, open the AI Deal Analyser."
await until(39.6);
await moveClick('.tab[data-v="analyser"]', 0.8);
// 42.0 "Paste in an advert, or enter the rent, deposit and expected nightly rate yourself."
await until(42.0);
await moveClick("#aiDealInput", 0.7);
await until(43.1);
await page.keyboard.insertText(SAMPLE_AD);
await until(44.4);
await move("#aiDealInput", 0.6, 60, 20);
await scroll("#analyseWithAI", 0.8, 560);
await move("#analyseWithAI", 0.6);
// 47.7 "Deal Pro explains the likely profit at different occupancy levels, the key risks, and anything that's still missing, without simply guessing."
await until(47.5);
await click();
await until(49.9);
await scroll("#aiDealOutput", 0.9, 80);
await move("#aiDealOutput .ai-metric:first-child", 0.7);
await until(52.0);
await move("#aiDealOutput .ai-score strong", 0.6);
await scroll("#aiDealOutput .ai-metrics", 1.0, 40);
await until(54.2);
await scroll("#analyseWithAI", 1.0, 120);
await until(55.6);
// 56.4 "Then work through the due diligence checks, save the deal, and prepare the deal pack."
await moveClick("#advancedToggle", 0.7);
await scroll(".stepbar", 0.5, 20);
await moveClick('.stp[data-step="dd"]', 0.6);
await until(58.2);
await scroll(0, 0.5);
await moveClick("#saveDealTop", 0.7);
await until(59.3);
await scroll(".stepbar", 0.4, 20);
await moveClick('.stp[data-step="pack"]', 0.6);
// 61.8 "You can also use the Deal Community to post deals where you've already spoken to the landlord or agent, and to find deals other sourcers have contacted."
await until(62.2);
await moveClick('.tab[data-v="community"]', 0.8);
await until(63.6);
await moveClick("#cPostToggle", 0.8);
await until(66.3);
await moveClick("#cPostToggle", 0.6);
await move("#cResults .dcard:first-child h3", 0.8);
await until(68.6);
await move("#cResults .dcard:first-child .dc-act .btn", 0.7);
// 70.7 "And remember, always verify legal, planning, licensing and financial information independently."
await until(70.7);
await moveClick('.tab[data-v="home"]', 0.8);
await until(72.2);
await scroll(".home-foot", 1.8, 440);
await move(".home-foot p", 0.9);
await until(audioSeconds(AUDIO) + 0.4);

await finish({ audio: AUDIO, video: "deal-pro-tutorial.mp4", poster: "deal-pro-tutorial-poster.png", posterAt: 2.6 });
