import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

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

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in." }, 401);

  const store = getStore({ name: "deal-premium-accounts", consistency: "strong" });
  const key = `users/${user.id}/state`;
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;

  if (request.method === "GET") {
    let state = await store.get(key, { type: "json" }) as Record<string, unknown> | null;
    if (!state) {
      state = defaultState(isAdmin);
      await store.setJSON(key, state, { metadata: { userId: user.id, email: user.email ?? "", updatedAt: new Date().toISOString() } });
    }
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
    if (isAdmin) { nextState.admin = true; nextState.plan = "Max20"; nextState.accountEnabled = true; }
    await store.setJSON(key, nextState, {
      metadata: { userId: user.id, email: user.email ?? "", updatedAt: new Date().toISOString() },
    });
    return json({ saved: true });
  }

  return json({ error: "Method not allowed." }, 405);
};

export const config: Config = {
  path: "/api/account-state",
  method: ["GET", "PUT"],
};
