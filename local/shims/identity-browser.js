// Stand-in for @netlify/identity in the browser: the local copy of Deal Pro signs you in as the
// local user, so no Netlify account or Identity service is involved. Signing out is remembered
// until you sign in again.
const KEY = "dealpro:local-signed-out";
const USER = { id: "local-user", email: window.__DEALPRO_LOCAL_EMAIL || "jonahquartey584@gmail.com", name: "You" };
const out = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };
const set = (on) => { try { on ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch {} };
let listeners = [];
const emit = (event, user) => listeners.forEach((fn) => { try { fn(event, user); } catch {} });

export class AuthError extends Error {}
export const getUser = async () => (out() ? null : USER);
export const getSettings = async () => ({ providers: {} });
export const handleAuthCallback = async () => null;
export const refreshSession = async () => (out() ? null : USER);
export const login = async () => { set(false); emit("login", USER); return USER; };
export const signup = login;
export const acceptInvite = login;
export const updateUser = async () => USER;
export const oauthLogin = async () => { set(false); location.reload(); };
export const requestPasswordRecovery = async () => {};
export const logout = async () => { set(true); emit("logout", null); };
export const onAuthChange = (fn) => { listeners.push(fn); return () => { listeners = listeners.filter((x) => x !== fn); }; };
