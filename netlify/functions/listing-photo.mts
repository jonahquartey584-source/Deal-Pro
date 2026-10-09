import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { PHOTO_HOSTS } from "../lib/photos.mts";

// Listing photos on Deal Pro. The first time a photo is shown, it is copied from the listing site's
// image server into Deal Pro's own storage; after that Deal Pro serves its copy, so the photo still
// shows when the site blocks outside pages or the advert is taken down. Only pictures from the
// listing sites' image servers are copied, up to 4 MB each.

const MAX_BYTES = 4_000_000;
const TYPES = /^image\/(jpeg|png|webp|avif|gif)$/i;
const store = () => getStore({ name: "listing-photos" });
const CACHE = {
  "Cache-Control": "public, max-age=604800",
  "Netlify-CDN-Cache-Control": "public, max-age=31536000, durable",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};

async function keyFor(url: string) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url)));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default async (request: Request, _context: Context) => {
  const raw = new URL(request.url).searchParams.get("u") || "";
  let src: URL;
  try { src = new URL(raw); } catch { return new Response("Not found", { status: 404 }); }
  if (src.protocol !== "https:" || !PHOTO_HOSTS.test(src.hostname) || raw.length > 800) return new Response("Not found", { status: 404 });

  const key = await keyFor(src.href);
  const saved = await store().getWithMetadata(key, { type: "arrayBuffer" }).catch(() => null);
  if (saved?.data) {
    return new Response(saved.data, { headers: { ...CACHE, "Content-Type": String(saved.metadata?.type || "image/jpeg") } });
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(src.href, { redirect: "follow", signal: ctl.signal, headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
      "Accept": "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8" } });
    const type = (r.headers.get("content-type") || "").split(";")[0].trim();
    const landed = new URL(r.url || src.href).hostname;
    if (!r.ok || !PHOTO_HOSTS.test(landed) || !TYPES.test(type) || Number(r.headers.get("content-length") || 0) > MAX_BYTES) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
    const body = await r.arrayBuffer();
    if (!body.byteLength || body.byteLength > MAX_BYTES) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
    await store().set(key, body, { metadata: { type, src: src.href, savedAt: new Date().toISOString() } }).catch((error) => console.error("Couldn't save a listing photo", error));
    return new Response(body, { headers: { ...CACHE, "Content-Type": type } });
  } catch {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=600" } });
  } finally { clearTimeout(timer); }
};

export const config: Config = { path: "/listing-photo", method: ["GET"] };
