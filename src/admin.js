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
function render() {
  const query = search.value.trim().toLowerCase();
  const list = accounts.filter((a) => String(a.email).toLowerCase().includes(query));
  box.innerHTML = list.length ? list.map((a) => `<article class="row" data-user="${esc(a.userId)}"><div><div class="email">${esc(a.email)}</div><div class="sub">${esc(a.userId)} · ${a.savedDeals} saved deal${a.savedDeals === 1 ? "" : "s"}</div></div><select data-plan aria-label="Membership for ${esc(a.email)}">${[["Free","Free"],["Pro","Premium"],["Max5","Max 5x"],["Max20","Max 20x"]].map(([v,n]) => `<option value="${v}"${a.plan===v?" selected":""}>${n}</option>`).join("")}</select><button class="btn" data-enabled>${a.enabled ? "Suspend" : "Reactivate"}</button><div class="status">${a.enabled ? "Active" : "Suspended"}</div><div class="actions"><button class="btn danger" data-delete>Delete data</button></div></article>`).join("") : `<div class="empty">No matching customer accounts.</div>`;
}
async function load() { const data = await api(); accounts = data.accounts; status.textContent = `${accounts.length} customer account${accounts.length === 1 ? "" : "s"}`; render(); }
box.addEventListener("change", async (event) => { const row=event.target.closest("[data-user]"); if(!row||!event.target.matches("[data-plan]"))return; await api({method:"PATCH",body:JSON.stringify({userId:row.dataset.user,plan:event.target.value})}); status.textContent="Membership updated."; await load(); });
box.addEventListener("click", async (event) => { const row=event.target.closest("[data-user]"); if(!row)return; const item=accounts.find((a)=>a.userId===row.dataset.user); if(event.target.matches("[data-enabled]")){await api({method:"PATCH",body:JSON.stringify({userId:item.userId,enabled:!item.enabled})});await load();} if(event.target.matches("[data-delete]")&&confirm(`Delete all stored Deal Pro data for ${item.email}? This cannot be undone.`)){await api({method:"DELETE",body:JSON.stringify({userId:item.userId})});await load();} });
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
