import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

// Past Deal Finder searches and Deal Analyser results, kept per account so they can be reopened.
// Each kind has an index of short summaries (for the list) and one blob per entry (the full result),
// stored apart from the account state so big result sets don't count towards its size limit.

const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

const KINDS = { finder: { keep: 30 }, analyser: { keep: 50 } } as const;
type Kind = keyof typeof KINDS;
type Summary = { id: string; at: string; title: string; detail: string; count?: number; score?: number };

const MAX_ENTRY = 2_000_000;
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in to see your history." }, 401);

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as Kind;
  if (!(kind in KINDS)) return json({ error: "Unknown history." }, 400);

  const store = getStore({ name: "deal-history", consistency: "strong" });
  const base = `users/${user.id}/${kind}`;
  const loadIndex = async () => ((await store.get(`${base}/index`, { type: "json" })) as Summary[] | null) || [];
  const id = url.searchParams.get("id");
  if (id !== null && !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "Unknown entry." }, 404);

  if (request.method === "GET") {
    if (!id) return json({ items: await loadIndex() });
    const entry = await store.get(`${base}/${id}`, { type: "json" });
    if (!entry) return json({ error: "This entry is no longer available." }, 404);
    return json({ entry });
  }

  if (request.method === "DELETE") {
    if (!id) return json({ error: "Unknown entry." }, 404);
    await store.delete(`${base}/${id}`);
    const items = (await loadIndex()).filter((x) => x.id !== id);
    await store.setJSON(`${base}/index`, items);
    return json({ items });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const body = await request.json().catch(() => null) as { summary?: Partial<Summary>; data?: unknown } | null;
  if (!body || typeof body.data !== "object" || body.data === null) return json({ error: "Nothing to save." }, 400);
  const encoded = JSON.stringify(body.data);
  if (encoded.length > MAX_ENTRY) return json({ error: "This result is too large to save." }, 413);

  const s = body.summary || {};
  const summary: Summary = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    title: clip(s.title, 140) || (kind === "finder" ? "Search" : "Analysis"),
    detail: clip(s.detail, 240),
    ...(Number.isFinite(s.count) ? { count: Math.max(0, Math.round(Number(s.count))) } : {}),
    ...(Number.isFinite(s.score) ? { score: Math.max(0, Math.min(100, Math.round(Number(s.score)))) } : {}),
  };
  await store.set(`${base}/${summary.id}`, encoded);

  // Newest first; the oldest entries beyond the limit are deleted.
  const items = [summary, ...(await loadIndex())];
  const drop = items.splice(KINDS[kind].keep);
  await store.setJSON(`${base}/index`, items);
  await Promise.all(drop.map((x) => store.delete(`${base}/${x.id}`)));
  return json({ id: summary.id, items });
};

export const config: Config = {
  path: "/api/history",
  method: ["GET", "POST", "DELETE"],
};
