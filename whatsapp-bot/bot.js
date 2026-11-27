// Personal WhatsApp auto-replier. Runs on your Mac, linked to your WhatsApp like WhatsApp Web.
// It learns how you text, replies to everyone like you would, and when something needs you
// it says "hold on" and sends the message to your homebase chat (default: "Qp Homebase").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-terminal';
import wweb from 'whatsapp-web.js';
import { decide, inList } from './src/rules.js';
import { learnStyle, replyAsOwner, summarise, writeAsOwner, LEAD_FIELDS } from './src/ai.js';
import { searchDeals, renderPackPdf, criteriaKey, criteriaText, isReady } from './src/broker.js';
import { createHomebase } from './src/homebase.js';
import { renderChatPng } from './src/snapshot.js';
import { loadStyle, saveStyle, collectSamples, addSample, textOf, sample } from './src/style.js';
import { profilePaths, readProfileArg, currentUserAgent, saveAndOpenQr, removeQrImage, normalisePhone } from './src/login.js';

const { Client, LocalAuth, MessageMedia } = wweb;
const here = path.dirname(fileURLToPath(import.meta.url));
const paths = profilePaths(here, readProfileArg(process.argv.slice(2)));
const CONFIG_PATH = paths.config;
const STYLE_PATH = paths.style;
const BOT_TAG = '🤖'; // every note the bot sends you starts with this, so it never reacts to itself

// ---------- config ----------
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const profileExample = path.join(here, `config.${paths.profile}.example.json`);
    const example = fs.existsSync(profileExample) ? profileExample : path.join(here, 'config.example.json');
    fs.copyFileSync(example, CONFIG_PATH);
    console.log(`Created ${path.basename(CONFIG_PATH)} from ${path.basename(example)} – edit it to customise the bot.`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}
function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}
let config = loadConfig();
fs.watchFile(CONFIG_PATH, { interval: 2000 }, () => {
  try {
    config = loadConfig();
    console.log('config.json reloaded');
  } catch (err) {
    console.error('config.json has an error, keeping the previous settings:', err.message);
  }
});

// ---------- state ----------
let style = loadStyle(STYLE_PATH);
let myId; // your own chat
let homebaseId; // where alerts go
const youRepliedAt = new Map(); // chatId -> Date you last typed there yourself
const waitingOnYou = new Map(); // chatId -> true after the bot said "hold on"
const replyLog = new Map(); // chatId -> [timestamps of bot replies]
const lastFromThem = new Map(); // chatId -> their latest text (for learning from your own replies)
const botSends = new Set(); // "chatId|text" of messages the bot is sending (so they aren't mistaken for you)
const pending = new Map(); // chatId -> timer, so a burst of messages gets one reply
const schedule = loadJson(paths.schedule, {}); // chatId -> { dueAt, name, number }: replies waiting to go out (survives restarts)
const leads = loadJson(paths.leads, {}); // chatId -> last lead details posted to homebase
const reminders = new Map(); // chatId -> timer for "you still need to respond" reminders
const botMedia = new Set(); // chats the bot is sending a file to (so it isn't mistaken for you replying)
const homebase = createHomebase(config); // the Qp Homebase planner app on this Mac
let searchChain = Promise.resolve(); // deal searches run one at a time
const alerts = new Map(); // alert message id -> { chatId, name }
const alertsByNo = new Map(); // alert number -> { chatId, name }
let alertNo = 1;
const inbox = []; // messages since the last digest
let saveTimer;

// ---------- helpers ----------
function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
const saveJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clip = (text, n = 400) => (text.length > n ? text.slice(0, n) + '…' : text);
const rand = ([min, max]) => (min + Math.random() * (max - min)) * 1000;

function describe(msg) {
  const text = textOf(msg);
  if (text) return text;
  const kinds = { image: 'a photo', video: 'a video', ptt: 'a voice note', audio: 'audio', document: 'a document', sticker: 'a sticker', location: 'a location', vcard: 'a contact' };
  const label = `[sent ${kinds[msg.type] ?? msg.type}]`;
  return msg.body ? `${label} ${msg.body}` : label;
}

function saveStyleSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveStyle(STYLE_PATH, style), 5000);
}

async function tellMe(text) {
  const to = homebaseId || myId;
  if (!to) return null;
  return client.sendMessage(to, `${BOT_TAG} ${text}`);
}

/** Send to a contact as the bot (with typing and a human-ish delay). */
async function botSend(chat, rawText) {
  const text = rawText.trim();
  const chatId = chat.id._serialized;
  await chat.sendStateTyping().catch(() => {});
  await sleep(Math.min(1500 + text.length * 60, 8000));
  botSends.add(`${chatId}|${text}`);
  await chat.sendMessage(text);
  const log = (replyLog.get(chatId) ?? []).filter((t) => Date.now() - t < 3_600_000);
  log.push(Date.now());
  replyLog.set(chatId, log);
}

/** Post an alert in homebase that you can answer by replying (swipe-reply) to it. */
async function alert(chatId, name, body, picture, extra = {}) {
  const n = alertNo++;
  const footer = extra.draft
    ? extra.draft.length
      ? `_Reply ✅ to this message to send the draft, or reply with your own words to send those instead. !skip ${n} to send nothing._`
      : `_Reply to this message with what to send ${name}, or !skip ${n} to send nothing._`
    : `_Reply to this message to answer ${name}, or send !reply ${n} <text>. !done ${n} lets the bot carry on._`;
  const text = `${body}\n\n${footer}`;
  let sent;
  if (picture && (homebaseId || myId)) {
    sent = await client.sendMessage(homebaseId || myId, picture, { caption: `${BOT_TAG} ${text}` }).catch((err) => {
      console.error('Could not send chat picture:', err.message);
      return null;
    });
  }
  sent ??= await tellMe(text);
  const target = { chatId, name, n, ...extra };
  alertsByNo.set(n, target);
  if (sent?.id?._serialized) alerts.set(sent.id._serialized, target);
  return n;
}

/** Business number, approval mode: post a drafted reply to Qp Homebase and send nothing until you approve it. */
const awaitingApproval = new Set(); // chats with a draft waiting for you (so the planner gets one to-do, not many)
async function askApproval(chatId, person, result, recent, latest) {
  const draft = result?.action === 'reply' ? result.messages.map((m) => m.trim()).filter(Boolean) : [];
  // A newer message replaces any older draft for this chat, so a stale reply can't be sent.
  for (const t of alertsByNo.values()) if (t.chatId === chatId && t.draft && !t.handled) Object.assign(t, { handled: true, superseded: true });
  const why = result?.action === 'hold' ? `\n_(${result.reason || 'needs you'})_` : '';
  const picture = await chatPicture(person, recent, 'Waiting for your approval');
  await alert(
    chatId,
    person.name,
    `✋ *Approve reply to ${person.name}*\n\n"${clip(latest, 300)}"\n\n${draft.length ? `*Draft:*\n${draft.join('\n')}` : '*No draft* — this one needs you.'}${why}`,
    picture,
    { draft },
  );
  if (!awaitingApproval.has(chatId)) {
    awaitingApproval.add(chatId);
    await homebase.addTodo(`Approve reply to ${person.name} (WhatsApp)`);
  }
}

const APPROVE = /^(✅|👍|ok(ay)?|yes|y|send( it)?|approve(d)?|go)\W*$/i;

/** A WhatsApp-style picture of the recent conversation, or null if pictures are off or it fails. */
async function chatPicture(person, recent, subtitle) {
  if (config.chatPictures === false || !client.pupBrowser) return null;
  try {
    const messages = recent
      .slice(-(config.chatPictureMessages ?? 15))
      .map((m) => ({ fromMe: m.fromMe, text: describe(m), time: new Date(m.timestamp * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }))
      .filter((m) => !m.text.startsWith(BOT_TAG));
    const png = await renderChatPng(client.pupBrowser, { title: person.name, subtitle, messages });
    return new MessageMedia('image/png', png, `chat-${Date.now()}.png`);
  } catch (err) {
    console.error('Could not draw chat picture:', err.message);
    return null;
  }
}

/** Remind you again later if you still haven't answered someone the bot flagged. */
function remindLater(chatId, name, about) {
  const hours = config.remindAfterHours ?? 3;
  if (!hours) return;
  clearTimeout(reminders.get(chatId));
  reminders.set(
    chatId,
    setTimeout(async () => {
      reminders.delete(chatId);
      if (!waitingOnYou.get(chatId)) return;
      await alert(chatId, name, `⏰ Reminder: you still need to respond to *${name}*${about ? ` about ${about}` : ''}.`);
      remindLater(chatId, name, about);
    }, hours * 3_600_000),
  );
}

/** Post (or update) a deal sourcing task in homebase when an investor tells us what they want. */
async function trackLead(chatId, person, lead) {
  if (!config.leadTasks?.enabled || !lead?.isLead) return;
  const details = Object.fromEntries(LEAD_FIELDS.map((f) => [f, (lead[f] || '').trim()]).filter(([, v]) => v));
  if (!Object.keys(details).length) return;
  const before = JSON.stringify(leads[chatId]?.details ?? {});
  if (before === JSON.stringify(details)) return; // nothing new
  const isNew = !leads[chatId];
  leads[chatId] = { stage: 'new', packs: [], ...leads[chatId], name: person.name, number: person.number, details, updatedAt: new Date().toISOString() };
  saveJson(paths.leads, leads);
  await syncHomebase(chatId);
  const labels = { lookingFor: 'Looking for', strategy: 'Strategy', areas: 'Areas', budget: 'Budget', timeline: 'Timeline', finance: 'Finance', notes: 'Notes' };
  const lines = Object.entries(details).map(([k, v]) => `• *${labels[k]}:* ${v}`).join('\n');
  const plan = config.leadTasks.plan ? `\n*Plan:* ${config.leadTasks.plan}` : '';
  await tellMe(`📋 *${isNew ? 'New deal sourcing task' : 'Deal sourcing task updated'}* — ${person.name}${person.number ? ` (+${String(person.number).replace(/\D/g, '')})` : ''}${plan}\n${lines}\n\n_Task: find deals that match and send them over._`);
}

// ---------- deal broker: criteria → Claude search → deal pack → feedback → … ----------
const short = (d) => [d.strategy, d.areas, d.budget].filter(Boolean).join(' · ');

/** Keep the Qp Homebase planner (plan step + CRM contact) in step with where this investor is. */
async function syncHomebase(chatId) {
  const L = leads[chatId];
  if (!L || !homebase.enabled) return;
  const last = L.packs?.at(-1);
  const text = {
    new: `📋 ${L.name} — ${short(L.details) || 'getting their criteria'}`,
    searching: `🔎 Searching deals for ${L.name} — ${short(L.details)}`,
    sent: `📦 Deal pack sent to ${L.name} (${last?.deals.length ?? 0} deals, ${last ? new Date(last.at).toLocaleDateString('en-GB') : ''}) — waiting for feedback`,
    nodeals: `⚠️ No live deals found yet for ${L.name} — ${short(L.details)}`,
    ready: `🎯 ${L.name} wants to proceed: ${L.proceedWith || 'a deal from the pack'} — call them`,
  }[L.stage || 'new'];
  const notes = `${criteriaText(L.details)}

Deal packs sent: ${L.packs?.length ?? 0}${(L.packs ?? []).map((p, i) => `
#${i + 1} ${new Date(p.at).toLocaleDateString('en-GB')}: ${p.deals.map((d) => `${d.title}, ${d.area}, ${d.price}`).join(' | ')}`).join('')}`;
  const stepId = await homebase.upsertStep(L, text);
  const contactId = await homebase.upsertContact(L, { name: L.name, phone: L.number, notes, stage: L.stage });
  if (stepId) L.stepId = stepId;
  if (contactId) L.contactId = contactId;
  saveJson(paths.leads, leads);
}

/** What the reply AI should know about this investor's deals so far. */
function dealContext(chatId) {
  const L = leads[chatId];
  if (!L || !config.broker?.enabled) return '';
  const lines = [];
  if (L.stage === 'searching') lines.push('You are searching for deals that match what they asked for. Tell them they are on the way if they ask; never make up deals.');
  if (L.stage === 'nodeals') lines.push('Your last search found nothing suitable yet. You are still looking.');
  (L.packs ?? []).forEach((p, i) =>
    lines.push(`Deal pack #${i + 1} sent ${new Date(p.at).toLocaleDateString('en-GB')}:\n${p.deals.map((d, j) => `  ${j + 1}. ${d.title}, ${d.area}, ${d.price} (${d.strategy})`).join('\n')}`),
  );
  if (L.stage === 'ready') lines.push(`They want to go ahead (${L.proceedWith}). ${config.ownerName} is handling it personally now.`);
  if (!isReady(L.details, config)) lines.push(`Before you can search you still need: ${(config.broker.requiredFields ?? ['strategy', 'areas', 'budget']).filter((f) => !L.details[f]).join(', ')}.`);
  return lines.join('\n');
}

/** After replying: start a search when the criteria are complete (or changed), or hand over when they want to proceed. */
async function brokerStep(chat, person, result, recent) {
  const chatId = chat.id._serialized;
  const L = leads[chatId];
  if (!config.broker?.enabled || !L) return;

  if (result?.dealIntent === 'proceed' && L.stage !== 'ready') {
    L.stage = 'ready';
    L.proceedWith = result.proceedWith || 'a deal from the pack';
    saveJson(paths.leads, leads);
    waitingOnYou.set(chatId, true);
    await syncHomebase(chatId);
    await homebase.addTodo(`Call ${L.name} — wants to proceed with ${L.proceedWith}`);
    const picture = await chatPicture(person, recent, 'Ready to move forward');
    await alert(chatId, person.name, `🎯 *${person.name} wants to move forward* with ${L.proceedWith}.

The bot has stepped back from this chat — it's over to you.`, picture);
    remindLater(chatId, person.name, `moving forward with ${L.proceedWith}`);
    return;
  }

  if (L.stage === 'searching' || L.stage === 'ready' || !isReady(L.details, config)) return;
  const changed = criteriaKey(L.details) !== L.searchedKey;
  if (changed || result?.dealIntent === 'more') queueSearch(chatId);
}

function queueSearch(chatId) {
  const L = leads[chatId];
  L.stage = 'searching';
  L.searchedKey = criteriaKey(L.details);
  saveJson(paths.leads, leads);
  searchChain = searchChain.then(() => runSearch(chatId)).catch((err) => console.error('Deal search error:', err));
}

async function runSearch(chatId) {
  const L = leads[chatId];
  await syncHomebase(chatId);
  await tellMe(`🔎 Searching for deals for *${L.name}* (Claude)…
${criteriaText(L.details)}`);
  console.log(`Searching deals for ${L.name}: ${short(L.details)}`);
  let res;
  try {
    const exclude = (L.packs ?? []).flatMap((p) => p.deals.map((d) => d.url)).filter(Boolean);
    res = await searchDeals(config, L.details, { exclude });
  } catch (err) {
    L.stage = 'new';
    L.searchedKey = null; // try again on their next message
    saveJson(paths.leads, leads);
    await syncHomebase(chatId);
    await tellMe(`⚠️ The deal search for *${L.name}* didn't work: ${err.message}`);
    return;
  }

  if (!res.deals.length) {
    L.stage = 'nodeals';
    saveJson(paths.leads, leads);
    await syncHomebase(chatId);
    await homebase.addTodo(`Find deals for ${L.name} (${short(L.details)}) — the search found none`);
    await tellMe(`⚠️ No live deals found for *${L.name}* yet.
${res.summary}

_They haven't been told. The bot searches again if they change what they want or ask for more._`);
    return;
  }

  const chat = await client.getChatById(chatId);
  const brand = config.broker?.brand || `${config.ownerName} · Property deals`;
  const packData = { clientName: L.name, ownerName: config.ownerName, brand, details: L.details, summary: res.summary, deals: res.deals };
  const clientPdf = await renderPackPdf(client.pupBrowser, { ...packData, includeLinks: !!config.broker?.includeLinksForClient });
  const ownerPdf = await renderPackPdf(client.pupBrowser, { ...packData, includeLinks: true });

  const recent = await chat.fetchMessages({ limit: 20 });
  const history = recent.map((m) => ({ fromMe: m.fromMe, text: describe(m) }));
  const first = !(L.packs ?? []).length;
  const note =
    (await writeAsOwner({
      config,
      styleGuide: style.guide,
      contactName: L.name,
      history,
      instruction: `You're about to send them a PDF deal pack with ${res.deals.length} deals that match what they asked for (${short(L.details)}). Say so briefly and ask them to have a look and tell you which ones they like${first ? '' : ', since these are new ones'}. Don't list the deals.`,
    }).catch(() => null)) || `Found ${res.deals.length} deals that match what you're after, have a look and let me know which ones you like 👇`;

  await botSend(chat, note);
  botMedia.add(chatId);
  await client.sendMessage(chatId, new MessageMedia('application/pdf', clientPdf, `Deals for ${L.name}.pdf`), { sendMediaAsDocument: true });

  L.packs = [...(L.packs ?? []), { at: new Date().toISOString(), deals: res.deals.map((d) => ({ title: d.title, area: d.area, price: d.price, strategy: d.strategy, url: d.listingUrl, source: d.source })) }];
  L.stage = 'sent';
  saveJson(paths.leads, leads);
  await syncHomebase(chatId);

  const list = res.deals.map((d, i) => `${i + 1}. ${d.title}, ${d.area} — ${d.price}
   ${d.listingUrl}`).join('\n');
  await client
    .sendMessage(homebaseId || myId, new MessageMedia('application/pdf', ownerPdf, `Deals for ${L.name} (with links).pdf`), {
      sendMediaAsDocument: true,
      caption: `${BOT_TAG} 📦 *Deal pack #${L.packs.length} sent to ${L.name}* (${res.deals.length} deals)

${list}

_Your copy has the listing links; theirs doesn't._`,
    })
    .catch(() => tellMe(`📦 *Deal pack #${L.packs.length} sent to ${L.name}*

${list}`));
}

async function isControlChat(chat) {
  if (chat.id._serialized === homebaseId) return true;
  if (chat.isGroup) return false;
  const contact = await chat.getContact();
  return Boolean(contact.isMe);
}

// ---------- learning ----------
async function relearn({ announce = true } = {}) {
  if (announce) await tellMe('Reading your chats to learn how you text… this takes a few minutes.');
  const chats = await client.getChats();
  const skip = (c) => c.id._serialized === homebaseId || c.id._serialized === myId || inList({ name: c.name }, config.blockList);
  const fresh = await collectSamples(chats, {
    maxChats: config.learn?.chats ?? 60,
    messagesPerChat: config.learn?.messagesPerChat ?? 300,
    skip,
    log: (m) => console.log(m),
  });
  const all = Object.values(fresh.chats).flatMap((c) => c.samples.map((s) => ({ chatName: c.name, ...s })));
  if (all.length < 10) {
    await tellMe("I couldn't find enough of your messages to learn from yet. I'll copy your style from each chat as I go.");
    style = { ...fresh, guide: style.guide };
  } else {
    console.log(`Learning your style from ${all.length} examples…`);
    fresh.guide = (await learnStyle({ config, samples: sample(all, 600) })) ?? style.guide;
    style = fresh;
  }
  saveStyle(STYLE_PATH, style);
  if (announce) await tellMe(`Done. Learned from ${all.length} of your replies across ${Object.keys(style.chats).length} chats. Send !style to see what I picked up.`);
}

// ---------- WhatsApp client ----------
// Stop early with a clear message if the OpenAI key hasn't been set up properly.
const apiKey = process.env.OPENAI_API_KEY || '';
if (!apiKey.startsWith('sk-') || apiKey.includes('paste-your-key')) {
  console.error('\nYour OpenAI key isn\'t set up yet.');
  console.error('Run this, with your real key between the quotes, then start the bot again:\n');
  console.error('  sed -i \'\' \'/OPENAI_API_KEY/d\' ~/.zshrc; echo \'export OPENAI_API_KEY="your-key"\' >> ~/.zshrc && source ~/.zshrc\n');
  process.exit(1);
}

const QR_CODES_BEFORE_GIVING_UP = 5; // too many unscanned codes in a row makes WhatsApp block linking for a while
const executablePath = process.env.CHROME_PATH || undefined; // optional: use an installed Chrome instead of the downloaded one
const linkPhone = normalisePhone(config.linkWithPhoneNumber);
const showWindow = process.argv.includes('--show') || config.showWindow === true;
console.log(`Profile: ${paths.profile}${showWindow ? ' (showing the WhatsApp window)' : ''}`);

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: paths.authDir, clientId: paths.clientId }),
  userAgent: await currentUserAgent(executablePath),
  qrMaxRetries: QR_CODES_BEFORE_GIVING_UP - 1,
  ...(linkPhone ? { pairWithPhoneNumber: { phoneNumber: linkPhone, showNotification: true } } : {}),
  puppeteer: {
    headless: !showWindow, // --show opens a real Chrome window with the bot's WhatsApp in it
    defaultViewport: null,
    executablePath,
    args: process.env.CHROME_NO_SANDBOX ? ['--no-sandbox'] : [],
  },
});

let qrCount = 0;
let everLoggedIn = false;
client.on('qr', async (qr) => {
  if (linkPhone) return; // linking with a pairing code instead
  qrCount++;
  console.clear();
  console.log(`Link this bot (profile "${paths.profile}") to WhatsApp — code ${qrCount} of ${QR_CODES_BEFORE_GIVING_UP}\n`);
  console.log('On the phone with the number you want the bot on:');
  console.log('  • WhatsApp:          Settings → Linked devices → Link a device');
  console.log('  • WhatsApp Business: ⋮ / Settings → Linked devices → Link a device');
  console.log('Scan straight away — each code only works for about 20 seconds, then a new one appears here.\n');
  qrcode.generate(qr, { small: true });
  try {
    const file = await saveAndOpenQr(qr, paths.qrImage);
    console.log(`\nThe same code is saved as a big image (opened in Preview): ${file}`);
  } catch (err) {
    console.log('(Could not save the QR image:', err.message + ')');
  }
});
client.on('code', (code) => {
  console.log('\n────────────────────────────────────────');
  console.log(`  Pairing code:  ${code.slice(0, 4)}-${code.slice(4)}`);
  console.log('────────────────────────────────────────');
  console.log(`On the phone for +${linkPhone}: WhatsApp (or WhatsApp Business) → Linked devices → Link a device →`);
  console.log('"Link with phone number instead", then type the code above. A new code appears every 3 minutes.\n');
});
client.on('authenticated', () => {
  everLoggedIn = true;
  removeQrImage(paths.qrImage);
  console.log('Linked and logged in.');
});
client.on('auth_failure', (m) => console.error('Login failed:', m, '\nRun `npm run reset' + (paths.clientId ? ` -- ${paths.profile}` : '') + '` and start again.'));
client.on('disconnected', (reason) => {
  if (!everLoggedIn) {
    removeQrImage(paths.qrImage);
    console.error(`\nNo code was scanned (${reason}). Stopping here so WhatsApp doesn't block new links.`);
    console.error('Start the bot again when you are ready to scan.');
    process.exit(1);
  }
  if (reason === 'LOGOUT') {
    console.error('\nThis bot was logged out from the phone (Linked devices). Start it again to link it.');
    process.exit(1);
  }
  console.error('Disconnected from WhatsApp:', reason, '– restarting in 10s');
  setTimeout(() => client.initialize(), 10_000);
});

client.on('ready', async () => {
  everLoggedIn = true;
  myId = client.info.wid._serialized;
  const chats = await client.getChats();
  const wanted = (config.homebaseChat || '').trim().toLowerCase();
  const home = chats.find((c) => (c.name || '').trim().toLowerCase() === wanted);
  homebaseId = home?.id._serialized;
  if (!home) {
    console.log(`Couldn't find a chat called "${config.homebaseChat}". Alerts will go to your "Message yourself" chat instead.`);
  }
  console.log(`Bot is running as ${client.info.pushname} (mode: ${config.mode}). Alerts go to: ${home?.name ?? 'Message yourself'}`);
  await tellMe(`Bot is on (${config.mode}). Send !help for commands.`);

  // Restart any deal searches that were running when the bot last stopped.
  for (const [chatId, L] of Object.entries(leads)) {
    if (L.stage === 'searching') queueSearch(chatId);
  }

  // Pick up replies that were waiting when the bot last stopped.
  for (const [chatId, entry] of Object.entries(schedule)) {
    if (!pending.has(chatId)) scheduleReply(chatId, entry);
  }

  const ageDays = style.updatedAt ? (Date.now() - new Date(style.updatedAt)) / 86_400_000 : Infinity;
  if (!style.guide || ageDays > (config.learn?.relearnEveryDays ?? 7)) {
    relearn().catch((err) => console.error('Learning failed:', err.message));
  }
});

// Incoming messages from other people.
client.on('message', (msg) => {
  if (msg.fromMe || msg.isStatus || msg.from === 'status@broadcast') return;
  onIncoming(msg).catch((err) => console.error('Error handling message:', err));
});

// Everything you send: commands, answers in homebase, and your own replies (so the bot steps back and learns).
client.on('message_create', (msg) => {
  if (!msg.fromMe) return;
  onMine(msg).catch((err) => console.error('Error handling your message:', err));
});

async function onIncoming(msg) {
  const chat = await msg.getChat();
  const chatId = chat.id._serialized;
  if (chatId === homebaseId) return;

  const contact = await msg.getContact();
  const name = contact.name || contact.pushname || contact.number || 'Someone';
  const text = describe(msg);
  if (textOf(msg)) lastFromThem.set(chatId, text);
  inbox.push({ time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), contactName: name, text });
  if (inbox.length > 500) inbox.shift();

  // Wait before replying (a set time after their latest message, or a short random pause),
  // so a burst of messages gets one reply, like a person would.
  // Approval mode (business number): a new number, or a deal sourcing lead already handled
  // automatically, is answered almost straight away; anything else is drafted for you quickly.
  const isNew = !contact.isMyContact;
  let delay;
  if (config.approval?.enabled) {
    const instant = isNew || leads[chatId]?.auto;
    delay = rand(instant ? config.approval.instantDelaySeconds ?? [3, 8] : config.approval.draftDelaySeconds ?? [5, 15]);
  } else {
    delay = config.replyAfterMinutes ? config.replyAfterMinutes * 60_000 : rand(config.replyDelaySeconds ?? [10, 40]);
  }
  scheduleReply(chatId, { dueAt: Date.now() + delay, name, number: contact.number || msg.from, isNew });
}

function scheduleReply(chatId, entry) {
  clearTimeout(pending.get(chatId));
  schedule[chatId] = entry;
  saveJson(paths.schedule, schedule);
  pending.set(
    chatId,
    setTimeout(async () => {
      pending.delete(chatId);
      delete schedule[chatId];
      saveJson(paths.schedule, schedule);
      try {
        const chat = await client.getChatById(chatId);
        await handleChat(chat, { name: entry.name, number: entry.number, isNew: entry.isNew });
      } catch (err) {
        console.error('Error replying:', err);
      }
    }, Math.max(entry.dueAt - Date.now(), 5_000)),
  );
}

async function handleChat(chat, person) {
  const chatId = chat.id._serialized;
  const decision = decide({
    config,
    person,
    isGroup: chat.isGroup,
    youRepliedAt: youRepliedAt.get(chatId),
    waitingOnYou: waitingOnYou.get(chatId),
    repliesLastHour: (replyLog.get(chatId) ?? []).filter((t) => Date.now() - t < 3_600_000).length,
  });

  const recent = await chat.fetchMessages({ limit: 25 });
  const theirNew = [];
  for (let i = recent.length - 1; i >= 0 && !recent[i].fromMe; i--) theirNew.unshift(describe(recent[i]));
  const latest = theirNew.join('\n') || '(no new text)';
  console.log(`${person.name}: ${clip(latest, 80)}  →  ${decision.action} (${decision.reason})`);

  if (decision.action === 'ignore' || !theirNew.length) return;
  if (decision.action === 'forward') {
    if (config.notifyMe !== false) await alert(chatId, person.name, `*${person.name}*: ${clip(latest)}\n_(${decision.reason})_`, await chatPicture(person, recent, decision.reason));
    return;
  }

  // Let the AI reply as you, or hold.
  const history = recent.map((m) => ({ fromMe: m.fromMe, text: describe(m) })).filter((m) => !m.text.startsWith(BOT_TAG));
  let result;
  try {
    result = await replyAsOwner({
      config,
      styleGuide: style.guide,
      contactName: person.name,
      contactExamples: style.chats[chatId]?.samples?.slice(-20) ?? [],
      generalExamples: sample(style.general ?? [], 25),
      history,
      dealContext: dealContext(chatId),
    });
  } catch (err) {
    console.error('AI request failed:', err.message);
    await alert(chatId, person.name, `*${person.name}*: ${clip(latest)}\n_(couldn't auto-reply: ${err.message})_`);
    return;
  }

  await trackLead(chatId, person, result?.lead).catch((err) => console.error('Could not post lead:', err.message));

  if (result?.action === 'notify') {
    // A topic you always answer yourself (e.g. joint ventures, Qp Digital): no reply, just tell you.
    const topic = (config.notifyTopics ?? []).find((t) => t.name.toLowerCase() === (result.topic || '').toLowerCase());
    waitingOnYou.set(chatId, true);
    const about = result.about || topic?.name || 'their message';
    const suggestion = topic?.suggestReply && result.suggestedReply ? `\n\n💬 *You could say:*\n${result.suggestedReply}` : '';
    const picture = await chatPicture(person, recent, `${topic?.name ?? 'Needs you'} · not replied`);
    await alert(chatId, person.name, `🔔 *${topic?.name ?? 'Needs you'}* — you have to respond to *${person.name}* about ${about}.\n\n"${clip(latest, 300)}"${suggestion}`, picture);
    await homebase.addTodo(`Respond to ${person.name} about ${about}`);
    remindLater(chatId, person.name, about);
    return;
  }

  if (config.approval?.enabled) {
    // Only deal sourcing chats with new numbers run by themselves; everything else waits for you.
    const auto = leads[chatId]?.auto || (person.isNew && result?.isDealSourcing);
    if (!auto) return askApproval(chatId, person, result, recent, latest);
    if (leads[chatId] && !leads[chatId].auto) {
      leads[chatId].auto = true;
      saveJson(paths.leads, leads);
    }
  }

  if (!result || result.action === 'hold' || !result.messages?.length) {
    const reason = result?.reason || 'needs you';
    await botSend(chat, config.holdMessage || 'hold on');
    waitingOnYou.set(chatId, true);
    const picture = await chatPicture(person, recent, 'Bot said "hold on"');
    await alert(chatId, person.name, `⏸ *${person.name}*: ${clip(latest)}\n\n*Needs you:* ${reason}\n(I told them "${config.holdMessage || 'hold on'}")`, picture);
    await homebase.addTodo(`Reply to ${person.name}: ${reason}`);
    remindLater(chatId, person.name, reason);
    await brokerStep(chat, person, result, recent);
    return;
  }

  for (const [i, text] of result.messages.entries()) {
    if (i > 0) await sleep(rand([1, 4]));
    await botSend(chat, text);
  }
  if (config.notifyMe !== false && config.reportReplies) {
    await tellMe(`*${person.name}*: ${clip(latest, 150)}\n↳ ${result.messages.join(' / ')}`);
  }
  await brokerStep(chat, person, result, recent);
}

async function onMine(msg) {
  const chat = await msg.getChat();
  const chatId = chat.id._serialized;
  const body = (msg.body || '').trim();

  if (await isControlChat(chat)) {
    if (body.startsWith(BOT_TAG)) return;
    if (body.startsWith('!')) return handleCommand(body);
    if (msg.hasQuotedMsg) {
      const quoted = await msg.getQuotedMessage();
      const target = alerts.get(quoted?.id?._serialized);
      if (target) return answer(target, body);
    }
    return;
  }

  // A message in a normal chat: either the bot sent it, or you typed it yourself.
  if (msg.hasMedia && botMedia.has(chatId)) {
    botMedia.delete(chatId);
    return;
  }
  const key = `${chatId}|${body}`;
  if (botSends.has(key)) {
    botSends.delete(key);
    return;
  }
  youRepliedAt.set(chatId, new Date());
  waitingOnYou.delete(chatId);
  clearTimeout(reminders.get(chatId));
  clearTimeout(pending.get(chatId)); // you've answered, so drop any reply the bot had queued
  if (schedule[chatId]) {
    delete schedule[chatId];
    saveJson(paths.schedule, schedule);
  }
  if (textOf(msg)) {
    addSample(style, chatId, chat.name, { them: lastFromThem.get(chatId) ?? null, me: body });
    saveStyleSoon();
  }
}

/** Send your answer (from homebase) to the person, and let the bot carry on in that chat. */
async function answer(target, rawText) {
  const text = rawText.trim();
  if (!text) return;
  if (target.handled) return tellMe(target.superseded ? `${target.name} has sent more since — reply to the newer draft instead.` : `That one for ${target.name} has already been dealt with.`);
  const chat = await client.getChatById(target.chatId);
  const approved = target.draft?.length && APPROVE.test(text);
  const toSend = approved ? target.draft : [text];
  for (const [i, m] of toSend.entries()) {
    if (i > 0) await sleep(rand([1, 3]));
    botSends.add(`${target.chatId}|${m}`);
    await chat.sendMessage(m);
  }
  if (target.draft) {
    target.handled = true;
    awaitingApproval.delete(target.chatId);
  }
  waitingOnYou.delete(target.chatId);
  clearTimeout(reminders.get(target.chatId));
  if (!approved) {
    addSample(style, target.chatId, chat.name, { them: lastFromThem.get(target.chatId) ?? null, me: text });
    saveStyleSoon();
  }
  await tellMe(`${approved ? 'Draft approved and sent' : 'Sent'} to ${target.name}.`);
}

const HELP = `Commands (send them here):
Reply to any alert (swipe right on it) to answer that person. On a draft, reply ✅ to send it as written.
!send N – send draft N as written
!skip N – send nothing for alert N
!reply N text – answer alert N
!done N – you've dealt with alert N, the bot can carry on in that chat
!exclude Name or +44… – never auto-reply to this person (their messages come here)
!include Name or +44… – let the bot reply to them again
!excluded – list excluded people
!block Name or +44… – ignore this person completely
!pause / !resume – stop / restart all auto-replies
!status – current settings
!learn – re-read your chats and relearn how you text
!style – show what it learned about how you text
!digest – AI summary of messages since the last digest`;

async function handleCommand(body) {
  const [cmd, ...rest] = body.split(/\s+/);
  const arg = rest.join(' ').trim();
  const n = parseInt(rest[0], 10);

  switch (cmd.toLowerCase()) {
    case '!help':
      return tellMe(HELP);
    case '!status':
      return tellMe(
        `Mode: *${config.mode}* · Alerts go to: ${homebaseId ? config.homebaseChat : 'Message yourself'}\nExcluded: ${config.excludeList?.length ? config.excludeList.join(', ') : 'nobody'}\nWaiting on you: ${waitingOnYou.size} chat(s)\nStyle learned from ${style.general?.length ?? 0} examples (${style.updatedAt ? new Date(style.updatedAt).toLocaleDateString('en-GB') : 'not yet'})`,
      );
    case '!reply': {
      const target = alertsByNo.get(n);
      if (!target) return tellMe(`No alert #${rest[0] ?? ''}.`);
      return answer(target, rest.slice(1).join(' '));
    }
    case '!send': {
      const target = alertsByNo.get(n);
      if (!target?.draft?.length) return tellMe(`No draft #${rest[0] ?? ''} to send.`);
      return answer(target, '✅');
    }
    case '!skip': {
      const target = alertsByNo.get(n);
      if (!target) return tellMe(`No alert #${rest[0] ?? ''}.`);
      target.handled = true;
      awaitingApproval.delete(target.chatId);
      return tellMe(`OK, nothing sent to ${target.name}.`);
    }
    case '!done': {
      const target = alertsByNo.get(n);
      if (!target) return tellMe(`No alert #${rest[0] ?? ''}.`);
      waitingOnYou.delete(target.chatId);
      clearTimeout(reminders.get(target.chatId));
      return tellMe(`OK, I'll carry on replying to ${target.name}.`);
    }
    case '!exclude':
    case '!include':
    case '!block':
    case '!unblock': {
      if (!arg) return tellMe(`Add a name or number, e.g. ${cmd} Mum`);
      const key = cmd.toLowerCase().includes('block') ? 'blockList' : 'excludeList';
      const list = (config[key] ?? []).filter((e) => e.toLowerCase() !== arg.toLowerCase());
      if (cmd.toLowerCase() === '!exclude' || cmd.toLowerCase() === '!block') list.push(arg);
      config[key] = list;
      saveConfig();
      const msgs = { '!exclude': `I won't reply to ${arg}. Their messages will come here.`, '!include': `I'll reply to ${arg} again.`, '!block': `Ignoring ${arg} completely.`, '!unblock': `${arg} unblocked.` };
      return tellMe(msgs[cmd.toLowerCase()]);
    }
    case '!excluded':
      return tellMe(`Excluded: ${config.excludeList?.length ? config.excludeList.join(', ') : 'nobody'}\nBlocked: ${config.blockList?.length ? config.blockList.join(', ') : 'nobody'}`);
    case '!pause':
      config.mode = 'off';
      saveConfig();
      return tellMe('Paused. Messages will come here without replies. Send !resume to start again.');
    case '!resume':
      config.mode = 'auto';
      saveConfig();
      return tellMe('Back on. Replying automatically.');
    case '!learn':
      return relearn();
    case '!style':
      return tellMe(style.guide ? `What I've learned about how you text:\n\n${clip(style.guide, 3500)}` : "I haven't learned your style yet. Send !learn.");
    case '!digest': {
      if (!inbox.length) return tellMe('No new messages since the last digest.');
      const summary = await summarise({ config, items: inbox });
      inbox.length = 0;
      return tellMe(`Digest:\n\n${summary ?? 'Could not summarise this time.'}`);
    }
    default:
      return tellMe(`Unknown command.\n\n${HELP}`);
  }
}

async function shutdown() {
  console.log('\nShutting down…');
  saveStyle(STYLE_PATH, style);
  setTimeout(() => process.exit(0), 5000).unref(); // don't hang if the browser won't close
  await client.destroy().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('Starting WhatsApp… (first start downloads a browser and can take a minute)');
client.initialize().catch((err) => {
  if (/could not find chrome|browser was not found|executable doesn't exist|failed to launch/i.test(err.message)) {
    console.error('\nThe browser the bot needs isn\'t installed yet. Run this, then start the bot again:\n');
    console.error('  npx puppeteer browsers install chrome\n');
  } else {
    console.error('\nCould not start WhatsApp:', err.message);
  }
  process.exit(1);
});
