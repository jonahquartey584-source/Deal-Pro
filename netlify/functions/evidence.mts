import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

// Evidence files attached to due diligence checks (tenancy offers, certificates, photos, emails).
// Files are private: only the account that uploaded a file can open or delete it.
// POST (multipart, field "file") uploads; GET ?id= opens; DELETE ?id= removes.
const MAX_BYTES = 4 * 1024 * 1024; // Netlify limits a function request to about 6 MB.
const MAX_FILES = 500;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic",
  "application/pdf": "pdf", "text/plain": "txt", "text/csv": "csv", "message/rfc822": "eml",
  "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
// Browsers sometimes send no type (for example .eml or .heic); fall back to the file extension.
const BY_EXT = Object.fromEntries(Object.entries(TYPES).map(([t, e]) => [e, t]));
BY_EXT.jpeg = "image/jpeg";

const store = () => getStore({ name: "deal-evidence", consistency: "strong" });
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const validId = (id: string | null): id is string => !!id && /^[0-9a-f-]{36}$/.test(id);

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in to manage evidence." }, 401);
  const prefix = `${user.id}/`;
  const id = new URL(request.url).searchParams.get("id");

  if (request.method === "GET") {
    if (!validId(id)) return json({ error: "Unknown file." }, 404);
    const file = await store().getWithMetadata(prefix + id, { type: "arrayBuffer" });
    if (!file) return json({ error: "This file no longer exists." }, 404);
    const meta = file.metadata as { name?: string; type?: string };
    const type = meta.type && TYPES[meta.type] ? meta.type : "application/octet-stream";
    // Images and PDFs open in the browser; anything else downloads. The sandbox stops a file running scripts.
    const inline = type.startsWith("image/") || type === "application/pdf";
    const name = String(meta.name || "evidence").replace(/[^\w .()-]/g, "_");
    return new Response(file.data, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(String(meta.name || "evidence"))}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        ...(type === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'" }),
      },
    });
  }

  if (request.method === "DELETE") {
    if (!validId(id)) return json({ error: "Unknown file." }, 404);
    await store().delete(prefix + id);
    return json({ ok: true });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return json({ error: "Choose a file to upload." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "Files must be under 4 MB. Compress the file or split it, then try again." }, 413);
  if (!file.size) return json({ error: "That file is empty." }, 400);
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const type = TYPES[file.type] ? file.type : BY_EXT[ext];
  if (!type) return json({ error: "Upload a photo, PDF, Word or Excel document, email (.eml), or text or CSV file." }, 415);
  const { blobs } = await store().list({ prefix });
  if (blobs.length >= MAX_FILES) return json({ error: `You've reached the limit of ${MAX_FILES} evidence files. Remove some you no longer need.` }, 409);

  const fileId = crypto.randomUUID();
  const name = file.name.slice(0, 150) || `evidence.${TYPES[type]}`;
  const at = new Date().toISOString();
  await store().set(prefix + fileId, await file.arrayBuffer(), { metadata: { name, type, size: file.size, at } });
  return json({ id: fileId, name, type, size: file.size, at }, 201);
};

export const config: Config = { path: "/api/evidence", method: ["GET", "POST", "DELETE"] };
