// Local sign-in: no password screen. Loads the account and keeps it saved, like the live site.
const $ = (s) => document.querySelector(s);
const api = async (path, options = {}) => {
  const r = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong.");
  return d;
};
async function boot() {
  try {
    const { user, state } = await api("/api/account-state");
    const text = JSON.stringify(state);
    if (localStorage.getItem("dealpro:state") !== text || localStorage.getItem("dealpremium:active-user") !== user.id) {
      localStorage.setItem("dealpro:state", text);
      localStorage.setItem("dealpremium:active-user", user.id);
      if (!sessionStorage.getItem("dealpremium:reloaded")) { sessionStorage.setItem("dealpremium:reloaded", "1"); location.reload(); return; }
    }
    sessionStorage.removeItem("dealpremium:reloaded");
    $(".ws-name").textContent = user.name || user.email;
    $("#accountEmail").textContent = user.email;
    document.body.dataset.userId = user.id;
    document.body.dataset.userEmail = user.email;
    $("#adminLink").hidden = false;
    $("#authGate").hidden = true;
    document.body.classList.remove("auth-pending");
    document.body.classList.add("simple-mode");
    window.dispatchEvent(new Event("dealpro:signed-in"));
  } catch (e) {
    document.body.classList.remove("auth-pending");
    document.body.innerHTML = "<p style='font:16px sans-serif;padding:40px'>Deal Pro could not start: " + e.message + "</p>";
  }
}
let timer;
window.addEventListener("dealpro:state-saved", (event) => {
  clearTimeout(timer);
  timer = setTimeout(() => api("/api/account-state", { method: "PUT", body: JSON.stringify({ state: event.detail }) }).catch(() => window.dispatchEvent(new CustomEvent("dealpro:save-error"))), 350);
});
const signOut = $("#signOut"); if (signOut) signOut.addEventListener("click", () => location.reload());
boot();
