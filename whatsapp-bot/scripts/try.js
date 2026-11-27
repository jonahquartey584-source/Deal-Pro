// Practice chat: you play the person messaging you, and see exactly what the bot would do.
// Nothing is sent on WhatsApp. Uses the same settings, learned style and AI as the real bot.
//   npm run try -- business
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';
import { replyAsOwner, LEAD_FIELDS } from '../src/ai.js';
import { loadStyle, sample } from '../src/style.js';
import { profilePaths, readProfileArg } from '../src/login.js';
import { searchDeals, renderPackPdf, criteriaKey, isReady } from '../src/broker.js';
import { execFile } from 'node:child_process';
import puppeteer from 'puppeteer';

const here = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const paths = profilePaths(here, readProfileArg(process.argv.slice(2)));
const example = path.join(here, `config.${paths.profile}.example.json`);
const configFile = fs.existsSync(paths.config) ? paths.config : fs.existsSync(example) ? example : path.join(here, 'config.example.json');
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const style = loadStyle(paths.style);

if (!(process.env.OPENAI_API_KEY || '').startsWith('sk-')) {
  console.error('Your OpenAI key isn\'t set up yet (see the README), so the practice chat can\'t run.');
  process.exit(1);
}

console.log(`\nPractice chat — profile "${paths.profile}" (settings from ${path.basename(configFile)})`);
console.log(style.guide ? 'Using the texting style the bot learned from your chats.' : 'No learned style yet (link the bot once to learn it), so replies use a general style.');
console.log('Type messages as if you were someone messaging you. Nothing is sent on WhatsApp.');
console.log('Commands: /new = start a new conversation, /quit = stop.\n');

const rl = readline.createInterface({ input, output });
let history = [];
let searchedKey = null;
let packs = [];
const packFile = path.join(here, 'practice-deal-pack.pdf');
for (;;) {
  let text;
  try {
    text = (await rl.question('THEM › ')).trim();
  } catch {
    break; // input closed
  }
  if (!text) continue;
  if (text === '/quit') break;
  if (text === '/new') {
    history = [];
    searchedKey = null;
    packs = [];
    console.log('— new conversation —\n');
    continue;
  }
  history.push({ fromMe: false, text });
  process.stdout.write('   …thinking\r');
  let r;
  try {
    r = await replyAsOwner({
      config,
      styleGuide: style.guide,
      contactName: 'Test contact',
      contactExamples: [],
      generalExamples: sample(style.general ?? [], 25),
      history,
      dealContext: packs.map((p, i) => `Deal pack #${i + 1} sent:\n${p.map((d, j) => `  ${j + 1}. ${d.title}, ${d.area}, ${d.price}`).join('\n')}`).join('\n'),
    });
  } catch (err) {
    console.log(`   ⚠️  AI request failed: ${err.message}\n`);
    history.pop();
    continue;
  }
  if (!r) {
    console.log('   (the AI declined to answer)\n');
    continue;
  }
  const wait = config.replyAfterMinutes ? ` (real bot waits ${config.replyAfterMinutes} min first)` : '';
  if (r.action === 'reply') {
    for (const m of r.messages) {
      console.log(`YOU (bot) › ${m}`);
      history.push({ fromMe: true, text: m });
    }
    console.log(`   ↳ replied${wait}`);
  } else if (r.action === 'notify') {
    console.log(`   🔔 No reply. Qp Homebase would get: "${r.topic}" — you have to respond about ${r.about}`);
    if (r.suggestedReply) console.log(`   💬 Suggested reply: ${r.suggestedReply}`);
  } else {
    console.log(`YOU (bot) › ${config.holdMessage || 'hold on'}`);
    history.push({ fromMe: true, text: config.holdMessage || 'hold on' });
    console.log(`   ⏸ Held for you. Qp Homebase would get: "Needs you: ${r.reason}"`);
  }
  const lead = r.lead || {};
  const known = LEAD_FIELDS.filter((f) => lead[f]).map((f) => `${f}: ${lead[f]}`);
  if (lead.isLead && known.length) console.log(`   📋 Deal sourcing task would show → ${known.join(' · ')}`);
  if (r.dealIntent === 'proceed') console.log(`   🎯 They want to go ahead (${r.proceedWith}) — the real bot would step back and alert you.`);

  // When the criteria are complete (or changed, or they ask for more), run the real deal search.
  const details = Object.fromEntries(LEAD_FIELDS.map((f) => [f, (lead[f] || '').trim()]).filter(([, v]) => v));
  if (config.broker?.enabled && lead.isLead && isReady(details, config) && r.dealIntent !== 'proceed' && (criteriaKey(details) !== searchedKey || r.dealIntent === 'more')) {
    searchedKey = criteriaKey(details);
    console.log('   🔎 Criteria complete — searching for deals with Claude (this can take a few minutes)…');
    try {
      const res = await searchDeals(config, details, { exclude: packs.flat().map((d) => d.listingUrl) });
      console.log(`   ${res.summary}`);
      if (res.deals.length) {
        res.deals.forEach((d, i) => console.log(`   ${i + 1}. ${d.title}, ${d.area} — ${d.price}  ${d.listingUrl}`));
        const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
        const pdf = await renderPackPdf(browser, { clientName: 'Test contact', ownerName: config.ownerName, brand: config.broker?.brand || `${config.ownerName} · Property deals`, details, summary: res.summary, deals: res.deals });
        await browser.close();
        fs.writeFileSync(packFile, Buffer.from(pdf, 'base64'));
        if (process.platform === 'darwin') execFile('open', [packFile], () => {});
        console.log(`   📦 The client's deal pack (opened in Preview): ${packFile}`);
        packs.push(res.deals);
        history.push({ fromMe: true, text: `[sent a PDF deal pack with ${res.deals.length} deals]` });
      }
    } catch (err) {
      console.log(`   ⚠️  ${err.message}`);
    }
  }
  console.log('');
}
rl.close();
