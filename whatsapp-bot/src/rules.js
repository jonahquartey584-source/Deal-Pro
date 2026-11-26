// Pure decision logic: given an incoming message and the config, decide what to do.
// Kept free of WhatsApp and network code so it can be tested on its own.

/** Strip everything but digits, so "+44 7700 900123" and "447700900123@c.us" compare equal. */
export function digits(value) {
  return String(value ?? '').replace(/@.*$/, '').replace(/\D/g, '');
}

/** True when the number appears in the list (entries may be written with +, spaces or dashes). */
export function inList(number, list = []) {
  const n = digits(number);
  return n !== '' && list.some((entry) => digits(entry) === n);
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

/** First keyword rule whose words appear in the message (whole-word, case-insensitive). */
export function matchKeyword(text, keywordReplies = []) {
  const lower = String(text ?? '').toLowerCase();
  return (
    keywordReplies.find((rule) =>
      (rule.match ?? []).some((word) => {
        const escaped = String(word).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|\\W)${escaped}($|\\W)`).test(lower);
      }),
    ) ?? null
  );
}

/**
 * Decide how to handle one incoming message.
 *
 * Returns { action, reason, reply? } where action is one of:
 *   "ignore"  - do nothing at all
 *   "notify"  - only tell the owner about it
 *   "fixed"   - send a fixed reply (keyword or quiet-hours message)
 *   "ai"      - ask Claude for a reply (sent or drafted depending on mode)
 */
export function decide({ config, number, isGroup, text, now = new Date(), lastAutoReplyAt }) {
  if (isGroup && !config.replyToGroups) return { action: 'ignore', reason: 'group chat' };
  if (inList(number, config.blockList)) return { action: 'ignore', reason: 'blocked contact' };
  if (config.allowList?.length && !inList(number, config.allowList)) {
    return { action: 'notify', reason: 'not on allow list' };
  }
  if (inList(number, config.vipList)) return { action: 'notify', reason: 'VIP: you reply yourself' };
  if (config.mode === 'off') return { action: 'notify', reason: 'bot is paused' };

  const cooldownMs = (config.cooldownMinutes ?? 0) * 60_000;
  if (lastAutoReplyAt && now - lastAutoReplyAt < cooldownMs) {
    return { action: 'notify', reason: 'already replied recently' };
  }

  const keyword = matchKeyword(text, config.keywordReplies);
  if (keyword) return { action: 'fixed', reason: `keyword "${keyword.match[0]}"`, reply: keyword.reply };

  if (isQuietTime(config.quietHours, now)) {
    return { action: 'fixed', reason: 'quiet hours', reply: config.quietHours.message };
  }

  if (config.ai?.enabled) return { action: 'ai', reason: 'AI reply' };
  if (config.fallbackReply) return { action: 'fixed', reason: 'fallback reply', reply: config.fallbackReply };
  return { action: 'notify', reason: 'no rule matched' };
}
