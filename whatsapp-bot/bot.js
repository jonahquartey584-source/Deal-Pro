// Personal WhatsApp assistant. Runs on your Mac, linked to your WhatsApp like WhatsApp Web.
// Control it by messaging yourself (the "Message yourself" chat) – send !help to see commands.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-terminal';
import wweb from 'whatsapp-web.js';
import { decide } from './src/rules.js';
import { draftReply, summarise } from './src/ai.js';

const { Client, LocalAuth } = wweb;
const here = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(here, 'config.json');
const BOT_TAG = '🤖'; // every message the bot sends to you starts with this, so it never reacts to itself

// ---------- config ----------
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(path.join(here, 'config.example.json'), CONFIG_PATH);
    console.log('Created config.json from config.example.json – edit it to customise the bot.');
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
const lastAutoReply = new Map(); // chatId -> Date of last automatic reply
const drafts = new Map(); // draft number -> { chatId, contactName, text }
let nextDraft = 1;
const inbox = []; // messages since the last digest
let myId;

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () => {
  const [min, max] = config.replyDelaySeconds ?? [5, 20];
  return (min + Math.random() * (max - min)) * 1000;
};
const clip = (text, n = 300) => (text.length > n ? text.slice(0, n) + '…' : text);

function describe(msg) {
  if (msg.type === 'chat') return msg.body;
  const kinds = { image: 'a photo', video: 'a video', ptt: 'a voice note', audio: 'audio', document: 'a document', sticker: 'a sticker', location: 'a location', vcard: 'a contact' };
  const label = `[sent ${kinds[msg.type] ?? msg.type}]`;
  return msg.body ? `${label} ${msg.body}` : label;
}

async function tellMe(text) {
  if (!myId) return;
  await client.sendMessage(myId, `${BOT_TAG} ${text}`);
}

async function sendReply(chat, text) {
  await chat.sendStateTyping().catch(() => {});
  await sleep(randomDelay());
  await chat.sendMessage(text);
  lastAutoReply.set(chat.id._serialized, new Date());
}

// ---------- WhatsApp client ----------
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(here, '.wwebjs_auth') }),
  puppeteer: {
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined, // optional: use an installed Chrome instead of the downloaded one
    args: process.env.CHROME_NO_SANDBOX ? ['--no-sandbox'] : [],
  },
});

client.on('qr', (qr) => {
  console.log('\nScan this with WhatsApp on your phone: Settings → Linked devices → Link a device\n');
  qrcode.generate(qr, { small: true });
});
client.on('authenticated', () => console.log('Logged in.'));
client.on('auth_failure', (m) => console.error('Login failed:', m));
client.on('disconnected', (reason) => {
  console.error('Disconnected from WhatsApp:', reason, '– restarting in 10s');
  setTimeout(() => client.initialize(), 10_000);
});
client.on('ready', async () => {
  myId = client.info.wid._serialized;
  console.log(`Bot is running as ${client.info.pushname} (mode: ${config.mode}).`);
  await tellMe(`Bot is on. Mode: *${config.mode}*. Send !help for commands.`);
});

// Incoming messages from other people.
client.on('message', async (msg) => {
  try {
    if (msg.fromMe || msg.isStatus || msg.from === 'status@broadcast') return;
    await handleIncoming(msg);
  } catch (err) {
    console.error('Error handling message:', err);
  }
});

// Everything you send, including notes to yourself – used for commands.
client.on('message_create', async (msg) => {
  try {
    if (!msg.fromMe || !msg.body?.startsWith('!')) return;
    const chat = await msg.getChat();
    const contact = await chat.getContact();
    if (!contact.isMe) return; // commands only work in your own "Message yourself" chat
    await handleCommand(msg.body.trim());
  } catch (err) {
    console.error('Error handling command:', err);
  }
});

async function handleIncoming(msg) {
  const chat = await msg.getChat();
  const contact = await msg.getContact();
  const contactName = contact.name || contact.pushname || contact.number || 'Someone';
  const number = contact.number || msg.from;
  const text = describe(msg);
  const where = chat.isGroup ? ` in ${chat.name}` : '';

  inbox.push({ time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), contactName: contactName + where, text });
  if (inbox.length > 500) inbox.shift();

  const decision = decide({
    config,
    number,
    isGroup: chat.isGroup,
    text,
    lastAutoReplyAt: lastAutoReply.get(chat.id._serialized),
  });
  console.log(`${contactName}${where}: ${clip(text, 80)}  →  ${decision.action} (${decision.reason})`);

  if (decision.action === 'ignore') return;

  if (decision.action === 'notify') {
    if (config.notifyMe) await tellMe(`*${contactName}*${where}: ${clip(text)}\n_(${decision.reason})_`);
    return;
  }

  if (decision.action === 'fixed') {
    await sendReply(chat, decision.reply);
    if (config.notifyMe) await tellMe(`*${contactName}*: ${clip(text)}\n↳ auto-replied (${decision.reason}): "${decision.reply}"`);
    return;
  }

  // AI reply
  const recent = await chat.fetchMessages({ limit: 15 });
  const history = recent.map((m) => ({ fromMe: m.fromMe, author: m.fromMe ? null : contactName, text: describe(m) }));
  let reply;
  try {
    reply = await draftReply({ config, contactName, history });
  } catch (err) {
    console.error('Claude request failed:', err.message);
    if (config.notifyMe) await tellMe(`*${contactName}*: ${clip(text)}\n_(AI reply failed: ${err.message})_`);
    return;
  }

  if (!reply) {
    if (config.notifyMe) await tellMe(`*${contactName}*: ${clip(text)}\n_(needs you – no auto-reply)_`);
    return;
  }

  if (config.mode === 'auto') {
    await sendReply(chat, reply);
    if (config.notifyMe) await tellMe(`*${contactName}*: ${clip(text)}\n↳ replied: "${reply}"`);
  } else {
    const n = nextDraft++;
    drafts.set(n, { chatId: chat.id._serialized, contactName, text: reply });
    await tellMe(`*${contactName}*: ${clip(text)}\n\nDraft *#${n}*: ${reply}\n\n!send ${n} · !edit ${n} <new text> · !skip ${n}`);
  }
}

const HELP = `Commands (send them here, in your own chat):
!status – current settings
!mode auto | draft | off – how replies are handled
!pause / !resume – same as !mode off / !mode draft
!send N – send draft N
!edit N your text – send your own text instead of draft N
!skip N – throw away draft N
!drafts – list waiting drafts
!digest – AI summary of messages since the last digest
!quiet on | off – turn quiet hours on or off
!vip +44... – never auto-reply to this number
!block +44... – ignore this number completely`;

async function handleCommand(body) {
  const [cmd, ...rest] = body.split(/\s+/);
  const arg = rest.join(' ');
  const draftNo = parseInt(rest[0], 10);

  switch (cmd.toLowerCase()) {
    case '!help':
      return tellMe(HELP);
    case '!status':
      return tellMe(`Mode: *${config.mode}* · AI: ${config.ai?.enabled ? 'on' : 'off'} · Quiet hours: ${config.quietHours?.enabled ? `${config.quietHours.start}–${config.quietHours.end}` : 'off'} · Drafts waiting: ${drafts.size} · Messages since digest: ${inbox.length}`);
    case '!mode':
      if (!['auto', 'draft', 'off'].includes(arg)) return tellMe('Use !mode auto, !mode draft or !mode off');
      config.mode = arg;
      saveConfig();
      return tellMe(`Mode set to *${arg}*.`);
    case '!pause':
      config.mode = 'off';
      saveConfig();
      return tellMe('Paused. You will still get alerts. Send !resume to start again.');
    case '!resume':
      config.mode = config.mode === 'off' ? 'draft' : config.mode;
      saveConfig();
      return tellMe(`Resumed in *${config.mode}* mode.`);
    case '!send':
    case '!edit': {
      const draft = drafts.get(draftNo);
      if (!draft) return tellMe(`No draft #${rest[0] ?? ''}.`);
      const text = cmd.toLowerCase() === '!edit' ? rest.slice(1).join(' ') : draft.text;
      if (!text) return tellMe('Add your text after the number, e.g. !edit 3 Sounds good!');
      await client.sendMessage(draft.chatId, text);
      lastAutoReply.set(draft.chatId, new Date());
      drafts.delete(draftNo);
      return tellMe(`Sent to ${draft.contactName}.`);
    }
    case '!skip':
      drafts.delete(draftNo);
      return tellMe(`Draft #${rest[0]} discarded.`);
    case '!drafts':
      if (!drafts.size) return tellMe('No drafts waiting.');
      return tellMe([...drafts].map(([n, d]) => `#${n} → ${d.contactName}: ${d.text}`).join('\n'));
    case '!digest': {
      if (!inbox.length) return tellMe('No new messages since the last digest.');
      const summary = await summarise({ config, items: inbox });
      inbox.length = 0;
      return tellMe(`Digest:\n\n${summary ?? 'Could not summarise this time.'}`);
    }
    case '!quiet':
      config.quietHours.enabled = arg === 'on';
      saveConfig();
      return tellMe(`Quiet hours ${config.quietHours.enabled ? 'on' : 'off'}.`);
    case '!vip':
    case '!block': {
      if (!arg) return tellMe(`Add a number, e.g. ${cmd} +44 7700 900123`);
      const key = cmd.toLowerCase() === '!vip' ? 'vipList' : 'blockList';
      config[key] = [...(config[key] ?? []), arg];
      saveConfig();
      return tellMe(`Added ${arg} to ${key}.`);
    }
    default:
      return tellMe(`Unknown command. ${HELP}`);
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down…');
  await client.destroy().catch(() => {});
  process.exit(0);
});

console.log('Starting WhatsApp… (first start downloads a browser and can take a minute)');
client.initialize();
