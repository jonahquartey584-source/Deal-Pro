import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

// What a customer is looking for. Ids match STRATS in index.html, plus "Other".
const STRATEGIES = ["R2SA", "R2R", "BTL", "HMO", "BRRR", "Flip", "LeaseOption", "SA", "Commercial", "Other"];

// The details every customer gives after signing in: full name, company and the strategy they are after.
export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  if (request.method !== "PUT") return json({ error: "Method not allowed." }, 405);

  const body = await request.json().catch(() => null) as { fullName?: unknown; company?: unknown; strategy?: unknown } | null;
  const fullName = String(body?.fullName ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const company = String(body?.company ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const strategy = String(body?.strategy ?? "");
  if (fullName.length < 2) return json({ error: "Please enter your full name." }, 400);
  if (!company) return json({ error: "Please enter your company name." }, 400);
  if (!STRATEGIES.includes(strategy)) return json({ error: "Please choose the strategy you are looking for." }, 400);

  const store = getStore({ name: "deal-premium-accounts", consistency: "strong" });
  const key = `users/${user.id}/state`;
  const state = (await store.get(key, { type: "json" }) as Record<string, unknown> | null) || { plan: "Free", accountEnabled: true, saved: [] };
  const oldMeta = (await store.getMetadata(key))?.metadata || {};
  const profile = { fullName, company, strategy, completedAt: new Date().toISOString() };
  state.profile = profile;
  await store.setJSON(key, state, { metadata: { ...oldMeta, userId: user.id, email: user.email ?? "", name: fullName, updatedAt: new Date().toISOString() } });
  return json({ profile });
};

export const config: Config = { path: "/api/profile", method: ["PUT"] };
