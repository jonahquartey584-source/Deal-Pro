// Collects examples of how you text and keeps them in style.json (stays on your Mac, never committed).
import fs from 'node:fs';

const MAX_PER_CHAT = 30;
const MAX_GENERAL = 400;

export function loadStyle(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { updatedAt: null, guide: '', chats: {}, general: [] };
  }
}

export function saveStyle(file, style) {
  fs.writeFileSync(file, JSON.stringify(style, null, 2));
}

/** Plain text of a message, or null for media / system messages we can't learn from. */
export function textOf(msg) {
  if (msg.type !== 'chat') return null;
  const body = msg.body?.trim();
  return body || null;
}

/**
 * Turn a chat's messages (oldest first) into examples of { them, me }:
 * what they last said, and everything you sent back before they spoke again.
 */
export function pairsFrom(messages) {
  const pairs = [];
  let them = [];
  let me = [];
  const flush = () => {
    if (me.length) pairs.push({ them: them.slice(-3).join('\n') || null, me: me.join('\nME: ') });
    them = [];
    me = [];
  };
  for (const m of messages) {
    const text = textOf(m);
    if (!text) continue;
    if (m.fromMe) {
      if (text.startsWith('🤖')) continue; // the bot's own notes
      me.push(text);
    } else {
      if (me.length) flush();
      them.push(text);
    }
  }
  flush();
  return pairs;
}

/** Add one new example (used when you reply to someone yourself, so it keeps learning). */
export function addSample(style, chatId, chatName, sample) {
  const chat = (style.chats[chatId] ??= { name: chatName, samples: [] });
  chat.name = chatName;
  chat.samples.push(sample);
  if (chat.samples.length > MAX_PER_CHAT) chat.samples.shift();
  style.general.push({ chatName, ...sample });
  if (style.general.length > MAX_GENERAL) style.general.shift();
}

/** Random pick of n items. */
export function sample(list, n) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/**
 * Read your recent chats and rebuild the examples.
 * `chats` are whatsapp-web.js Chat objects; `skip(chat)` filters out ones to ignore.
 */
export async function collectSamples(chats, { maxChats = 60, messagesPerChat = 300, skip = () => false, log = () => {} }) {
  const style = { updatedAt: new Date().toISOString(), guide: '', chats: {}, general: [] };
  const picked = chats
    .filter((c) => !c.isGroup && !skip(c))
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, maxChats);

  for (const [i, chat] of picked.entries()) {
    log(`Reading chat ${i + 1}/${picked.length}: ${chat.name}`);
    let messages = [];
    try {
      messages = await chat.fetchMessages({ limit: messagesPerChat });
    } catch {
      continue;
    }
    const pairs = pairsFrom(messages);
    if (!pairs.length) continue;
    style.chats[chat.id._serialized] = { name: chat.name, samples: pairs.slice(-MAX_PER_CHAT) };
    for (const p of pairs.slice(-15)) style.general.push({ chatName: chat.name, ...p });
  }
  style.general = sample(style.general, MAX_GENERAL);
  return style;
}
