import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";
import { applyPlanExpiry } from "../lib/plan.mts";
import { accounts, ADMIN_EMAIL } from "../lib/ai.mts";

// Shareable deal lists. From the Deal Finder, "Share as link" turns the deal cards into one page at
// /deals/<id> that anyone with the link can open (for WhatsApp, email or a text). The browser builds
// the cards; this function keeps only the known fields, as plain text, so a list can't carry anything else.

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const store = () => getStore({ name: "deal-lists", consistency: "strong" });
const MAX_PER_DAY = 40;

const str = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, n);
const httpsUrl = (v: unknown) => { const u = str(v, 600); return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : ""; };

function clean(list: Record<string, unknown>) {
  const cards = (Array.isArray(list.cards) ? list.cards : []).slice(0, 60)
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      head: str(c.head, 140),
      lines: (Array.isArray(c.lines) ? c.lines : []).slice(0, 20)
        .filter((l): l is unknown[] => Array.isArray(l))
        .map((l) => [str(l[0], 8), str(l[1], 300)])
        .filter((l) => l[1]),
      url: httpsUrl(c.url),
      pack: /^[0-9a-f-]{36}$/.test(String(c.pack ?? "")) ? String(c.pack) : "",
    }))
    .filter((c) => c.head);
  return {
    title: str(list.title, 160) || "Property deals",
    intro: str(list.intro, 600),
    foot: str(list.foot, 400),
    preNDA: list.preNDA === true,
    cards,
  };
}

export default async (request: Request, _context: Context) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  // Public: anyone with the link can read a list.
  if (request.method === "GET") {
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "This deal list doesn't exist." }, 404);
    const list = await store().get(`lists/${id}`, { type: "json" }) as Record<string, unknown> | null;
    if (!list) return json({ error: "This deal list is no longer available." }, 404);
    const { owner: _owner, ...pub } = list;
    return json({ list: pub });
  }

  const user = await getUser();
  if (!user) return json({ error: "Please sign in to share deals as a link." }, 401);
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  const state = await accounts().get(`users/${user.id}/state`, { type: "json" }) as Record<string, unknown> | null;
  applyPlanExpiry(state);
  if (!isAdmin && state?.accountEnabled === false) return json({ error: "This account has been suspended. Contact Deal Pro support." }, 403);

  if (request.method === "DELETE") {
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "Unknown deal list." }, 404);
    const list = await store().get(`lists/${id}`, { type: "json" }) as Record<string, unknown> | null;
    if (!list || (list.owner !== user.id && !isAdmin)) return json({ error: "Unknown deal list." }, 404);
    await store().delete(`lists/${id}`);
    return json({ ok: true });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const body = await request.json().catch(() => null) as { list?: unknown } | null;
  if (!body || !body.list || typeof body.list !== "object") return json({ error: "There are no deals to share." }, 400);
  if (JSON.stringify(body.list).length > 120_000) return json({ error: "Too many deals to share in one link. Select fewer." }, 413);
  const list = clean(body.list as Record<string, unknown>);
  if (!list.cards.length) return json({ error: "There are no deals to share." }, 400);

  // A daily cap keeps public pages from being mass-produced from one account.
  const dayKey = `count/${user.id}/${new Date().toISOString().slice(0, 10)}`;
  const made = Number(await store().get(dayKey)) || 0;
  if (!isAdmin && made >= MAX_PER_DAY) return json({ error: `You've shared ${MAX_PER_DAY} deal links today. Try again tomorrow.` }, 429);

  const listId = crypto.randomUUID();
  await store().setJSON(`lists/${listId}`, { ...list, owner: user.id, createdAt: new Date().toISOString() });
  await store().set(dayKey, String(made + 1));
  return json({ id: listId, url: `/deals/${listId}` });
};

export const config: Config = {
  path: "/api/deal-lists",
  method: ["GET", "POST", "DELETE"],
};
