import type { Config } from "@netlify/functions";
import { JWT, REFRESH, sessionCookies } from "../lib/session-cookies.mts";

// Renews a member's sign-in. A refresh token works once, so if the page asked Netlify Identity
// directly and was then closed or suspended before the answer arrived, the new tokens were lost
// and the old one was already spent: the member was signed out. Here the server makes the same
// request and sets the new tokens as cookies itself, so the browser keeps them even when the page
// is gone. The page adopts them next time it opens. The answer is passed back unchanged.

export default async (request: Request) => {
  const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json", "X-Dealpro-Proxy": "1" });
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response('{"error":"Not allowed"}', { status: 403, headers });
  const form = new URLSearchParams(await request.text());
  const token = form.get("refresh_token") || "";
  if (form.get("grant_type") !== "refresh_token" || !REFRESH.test(token)) return new Response('{"error":"Bad request"}', { status: 400, headers });

  let upstream: Response;
  try {
    upstream = await fetch(new URL("/.netlify/identity/token", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: token }),
    });
  } catch {
    // Couldn't reach Identity. Without the marker header the page asks Identity itself.
    headers.delete("X-Dealpro-Proxy");
    return new Response('{"error":"Unavailable"}', { status: 502, headers });
  }
  const text = await upstream.text();
  if (upstream.ok) {
    try {
      const data = JSON.parse(text);
      if (JWT.test(data.access_token) && REFRESH.test(data.refresh_token)) sessionCookies(data.access_token, data.refresh_token, headers);
    } catch { /* the page still gets the answer */ }
  }
  return new Response(text, { status: upstream.status, headers });
};

export const config: Config = { path: "/api/session-refresh", method: "POST" };
