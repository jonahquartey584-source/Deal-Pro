import {
  AuthError,
  acceptInvite,
  getSettings,
  getUser,
  handleAuthCallback,
  login,
  logout,
  oauthLogin,
  onAuthChange,
  refreshSession,
  requestPasswordRecovery,
  signup,
  updateUser,
} from "@netlify/identity";

const $ = (selector) => document.querySelector(selector);

// ---------- staying signed in ----------
// The access token lasts an hour and is renewed with a refresh token. Three things used to sign
// people out: the library deletes the whole saved session if a single refresh fails (a network
// blip, a laptop waking up, or two tabs refreshing at once with the same one-time refresh
// token); browsers drop cookies the page writes (Safari after 7 days); and a failed account load
// at start-up was treated as signed out. This keeps one refresh at a time across tabs, retries
// network errors, backs the session up, and has the server re-issue the cookies.
// Signing out still ends the session everywhere, and a revoked refresh token still signs out.
const REMEMBER_SECONDS = 60 * 60 * 24 * 90; // rolling: renewed on every visit and token refresh
const STORE_KEY = "gotrue.user";
const BACKUP_KEY = "dealpro:session-backup";
const SIGNED_OUT_KEY = "dealpro:signed-out";
const readCookie = (name) => document.cookie.split("; ").find((c) => c.startsWith(name + "="))?.slice(name.length + 1) || "";
const writeCookie = (name, value) => {
  document.cookie = `${name}=${value}; path=/; max-age=${REMEMBER_SECONDS}; secure; samesite=lax`;
};
const readJSON = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
const tokenOf = (saved) => (saved?.token?.access_token && saved?.token?.refresh_token ? saved.token : null);
const expiresMs = (token) => { const e = Number(token?.expires_at) || 0; return e > 1e12 ? e : e * 1000; };
const realFetch = window.fetch.bind(window);

function backupSession() {
  const saved = readJSON(STORE_KEY);
  if (tokenOf(saved)) try { localStorage.setItem(BACKUP_KEY, JSON.stringify(saved)); } catch {}
}
// If the saved session vanished without the user signing out, put the backup back.
function restoreSession() {
  if (localStorage.getItem(SIGNED_OUT_KEY)) return false;
  if (tokenOf(readJSON(STORE_KEY))) return false;
  const backup = readJSON(BACKUP_KEY);
  if (!tokenOf(backup)) return false;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(backup)); } catch { return false; }
  return true;
}
function writeSessionCookies(force = false) {
  const token = tokenOf(readJSON(STORE_KEY));
  if (!token || (!force && readCookie("nf_jwt"))) return;
  writeCookie("nf_jwt", encodeURIComponent(token.access_token));
  writeCookie("nf_refresh", encodeURIComponent(token.refresh_token));
}
let extendedAt = 0;
// Cookies set by the server aren't cut short the way page-set cookies are.
function rememberSession() {
  ["nf_jwt", "nf_refresh"].forEach((name) => { const v = readCookie(name); if (v) writeCookie(name, v); });
  backupSession();
  if (readCookie("nf_jwt") && Date.now() - extendedAt > 5 * 60_000) {
    extendedAt = Date.now();
    realFetch("/api/session", { method: "POST", credentials: "same-origin" }).catch(() => {});
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withLock = (fn) => (navigator.locks?.request ? navigator.locks.request("dealpro-token-refresh", fn) : fn());
const tokenResponse = (token) => new Response(JSON.stringify({
  access_token: token.access_token, token_type: "bearer", refresh_token: token.refresh_token,
  expires_in: Math.max(60, Math.floor((expiresMs(token) - Date.now()) / 1000)),
}), { status: 200, headers: { "Content-Type": "application/json" } });
// A token another tab refreshed a moment ago, still valid for a while.
const fresherToken = (used) => { const t = tokenOf(readJSON(STORE_KEY)) || tokenOf(readJSON(BACKUP_KEY)); return t && t.refresh_token !== used && expiresMs(t) - Date.now() > 30_000 ? t : null; };

async function refreshToken(input, init) {
  const used = new URLSearchParams(String(init.body)).get("refresh_token") || "";
  return withLock(async () => {
    const fresh = fresherToken(used);
    if (fresh) return tokenResponse(fresh);
    // Retry network errors and server hiccups; the library gives up (and signs out) after 30s.
    for (const wait of [0, 1500, 4000]) {
      if (wait) await sleep(wait);
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 7000);
      try {
        const r = await realFetch(input, { ...init, signal: ctl.signal });
        if (r.ok) {
          const data = await r.clone().json();
          // Save straight away so other tabs waiting for the lock pick up the new token.
          const saved = readJSON(STORE_KEY) || readJSON(BACKUP_KEY);
          if (saved && data.access_token) {
            saved.token = { ...saved.token, ...data, expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
            try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); localStorage.setItem(BACKUP_KEY, JSON.stringify(saved)); } catch {}
          }
          localStorage.removeItem(SIGNED_OUT_KEY);
          return r;
        }
        if (r.status === 400 || r.status === 401) {
          const again = fresherToken(used);
          if (again) return tokenResponse(again);
          // The refresh token really was revoked (signed out elsewhere or by an admin).
          localStorage.removeItem(BACKUP_KEY);
          return r;
        }
      } catch {} finally { clearTimeout(timer); }
    }
    // Still offline: keep the backup so the session comes back once the connection does.
    throw new Error("Token refresh failed (offline)");
  });
}

// One place for every request: refresh tokens safely, and retry API calls once after a 401.
let fixing401 = null;
window.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || "";
  if (/\/\.netlify\/identity\/token(\?|$)/.test(url) && /grant_type=refresh_token/.test(String(init?.body || ""))) return refreshToken(input, init);
  const res = await realFetch(input, init);
  if (res.status !== 401 || !/^(\/|https?:\/\/[^/]*usedealpro\.com\/|https?:\/\/localhost[:/])api\//.test(url.replace(location.origin, "")) || !signedInUser) return res;
  fixing401 = fixing401 || (async () => {
    restoreSession();
    writeSessionCookies(true);
    try { await refreshSession(); } catch {}
    rememberSession();
  })().finally(() => setTimeout(() => { fixing401 = null; }, 1000));
  await fixing401;
  return realFetch(input, init);
};

// Keep the session fresh: after sleep, on focus, when back online and every few minutes.
async function keepAlive() {
  if (!signedInUser || localStorage.getItem(SIGNED_OUT_KEY)) return;
  if (restoreSession()) writeSessionCookies(true);
  else writeSessionCookies();
  try { await refreshSession(); } catch {}
  rememberSession();
}
setInterval(keepAlive, 4 * 60_000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) keepAlive(); });
window.addEventListener("focus", keepAlive);
window.addEventListener("online", keepAlive);
onAuthChange((event) => {
  if (event === "logout") {
    // Another tab signed out on purpose: follow it. Otherwise it was a failed refresh; recover.
    if (localStorage.getItem(SIGNED_OUT_KEY)) { if (signedInUser && !signingOut) location.reload(); }
    else setTimeout(keepAlive, 2000);
  } else rememberSession();
});
const gate = $("#authGate");
const form = $("#authForm");
const message = $("#authMessage");
let mode = "login";
let saveTimer;
let signedInUser = null;
let inviteToken = null;
let googleEnabled = false;

function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle("bad", error);
  message.hidden = !text;
}

// Modes: "login", "signup", "reset" (from a recovery email) and "invite" (from an invite email).
function setMode(next) {
  mode = next;
  const settingPassword = mode === "reset" || mode === "invite";
  $("#authNameWrap").hidden = mode !== "signup";
  $("#authEmailWrap").hidden = settingPassword;
  $("#authEmail").required = !settingPassword;
  $("#authConfirmWrap").hidden = !settingPassword;
  $("#authConfirm").required = settingPassword;
  $("#forgotPassword").hidden = mode !== "login";
  $("#authSwitch").hidden = settingPassword;
  $("#authClose").hidden = settingPassword;
  $("#authOauth").hidden = settingPassword || !googleEnabled;
  $("#authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("#authPasswordLabel").textContent = settingPassword ? "New password" : "Password";
  $("#authSubmit").textContent = { signup: "Create account", reset: "Save new password", invite: "Set password" }[mode] || "Sign in";
  $("#authTitle").textContent = { signup: "Create your account", reset: "Set a new password", invite: "Accept your invitation" }[mode] || "Welcome back";
  $("#authSwitch").textContent = mode === "signup" ? "Already have an account? Sign in" : "New to Deal Pro? Create an account";
  $("#authPassword").value = "";
  $("#authConfirm").value = "";
  showMessage("");
}

function openAccount(next = "login") {
  setMode(next);
  gate.hidden = false;
  setTimeout(() => $("#authEmail")?.focus(), 0);
}

function closeAccount() {
  gate.hidden = true;
  showMessage("");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

async function prepareAccount(user) {
  signedInUser = user;
  const accountKey = "dealpremium:active-user";
  const current = localStorage.getItem(accountKey);
  const remote = await api("/api/account-state");
  const remoteState = remote.state;
  const localState = localStorage.getItem("dealpro:state");
  const remoteText = remoteState ? JSON.stringify(remoteState) : null;

  if (current !== user.id || (remoteText && remoteText !== localState)) {
    if (remoteText) localStorage.setItem("dealpro:state", remoteText);
    else localStorage.removeItem("dealpro:state");
    localStorage.setItem(accountKey, user.id);
    sessionStorage.setItem("dealpremium:reloaded", "1");
    location.reload();
    return false;
  }

  return showSignedIn(user);
}

function showSignedIn(user) {
  signedInUser = user;
  localStorage.removeItem(SIGNED_OUT_KEY);
  rememberSession();
  $(".ws-name").textContent = user.name || user.email;
  $("#accountEmail").textContent = user.email;
  document.body.dataset.userId = user.id;
  document.body.dataset.userEmail = user.email;
  if (user.email?.toLowerCase() === "jonahquartey584@gmail.com") $("#adminLink").hidden = false;
  gate.hidden = true;
  document.body.classList.remove("auth-pending");
  document.body.classList.add("simple-mode");
  window.dispatchEvent(new Event("dealpro:signed-in"));
  return true;
}

function signedOut() {
  gate.hidden = true;
  document.body.classList.remove("auth-pending");
  document.body.classList.add("signed-out");
  document.body.classList.add("simple-mode");
}

async function boot() {
  // Show "Continue with Google" only when Google is switched on in Netlify Identity.
  getSettings().then((settings) => {
    googleEnabled = !!settings.providers?.google;
    $("#authOauth").hidden = !googleEnabled || mode === "reset" || mode === "invite";
  }).catch(() => {});
  let callback = null;
  try {
    callback = await handleAuthCallback();
  } catch (error) {
    signedOut();
    openAccount("login");
    showMessage("That email link is invalid or has expired. Request a new one below.", true);
    return;
  }
  if (callback?.type === "recovery" || callback?.type === "invite") {
    inviteToken = callback.token || null;
    document.body.classList.remove("auth-pending");
    openAccount(callback.type === "recovery" ? "reset" : "invite");
    return;
  }
  try {
    // After a deliberate sign-out, leftover cookies must not sign the member back in.
    if (localStorage.getItem(SIGNED_OUT_KEY) && !tokenOf(readJSON(STORE_KEY))) {
      ["nf_jwt", "nf_refresh"].forEach((name) => { document.cookie = `${name}=; path=/; max-age=0; secure; samesite=lax`; });
    }
    restoreSession();
    writeSessionCookies();
    let user = await getUser();
    if (user) {
      // The access token lasts an hour; refresh it before calling the API so a
      // returning visitor isn't treated as signed out.
      await refreshSession();
      user = await getUser();
      rememberSession();
    }
    if (!user) {
      gate.hidden = true;
      document.body.classList.remove("auth-pending");
      document.body.classList.add("signed-out");
      document.body.classList.add("simple-mode");
      window.go?.("home");
      return;
    }
    await prepareAccountWithRetry(user);
  } catch (error) {
    signedOut();
  }
}

// A slow or failed account load isn't a reason to sign someone out: retry, then carry on with
// the copy saved on this device.
async function prepareAccountWithRetry(user) {
  for (const wait of [0, 1000, 3000, 6000]) {
    if (wait) await sleep(wait);
    try { return await prepareAccount(user); } catch (error) { console.warn("Account load failed, retrying", error); }
  }
  if (localStorage.getItem("dealpremium:active-user") === user.id) return showSignedIn(user);
  throw new Error("Could not load the account");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#authSubmit");
  button.disabled = true;
  try {
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    if (mode === "reset" || mode === "invite") {
      if (password !== $("#authConfirm").value) throw new AuthError("The two passwords don't match.");
      showMessage("Saving your password…");
      const user = mode === "reset" ? await updateUser({ password }) : await acceptInvite(inviteToken, password);
      localStorage.removeItem("dealpremium:active-user");
      await prepareAccount(user);
      return;
    }
    showMessage(mode === "signup" ? "Creating your account…" : "Signing you in…");
    const user = mode === "signup"
      ? await signup(email, password, { full_name: $("#authName").value.trim() })
      : await login(email, password);
    if (!user.confirmedAt) {
      showMessage("Check your email and confirm your account, then sign in.");
      setMode("login");
    } else {
      localStorage.removeItem("dealpremium:active-user");
      await prepareAccount(user);
    }
  } catch (error) {
    showMessage(error instanceof AuthError ? error.message : "Unable to continue. Please try again.", true);
  } finally {
    button.disabled = false;
  }
});

$("#authGoogle").addEventListener("click", () => {
  showMessage("Taking you to Google…");
  localStorage.removeItem("dealpremium:active-user");
  try { oauthLogin("google"); } catch (error) { showMessage("Google sign-in isn't available right now. Use your email instead.", true); }
});
$("#authSwitch").addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));
$("#authClose").addEventListener("click", closeAccount);
$("#homeSignIn").addEventListener("click", () => openAccount("login"));
$("#homeCreateAccount").addEventListener("click", () => openAccount("signup"));
const canClose = () => mode !== "reset" && mode !== "invite";
gate.addEventListener("click", (event) => { if (event.target === gate && canClose()) closeAccount(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !gate.hidden && canClose()) closeAccount(); });
document.addEventListener("click", (event) => {
  if (signedInUser) return;
  const protectedAction = event.target.closest('[data-go="find"],[data-go="analyser"],[data-go="analyse"],[data-go="deals"],[data-go="community"],[data-plan],#pwPro,#pwMax');
  if (!protectedAction) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openAccount("login");
}, true);
$("#forgotPassword").addEventListener("click", async () => {
  const email = $("#authEmail").value.trim();
  if (!email) return showMessage("Enter your email address first.", true);
  const button = $("#forgotPassword");
  button.disabled = true;
  try {
    await requestPasswordRecovery(email);
    showMessage("If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.");
  } catch (error) {
    showMessage(error?.message || "Could not send the reset email.", true);
  } finally {
    button.disabled = false;
  }
});

let signingOut = false;
$("#signOut").addEventListener("click", async () => {
  // Mark the sign-out first so nothing restores the session, then clear the server session and cookies.
  signingOut = true;
  localStorage.setItem(SIGNED_OUT_KEY, "1");
  localStorage.removeItem(BACKUP_KEY);
  await logout().catch(() => {});
  ["nf_jwt", "nf_refresh"].forEach((name) => { document.cookie = `${name}=; path=/; max-age=0; secure; samesite=lax`; });
  await realFetch("/api/session", { method: "DELETE", credentials: "same-origin" }).catch(() => {});
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem("dealpremium:active-user");
  localStorage.removeItem("dealpro:state");
  location.reload();
});

window.addEventListener("dealpro:state-saved", (event) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    api("/api/account-state", { method: "PUT", body: JSON.stringify({ state: event.detail }) })
      .catch(() => window.dispatchEvent(new CustomEvent("dealpro:save-error")));
  }, 350);
});

setMode("login");
boot();
