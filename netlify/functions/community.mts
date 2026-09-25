import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

const ADMIN_EMAIL = "jonahquartey584@gmail.com";
const STRATEGIES = ["R2SA", "R2R", "BTL", "HMO", "BRRR", "Lease option", "Flip", "Other"];
const PROPERTY_TYPES = ["Flat", "House", "Studio", "HMO", "Commercial", "Other"];
const CONTACTED = ["Landlord", "Agent"];
const MAX_POSTS_PER_USER = 20;
// Regions for deals and the region chat rooms. Keep in sync with REGIONS in index.html.
const REGIONS = ["London", "Midlands", "North East", "North West", "South East", "South West", "Yorkshire and Humber", "Other"];
const slug = (region: string) => region.toLowerCase().replace(/[^a-z]+/g, "-");
const ROOMS = new Map(REGIONS.map((r) => [slug(r), r]));
const MAX_MESSAGE = 1000;
const MAX_RECENT_WRITES = 30; // messages and replies per user per hour
const ID = /^[0-9]+-[0-9a-f]{8}$/;

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
  region?: string;
};

// A chat message in a region room, or a reply on a deal.
type Note = { id: string; authorId: string; authorName: string; createdAt: string; text: string };

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
  const region = text(body.region, 40);

  if (title.length < 5) return { error: "Give the deal a short title." };
  if (!location) return { error: "Add the town or area." };
  if (!REGIONS.includes(region)) return { error: "Choose a region." };
  if (!STRATEGIES.includes(strategy)) return { error: "Choose a strategy." };
  if (!PROPERTY_TYPES.includes(propertyType)) return { error: "Choose a property type." };
  if (!CONTACTED.includes(contacted)) return { error: "Say whether the landlord or agent was contacted." };
  if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) return { error: "Enter the price as a number." };
  if (bedsRaw !== null && (!Number.isFinite(bedsRaw) || bedsRaw < 0 || bedsRaw > 50)) return { error: "Enter a valid number of bedrooms." };
  if (listingUrl && !/^https?:\/\/\S+$/i.test(listingUrl)) return { error: "The listing link must start with http:// or https://." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) return { error: "Enter a contact email." };

  return {
    post: {
      title, location, postcode, region, strategy, propertyType, contacted, priceType, price,
      beds: bedsRaw, listingUrl, contactEmail,
      status: text(body.status, 120),
      description: String(body.description ?? "").trim().slice(0, 2000),
      contactName: text(body.contactName, 80),
      contactPhone: text(body.contactPhone, 30),
    },
  };
}

const newId = () => {
  const createdAt = new Date().toISOString();
  return { createdAt, id: `${createdAt.replace(/[^0-9]/g, "")}-${crypto.randomUUID().slice(0, 8)}` };
};
const noteText = (value: unknown) => String(value ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_MESSAGE);

type Store = ReturnType<typeof getStore>;
async function readNotes(store: Store, prefix: string, userId: string, isAdmin: boolean, limit: number) {
  const { blobs } = await store.list({ prefix });
  // Ids start with the timestamp, so the newest keys sort last.
  const keys = blobs.map((b) => b.key).sort().slice(-limit);
  return (await Promise.all(keys.map((k) => store.get(k, { type: "json" }) as Promise<Note | null>)))
    .filter((n): n is Note => !!n)
    .map(({ authorId, ...note }) => ({ ...note, mine: authorId === userId, canDelete: authorId === userId || isAdmin }));
}

// Limits how many messages and replies one member can write in an hour.
async function tooManyWrites(store: Store, userId: string) {
  const { blobs } = await store.list({ prefix: `writes/${userId}/` });
  const hourAgo = Date.now() - 3600e3;
  // Keys are writes/<user>/<timestamp>-<random>; compare the timestamp part.
  const recent = blobs.filter((b) => Number(b.key.split("/").pop()!.split("-")[0]) > hourAgo);
  // Tidy up entries older than an hour.
  await Promise.all(blobs.filter((b) => !recent.includes(b)).map((b) => store.delete(b.key)));
  return recent.length >= MAX_RECENT_WRITES;
}

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in to use the Deal Community." }, 401);
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  const store = getStore({ name: "deal-community", consistency: "strong" });

  if (request.method === "GET") {
    const url = new URL(request.url);
    const room = url.searchParams.get("room");
    if (room) {
      if (!ROOMS.has(room)) return json({ error: "That region doesn't exist." }, 404);
      return json({ messages: await readNotes(store, `messages/${room}/`, user.id, isAdmin, 200) });
    }
    const repliesTo = url.searchParams.get("replies");
    if (repliesTo) {
      if (!ID.test(repliesTo)) return json({ error: "A valid deal is required." }, 400);
      return json({ replies: await readNotes(store, `replies/${repliesTo}/`, user.id, isAdmin, 300) });
    }
    const replyCounts = new Map<string, number>();
    for (const b of (await store.list({ prefix: "replies/" })).blobs) {
      const postId = b.key.split("/")[1];
      replyCounts.set(postId, (replyCounts.get(postId) || 0) + 1);
    }
    const { blobs } = await store.list({ prefix: "posts/" });
    const posts = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<Post | null>)))
      .filter((p): p is Post => !!p)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 500)
      .map(({ authorId, ...post }) => ({ ...post, replyCount: replyCounts.get(post.id) || 0, mine: authorId === user.id, canDelete: authorId === user.id || isAdmin }));
    return json({ posts });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ error: "Deal details are required." }, 400);
    if (!isAdmin) {
      const accounts = getStore({ name: "deal-premium-accounts", consistency: "strong" });
      const state = await accounts.get(`users/${user.id}/state`, { type: "json" }) as Record<string, unknown> | null;
      if (state?.accountEnabled === false) return json({ error: "This account has been suspended. Contact Deal Pro support." }, 403);
    }

    if (body.kind === "message" || body.kind === "reply") {
      const message = noteText(body.text);
      if (!message) return json({ error: "Write a message first." }, 400);
      let prefix: string;
      if (body.kind === "message") {
        const room = String(body.room ?? "");
        if (!ROOMS.has(room)) return json({ error: "Choose a region." }, 400);
        prefix = `messages/${room}/`;
      } else {
        const postId = String(body.postId ?? "");
        if (!ID.test(postId) || !(await store.getMetadata(`posts/${postId}`))) return json({ error: "That deal has been removed." }, 404);
        prefix = `replies/${postId}/`;
      }
      if (!isAdmin && await tooManyWrites(store, user.id)) return json({ error: "You've sent a lot of messages in the last hour. Please try again later." }, 429);
      const u = user as { name?: string; email?: string };
      const authorName = text(u.name, 80) || text(u.email?.split("@")[0], 80) || "Member";
      const { id, createdAt } = newId();
      const note: Note = { id, authorId: user.id, authorName, createdAt, text: message };
      await store.setJSON(prefix + id, note);
      if (!isAdmin) await store.set(`writes/${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, "");
      const { authorId, ...shown } = note;
      return json({ [body.kind]: { ...shown, mine: true, canDelete: true } }, 201);
    }

    if (!isAdmin) {
      const { blobs } = await store.list({ prefix: `posts/` });
      const own = (await Promise.all(blobs.map((b) => store.getMetadata(b.key))))
        .filter((m) => m?.metadata?.authorId === user.id).length;
      if (own >= MAX_POSTS_PER_USER) return json({ error: `You can have up to ${MAX_POSTS_PER_USER} deals posted. Delete an old one first.` }, 429);
    }
    const { post, error } = validate(body);
    if (!post) return json({ error }, 400);
    const { id, createdAt } = newId();
    const record: Post = { id, authorId: user.id, createdAt, ...post };
    await store.setJSON(`posts/${id}`, record, { metadata: { authorId: user.id } });
    return json({ post: { ...post, id, createdAt, replyCount: 0, mine: true, canDelete: true } }, 201);
  }

  if (request.method === "DELETE") {
    const body = await request.json().catch(() => null) as { id?: string; kind?: string; room?: string; postId?: string } | null;
    if (body?.kind === "message" || body?.kind === "reply") {
      const where = body.kind === "message" ? String(body.room ?? "") : String(body.postId ?? "");
      if (!body.id || !ID.test(body.id) || (body.kind === "message" ? !ROOMS.has(where) : !ID.test(where))) return json({ error: "A valid message is required." }, 400);
      const key = `${body.kind === "message" ? "messages" : "replies"}/${where}/${body.id}`;
      const note = await store.get(key, { type: "json" }) as Note | null;
      if (!note) return json({ error: "That message has already been removed." }, 404);
      if (note.authorId !== user.id && !isAdmin) return json({ error: "You can only delete your own messages." }, 403);
      await store.delete(key);
      return json({ deleted: true });
    }
    if (!body?.id || !ID.test(body.id)) return json({ error: "A valid deal is required." }, 400);
    const key = `posts/${body.id}`;
    const post = await store.get(key, { type: "json" }) as Post | null;
    if (!post) return json({ error: "That deal has already been removed." }, 404);
    if (post.authorId !== user.id && !isAdmin) return json({ error: "You can only delete your own deals." }, 403);
    await store.delete(key);
    // Remove the deal's replies with it.
    const { blobs } = await store.list({ prefix: `replies/${body.id}/` });
    await Promise.all(blobs.map((b) => store.delete(b.key)));
    return json({ deleted: true });
  }

  return json({ error: "Method not allowed." }, 405);
};

export const config: Config = { path: "/api/community", method: ["GET", "POST", "DELETE"] };
