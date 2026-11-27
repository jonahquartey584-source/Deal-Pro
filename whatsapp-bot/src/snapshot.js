// Draws a WhatsApp-style picture of a conversation, to send to the homebase chat.
// Rendered in a separate browser tab, so the real chat is never opened (and never marked as read).

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * messages: [{ fromMe, text, time }] oldest first.
 * Returns the HTML for one chat picture.
 */
export function chatHtml({ title, subtitle, messages }) {
  const bubbles = messages
    .map(
      (m) => `<div class="row ${m.fromMe ? 'me' : 'them'}"><div class="bubble">${esc(m.text).replace(/\n/g, '<br>')}<span class="time">${esc(m.time ?? '')}</span></div></div>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.35 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Noto Color Emoji", sans-serif; }
  #card { width: 520px; background: #efeae2; }
  header { background: #075e54; color: #fff; padding: 12px 16px; }
  header b { display: block; font-size: 16px; }
  header span { font-size: 12px; opacity: .85; }
  .chat { padding: 12px 10px 14px; }
  .row { display: flex; margin: 3px 0; }
  .row.me { justify-content: flex-end; }
  .bubble { max-width: 80%; padding: 6px 9px 16px; border-radius: 8px; position: relative; color: #111b21; word-wrap: break-word; box-shadow: 0 1px .5px rgba(0,0,0,.13); min-width: 60px; }
  .them .bubble { background: #fff; border-top-left-radius: 0; }
  .me .bubble { background: #d9fdd3; border-top-right-radius: 0; }
  .time { position: absolute; right: 8px; bottom: 3px; font-size: 11px; color: #667781; }
  </style></head><body><div id="card"><header><b>${esc(title)}</b><span>${esc(subtitle ?? '')}</span></header><div class="chat">${bubbles}</div></div></body></html>`;
}

/** Screenshot the chat card with an existing puppeteer browser. Returns base64 PNG. */
export async function renderChatPng(browser, data) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 520, height: 600, deviceScaleFactor: 2 });
    await page.setContent(chatHtml(data), { waitUntil: 'load' });
    const card = await page.$('#card');
    return await card.screenshot({ encoding: 'base64' });
  } finally {
    await page.close().catch(() => {});
  }
}
