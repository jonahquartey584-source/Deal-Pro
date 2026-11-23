import { S, save, today, addDays, mondayOf, fmtDate, DAY_LONG, esc, uid, rerender, setParams, openSheet, closeSheet, toast, weekday } from "../app.js";
import { SLOTS, mealEntry, mealName, mealCalories, dayCalories, recipeById, shoppingFor } from "./shared.js";

export const title = "Meal planner";
const EMOJI = ["🥗", "🍝", "🍲", "🥘", "🍛", "🍳", "🥞", "🌮", "🍜", "🥑", "🍓", "🍰"];
const emojiFor = (r) => r.emoji || EMOJI[[...r.name].reduce((a, c) => a + c.charCodeAt(0), 0) % EMOJI.length];
const imgStyle = (r) => (r.image ? `background-image:url('${esc(r.image)}')` : "");

export function render(el, p) {
  const tab = p.tab || "plan", date = p.date || today(), mon = mondayOf(date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const favs = S.recipes.filter((r) => r.fav);
  const seg = `<div class="seg" style="margin-top:4px">${[["plan", "Week plan"], ["favs", "Favourites"], ["recipes", "Recipes"], ["shop", "Shopping"]].map(([k, n]) => `<button class="${tab === k ? "on" : ""}" data-tab="${k}">${n}</button>`).join("")}</div>`;
  const nav = (label) => `<div class="row spread" style="margin:12px 0 4px"><button class="btn small" data-shift="-7">‹</button><b>${label} ${fmtDate(mon, { day: "numeric", month: "short" })}</b><button class="btn small" data-shift="7">›</button></div>`;
  const target = +S.calorieTarget || 2000;
  let body = "";

  if (tab === "plan") {
    const weekCals = week.map(dayCalories), planned = weekCals.filter(Boolean);
    body = nav("Week of") + `
    <div class="grid3">
      <div class="stat"><div class="k">Week total</div><div class="v">${weekCals.reduce((a, b) => a + b, 0).toLocaleString()}</div><div class="small muted">kcal</div></div>
      <div class="stat"><div class="k">Daily average</div><div class="v">${planned.length ? Math.round(planned.reduce((a, b) => a + b, 0) / planned.length) : 0}</div><div class="small muted">kcal</div></div>
      <button class="stat" data-act="target" style="text-align:left"><div class="k">Daily goal ✎</div><div class="v">${target}</div><div class="small muted">kcal</div></button>
    </div>
    ${favs.length ? `<h3 style="margin:16px 0 4px">Your favourites <span class="small muted">— tap to add to the week</span></h3>${favCarousel(favs)}` : ""}
    <div class="card">${week.map((d, i) => {
      const c = weekCals[i];
      return `<div class="plan-day"><div class="row spread"><b>${d === today() ? "Today · " : ""}${fmtDate(d)}</b><span class="small" style="color:${c > target ? "var(--bad)" : "var(--muted)"}">${c ? `${c} kcal` : ""}</span></div>
        ${SLOTS.map((s) => { const e = mealEntry(d, s); return `<div class="slot"><span class="n">${s}</span><button class="m ${e ? "filled" : ""}" data-slot="${s}" data-date="${d}">${e ? `${esc(mealName(e))}${e.portions > 1 ? ` ×${e.portions}` : ""} <span class="small muted">· ${mealCalories(e)} kcal</span>` : `<span class="muted">+ add</span>`}</button></div>`; }).join("")}
        ${c ? `<div class="bar ${c > target ? "over" : ""}" style="margin-top:6px"><i style="width:${Math.min(100, (c / target) * 100)}%"></i></div>` : ""}</div>`;
    }).join("")}</div>
    <div class="row"><button class="btn grow" data-tab="shop">🛒 Make my shopping list</button><button class="btn" data-act="clearWeek">Clear week</button></div>`;
  } else if (tab === "favs") {
    body = favs.length ? `<h3 style="margin:14px 0 4px">Scroll through your favourites</h3>${favCarousel(favs, true)}
      <div class="card"><ul class="list">${favs.map((r) => recipeRow(r)).join("")}</ul></div>`
      : `<div class="card"><div class="empty">No favourites yet. Save a recipe and tap ♥ to make it a favourite.</div><button class="btn primary" data-act="newRecipe" style="width:100%">+ Save a recipe</button></div>`;
  } else if (tab === "recipes") {
    const q = (p.q || "").toLowerCase();
    const list = S.recipes.filter((r) => !q || r.name.toLowerCase().includes(q) || (r.ingredients || []).join(" ").toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    body = `<div class="row" style="margin-top:12px"><input class="input grow" id="q" placeholder="Search recipes or ingredients" value="${esc(p.q || "")}"><button class="btn primary" data-act="newRecipe">+ New</button></div>
      <div class="card">${list.length ? `<ul class="list">${list.map((r) => recipeRow(r)).join("")}</ul>` : `<div class="empty">${S.recipes.length ? "No matches" : "Save recipes you like here."}</div>`}</div>`;
  } else {
    const items = shoppingFor(mon, 7), wk = mon;
    const checked = S.shopping.checked[wk] || {};
    body = nav("Shopping for week of") + `
    <div class="card"><div class="row spread"><h2>From your meal plan</h2><button class="btn small" data-act="copy">Copy list</button></div>
    ${items.length ? `<ul class="list">${items.map((it) => `<li class="item ${checked[it.key] ? "done" : ""}"><button class="check ${checked[it.key] ? "on" : ""}" data-act="tick" data-key="${esc(it.key)}">${checked[it.key] ? "✓" : ""}</button><span class="t">${esc(it.label)}<div class="small muted">${esc(it.recipes.join(", "))}</div></span></li>`).join("")}</ul>` : `<div class="empty">Plan meals from saved recipes and their ingredients appear here, added up for the week.</div>`}</div>
    <div class="card"><h2>Extras</h2>
      <form id="extra" class="row"><input class="input grow" id="ex" placeholder="Add something else (e.g. toilet roll)"><button class="btn primary">Add</button></form>
      <ul class="list">${S.shopping.extra.map((x) => `<li class="item ${x.done ? "done" : ""}"><button class="check ${x.done ? "on" : ""}" data-act="tickExtra" data-id="${x.id}">${x.done ? "✓" : ""}</button><span class="t">${esc(x.name)}</span><button class="x" data-act="delExtra" data-id="${x.id}">✕</button></li>`).join("")}</ul>
      ${S.shopping.extra.some((x) => x.done) ? `<button class="btn small" data-act="clearExtra">Clear ticked</button>` : ""}</div>`;
  }
  el.innerHTML = seg + body;

  el.querySelector("#q")?.addEventListener("input", (e) => { clearTimeout(window.__q); window.__q = setTimeout(() => { setParams({ q: e.target.value }); const i = document.querySelector("#q"); i?.focus(); i?.setSelectionRange(99, 99); }, 300); });
  el.querySelector("#extra")?.addEventListener("submit", (e) => { e.preventDefault(); const v = el.querySelector("#ex").value.trim(); if (!v) return; S.shopping.extra.push({ id: uid(), name: v, done: false }); save(); rerender(); });

  el.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tab) return setParams({ tab: b.dataset.tab });
    if (b.dataset.shift) return setParams({ date: addDays(date, +b.dataset.shift) });
    if (b.dataset.slot) return slotSheet(b.dataset.date, b.dataset.slot);
    const a = b.dataset.act, id = b.dataset.id;
    if (a === "open") recipeSheet(recipeById(id), mon);
    if (a === "fav") { const r = recipeById(id); r.fav = !r.fav; save(); rerender(); }
    if (a === "newRecipe") editRecipe(null);
    if (a === "target") { const v = prompt("Daily calorie goal", target); if (v && +v > 0) { S.calorieTarget = +v; save(); rerender(); } }
    if (a === "clearWeek" && confirm("Clear this week's meal plan?")) { week.forEach((d) => delete S.mealPlan[d]); save(); rerender(); }
    if (a === "tick") { const wk = mon; S.shopping.checked[wk] ||= {}; const k = b.dataset.key; S.shopping.checked[wk][k] = !S.shopping.checked[wk][k]; save(); rerender(); }
    if (a === "tickExtra") { const x = S.shopping.extra.find((y) => y.id === id); x.done = !x.done; save(); rerender(); }
    if (a === "delExtra") { S.shopping.extra = S.shopping.extra.filter((y) => y.id !== id); save(); rerender(); }
    if (a === "clearExtra") { S.shopping.extra = S.shopping.extra.filter((y) => !y.done); save(); rerender(); }
    if (a === "copy") {
      const ch = S.shopping.checked[mon] || {};
      const text = [...shoppingFor(mon, 7).filter((i) => !ch[i.key]).map((i) => "• " + i.label), ...S.shopping.extra.filter((x) => !x.done).map((x) => "• " + x.name)].join("\n");
      navigator.clipboard?.writeText(text).then(() => toast("Shopping list copied"), () => toast("Couldn't copy"));
    }
  };
}

function favCarousel(favs, big) {
  return `<div class="hscroll">${favs.map((r) => `<button class="recipe-card" data-act="open" data-id="${r.id}" style="text-align:left;padding:0">
    <div class="img" style="${imgStyle(r)}${big ? ";height:170px" : ""}">${r.image ? "" : emojiFor(r)}</div>
    <div class="body"><b>${esc(r.name)}</b><div class="small muted">${r.calories ? `${r.calories} kcal / serving` : "Calories not set"}</div></div></button>`).join("")}</div>`;
}
function recipeRow(r) {
  return `<li class="item"><button class="btn ghost small" data-act="open" data-id="${r.id}" style="flex:1;text-align:left;border:0;padding:0;display:flex;gap:10px;align-items:center">
    <span style="width:46px;height:46px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:1.4rem;background:linear-gradient(135deg,var(--blob1),var(--blob2));background-size:cover;background-position:center;${imgStyle(r)}">${r.image ? "" : emojiFor(r)}</span>
    <span class="t"><b>${esc(r.name)}</b><div class="small muted">${r.calories || 0} kcal · serves ${r.servings || 1}</div></span></button>
    <button class="x" data-act="fav" data-id="${r.id}" style="color:var(--accent);font-size:1.3rem" aria-label="Favourite">${r.fav ? "♥" : "♡"}</button></li>`;
}

// pick a meal for one slot
function slotSheet(date, slot) {
  const cur = mealEntry(date, slot);
  const favs = S.recipes.filter((r) => r.fav), others = S.recipes.filter((r) => !r.fav);
  openSheet(`<h2 style="text-transform:capitalize">${slot} · ${fmtDate(date)}</h2>
    ${favs.length ? `<label class="field">From your favourites</label>${favCarousel(favs)}` : ""}
    ${others.length ? `<label class="field">Other recipes</label><div class="row wrap">${others.map((r) => `<button class="chip" data-act="open" data-id="${r.id}">${esc(r.name)}</button>`).join("")}</div>` : ""}
    ${!S.recipes.length ? `<p class="muted small">No saved recipes yet — type a meal below, or save recipes in the Recipes tab.</p>` : ""}
    <label class="field">Portions</label><input class="input" id="portions" type="number" min="0.5" step="0.5" value="${cur?.portions || 1}">
    <label class="field">Or type something quick</label>
    <div class="row"><input class="input grow" id="txt" placeholder="e.g. Toast & eggs" value="${cur && !cur.recipeId ? esc(cur.text) : ""}"><input class="input" id="kc" type="number" inputmode="numeric" placeholder="kcal" style="width:90px" value="${cur && !cur.recipeId ? cur.calories || "" : ""}"></div>
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button>${cur ? `<button class="btn danger" id="clr">Remove</button>` : ""}<button class="btn" data-close>Cancel</button></div>`, (c) => {
    const put = (entry) => { S.mealPlan[date] ||= {}; S.mealPlan[date][slot] = entry; save(); closeSheet(); rerender(); };
    c.onclick = (e) => { const b = e.target.closest('[data-act="open"]'); if (b) put({ recipeId: b.dataset.id, portions: +c.querySelector("#portions").value || 1 }); };
    c.querySelector("#ok").onclick = () => {
      const t = c.querySelector("#txt").value.trim();
      if (t) put({ text: t, calories: +c.querySelector("#kc").value || 0 });
      else if (cur?.recipeId) put({ ...cur, portions: +c.querySelector("#portions").value || 1 });
      else toast("Pick a recipe or type a meal");
    };
    c.querySelector("#clr")?.addEventListener("click", () => { delete S.mealPlan[date][slot]; save(); closeSheet(); rerender(); });
  });
}

// view a recipe + add it to the week
function recipeSheet(r, mon) {
  if (!r) return;
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  openSheet(`<div class="recipe-card" style="max-width:none;margin:-4px 0 10px"><div class="img" style="height:170px;${imgStyle(r)}">${r.image ? "" : emojiFor(r)}</div></div>
    <div class="row spread"><h2>${esc(r.name)}</h2><button class="x" id="fav" style="font-size:1.5rem;color:var(--accent)">${r.fav ? "♥" : "♡"}</button></div>
    <div class="small muted">${r.calories || 0} kcal per serving · serves ${r.servings || 1}</div>
    <div class="card" style="margin:10px 0"><h3 style="margin-top:0">Add to the week</h3>
      <div class="grid2"><select class="input" id="d">${days.map((d) => `<option value="${d}" ${d === today() ? "selected" : ""}>${DAY_LONG[weekday(d)]} ${+d.slice(8)}</option>`).join("")}</select>
      <select class="input" id="s">${SLOTS.map((s) => `<option value="${s}" ${s === "dinner" ? "selected" : ""}>${s[0].toUpperCase() + s.slice(1)}</option>`).join("")}</select></div>
      <button class="btn primary" id="add" style="width:100%;margin-top:8px">Add to plan</button></div>
    ${(r.ingredients || []).length ? `<h3>Ingredients</h3><ul style="margin:0;padding-left:20px">${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
    ${r.method ? `<h3>Method</h3><div style="white-space:pre-wrap">${esc(r.method)}</div>` : ""}
    <div class="row" style="margin-top:14px"><button class="btn grow" id="edit">Edit</button><button class="btn" data-close>Close</button></div>`, (c) => {
    c.querySelector("#fav").onclick = () => { r.fav = !r.fav; save(); c.querySelector("#fav").textContent = r.fav ? "♥" : "♡"; rerender(); };
    c.querySelector("#add").onclick = () => { const d = c.querySelector("#d").value, s = c.querySelector("#s").value; S.mealPlan[d] ||= {}; S.mealPlan[d][s] = { recipeId: r.id, portions: 1 }; save(); closeSheet(); toast(`${r.name} added to ${DAY_LONG[weekday(d)]} ${s}`); rerender(); };
    c.querySelector("#edit").onclick = () => editRecipe(r);
  });
}

function editRecipe(r) {
  const isNew = !r; r ||= { name: "", servings: 1, calories: "", ingredients: [], method: "", fav: true, image: "" };
  let image = r.image || "";
  openSheet(`<h2>${isNew ? "Save a recipe" : "Edit recipe"}</h2>
    <label class="field">Name</label><input class="input" id="n" value="${esc(r.name)}" autofocus>
    <div class="grid2"><div><label class="field">Calories per serving</label><input class="input" id="kc" type="number" inputmode="numeric" value="${r.calories || ""}"></div><div><label class="field">Serves</label><input class="input" id="sv" type="number" min="1" value="${r.servings || 1}"></div></div>
    <label class="field">Ingredients (one per line, e.g. “200 g chicken breast”)</label><textarea class="input" id="ing" rows="6">${esc((r.ingredients || []).join("\n"))}</textarea>
    <label class="field">Method</label><textarea class="input" id="m">${esc(r.method || "")}</textarea>
    <label class="field">Photo (optional)</label><div class="row"><input type="file" accept="image/*" id="img" class="input grow">${image ? `<button class="btn small" id="noimg">Remove</button>` : ""}</div>
    <label class="row" style="margin-top:10px;gap:8px"><input type="checkbox" id="fv" ${r.fav ? "checked" : ""}> Favourite ♥</label>
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button>${isNew ? "" : `<button class="btn danger" id="del">Delete</button>`}<button class="btn" data-close>Cancel</button></div>`, (c) => {
    c.querySelector("#img").onchange = async (e) => { const f = e.target.files[0]; if (f) { image = await shrink(f); toast("Photo added"); } };
    c.querySelector("#noimg")?.addEventListener("click", () => { image = ""; toast("Photo removed"); });
    c.querySelector("#ok").onclick = () => {
      const v = (id) => c.querySelector(id).value.trim();
      if (!v("#n")) return toast("Give the recipe a name");
      Object.assign(r, { name: v("#n"), calories: +v("#kc") || 0, servings: +v("#sv") || 1, ingredients: v("#ing").split("\n").map((s) => s.trim()).filter(Boolean), method: v("#m"), fav: c.querySelector("#fv").checked, image });
      if (isNew) S.recipes.push({ id: uid(), ...r });
      save(); closeSheet(); toast("Recipe saved"); rerender();
    };
    c.querySelector("#del")?.addEventListener("click", () => { if (!confirm(`Delete ${r.name}?`)) return; S.recipes = S.recipes.filter((x) => x !== r); save(); closeSheet(); rerender(); });
  });
}

// resize a photo so it stays small in the saved data
function shrink(file, max = 640) {
  return new Promise((res) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      res(cv.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = () => res("");
    img.src = url;
  });
}
