import{createRequire as __cr}from'module';const require=__cr(import.meta.url);

// downloads/local-src/blobs-shim.mjs
import fs from "node:fs";
import path from "node:path";
var ROOT = path.resolve(process.env.DEALPRO_DATA || "local-data");
var enc = (k) => encodeURIComponent(k).replace(/\./g, "%2E");
function getStore(opts) {
  const name = typeof opts === "string" ? opts : opts.name;
  const dir = path.join(ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  const f = (k) => path.join(dir, enc(k));
  const readMeta = (k) => {
    try {
      return JSON.parse(fs.readFileSync(f(k) + ".meta", "utf8"));
    } catch {
      return {};
    }
  };
  const raw = (k) => {
    try {
      return fs.readFileSync(f(k));
    } catch {
      return null;
    }
  };
  const out = (buf, type) => buf == null ? null : type === "json" ? JSON.parse(buf.toString("utf8")) : type === "arrayBuffer" ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf.toString("utf8");
  const put = (k, v, o) => {
    fs.writeFileSync(f(k), typeof v === "string" || Buffer.isBuffer(v) ? v : v instanceof ArrayBuffer ? Buffer.from(v) : ArrayBuffer.isView(v) ? Buffer.from(v.buffer, v.byteOffset, v.byteLength) : String(v));
    fs.writeFileSync(f(k) + ".meta", JSON.stringify(o?.metadata || {}));
  };
  return {
    async get(k, o) {
      return out(raw(k), o?.type);
    },
    async getWithMetadata(k, o) {
      const b = raw(k);
      return b == null ? null : { data: out(b, o?.type), metadata: readMeta(k), etag: "local" };
    },
    async getMetadata(k) {
      return raw(k) == null ? null : { metadata: readMeta(k), etag: "local" };
    },
    async set(k, v, o) {
      put(k, v, o);
      return { modified: true };
    },
    async setJSON(k, v, o) {
      put(k, JSON.stringify(v), o);
      return { modified: true };
    },
    async delete(k) {
      for (const p of [f(k), f(k) + ".meta"]) try {
        fs.unlinkSync(p);
      } catch {
      }
    },
    async list(o) {
      const prefix = o?.prefix || "";
      const blobs = fs.readdirSync(dir).filter((n) => !n.endsWith(".meta")).map((n) => decodeURIComponent(n)).filter((k) => k.startsWith(prefix)).map((key) => ({ key, etag: "local" }));
      return { blobs, directories: [] };
    }
  };
}

// downloads/local-src/identity-shim.mjs
async function getUser() {
  const als = globalThis.__dpUser;
  if (als) return als.getStore() ?? null;
  return { id: "local-admin", email: "jonahquartey584@gmail.com", name: "Jonah" };
}

// netlify/functions/community.mts
var ADMIN_EMAIL = "jonahquartey584@gmail.com";
var STRATEGIES = ["R2SA", "R2R", "BTL", "HMO", "BRRR", "Lease option", "Flip", "Other"];
var PROPERTY_TYPES = ["Flat", "House", "Studio", "HMO", "Commercial", "Other"];
var CONTACTED = ["Landlord", "Agent"];
var MAX_POSTS_PER_USER = 20;
var MONTHLY_POSTS = { Lite: 3, Pro: 10 };
var UNLIMITED_PLANS = /* @__PURE__ */ new Set(["Max5", "Max20"]);
var monthKey = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
var REGIONS = ["London", "South East", "East of England", "South West", "Midlands", "North West", "North East", "Yorkshire and Humber", "Scotland", "Wales", "Northern Ireland", "Other"];
var slug = (region) => region.toLowerCase().replace(/[^a-z]+/g, "-");
var ROOMS = new Map(REGIONS.map((r) => [slug(r), r]));
var MAX_MESSAGE = 1e3;
var MAX_RECENT_WRITES = 30;
var ID = /^[0-9]+-[0-9a-f]{8}$/;
var json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" }
});
var text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
function validate(body) {
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
  if (!Number.isFinite(price) || price <= 0 || price > 1e8) return { error: "Enter the price as a number." };
  if (bedsRaw !== null && (!Number.isFinite(bedsRaw) || bedsRaw < 0 || bedsRaw > 50)) return { error: "Enter a valid number of bedrooms." };
  if (listingUrl && !/^https?:\/\/\S+$/i.test(listingUrl)) return { error: "The listing link must start with http:// or https://." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) return { error: "Enter a contact email." };
  return {
    post: {
      title,
      location,
      postcode,
      region,
      strategy,
      propertyType,
      contacted,
      priceType,
      price,
      beds: bedsRaw,
      listingUrl,
      contactEmail,
      status: text(body.status, 120),
      description: String(body.description ?? "").trim().slice(0, 2e3),
      contactName: text(body.contactName, 80),
      contactPhone: text(body.contactPhone, 30)
    }
  };
}
var newId = () => {
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  return { createdAt, id: `${createdAt.replace(/[^0-9]/g, "")}-${crypto.randomUUID().slice(0, 8)}` };
};
var noteText = (value) => String(value ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_MESSAGE);
async function readNotes(store, prefix, userId, isAdmin, limit) {
  const { blobs } = await store.list({ prefix });
  const keys = blobs.map((b) => b.key).sort().slice(-limit);
  return (await Promise.all(keys.map((k) => store.get(k, { type: "json" })))).filter((n) => !!n).map(({ authorId, ...note }) => ({ ...note, mine: authorId === userId, canDelete: authorId === userId || isAdmin }));
}
async function tooManyWrites(store, userId) {
  const { blobs } = await store.list({ prefix: `writes/${userId}/` });
  const hourAgo = Date.now() - 36e5;
  const recent = blobs.filter((b) => Number(b.key.split("/").pop().split("-")[0]) > hourAgo);
  await Promise.all(blobs.filter((b) => !recent.includes(b)).map((b) => store.delete(b.key)));
  return recent.length >= MAX_RECENT_WRITES;
}
var community_default = async (request, _context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in to use the Deal Community." }, 401);
  const u = user;
  const authorName = text(u.name, 80) || text(u.email?.split("@")[0], 80) || "Member";
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  const store = getStore({ name: "deal-community", consistency: "strong" });
  const accountState = async () => await getStore({ name: "deal-premium-accounts", consistency: "strong" }).get(`users/${user.id}/state`, { type: "json" });
  const posting = async (state) => {
    const plan = isAdmin ? "Admin" : String(state?.plan || "Free");
    const used = Number(await store.get(`postcount/${user.id}/${monthKey()}`)) || 0;
    if (isAdmin || UNLIMITED_PLANS.has(plan)) return { plan, allowed: true, limit: null, used, left: null };
    const limit = MONTHLY_POSTS[plan] ?? 0;
    return { plan, allowed: limit > 0 && used < limit, limit, used, left: Math.max(0, limit - used) };
  };
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
    const replyCounts = /* @__PURE__ */ new Map();
    for (const b of (await store.list({ prefix: "replies/" })).blobs) {
      const postId = b.key.split("/")[1];
      replyCounts.set(postId, (replyCounts.get(postId) || 0) + 1);
    }
    const { blobs } = await store.list({ prefix: "posts/" });
    const posts = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter((p) => !!p).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500).map(({ authorId, ...post }) => ({ ...post, replyCount: replyCounts.get(post.id) || 0, mine: authorId === user.id, canDelete: authorId === user.id || isAdmin }));
    return json({ posts, posting: await posting(await accountState()) });
  }
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "Deal details are required." }, 400);
    const state = isAdmin ? null : await accountState();
    if (!isAdmin && state?.accountEnabled === false) return json({ error: "This account has been suspended. Contact Deal Pro support." }, 403);
    if (body.kind === "message" || body.kind === "reply") {
      const message2 = noteText(body.text);
      if (!message2) return json({ error: "Write a message first." }, 400);
      let prefix;
      if (body.kind === "message") {
        const room = String(body.room ?? "");
        if (!ROOMS.has(room)) return json({ error: "Choose a region." }, 400);
        prefix = `messages/${room}/`;
      } else {
        const postId = String(body.postId ?? "");
        if (!ID.test(postId) || !await store.getMetadata(`posts/${postId}`)) return json({ error: "That deal has been removed." }, 404);
        prefix = `replies/${postId}/`;
      }
      if (!isAdmin && await tooManyWrites(store, user.id)) return json({ error: "You've sent a lot of messages in the last hour. Please try again later." }, 429);
      const { id: id2, createdAt: createdAt2 } = newId();
      const note = { id: id2, authorId: user.id, authorName, createdAt: createdAt2, text: message2 };
      await store.setJSON(prefix + id2, note);
      if (!isAdmin) await store.set(`writes/${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, "");
      const { authorId, ...shown } = note;
      return json({ [body.kind]: { ...shown, mine: true, canDelete: true } }, 201);
    }
    const allowance = await posting(state);
    if (!allowance.allowed) {
      return json(allowance.limit ? { error: `You've posted your ${allowance.limit} deals for this month. Upgrade to Max for unlimited posts.`, posting: allowance } : { error: "Posting deals needs a paid plan (Lite, Premium or Max). You can still browse deals, reply and use the region chat.", posting: allowance }, 402);
    }
    if (!isAdmin) {
      const { blobs } = await store.list({ prefix: `posts/` });
      const own = (await Promise.all(blobs.map((b) => store.getMetadata(b.key)))).filter((m) => m?.metadata?.authorId === user.id).length;
      if (own >= MAX_POSTS_PER_USER) return json({ error: `You can have up to ${MAX_POSTS_PER_USER} deals posted. Delete an old one first.` }, 429);
    }
    const { post, error } = validate(body);
    if (!post) return json({ error }, 400);
    const { id, createdAt } = newId();
    const record = { id, authorId: user.id, createdAt, ...post };
    await store.setJSON(`posts/${id}`, record, { metadata: { authorId: user.id } });
    await store.set(`postcount/${user.id}/${monthKey()}`, String(allowance.used + 1));
    let message;
    if (body.announce === true) {
      const deal = { id, title: post.title, location: post.location, postcode: post.postcode, price: post.price, priceType: post.priceType, strategy: post.strategy, propertyType: post.propertyType, beds: post.beds };
      const m = newId();
      const note = { id: m.id, authorId: user.id, authorName, createdAt: m.createdAt, text: noteText(body.announceText), deal };
      await store.setJSON(`messages/${slug(post.region ?? "")}/${m.id}`, note);
      const { authorId, ...shown } = note;
      message = { ...shown, mine: true, canDelete: true };
    }
    return json({ post: { ...post, id, createdAt, replyCount: 0, mine: true, canDelete: true }, message, room: slug(post.region ?? ""), posting: await posting(state) }, 201);
  }
  if (request.method === "DELETE") {
    const body = await request.json().catch(() => null);
    if (body?.kind === "message" || body?.kind === "reply") {
      const where = body.kind === "message" ? String(body.room ?? "") : String(body.postId ?? "");
      if (!body.id || !ID.test(body.id) || (body.kind === "message" ? !ROOMS.has(where) : !ID.test(where))) return json({ error: "A valid message is required." }, 400);
      const key2 = `${body.kind === "message" ? "messages" : "replies"}/${where}/${body.id}`;
      const note = await store.get(key2, { type: "json" });
      if (!note) return json({ error: "That message has already been removed." }, 404);
      if (note.authorId !== user.id && !isAdmin) return json({ error: "You can only delete your own messages." }, 403);
      await store.delete(key2);
      return json({ deleted: true });
    }
    if (!body?.id || !ID.test(body.id)) return json({ error: "A valid deal is required." }, 400);
    const key = `posts/${body.id}`;
    const post = await store.get(key, { type: "json" });
    if (!post) return json({ error: "That deal has already been removed." }, 404);
    if (post.authorId !== user.id && !isAdmin) return json({ error: "You can only delete your own deals." }, 403);
    await store.delete(key);
    const { blobs } = await store.list({ prefix: `replies/${body.id}/` });
    await Promise.all(blobs.map((b) => store.delete(b.key)));
    return json({ deleted: true });
  }
  return json({ error: "Method not allowed." }, 405);
};
var config = { path: "/api/community", method: ["GET", "POST", "DELETE"] };
export {
  config,
  community_default as default
};
