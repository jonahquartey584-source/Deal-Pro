import { S, api, today, nowHM, esc, replaceData, go } from "../app.js";

export const title = "Ask Jay";
export const subtitle = () => "Your assistant";
let chat = [];
const SUGGEST = ["Plan my meals for this week from my favourites", "Add cleaning the bathroom every Saturday", "I spent £24.50 at Tesco today", "Make me a savings plan for a £1,000 holiday by August", "What's on today?"];

export function render(el) {
  el.innerHTML = `
  <div class="card"><div class="chat" id="chat">
    <div class="msg assistant">Hi ${esc(S.profile.name || "RubyQp")} 💕 I'm Jay. I can add tasks, chores, meals, recipes, money and to-dos for you, or help you plan. What do you need?</div>
    ${chat.map((m) => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join("")}
  </div></div>
  ${chat.length ? "" : `<div class="row wrap">${SUGGEST.map((s) => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>`}
  <form id="f" class="row" style="position:sticky;bottom:calc(env(safe-area-inset-bottom) + 76px);margin-top:12px">
    <input class="input grow" id="q" placeholder="Message Jay…" autocomplete="off"><button class="btn primary" id="send">Send</button></form>
  ${chat.length ? `<button class="btn small ghost" id="clear" style="margin-top:8px">New chat</button>` : ""}`;
  const box = el.querySelector("#chat");
  const ask = async (text) => {
    if (!text.trim()) return;
    chat.push({ role: "user", content: text });
    box.insertAdjacentHTML("beforeend", `<div class="msg user">${esc(text)}</div><div class="msg assistant" id="typing">…</div>`);
    el.querySelector("#q").value = ""; window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    try {
      const r = await api("POST", "/api/assistant", { messages: chat, today: today(), now: nowHM() });
      if (r.changed && r.data) replaceData(r.data, r.rev);
      chat.push({ role: "assistant", content: r.reply || "Done." });
    } catch (e) {
      chat.push({ role: "assistant", content: e.status === 401 ? "I need an Anthropic API key first — add one in Settings ⚙︎." : `Sorry, something went wrong: ${e.message}` });
    }
    go("jay", {}, false);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight }), 50);
  };
  el.querySelector("#f").onsubmit = (e) => { e.preventDefault(); ask(el.querySelector("#q").value); };
  el.onclick = (e) => {
    const b = e.target.closest("[data-s]"); if (b) ask(b.dataset.s);
    if (e.target.id === "clear") { chat = []; go("jay", {}, false); }
  };
}
