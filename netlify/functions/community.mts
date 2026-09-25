import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

const ADMIN_EMAIL = "jonahquartey584@gmail.com";
const STRATEGIES = ["R2SA", "R2R", "BTL", "HMO", "BRRR", "Lease option", "Flip", "Other"];
const PROPERTY_TYPES = ["Flat", "House", "Studio", "HMO", "Commercial", "Other"];
const CONTACTED = ["Landlord", "Agent"];
const MAX_POSTS_PER_USER = 20;

const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

type Post = {
  id: string; authorId: string; createdAt: string;
  title: string; location: string; postcode: string; strategy: string; propertyType: string;
  beds: number | null; price: number; priceType: "pcm" | "purchase"; contacted: string;
  status: string; description: string; listingUrl: string;
  contactName: string; contactEmail: string; contactPhone: string;
};

const text = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function validate(body: Record<string, unknown>): { post?: Omit<Post, "id" | "authorId" | "createdAt">; error?: string } {
  const title = text(body.title, 120);
  const location = text(body.location, 80);
  const postcode = text(body.postcode, 10).toUpperCase();
  const strategy = text(body.strategy, 20);
  const propertyType = text(body.propertyType, 20);
  const contacted = text(body.contacted, 20);
  const priceType = body.priceType === "purchase" ? "purchase" : "pcm";
  const price = Math.round(Number(body.price));
  const bedsRaw = body.beds === "" || body.beds == null ? null : Math.round(Number(body.beds));
  const listingUrl = text(body.listingUrl, 500);
  const contactEmail = text(body.contactEmail, 200);

  if (title.length < 5) return { error: "Give the deal a short title." };
  if (!location) return { error: "Add the town or area." };
  if (!STRATEGIES.includes(strategy)) return { error: "Choose a strategy." };
  if (!PROPERTY_TYPES.includes(propertyType)) return { error: "Choose a property type." };
  if (!CONTACTED.includes(contacted)) return { error: "Say whether the landlord or agent was contacted." };
  if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) return { error: "Enter the price as a number." };
  if (bedsRaw !== null && (!Number.isFinite(bedsRaw) || bedsRaw < 0 || bedsRaw > 50)) return { error: "Enter a valid number of bedrooms." };
  if (listingUrl && !/^https?:\/\/\S+$/i.test(listingUrl)) return { error: "The listing link must start with http:// or https://." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) return { error: "Enter a contact email." };

  return {
    post: {
      title, location, postcode, strategy, propertyType, contacted, priceType, price,
      beds: bedsRaw, listingUrl, contactEmail,
      status: text(body.status, 120),
      description: String(body.description ?? "").trim().slice(0, 2000),
      contactName: text(body.contactName, 80),
      contactPhone: text(body.contactPhone, 30),
    },
  };
}

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in to use the Deal Community." }, 401);
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  const store = getStore({ name: "deal-community", consistency: "strong" });

  if (request.method === "GET") {
    const { blobs } = await store.list({ prefix: "posts/" });
    const posts = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<Post | null>)))
      .filter((p): p is Post => !!p)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 500)
      .map(({ authorId, ...post }) => ({ ...post, mine: authorId === user.id, canDelete: authorId === user.id || isAdmin }));
    return json({ posts });
  }

  if (request.method === "POST") {
    if (!isAdmin) {
      const accounts = getStore({ name: "deal-premium-accounts", consistency: "strong" });
      const state = await accounts.get(`users/${user.id}/state`, { type: "json" }) as Record<string, unknown> | null;
      if (state?.accountEnabled === false) return json({ error: "This account has been suspended. Contact Deal Pro support." }, 403);
      const { blobs } = await store.list({ prefix: `posts/` });
      const own = (await Promise.all(blobs.map((b) => store.getMetadata(b.key))))
        .filter((m) => m?.metadata?.authorId === user.id).length;
      if (own >= MAX_POSTS_PER_USER) return json({ error: `You can have up to ${MAX_POSTS_PER_USER} deals posted. Delete an old one first.` }, 429);
    }
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ error: "Deal details are required." }, 400);
    const { post, error } = validate(body);
    if (!post) return json({ error }, 400);
    const createdAt = new Date().toISOString();
    const id = `${createdAt.replace(/[^0-9]/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
    const record: Post = { id, authorId: user.id, createdAt, ...post };
    await store.setJSON(`posts/${id}`, record, { metadata: { authorId: user.id } });
    return json({ post: { ...post, id, createdAt, mine: true, canDelete: true } }, 201);
  }

  if (request.method === "DELETE") {
    const body = await request.json().catch(() => null) as { id?: string } | null;
    if (!body?.id || !/^[0-9]+-[0-9a-f]{8}$/.test(body.id)) return json({ error: "A valid deal is required." }, 400);
    const key = `posts/${body.id}`;
    const post = await store.get(key, { type: "json" }) as Post | null;
    if (!post) return json({ error: "That deal has already been removed." }, 404);
    if (post.authorId !== user.id && !isAdmin) return json({ error: "You can only delete your own deals." }, 403);
    await store.delete(key);
    return json({ deleted: true });
  }

  return json({ error: "Method not allowed." }, 405);
};

export const config: Config = { path: "/api/community", method: ["GET", "POST", "DELETE"] };
