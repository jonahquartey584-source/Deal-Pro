import {
  AuthError,
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  requestPasswordRecovery,
  signup,
  updateUser,
} from "@netlify/identity";

const $ = (selector) => document.querySelector(selector);
const gate = $("#authGate");
const form = $("#authForm");
const message = $("#authMessage");
let mode = "login";
let saveTimer;
let signedInUser = null;
let inviteToken = null;

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

  $(".ws-name").textContent = user.name || user.email;
  $("#accountEmail").textContent = user.email;
  document.body.dataset.userId = user.id;
  document.body.dataset.userEmail = user.email;
  if (user.email?.toLowerCase() === "jonahquartey584@gmail.com") $("#adminLink").hidden = false;
  gate.hidden = true;
  document.body.classList.remove("auth-pending");
  document.body.classList.add("simple-mode");
  return true;
}

function signedOut() {
  gate.hidden = true;
  document.body.classList.remove("auth-pending");
  document.body.classList.add("signed-out");
  document.body.classList.add("simple-mode");
}

async function boot() {
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
    const user = await getUser();
    if (!user) {
      gate.hidden = true;
      document.body.classList.remove("auth-pending");
      document.body.classList.add("signed-out");
      document.body.classList.add("simple-mode");
      window.go?.("home");
      return;
    }
    await prepareAccount(user);
  } catch (error) {
    signedOut();
  }
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

$("#signOut").addEventListener("click", async () => {
  await logout();
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
