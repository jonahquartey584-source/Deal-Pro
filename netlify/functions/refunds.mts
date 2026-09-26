import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

// Refund requests. Members ask for a refund of their subscription; the admin approves or
// declines. Approving refunds the customer's latest Stripe payment, cancels the
// subscription and moves the account to Free. Needs STRIPE_SECRET_KEY (a restricted key
// with Charges read, Refunds write and Subscriptions write); without it, approving marks
// the request so the admin can refund by hand in Stripe.
const ADMIN_EMAIL = "jonahquartey584@gmail.com";
const REFUND_WINDOW_DAYS = 14;

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const refunds = () => getStore({ name: "deal-refunds", consistency: "strong" });
const accounts = () => getStore({ name: "deal-premium-accounts", consistency: "strong" });

type Request_ = {
  id: string; userId: string; email: string; plan: string; reason: string; createdAt: string;
  status: "pending" | "refunded" | "approved_manual" | "declined"; decidedAt?: string; note?: string;
  amount?: string; stripe?: { customer?: string; subscription?: string; charge?: string; refund?: string };
};

async function stripe(path: string, method = "GET", form?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const data = await res.json().catch(() => ({})) as Record<string, any>;
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

const pence = (n: number, currency = "gbp") => `${currency === "gbp" ? "£" : ""}${(n / 100).toFixed(2)}${currency === "gbp" ? "" : ` ${currency.toUpperCase()}`}`;

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  const store = refunds();
  const all = async () => (await Promise.all((await store.list({ prefix: "req/" })).blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<Request_ | null>)))
    .filter((r): r is Request_ => !!r).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (request.method === "GET") {
    const list = await all();
    if (isAdmin && new URL(request.url).searchParams.get("all")) return json({ requests: list, stripeConnected: !!process.env.STRIPE_SECRET_KEY });
    return json({ requests: list.filter((r) => r.userId === user.id).map(({ stripe: _s, ...r }) => r), windowDays: REFUND_WINDOW_DAYS });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as { reason?: string } | null;
    const reason = String(body?.reason || "").trim().slice(0, 1000);
    if (reason.length < 5) return json({ error: "Tell us briefly why you'd like a refund." }, 400);
    const state = await accounts().get(`users/${user.id}/state`, { type: "json" }) as Record<string, any> | null;
    const plan = String(state?.plan || "Free");
    if (plan === "Free" && !state?.stripe?.customer) return json({ error: "There's no paid subscription on this account to refund." }, 400);
    const mine = (await all()).filter((r) => r.userId === user.id);
    if (mine.some((r) => r.status === "pending")) return json({ error: "You already have a refund request waiting. We'll be in touch soon." }, 409);
    const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const req: Request_ = {
      id, userId: user.id, email: user.email || "", plan, reason, createdAt: new Date().toISOString(), status: "pending",
      stripe: { customer: state?.stripe?.customer, subscription: state?.stripe?.subscription },
    };
    await store.setJSON(`req/${id}`, req);
    const { stripe: _s, ...visible } = req;
    return json({ request: visible }, 201);
  }

  if (request.method === "PATCH") {
    if (!isAdmin) return json({ error: "Administrator access required." }, 403);
    const body = await request.json().catch(() => null) as { id?: string; action?: string; note?: string } | null;
    if (!body?.id || !/^[0-9]+-[0-9a-f]{8}$/.test(body.id)) return json({ error: "A valid request is required." }, 400);
    const key = `req/${body.id}`;
    const req = await store.get(key, { type: "json" }) as Request_ | null;
    if (!req) return json({ error: "Request not found." }, 404);
    if (req.status !== "pending") return json({ error: "This request has already been decided." }, 409);
    req.note = String(body.note || "").slice(0, 500);
    req.decidedAt = new Date().toISOString();

    if (body.action === "decline") {
      req.status = "declined";
      await store.setJSON(key, req);
      return json({ request: req });
    }
    if (body.action !== "approve") return json({ error: "Unknown action." }, 400);

    if (process.env.STRIPE_SECRET_KEY && req.stripe?.customer) {
      try {
        // Refund the customer's most recent successful payment.
        const charges = await stripe(`charges?customer=${encodeURIComponent(req.stripe.customer)}&limit=10`);
        const charge = (charges.data || []).find((c: any) => c.paid && c.status === "succeeded" && !c.refunded);
        if (!charge) throw new Error("No refundable payment was found for this customer.");
        const refund = await stripe("refunds", "POST", { charge: charge.id, reason: "requested_by_customer" });
        req.stripe = { ...req.stripe, charge: charge.id, refund: refund.id };
        req.amount = pence(refund.amount, refund.currency);
        if (req.stripe.subscription) await stripe(`subscriptions/${encodeURIComponent(req.stripe.subscription)}`, "DELETE").catch((e) => console.warn("Cancel failed", e));
        req.status = "refunded";
      } catch (error) {
        return json({ error: `Stripe refused the refund: ${(error as Error).message}` }, 502);
      }
    } else {
      req.status = "approved_manual";
    }
    // Move the account back to Free.
    const stateKey = `users/${req.userId}/state`;
    const state = await accounts().get(stateKey, { type: "json" }) as Record<string, unknown> | null;
    if (state) {
      const meta = (await accounts().getMetadata(stateKey))?.metadata || {};
      state.plan = "Free";
      await accounts().setJSON(stateKey, state, { metadata: { ...meta, updatedAt: new Date().toISOString() } });
    }
    await store.setJSON(key, req);
    return json({ request: req });
  }

  return json({ error: "Method not allowed." }, 405);
};

export const config: Config = { path: "/api/refunds", method: ["GET", "POST", "PATCH"] };
