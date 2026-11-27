// Pure decision logic: given an incoming message and the current state, decide what to do.
// Kept free of WhatsApp and network code so it can be tested on its own.

/** Strip everything but digits, so "+44 7700 900123" and "447700900123@c.us" compare equal. */
export function digits(value) {
  return String(value ?? '').replace(/@.*$/, '').replace(/\D/g, '');
}

/**
 * True when the person is in the list. Entries can be phone numbers in any format
 * ("+44 7700 900123") or contact names as saved in your phone ("Mum").
 */
export function inList({ number, name }, list = []) {
  const n = digits(number);
  const nm = String(name ?? '').trim().toLowerCase();
  return list.some((entry) => {
    const e = String(entry).trim();
    const d = digits(e);
    if (d.length >= 6) return d === n; // looks like a phone number
    return e.toLowerCase() === nm && nm !== '';
  });
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

/** True when `date` falls inside quiet hours. Handles ranges that cross midnight (22:00 to 08:00). */
export function isQuietTime(quietHours, date = new Date()) {
  if (!quietHours?.enabled) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

/**
 * Decide how to handle one incoming message.
 *
 * Returns { action, reason } where action is one of:
 *   "ignore"  - do nothing (group, blocked, or you're chatting with them yourself right now)
 *   "forward" - don't reply, just send it to your homebase chat
 *   "ai"      - let the bot handle it (reply in your style, or "hold on" + forward)
 */
export function decide({
  config,
  person, // { number, name }
  isGroup,
  now = new Date(),
  youRepliedAt, // last time YOU typed in this chat yourself
  waitingOnYou, // the bot said "hold on" here and you haven't answered yet
  repliesLastHour = 0,
}) {
  if (isGroup && !config.replyToGroups) return { action: 'ignore', reason: 'group chat' };
  if (inList(person, config.blockList)) return { action: 'ignore', reason: 'blocked' };

  const takeoverMs = (config.youTakeOverMinutes ?? 15) * 60_000;
  if (youRepliedAt && now - youRepliedAt < takeoverMs) {
    return { action: 'ignore', reason: "you're chatting with them yourself" };
  }

  if (inList(person, config.excludeList)) return { action: 'forward', reason: 'excluded: you reply to them yourself' };
  if (config.mode === 'off') return { action: 'forward', reason: 'bot is paused' };
  if (waitingOnYou) return { action: 'forward', reason: 'waiting on you (already said hold on)' };
  if (repliesLastHour >= (config.maxRepliesPerChatPerHour ?? 20)) {
    return { action: 'forward', reason: 'reply limit for this chat reached' };
  }
  if (isQuietTime(config.quietHours, now)) return { action: 'forward', reason: 'quiet hours' };

  return { action: 'ai', reason: 'automated' };
}
