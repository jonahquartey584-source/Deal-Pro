// The deal broker: turns an investor's criteria into a deal pack.
// The search is done by Claude Code on this Mac, which uses your Claude subscription
// (you sign in once with `claude`), with web search to find live UK listings.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEAL_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Two or three sentences for the investor: what you found and how it matches their criteria.' },
    deals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'e.g. "3 bed terraced house" — no street number' },
          area: { type: 'string', description: 'Town and postcode district, e.g. "Leeds LS9"' },
          price: { type: 'string', description: 'Asking price or monthly rent as advertised, e.g. "£95,000" or "£850 pcm"' },
          strategy: { type: 'string', description: 'The strategy this suits, e.g. "HMO", "BTL", "R2SA"' },
          keyFigures: {
            type: 'array',
            items: {
              type: 'object',
              properties: { label: { type: 'string' }, value: { type: 'string' } },
              required: ['label', 'value'],
              additionalProperties: false,
            },
            description: 'Up to 5 figures that matter for the strategy (yield, cash flow, profit, ROI...). Mark estimates "(est.)".',
          },
          whyItFits: { type: 'string', description: 'One or two sentences on why it suits this investor.' },
          watchOut: { type: 'string', description: 'The main risk or thing to check. Empty if none.' },
          listingUrl: { type: 'string', description: 'The live listing page you checked.' },
          source: { type: 'string', description: 'The website it is listed on.' },
        },
        required: ['title', 'area', 'price', 'strategy', 'keyFigures', 'whyItFits', 'watchOut', 'listingUrl', 'source'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'deals'],
  additionalProperties: false,
};

const LABELS = { lookingFor: 'Looking for', strategy: 'Strategy', areas: 'Areas', budget: 'Budget', timeline: 'Timeline', finance: 'Finance', notes: 'Notes' };

export const criteriaText = (details) =>
  Object.entries(details)
    .filter(([, v]) => v)
    .map(([k, v]) => `${LABELS[k] || k}: ${v}`)
    .join('\n');

/** Stable fingerprint of what the investor wants, so a new search runs only when it changes. */
export const criteriaKey = (details) =>
  ['lookingFor', 'strategy', 'areas', 'budget', 'finance']
    .map((k) => String(details[k] || '').toLowerCase().replace(/\s+/g, ' ').trim())
    .join('|');

export function isReady(details, config) {
  const need = config.broker?.requiredFields ?? ['strategy', 'areas', 'budget'];
  return need.every((f) => String(details[f] || '').trim());
}

function searchPrompt(details, { exclude = [], count = 6 }) {
  return `You are sourcing UK property investment deals for an investor. Find ${count} real, currently available properties that match their criteria.

THE INVESTOR'S CRITERIA:
${criteriaText(details)}

How to search:
- Use web search to find live listings on UK property sites: Rightmove, Zoopla, OnTheMarket, auction sites (EIG, Auction House, Allsop, SDL, iamsold) for purchases, and OpenRent, SpareRoom, Rightmove and Zoopla lettings for rent-to-rent or serviced accommodation.
- Open each listing page to confirm it is still available and the details are right. Leave out anything sold, let, under offer or that you could not open.
- Stay within their budget and areas. If very little matches, widen to neighbouring areas and say so in the summary.
- Work out the figures that matter for their strategy (yield, monthly cash flow, profit, ROI, money left in...). Use realistic local rents and costs and mark every estimate "(est.)". Never invent facts about a property.
${exclude.length ? `- They have already been sent these, so do not include them again:\n${exclude.map((u) => `  - ${u}`).join('\n')}\n` : ''}- If you genuinely cannot find any suitable live deals, return an empty "deals" list and explain why in the summary.`;
}

/**
 * Run the search with Claude Code (your Claude subscription). Resolves to { summary, deals }.
 * Throws an Error with a plain-English message if Claude Code isn't installed or signed in.
 */
export function searchDeals(config, details, { exclude = [] } = {}) {
  const b = config.broker ?? {};
  const args = [
    '-p', searchPrompt(details, { exclude, count: b.dealsPerPack ?? 6 }),
    '--output-format', 'json',
    '--json-schema', JSON.stringify(DEAL_SCHEMA),
    '--tools', 'WebSearch,WebFetch',
    '--allowedTools', 'WebSearch', 'WebFetch',
    '--no-session-persistence',
    ...(b.model ? ['--model', b.model] : []),
  ];
  // Run in an empty folder so Claude Code doesn't pick up any project's files or settings.
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'deal-search-'));
  return new Promise((resolve, reject) => {
    execFile(b.claudePath || 'claude', args, { cwd, timeout: (b.searchTimeoutMinutes ?? 25) * 60_000, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      fs.rmSync(cwd, { recursive: true, force: true });
      if (err && err.code === 'ENOENT') {
        return reject(new Error('Claude Code is not installed on this Mac. Install it with: npm install -g @anthropic-ai/claude-code — then run `claude` once and sign in with your Claude account.'));
      }
      let out;
      try {
        out = JSON.parse(stdout);
      } catch {
        const why = String(stderr || err?.message || '').trim().slice(0, 300);
        if (/log ?in|auth|credential|sign in/i.test(why)) {
          return reject(new Error('Claude Code is not signed in. Open Terminal, run `claude`, and sign in with your Claude account.'));
        }
        return reject(new Error(err?.killed ? 'The deal search took too long and was stopped.' : `The deal search failed: ${why || 'no output'}`));
      }
      if (out.is_error || !out.structured_output) {
        const msg = String(out.result || out.subtype || 'unknown error');
        if (/log ?in|auth|credential/i.test(msg)) return reject(new Error('Claude Code is not signed in. Open Terminal, run `claude`, and sign in with your Claude account.'));
        if (/limit|usage/i.test(msg)) return reject(new Error(`Your Claude subscription limit was reached: ${msg.slice(0, 200)}`));
        return reject(new Error(`The deal search failed: ${msg.slice(0, 300)}`));
      }
      const res = out.structured_output;
      res.deals = (res.deals || []).filter((d) => d.title && d.price);
      resolve(res);
    });
  });
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** HTML for the deal pack. Listing links and websites are left out unless includeLinks is on (pre-NDA). */
export function packHtml({ clientName, ownerName, brand, details, summary, deals, includeLinks = false }) {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const cards = deals
    .map(
      (d, i) => `<section class="deal">
  <div class="num">${i + 1}</div>
  <div class="body">
    <h2>${esc(d.title)}</h2>
    <div class="meta">${esc(d.area)} · <b>${esc(d.price)}</b> · ${esc(d.strategy)}</div>
    ${d.keyFigures?.length ? `<table>${d.keyFigures.slice(0, 5).map((f) => `<tr><td>${esc(f.label)}</td><td>${esc(f.value)}</td></tr>`).join('')}</table>` : ''}
    <p><b>Why it fits:</b> ${esc(d.whyItFits)}</p>
    ${d.watchOut ? `<p class="warn"><b>Check:</b> ${esc(d.watchOut)}</p>` : ''}
    ${includeLinks && d.listingUrl ? `<p class="link">${esc(d.source)}: ${esc(d.listingUrl)}</p>` : ''}
  </div>
</section>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font: 11pt/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1d2433; margin: 0; }
  header { border-bottom: 3px solid #0f6b5c; padding-bottom: 10px; margin-bottom: 14px; }
  header .brand { color: #0f6b5c; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; font-size: 9pt; }
  header h1 { margin: 4px 0 2px; font-size: 20pt; }
  header .sub { color: #5b6475; font-size: 10pt; }
  .criteria { background: #f2f6f5; border-radius: 8px; padding: 10px 12px; margin: 0 0 12px; font-size: 10pt; white-space: pre-line; }
  .summary { margin: 0 0 14px; }
  .deal { display: flex; gap: 12px; border: 1px solid #dfe5ea; border-radius: 10px; padding: 12px; margin: 0 0 10px; break-inside: avoid; }
  .num { flex: 0 0 28px; height: 28px; border-radius: 50%; background: #0f6b5c; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .body { flex: 1; }
  h2 { font-size: 13pt; margin: 2px 0; }
  .meta { color: #5b6475; margin-bottom: 6px; }
  table { border-collapse: collapse; margin: 4px 0 6px; font-size: 10pt; }
  td { padding: 2px 14px 2px 0; } td:first-child { color: #5b6475; width: 200px; }
  p { margin: 4px 0; } .warn { color: #8a4b12; } .link { font-size: 8.5pt; color: #5b6475; word-break: break-all; }
  footer { margin-top: 14px; font-size: 8.5pt; color: #7a8394; border-top: 1px solid #dfe5ea; padding-top: 8px; }
  </style></head><body>
  <header><div class="brand">${esc(brand || 'Deal pack')}</div><h1>Deals for ${esc(clientName)}</h1><div class="sub">Prepared by ${esc(ownerName)} · ${date}</div></header>
  <div class="criteria"><b>What you asked for</b>\n${esc(criteriaText(details))}</div>
  <p class="summary">${esc(summary)}</p>
  ${cards}
  <footer>Figures marked (est.) are estimates based on typical local rents and costs and must be checked before any offer. Availability can change quickly. Full addresses and details are shared once you'd like to proceed with a deal.</footer>
</body></html>`;
}

/** Render the deal pack as a PDF using the bot's browser. Returns base64. */
export async function renderPackPdf(browser, data) {
  const page = await browser.newPage();
  try {
    await page.setContent(packHtml(data), { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf).toString('base64');
  } finally {
    await page.close().catch(() => {});
  }
}
