import { getStore } from "@netlify/blobs";
import { getUser, admin } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

const ADMIN_EMAIL = "jonahquartey584@gmail.com";
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) return json({ error: "Administrator access required." }, 403);
  const store = getStore({ name: "deal-premium-accounts", consistency: "strong" });

  if (request.method === "GET") {
    const { blobs } = await store.list({ prefix: "users/" });
    // Older accounts have no stored join date: look it up from Identity (best effort) so they show one too.
    const signedUp = new Map<string, { createdAt?: string; name?: string }>();
    try {
      for (let page = 1; page <= 10; page++) {
        const users = await admin.listUsers({ page, perPage: 100 });
        for (const u of users) signedUp.set(u.id, { createdAt: u.createdAt, name: u.name });
        if (users.length < 100) break;
      }
    } catch (error) { console.warn("Couldn't list Identity users for join dates", error); }
    const accounts = await Promise.all(blobs.filter((b) => b.key.endsWith("/state")).map(async (blob) => {
      const state = await store.get(blob.key, { type: "json" }) as Record<string, unknown> | null;
      const metadata = (await store.getMetadata(blob.key))?.metadata as Record<string, unknown> | undefined;
      return {
        userId: blob.key.split("/")[1], email: metadata?.email || "Email unavailable",
        joinedAt: metadata?.joinedAt || signedUp.get(blob.key.split("/")[1])?.createdAt || null,
        name: String(metadata?.name || signedUp.get(blob.key.split("/")[1])?.name || ""),
        plan: state?.plan || "Free", enabled: state?.accountEnabled !== false,
        savedDeals: Array.isArray(state?.saved) ? state.saved.length : 0, updatedAt: metadata?.updatedAt || null,
      };
    }));
    return json({ accounts });
  }

  const body = await request.json().catch(() => null) as { userId?: string; plan?: string; enabled?: boolean } | null;
  if (!body?.userId || !/^[a-zA-Z0-9-]+$/.test(body.userId)) return json({ error: "A valid user is required." }, 400);
  const key = `users/${body.userId}/state`;

  if (request.method === "PATCH") {
    const state = await store.get(key, { type: "json" }) as Record<string, unknown> | null;
    if (!state) return json({ error: "Account data was not found." }, 404);
    if (body.plan && ["Free", "Lite", "Pro", "Max5", "Max20"].includes(body.plan)) state.plan = body.plan;
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
