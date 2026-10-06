import{createRequire as __cr}from'module';const require=__cr(import.meta.url);

// netlify/functions/session.mts
var MAX_AGE = 60 * 60 * 24 * 90;
var JWT = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
var REFRESH = /^[A-Za-z0-9_-]{8,256}$/;
var cookie = (name, value, maxAge) => `${name}=${value}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;
var session_default = async (request, context) => {
  const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json" });
  if (request.method === "DELETE") {
    headers.append("Set-Cookie", cookie("nf_jwt", "", 0));
    headers.append("Set-Cookie", cookie("nf_refresh", "", 0));
    return new Response('{"ok":true}', { headers });
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response('{"error":"Not allowed"}', { status: 403, headers });
  const jwt = decodeURIComponent(context.cookies.get("nf_jwt") || "");
  const refresh = decodeURIComponent(context.cookies.get("nf_refresh") || "");
  if (!JWT.test(jwt) || !REFRESH.test(refresh)) return new Response('{"ok":false}', { status: 400, headers });
  headers.append("Set-Cookie", cookie("nf_jwt", encodeURIComponent(jwt), MAX_AGE));
  headers.append("Set-Cookie", cookie("nf_refresh", encodeURIComponent(refresh), MAX_AGE));
  return new Response('{"ok":true}', { headers });
};
var config = { path: "/api/session", method: ["POST", "DELETE"] };
export {
  config,
  session_default as default
};
