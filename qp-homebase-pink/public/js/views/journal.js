import { S, save, today, fmtDate, esc, uid, rerender, openSheet, closeSheet, toast } from "../app.js";

export const title = "Journal";
const MOODS = ["😊", "🥰", "😌", "😐", "😴", "😢", "😤", "🙏"];

export function render(el) {
  const entries = [...S.journal].sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || ""));
  el.innerHTML = `
  <div class="card"><h2>${fmtDate(today(), { weekday: "long", day: "numeric", month: "long" })}</h2>
    <div class="row wrap" id="moods" style="margin:6px 0">${MOODS.map((m) => `<button class="chip" data-m="${m}">${m}</button>`).join("")}</div>
    <textarea class="input" id="txt" placeholder="How was your day? What are you grateful for?"></textarea>
    <button class="btn primary" id="saveBtn" style="width:100%;margin-top:8px">Save entry</button></div>
  ${entries.length ? entries.map((j) => `<div class="card" style="padding:12px 14px"><div class="row spread"><b>${j.mood || ""} ${fmtDate(j.date)}</b><button class="x" data-edit="${j.id}">⋯</button></div><div style="white-space:pre-wrap;margin-top:4px">${esc(j.text)}</div></div>`).join("") : `<div class="empty">Your entries will appear here.</div>`}`;
  let mood = "";
  el.querySelector("#moods").onclick = (e) => { const b = e.target.closest("[data-m]"); if (!b) return; mood = mood === b.dataset.m ? "" : b.dataset.m; el.querySelectorAll("#moods .chip").forEach((c) => c.classList.toggle("on", c.dataset.m === mood)); };
  el.querySelector("#saveBtn").onclick = () => {
    const text = el.querySelector("#txt").value.trim(); if (!text) return toast("Write something first");
    S.journal.push({ id: uid(), date: today(), time: new Date().toTimeString().slice(0, 5), mood, text }); save(); toast("Saved ✨"); rerender();
  };
  el.onclick = (e) => {
    const b = e.target.closest("[data-edit]"); if (!b) return;
    const j = S.journal.find((x) => x.id === b.dataset.edit);
    openSheet(`<h2>${fmtDate(j.date)}</h2><input class="input" id="m" value="${esc(j.mood)}" style="width:70px"><textarea class="input" id="t" style="min-height:40dvh;margin-top:8px">${esc(j.text)}</textarea>
      <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button><button class="btn danger" id="del">Delete</button><button class="btn" data-close>Cancel</button></div>`, (c) => {
      c.querySelector("#ok").onclick = () => { j.text = c.querySelector("#t").value.trim(); j.mood = c.querySelector("#m").value.trim(); save(); closeSheet(); rerender(); };
      c.querySelector("#del").onclick = () => { if (!confirm("Delete this entry?")) return; S.journal = S.journal.filter((x) => x !== j); save(); closeSheet(); rerender(); };
    });
  };
}
