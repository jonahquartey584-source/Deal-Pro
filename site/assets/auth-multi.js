// Online sign-in: email + password accounts kept by this server.
const $ = (s) => document.querySelector(s);
const gate = $("#authGate"), form = $("#authForm"), message = $("#authMessage");
let mode = "login", saveTimer, signedIn = null;
const api = async (path, options = {}) => {
  const r = await fetch(path, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong.");
  return d;
};
const showMessage = (t, bad = false) => { message.textContent = t; message.classList.toggle("bad", bad); message.hidden = !t; };
function setMode(next) {
  mode = next;
  $("#authNameWrap").hidden = mode !== "signup";
  $("#authEmailWrap").hidden = false; $("#authEmail").required = true;
  $("#authConfirmWrap").hidden = true; $("#authConfirm").required = false;
  $("#forgotPassword").hidden = mode !== "login";
  $("#authSwitch").hidden = false; $("#authClose").hidden = false; $("#authOauth").hidden = true;
  $("#authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("#authPasswordLabel").textContent = "Password";
  $("#authSubmit").textContent = mode === "signup" ? "Create account" : "Sign in";
  $("#authTitle").textContent = mode === "signup" ? "Create your account" : "Welcome back";
  $("#authSwitch").textContent = mode === "signup" ? "Already have an account? Sign in" : "New to Deal Pro? Create an account";
  $("#authPassword").value = ""; showMessage("");
}
function openAccount(next = "login") { setMode(next); gate.hidden = false; setTimeout(() => $("#authEmail")?.focus(), 0); }
function closeAccount() { gate.hidden = true; showMessage(""); }
function signedOut() {
  gate.hidden = true;
  document.body.classList.remove("auth-pending");
  document.body.classList.add("signed-out", "simple-mode");
}
async function load(user) {
  const { state } = await api("/api/account-state");
  const text = JSON.stringify(state);
  if (localStorage.getItem("dealpro:state") !== text || localStorage.getItem("dealpremium:active-user") !== user.id) {
    localStorage.setItem("dealpro:state", text);
    localStorage.setItem("dealpremium:active-user", user.id);
    if (!sessionStorage.getItem("dealpremium:reloaded")) { sessionStorage.setItem("dealpremium:reloaded", "1"); location.reload(); return; }
  }
  sessionStorage.removeItem("dealpremium:reloaded");
  signedIn = user;
  $(".ws-name").textContent = user.name || user.email;
  $("#accountEmail").textContent = user.email;
  document.body.dataset.userId = user.id;
  document.body.dataset.userEmail = user.email;
  if (user.admin) $("#adminLink").hidden = false;
  gate.hidden = true;
  document.body.classList.remove("auth-pending", "signed-out");
  document.body.classList.add("simple-mode");
  window.dispatchEvent(new Event("dealpro:signed-in"));
}
async function boot() {
  try {
    const { user } = await api("/api/auth/me");
    if (!user) { signedOut(); window.go?.("home"); return; }
    await load(user);
  } catch { signedOut(); }
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#authSubmit"); button.disabled = true;
  try {
    showMessage(mode === "signup" ? "Creating your account…" : "Signing you in…");
    const { user } = await api(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
      method: "POST", body: JSON.stringify({ email: $("#authEmail").value.trim(), password: $("#authPassword").value, name: $("#authName").value.trim() }),
    });
    localStorage.removeItem("dealpremium:active-user");
    await load(user);
  } catch (error) { showMessage(error.message || "Unable to continue. Please try again.", true); }
  finally { button.disabled = false; }
});
$("#authSwitch").addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));
$("#authClose").addEventListener("click", closeAccount);
$("#homeSignIn").addEventListener("click", () => openAccount("login"));
$("#homeCreateAccount").addEventListener("click", () => openAccount("signup"));
gate.addEventListener("click", (e) => { if (e.target === gate) closeAccount(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !gate.hidden) closeAccount(); });
document.addEventListener("click", (event) => {
  if (signedIn) return;
  if (!event.target.closest('[data-go="find"],[data-go="analyser"],[data-go="analyse"],[data-go="deals"],[data-go="community"],[data-plan],#pwPro,#pwMax')) return;
  event.preventDefault(); event.stopImmediatePropagation(); openAccount("login");
}, true);
$("#forgotPassword").addEventListener("click", () => showMessage("Password resets are handled by Deal Pro support. Contact the person who gave you access.", true));
$("#signOut").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  for (const k of ["dealpro:state", "dealpremium:active-user"]) localStorage.removeItem(k);
  location.reload();
});
window.addEventListener("dealpro:state-saved", (event) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api("/api/account-state", { method: "PUT", body: JSON.stringify({ state: event.detail }) }).catch(() => window.dispatchEvent(new CustomEvent("dealpro:save-error"))), 350);
});
setMode("login");
boot();
