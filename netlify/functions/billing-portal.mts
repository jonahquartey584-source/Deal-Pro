import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

// Opens Stripe's customer portal so subscribers can switch plan, update their card or
// cancel. Plan changes come back through the Stripe webhook. Needs STRIPE_SECRET_KEY
// (restricted key with Customer portal: Write) and the portal switched on in Stripe.
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const state = await getStore({ name: "deal-premium-accounts", consistency: "strong" })
    .get(`users/${user.id}/state`, { type: "json" }) as Record<string, any> | null;
  const customer = state?.stripe?.customer;
  if (!customer) return json({ error: "no_subscription" }, 404);
  if (!process.env.STRIPE_SECRET_KEY) return json({ error: "portal_unavailable" }, 503);
  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ customer, return_url: new URL("/?billing=1", request.url).toString() }).toString(),
  });
  const data = await res.json().catch(() => ({})) as Record<string, any>;
  if (!res.ok || !data.url) {
    console.error("Billing portal failed", data?.error?.message);
    return json({ error: "portal_unavailable" }, 502);
  }
  return json({ url: data.url });
};

export const config: Config = { path: "/api/billing-portal", method: "POST" };
