// The Netlify Identity cookies the page reads, set from the server so browsers don't cut them short
// (Safari deletes cookies that page scripts write after 7 days).
export const MAX_AGE = 60 * 60 * 24 * 365; // rolling: renewed on every visit and token refresh
export const JWT = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
export const REFRESH = /^[A-Za-z0-9_-]{8,256}$/;

export const cookie = (name: string, value: string, maxAge: number) =>
  `${name}=${value}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;

export const sessionCookies = (jwt: string, refresh: string, headers: Headers) => {
  headers.append("Set-Cookie", cookie("nf_jwt", encodeURIComponent(jwt), MAX_AGE));
  headers.append("Set-Cookie", cookie("nf_refresh", encodeURIComponent(refresh), MAX_AGE));
};
