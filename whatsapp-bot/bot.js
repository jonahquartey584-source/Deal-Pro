// Personal WhatsApp auto-replier. Runs on your Mac, linked to your WhatsApp like WhatsApp Web.
// It learns how you text, replies to everyone like you would, and when something needs you
// it says "hold on" and sends the message to your homebase chat (default: "Qp Homebase").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-terminal';
import wweb from 'whatsapp-web.js';
import { decide, inList } from './src/rules.js';
import { learnStyle, replyAsOwner, summarise, LEAD_FIELDS } from './src/ai.js';
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
async function alert(chatId, name, body, picture) {
  const n = alertNo++;
  const text = `${body}\n\n_Reply to this message to answer ${name}, or send !reply ${n} <text>. !done ${n} lets the bot carry on._`;
  let sent;
  if (picture && (homebaseId || myId)) {
    sent = await client.sendMessage(homebaseId || myId, picture, { caption: `${BOT_TAG} ${text}` }).catch((err) => {
      console.error('Could not send chat picture:', err.message);
      return null;
    });
  }
  sent ??= await tellMe(text);
  const target = { chatId, name };
  alertsByNo.set(n, target);
  if (sent?.id?._serialized) alerts.set(sent.id._serialized, target);
}

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
  leads[chatId] = { name: person.name, number: person.number, details, updatedAt: new Date().toISOString() };
  saveJson(paths.leads, leads);
  const labels = { lookingFor: 'Looking for', strategy: 'Strategy', areas: 'Areas', budget: 'Budget', timeline: 'Timeline', finance: 'Finance', notes: 'Notes' };
  const lines = Object.entries(details).map(([k, v]) => `• *${labels[k]}:* ${v}`).join('\n');
  const plan = config.leadTasks.plan ? `\n*Plan:* ${config.leadTasks.plan}` : '';
  await tellMe(`📋 *${isNew ? 'New deal sourcing task' : 'Deal sourcing task updated'}* — ${person.name}${person.number ? ` (+${String(person.number).replace(/\D/g, '')})` : ''}${plan}\n${lines}\n\n_Task: find deals that match and send them over._`);
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
const QR_CODES_BEFORE_GIVING_UP = 5; // too many unscanned codes in a row makes WhatsApp block linking for a while
const executablePath = process.env.CHROME_PATH || undefined; // optional: use an installed Chrome instead of the downloaded one
const linkPhone = normalisePhone(config.linkWithPhoneNumber);
console.log(`Profile: ${paths.profile}`);

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: paths.authDir, clientId: paths.clientId }),
  userAgent: await currentUserAgent(executablePath),
  qrMaxRetries: QR_CODES_BEFORE_GIVING_UP - 1,
  ...(linkPhone ? { pairWithPhoneNumber: { phoneNumber: linkPhone, showNotification: true } } : {}),
  puppeteer: {
    headless: true,
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
  const delay = config.replyAfterMinutes ? config.replyAfterMinutes * 60_000 : rand(config.replyDelaySeconds ?? [10, 40]);
  scheduleReply(chatId, { dueAt: Date.now() + delay, name, number: contact.number || msg.from });
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
        await handleChat(chat, { name: entry.name, number: entry.number });
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
    remindLater(chatId, person.name, about);
    return;
  }

  if (!result || result.action === 'hold' || !result.messages?.length) {
    const reason = result?.reason || 'needs you';
    await botSend(chat, config.holdMessage || 'hold on');
    waitingOnYou.set(chatId, true);
    const picture = await chatPicture(person, recent, 'Bot said "hold on"');
    await alert(chatId, person.name, `⏸ *${person.name}*: ${clip(latest)}\n\n*Needs you:* ${reason}\n(I told them "${config.holdMessage || 'hold on'}")`, picture);
    remindLater(chatId, person.name, reason);
    return;
  }

  for (const [i, text] of result.messages.entries()) {
    if (i > 0) await sleep(rand([1, 4]));
    await botSend(chat, text);
  }
  if (config.notifyMe !== false && config.reportReplies) {
    await tellMe(`*${person.name}*: ${clip(latest, 150)}\n↳ ${result.messages.join(' / ')}`);
  }
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
  const chat = await client.getChatById(target.chatId);
  botSends.add(`${target.chatId}|${text}`);
  await chat.sendMessage(text);
  waitingOnYou.delete(target.chatId);
  clearTimeout(reminders.get(target.chatId));
  addSample(style, target.chatId, chat.name, { them: lastFromThem.get(target.chatId) ?? null, me: text });
  saveStyleSoon();
  await tellMe(`Sent to ${target.name}.`);
}

const HELP = `Commands (send them here):
Reply to any alert (swipe right on it) to answer that person.
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
client.initialize();
