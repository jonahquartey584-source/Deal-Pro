import type { Config, Context } from "@netlify/functions";

// Keeps members signed in. Browsers cut short cookies that page scripts write (Safari deletes
// them after 7 days), so after each sign-in or token refresh the page asks the server to set the
// same Netlify Identity cookies again, which lasts the full period. It only echoes back cookies
// the browser already holds, so it grants nothing new. DELETE clears them on sign-out.
const MAX_AGE = 60 * 60 * 24 * 90; // rolling: renewed on every visit
const JWT = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
const REFRESH = /^[A-Za-z0-9_-]{8,256}$/;

const cookie = (name: string, value: string, maxAge: number) =>
  `${name}=${value}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;

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
  const jwt = decodeURIComponent(context.cookies.get("nf_jwt") || "");
  const refresh = decodeURIComponent(context.cookies.get("nf_refresh") || "");
  if (!JWT.test(jwt) || !REFRESH.test(refresh)) return new Response('{"ok":false}', { status: 400, headers });
  headers.append("Set-Cookie", cookie("nf_jwt", encodeURIComponent(jwt), MAX_AGE));
  headers.append("Set-Cookie", cookie("nf_refresh", encodeURIComponent(refresh), MAX_AGE));
  return new Response('{"ok":true}', { headers });
};

export const config: Config = { path: "/api/session", method: ["POST", "DELETE"] };
