import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";
import { sendEmail, welcomeEmail } from "../lib/email.mts";

const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

const ADMIN_EMAIL = "jonahquartey584@gmail.com";
const defaultState = (admin = false) => ({
  plan: admin ? "Max20" : "Free",
  admin,
  accountEnabled: true,
  deal: {
    id: `d${Date.now()}`, name: "New deal", area: "", strat: "R2SA", london: false, status: "Checking",
    units: [{ label: "Unit 1", rent: 0, dep: 0, rate: 0 }],
    a: { fee: 15, clean: 45, stay: 3, other: 150 }, dd: [], ai: false,
    pack: { biz: "", redress: "", fee: "", nda: true, final: false },
    send: { co: "", email: "", addr: "", ll: "", role: "Owner / landlord", phone: "", lemail: "", use: "Serviced accommodation", docs: "" },
  },
  saved: [], usage: { sStart: null, sUsed: 0, wStart: null, wUsed: 0 },
  extra: { on: false, cap: 20, spent: 0, month: null }, analysedDealIds: [], unlocked: [], agreements: [],
});

export default async (request: Request, context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in." }, 401);

  const store = getStore({ name: "deal-premium-accounts", consistency: "strong" });
  const key = `users/${user.id}/state`;
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;

  if (request.method === "GET") {
    let state = await store.get(key, { type: "json" }) as Record<string, unknown> | null;
    if (!state) {
      state = defaultState(isAdmin);
      await store.setJSON(key, state, { metadata: { userId: user.id, email: user.email ?? "", name: user.name ?? "", joinedAt: user.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() } });
      // A brand-new account gets one welcome email from hello@qp-digital.co.uk. It never delays or blocks sign-in,
      // and the marker stops a second request from sending it twice.
      if (!isAdmin && user.email && !(await store.get(`users/${user.id}/welcome-email`))) {
        await store.set(`users/${user.id}/welcome-email`, new Date().toISOString());
        const mail = welcomeEmail(user.name);
        const sending = sendEmail({ to: user.email, ...mail })
          .then((r) => { if (!r.sent) console.warn(`Welcome email not sent: ${r.reason}`); })
          .catch((error) => console.warn("Welcome email failed", error));
        if (typeof context?.waitUntil === "function") context.waitUntil(sending); else await sending;
      }
    }
    // Accounts created before the join date was kept get it now, from their Identity sign-up date.
    const meta = (await store.getMetadata(key))?.metadata as Record<string, unknown> | undefined;
    if (meta && ((!meta.joinedAt && user.createdAt) || (!meta.name && user.name))) await store.setJSON(key, state, { metadata: { ...meta, joinedAt: meta.joinedAt || user.createdAt, name: meta.name || user.name || "" } }).catch(() => {});
    if (state.accountEnabled === false && !isAdmin) return json({ error: "This account has been suspended. Contact Deal Pro support." }, 403);
    if (isAdmin) { state.admin = true; state.plan = "Max20"; state.accountEnabled = true; }
    return json({ user: { id: user.id, email: user.email, name: user.name }, state });
  }

  if (request.method === "PUT") {
    const body = await request.json().catch(() => null) as { state?: unknown } | null;
    if (!body || typeof body.state !== "object" || body.state === null) {
      return json({ error: "A valid account state is required." }, 400);
    }
    const encoded = JSON.stringify(body.state);
    if (encoded.length > 1_000_000) return json({ error: "Account data is too large." }, 413);
    const nextState = body.state as Record<string, unknown>;
    if (isAdmin) {
      nextState.admin = true; nextState.plan = "Max20"; nextState.accountEnabled = true;
    } else {
      // Membership, suspension and paid unlocks are only changed by the server or an administrator,
      // never by the browser, so keep the stored values.
      const stored = ((await store.get(key, { type: "json" }) as Record<string, unknown> | null) || defaultState(false)) as Record<string, unknown>;
      if (stored.accountEnabled === false) return json({ error: "This account has been suspended. Contact Deal Pro support." }, 403);
      nextState.admin = false;
      nextState.plan = stored.plan || "Free";
      nextState.accountEnabled = true;
      nextState.unlocked = Array.isArray(stored.unlocked) ? stored.unlocked : [];
      if (stored.stripe) nextState.stripe = stored.stripe; else delete nextState.stripe;
    }
    // Keep the date they joined: stored when the account was first saved, else the sign-up date from Identity.
    const oldMeta = (await store.getMetadata(key))?.metadata as Record<string, unknown> | undefined;
    await store.setJSON(key, nextState, {
      metadata: { ...(oldMeta || {}), userId: user.id, email: user.email ?? "", name: oldMeta?.name || user.name || "", joinedAt: oldMeta?.joinedAt || user.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() },
    });
    return json({ saved: true });
  }

  return json({ error: "Method not allowed." }, 405);
};

export const config: Config = {
  path: "/api/account-state",
  method: ["GET", "PUT"],
};
