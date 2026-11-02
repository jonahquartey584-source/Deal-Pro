import type { Config, Context } from "@netlify/functions";
import { JWT, REFRESH, cookie, sessionCookies } from "../lib/session-cookies.mts";

// Keeps members signed in. Browsers cut short cookies that page scripts write (Safari deletes
// them after 7 days), so after each sign-in or token refresh the page asks the server to set the
// same Netlify Identity cookies again, which lasts the full period. The page sends the tokens it
// holds (or, failing that, the cookies it already has are echoed back), so this grants nothing new.
// DELETE clears them on sign-out.

export default async (request: Request, context: Context) => {
  const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json" });
  if (request.method === "DELETE") {
    headers.append("Set-Cookie", cookie("nf_jwt", "", 0));
    headers.append("Set-Cookie", cookie("nf_refresh", "", 0));
    return new Response('{"ok":true}', { headers });
  }
  // Only same-site requests from the page itself.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response('{"error":"Not allowed"}', { status: 403, headers });
  let jwt = decodeURIComponent(context.cookies.get("nf_jwt") || "");
  let refresh = decodeURIComponent(context.cookies.get("nf_refresh") || "");
  const sent = await request.json().catch(() => null) as { jwt?: unknown; refresh?: unknown } | null;
  if (typeof sent?.jwt === "string" && typeof sent?.refresh === "string" && JWT.test(sent.jwt) && REFRESH.test(sent.refresh)) {
    jwt = sent.jwt;
    refresh = sent.refresh;
  }
  if (!JWT.test(jwt) || !REFRESH.test(refresh)) return new Response('{"ok":false}', { status: 400, headers });
  sessionCookies(jwt, refresh, headers);
  return new Response('{"ok":true}', { headers });
};

export const config: Config = { path: "/api/session", method: ["POST", "DELETE"] };
