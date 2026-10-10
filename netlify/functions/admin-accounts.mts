import { getStore } from "@netlify/blobs";
import { getUser, admin } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";
import { applyPlanExpiry } from "../lib/plan.mts";
import { activityFor } from "../lib/ai.mts";

const ADMIN_EMAIL = "jonahquartey584@gmail.com";
// Midnight at the end of a UK calendar day (British Summer Time included), as a timestamp.
function endOfUkDay(day: string) {
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const next = Date.UTC(+m[1], +m[2] - 1, +m[3] + 1);
  const check = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (check.getUTCMonth() !== +m[2] - 1 || check.getUTCDate() !== +m[3]) return null;
  const londonHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(new Date(next)));
  return next - londonHour * 3_600_000;
}
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) return json({ error: "Administrator access required." }, 403);
  const store = getStore({ name: "deal-premium-accounts", consistency: "strong" });

  if (request.method === "GET") {
    const { blobs } = await store.list({ prefix: "users/" });
    // The sign-up date (and name) come from Netlify Identity: the sign-in token the other functions see
    // doesn't carry them. If the lookup fails, the list still loads, without join dates.
    const signedUp = new Map<string, { createdAt?: string; name?: string }>();
    try {
      for (let page = 1; page <= 20; page++) {
        const users = await admin.listUsers({ page, perPage: 100 });
        for (const u of users) signedUp.set(u.id, { createdAt: u.createdAt, name: u.name });
        if (users.length < 100) break;
      }
    } catch (error) { console.warn("Couldn't list Identity users for sign-up dates", error); }
    const accounts = await Promise.all(blobs.filter((b) => b.key.endsWith("/state")).map(async (blob) => {
      const state = await store.get(blob.key, { type: "json" }) as Record<string, unknown> | null;
      if (state) applyPlanExpiry(state);
      const metadata = (await store.getMetadata(blob.key))?.metadata as Record<string, unknown> | undefined;
      const id = blob.key.split("/")[1], idUser = signedUp.get(id);
      const activity = await activityFor(id).catch(() => null);
      return {
        userId: id, name: (state?.profile as Record<string, unknown> | undefined)?.fullName || metadata?.name || idUser?.name || "", company: (state?.profile as Record<string, unknown> | undefined)?.company || "", strategy: (state?.profile as Record<string, unknown> | undefined)?.strategy || "", createdAt: idUser?.createdAt || metadata?.createdAt || null, email: metadata?.email || "Email unavailable",
        plan: state?.plan || "Free", expiresAt: state?.planExpiresAt || null, subscribed: !!(state?.stripe as Record<string, unknown> | undefined)?.subscription && state?.plan !== "Free", enabled: state?.accountEnabled !== false,
        savedDeals: Array.isArray(state?.saved) ? state.saved.length : 0, activity, updatedAt: metadata?.updatedAt || null,
      };
    }));
    return json({ accounts });
  }

  const body = await request.json().catch(() => null) as { userId?: string; plan?: string; enabled?: boolean; days?: number | null; until?: string } | null;
  if (!body?.userId || !/^[a-zA-Z0-9-]+$/.test(body.userId)) return json({ error: "A valid user is required." }, 400);
  const key = `users/${body.userId}/state`;

  if (request.method === "PATCH") {
    const state = await store.get(key, { type: "json" }) as Record<string, unknown> | null;
    if (!state) return json({ error: "Account data was not found." }, 404);
    applyPlanExpiry(state);
    if (body.plan && ["Free", "Lite", "Pro", "Max5", "Max20"].includes(body.plan)) state.plan = body.plan;
    // Referral access: `days` sets how long the current plan lasts from today; null removes the end date.
    if (body.days === null) delete state.planExpiresAt;
    else if (typeof body.days === "number") {
      if (!Number.isInteger(body.days) || body.days < 1 || body.days > 3650) return json({ error: "Choose between 1 and 3650 days." }, 400);
      if (state.plan === "Free") return json({ error: "Choose a paid plan before setting how long it lasts." }, 400);
      state.planExpiresAt = new Date(Date.now() + body.days * 86_400_000).toISOString();
    }
    // Or an exact last day ("YYYY-MM-DD"): the plan lasts to the end of that day, UK time.
    else if (typeof body.until === "string") {
      if (state.plan === "Free") return json({ error: "Choose a paid plan before setting how long it lasts." }, 400);
      const ends = endOfUkDay(body.until);
      if (!ends) return json({ error: "Choose a valid end date." }, 400);
      if (ends <= Date.now()) return json({ error: "Choose an end date after today." }, 400);
      if (ends > Date.now() + 3650 * 86_400_000) return json({ error: "Choose an end date within 10 years." }, 400);
      state.planExpiresAt = new Date(ends).toISOString();
    }
    if (state.plan === "Free") delete state.planExpiresAt;
    if (typeof body.enabled === "boolean") state.accountEnabled = body.enabled;
    const oldMeta = (await store.getMetadata(key))?.metadata;
    await store.setJSON(key, state, { metadata: { ...(oldMeta || {}), updatedAt: new Date().toISOString() } });
    return json({ saved: true });
  }

  if (request.method === "DELETE") {
    if (body.userId === user.id) return json({ error: "You cannot delete your own administrator account." }, 400);
    await store.delete(key);
    return json({ deleted: true });
  }

  return json({ error: "Method not allowed." }, 405);
};

export const config: Config = { path: "/api/admin/accounts", method: ["GET", "PATCH", "DELETE"] };
