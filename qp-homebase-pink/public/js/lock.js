// Face ID lock for private sections. Uses the phone's built-in passkey system
// (WebAuthn, platform authenticator with user verification), which on iPhone
// asks for Face ID / Touch ID. A passcode is the backup. Settings are stored
// on this device only (not copied to the MacBook).
import { idbGet, idbSet } from "./app.js";

export const LOCKABLE = { journal: "Journal", cycle: "Period tracker", money: "Budget", bible: "Bible notes" };
const RELOCK_MS = 5 * 60 * 1000;
let cfg = null, unlockedAt = 0;

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
async function sha(text) { return b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))); }

export async function lockConfig() {
  if (!cfg) cfg = (await idbGet("lock")) || { sections: ["journal"], credId: null, pinHash: null, salt: null };
  return cfg;
}
async function store() { await idbSet("lock", cfg); }

export const hasProtection = () => !!(cfg && (cfg.credId || cfg.pinHash));
export const isUnlocked = () => Date.now() - unlockedAt < RELOCK_MS;
export function isLocked(section) { return !!cfg && hasProtection() && cfg.sections.includes(section) && !isUnlocked(); }
export function relock() { unlockedAt = 0; }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") relock(); });

export async function faceIdAvailable() {
  try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}

export async function setupFaceId() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: rand(32), rp: { name: "Ruby Homebase" },
    user: { id: rand(16), name: "rubyqp", displayName: "RubyQp" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
    timeout: 60000, attestation: "none",
  } });
  await lockConfig(); cfg.credId = b64(cred.rawId); await store(); unlockedAt = Date.now();
}

export async function unlockWithFaceId() {
  await lockConfig(); if (!cfg.credId) throw new Error("Face ID isn't set up");
  const a = await navigator.credentials.get({ publicKey: {
    challenge: rand(32), allowCredentials: [{ type: "public-key", id: unb64(cfg.credId), transports: ["internal", "hybrid"] }],
    userVerification: "required", timeout: 60000,
  } });
  // the phone only returns this after Face ID (user verification flag set)
  const flags = new Uint8Array(a.response.authenticatorData)[32];
  if (!(flags & 0x04)) throw new Error("Face ID wasn't confirmed");
  unlockedAt = Date.now();
}

export async function setPin(pin) {
  await lockConfig(); cfg.salt = b64(rand(16)); cfg.pinHash = await sha(cfg.salt + pin); await store();
}
export async function unlockWithPin(pin) {
  await lockConfig();
  if (!cfg.pinHash || (await sha(cfg.salt + pin)) !== cfg.pinHash) throw new Error("Wrong passcode");
  unlockedAt = Date.now();
}
export async function setSections(sections) { await lockConfig(); cfg.sections = sections; await store(); }
export async function removeProtection() { await lockConfig(); cfg.credId = null; cfg.pinHash = null; cfg.salt = null; await store(); }
