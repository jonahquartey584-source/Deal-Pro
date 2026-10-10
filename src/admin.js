import { getUser } from "@netlify/identity";

const ADMIN_EMAIL = "jonahquartey584@gmail.com";
const box = document.querySelector("#accounts");
const status = document.querySelector("#status");
const search = document.querySelector("#search");
let accounts = [];

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
async function api(options = {}) {
  const response = await fetch("/api/admin/accounts", { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
const STRAT_NAME = { R2SA: "R2SA", R2R: "R2R", BTL: "BTL", HMO: "HMO", BRRR: "BRRR", Flip: "Flip", LeaseOption: "Lease option", SA: "Owned SA", Commercial: "Commercial", Other: "Other" };
const DAYS = [[7, "7 days"], [14, "14 days"], [30, "30 days"], [60, "60 days"], [90, "90 days"], [180, "6 months"], [365, "1 year"]];
const fmtDay = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
// When the account was made, in UK time, as dd/mm/yy hh:mm: "09/10/26 14:05".
const fmtJoined = (iso) => { const d = new Date(iso); if (Number.isNaN(+d)) return ""; const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value])); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`; };
// "Referral access": how long a plan the admin has given lasts. Hidden for plans a customer pays for through Stripe.
// How much they've used Deal Pro: finished Deal Finder searches, deal analyses and due diligence research.
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const activityLine = (x) => {
  if (!x) return "";
  const last = [x.lastSearchAt, x.lastAnalysisAt, x.lastResearchAt].filter(Boolean).sort().pop();
  return [plural(x.searches || 0, "Deal Finder search", "Deal Finder searches"), plural(x.analyses || 0, "analysis", "analyses"),
    ...(x.research ? [plural(x.research, "due diligence check", "due diligence checks")] : []),
    ...(last && fmtJoined(last) ? [`last used ${fmtJoined(last)}`] : [])].join(" · ");
};
const daysLeft = (iso) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
const expiryPicker = (a) => a.plan === "Free" || a.subscribed ? `<div class="sub">${a.subscribed ? "Paid via Stripe" : "Free plan"}</div>` : `<div class="exp"><select data-days aria-label="How long ${esc(a.email)} keeps this plan"><option value="keep" selected>${a.expiresAt ? `Until ${esc(fmtJoined(new Date(Date.parse(a.expiresAt) - 1000).toISOString()).slice(0, 8))} (${daysLeft(a.expiresAt)}d left)` : "No end date"}</option>${DAYS.map(([d, n]) => `<option value="${d}">Ends in ${n}</option>`).join("")}<option value="custom">Number of days…</option><option value="date">Pick an end date…</option>${a.expiresAt ? '<option value="none">Remove end date</option>' : ""}</select><form class="exp-edit" data-exp hidden><label class="sub" data-exp-label for="exp-${esc(a.userId)}"></label><input class="exp-in" id="exp-${esc(a.userId)}" required><div class="exp-btns"><button class="btn" type="submit">Save</button><button class="btn" type="button" data-exp-cancel>Cancel</button></div></form></div>`;
function render() {
  const query = search.value.trim().toLowerCase();
  const list = accounts.filter((a) => `${a.name} ${a.company} ${a.email}`.toLowerCase().includes(query));
  box.innerHTML = list.length ? list.map((a) => `<article class="row" data-user="${esc(a.userId)}"><div><div class="email">${esc(a.name || "No name given")}</div><div class="sub">${esc(a.email)}</div>${a.company || a.strategy ? `<div class="sub">${esc([a.company, STRAT_NAME[a.strategy] || a.strategy].filter(Boolean).join(" · "))}</div>` : ""}<div class="sub">${a.createdAt && fmtJoined(a.createdAt) ? `Joined ${esc(fmtJoined(a.createdAt))} · ` : ""}${esc(a.userId)} · ${a.savedDeals} saved deal${a.savedDeals === 1 ? "" : "s"}</div>${activityLine(a.activity) ? `<div class="sub use">${esc(activityLine(a.activity))}</div>` : ""}</div><select data-plan aria-label="Membership for ${esc(a.email)}">${[["Free","Free"],["Lite","Deal Community"],["Pro","Premium"],["Max5","Max 5x"],["Max20","Max 20x"]].map(([v,n]) => `<option value="${v}"${a.plan===v?" selected":""}>${n}</option>`).join("")}</select>${expiryPicker(a)}<button class="btn" data-enabled>${a.enabled ? "Suspend" : "Reactivate"}</button><div class="status">${a.enabled ? "Active" : "Suspended"}</div><div class="actions"><button class="btn danger" data-delete>Delete data</button></div></article>`).join("") : `<div class="empty">No matching customer accounts.</div>`;
}
async function load() { const data = await api(); accounts = data.accounts; status.textContent = `${accounts.length} customer account${accounts.length === 1 ? "" : "s"}`; render(); }
box.addEventListener("change", async (event) => { if (event.target.matches("[data-days]")) { const row = event.target.closest("[data-user]"); const v = event.target.value; if (!row || v === "keep") return; if (v === "custom" || v === "date") { openExpiry(row, v); return; } try { await api({ method: "PATCH", body: JSON.stringify({ userId: row.dataset.user, days: v === "none" ? null : Number(v) }) }); await load(); status.textContent = v === "none" ? "End date removed." : "Access length updated."; } catch (error) { status.textContent = error.message; await load(); } return; } const row=event.target.closest("[data-user]"); if(!row||!event.target.matches("[data-plan]"))return; await api({method:"PATCH",body:JSON.stringify({userId:row.dataset.user,plan:event.target.value})}); status.textContent="Membership updated."; await load(); });
box.addEventListener("click", async (event) => { const row=event.target.closest("[data-user]"); if(!row)return; const item=accounts.find((a)=>a.userId===row.dataset.user); if(event.target.matches("[data-enabled]")){await api({method:"PATCH",body:JSON.stringify({userId:item.userId,enabled:!item.enabled})});await load();} if(event.target.matches("[data-delete]")&&confirm(`Delete all stored Deal Pro data for ${item.email}? This cannot be undone.`)){await api({method:"DELETE",body:JSON.stringify({userId:item.userId})});await load();} });
// Custom access length: a number of days from today, or the last day they keep the plan.
const isoDay = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
function openExpiry(row, mode) {
  const form = row.querySelector("[data-exp]"), input = form.querySelector("input"), label = form.querySelector("[data-exp-label]");
  const item = accounts.find((a) => a.userId === row.dataset.user);
  form.dataset.mode = mode; form.hidden = false;
  if (mode === "date") {
    label.textContent = "Last day of access"; input.type = "date"; input.min = isoDay(Date.now() + 86_400_000); input.max = isoDay(Date.now() + 3650 * 86_400_000);
    input.value = item?.expiresAt ? isoDay(Date.parse(item.expiresAt) - 1000) : isoDay(Date.now() + 30 * 86_400_000);
  } else {
    label.textContent = "Days from today"; input.type = "number"; input.min = "1"; input.max = "3650"; input.step = "1"; input.inputMode = "numeric";
    input.value = item?.expiresAt ? String(Math.max(1, daysLeft(item.expiresAt))) : "30";
  }
  input.focus();
}
box.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-exp]"); if (!form) return; event.preventDefault();
  const row = form.closest("[data-user]"), v = form.querySelector("input").value;
  const body = form.dataset.mode === "date" ? { userId: row.dataset.user, until: v } : { userId: row.dataset.user, days: Number(v) };
  try { await api({ method: "PATCH", body: JSON.stringify(body) }); await load(); status.textContent = form.dataset.mode === "date" ? `Access now lasts until the end of ${v.split("-").reverse().join("/").replace(/\/(\d\d)(\d\d)$/, "/$2")}.` : `Access now ends in ${v} day${v === "1" ? "" : "s"}.`; }
  catch (error) { status.textContent = error.message; }
});
box.addEventListener("click", (event) => { const c = event.target.closest("[data-exp-cancel]"); if (!c) return; const form = c.closest("[data-exp]"); form.hidden = true; const sel = form.closest(".exp").querySelector("[data-days]"); sel.value = "keep"; });
search.addEventListener("input", render);

// ---------- refund requests ----------
const rfBox = document.querySelector("#refundReqs");
const rfStatus = document.querySelector("#rfStatus");
const RF_LABEL = { pending: "Waiting", refunded: "Refunded", approved_manual: "Approved: refund by hand in Stripe", declined: "Declined" };
let refundReqs = [];
async function rfApi(options = {}) {
  const response = await fetch("/api/refunds" + (options.method ? "" : "?all=1"), { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function renderRefunds() {
  const pending = refundReqs.filter((r) => r.status === "pending").length;
  rfBox.innerHTML = refundReqs.length ? refundReqs.map((r) => `<article class="rfrow" data-rf="${esc(r.id)}"><div><div class="email">${esc(r.email)}</div><div class="sub">${esc(r.plan)} plan · requested ${new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div><div class="sub ${r.status === "refunded" ? "ok" : ""}">${esc(RF_LABEL[r.status] || r.status)}${r.amount ? ` · ${esc(r.amount)}` : ""}${r.note ? ` · ${esc(r.note)}` : ""}</div></div><div class="reason">${esc(r.reason)}</div><div class="acts">${r.status === "pending" ? '<button class="btn" data-approve>Approve refund</button><button class="btn danger" data-decline>Decline</button>' : ""}</div></article>`).join("") : '<div class="empty">No refund requests.</div>';
  rfStatus.textContent = pending ? `${pending} waiting for a decision.` : "";
}
async function loadRefunds() { const data = await rfApi(); refundReqs = data.requests; if (!data.stripeConnected) rfStatus.dataset.manual = "1"; renderRefunds(); if (!data.stripeConnected) rfStatus.textContent += " Stripe isn't connected for refunds yet, so approving marks the request and you refund by hand in Stripe."; }
rfBox.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-rf]"); if (!row) return;
  const item = refundReqs.find((r) => r.id === row.dataset.rf);
  let body;
  if (event.target.matches("[data-approve]")) {
    if (!confirm(`Refund ${item.email}'s latest payment, cancel their subscription and move them to Free?`)) return;
    body = { id: item.id, action: "approve" };
  } else if (event.target.matches("[data-decline]")) {
    const note = prompt(`Decline ${item.email}'s request. Optional note for the customer:`, "");
    if (note === null) return;
    body = { id: item.id, action: "decline", note };
  } else return;
  event.target.disabled = true;
  try { await rfApi({ method: "PATCH", body: JSON.stringify(body) }); await loadRefunds(); await load(); }
  catch (error) { alert(error.message); event.target.disabled = false; }
});
(async()=>{const user=await getUser();if(!user||user.email?.toLowerCase()!==ADMIN_EMAIL){status.textContent="Administrator access required. Sign in with the administrator email on the Deal Pro homepage.";box.innerHTML='<div class="empty"><a href="/" style="color:white">Return to Deal Pro</a></div>';rfBox.innerHTML='';return}await load().catch((error)=>{status.textContent=error.message;box.innerHTML='<div class="empty">Unable to load accounts.</div>'});await loadRefunds().catch((error)=>{rfBox.innerHTML=`<div class="empty">${esc(error.message)}</div>`})})();
