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
  box.innerHTML = list.length ? list.map((a) => `<article class="row" data-user="${esc(a.userId)}"><div><div class="email">${esc(a.email)}</div><div class="sub">${esc(a.userId)} · ${a.savedDeals} saved deal${a.savedDeals === 1 ? "" : "s"}</div></div><select data-plan aria-label="Membership for ${esc(a.email)}">${[["Free","Free"],["Pro","Premium"],["Max5","Max 5x"],["Max20","Max 20x"],["TeamStd","Team Standard"],["TeamPrem","Team Premium"]].map(([v,n]) => `<option value="${v}"${a.plan===v?" selected":""}>${n}</option>`).join("")}</select><button class="btn" data-enabled>${a.enabled ? "Suspend" : "Reactivate"}</button><div class="status">${a.enabled ? "Active" : "Suspended"}</div><div class="actions"><button class="btn danger" data-delete>Delete data</button></div></article>`).join("") : `<div class="empty">No matching customer accounts.</div>`;
}
async function load() { const data = await api(); accounts = data.accounts; status.textContent = `${accounts.length} customer account${accounts.length === 1 ? "" : "s"}`; render(); }
box.addEventListener("change", async (event) => { const row=event.target.closest("[data-user]"); if(!row||!event.target.matches("[data-plan]"))return; await api({method:"PATCH",body:JSON.stringify({userId:row.dataset.user,plan:event.target.value})}); status.textContent="Membership updated."; await load(); });
box.addEventListener("click", async (event) => { const row=event.target.closest("[data-user]"); if(!row)return; const item=accounts.find((a)=>a.userId===row.dataset.user); if(event.target.matches("[data-enabled]")){await api({method:"PATCH",body:JSON.stringify({userId:item.userId,enabled:!item.enabled})});await load();} if(event.target.matches("[data-delete]")&&confirm(`Delete all stored Deal Pro data for ${item.email}? This cannot be undone.`)){await api({method:"DELETE",body:JSON.stringify({userId:item.userId})});await load();} });
search.addEventListener("input", render);
(async()=>{const user=await getUser();if(!user||user.email?.toLowerCase()!==ADMIN_EMAIL){status.textContent="Administrator access required. Sign in with the administrator email on the Deal Pro homepage.";box.innerHTML='<div class="empty"><a href="/" style="color:white">Return to Deal Pro</a></div>';return}await load().catch((error)=>{status.textContent=error.message;box.innerHTML='<div class="empty">Unable to load accounts.</div>'})})();
