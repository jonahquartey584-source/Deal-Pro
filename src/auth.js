import {
  AuthError,
  getUser,
  handleAuthCallback,
  login,
  logout,
  requestPasswordRecovery,
  signup,
} from "@netlify/identity";

const $ = (selector) => document.querySelector(selector);
const gate = $("#authGate");
const form = $("#authForm");
const message = $("#authMessage");
let mode = "login";
let saveTimer;
let signedInUser = null;

function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle("bad", error);
  message.hidden = !text;
}

function setMode(next) {
  mode = next;
  $("#authNameWrap").hidden = mode !== "signup";
  $("#authSubmit").textContent = mode === "signup" ? "Create account" : "Sign in";
  $("#authTitle").textContent = mode === "signup" ? "Create your account" : "Welcome back";
  $("#authSwitch").textContent = mode === "signup" ? "Already have an account? Sign in" : "New to Deal Pro? Create an account";
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

async function boot() {
  try {
    await handleAuthCallback();
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
    gate.hidden = true;
    document.body.classList.remove("auth-pending");
    document.body.classList.add("signed-out");
    document.body.classList.add("simple-mode");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#authSubmit");
  button.disabled = true;
  showMessage(mode === "signup" ? "Creating your account…" : "Signing you in…");
  try {
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    const user = mode === "signup"
      ? await signup(email, password, { full_name: $("#authName").value.trim() })
      : await login(email, password);
    if (!user.emailVerified) {
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
gate.addEventListener("click", (event) => { if (event.target === gate) closeAccount(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !gate.hidden) closeAccount(); });
document.addEventListener("click", (event) => {
  if (signedInUser) return;
  const protectedAction = event.target.closest('[data-go="find"],[data-go="analyser"],[data-go="analyse"],[data-go="deals"],[data-plan],#pwPro,#pwMax');
  if (!protectedAction) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openAccount("login");
}, true);
$("#forgotPassword").addEventListener("click", async () => {
  const email = $("#authEmail").value.trim();
  if (!email) return showMessage("Enter your email address first.", true);
  try {
    await requestPasswordRecovery(email);
    showMessage("Password reset instructions have been sent to your email.");
  } catch (error) {
    showMessage(error?.message || "Could not send the reset email.", true);
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
