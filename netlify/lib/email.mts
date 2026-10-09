// Emails sent on behalf of Deal Pro from hello@qp-digital.co.uk, through Resend (resend.com).
// Needs RESEND_API_KEY in the environment, and qp-digital.co.uk verified in Resend so it may send from that
// address. Without the key nothing is sent and the site carries on as normal.
import { FREE_ANALYSES, FREE_SEARCHES_PER_WEEK } from "./plans.mts";

export const EMAIL_FROM = process.env.EMAIL_FROM || "Deal Pro <hello@qp-digital.co.uk>";
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "hello@qp-digital.co.uk";
const SITE = "https://usedealpro.com";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const validEmail = (e: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e) && e.length <= 254;

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "RESEND_API_KEY is not set" };
  if (!validEmail(msg.to)) return { sent: false, reason: "not a valid email address" };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(process.env.EMAIL_API_URL || "https://api.resend.com/emails", {
      method: "POST", signal: ctl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, reply_to: EMAIL_REPLY_TO, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    if (!r.ok) return { sent: false, reason: `${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}` };
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: String((error as Error)?.message || error) };
  } finally { clearTimeout(timer); }
}

// The one-off email a new member gets after creating an account.
export function welcomeEmail(name: string | undefined | null) {
  const first = String(name || "").trim().split(/\s+/)[0].slice(0, 40);
  const hi = first ? `Hi ${first},` : "Hi there,";
  const steps = [
    "Open Deal Finder, choose your area and budget, and search live property listings. Every result shows the full details and a link to the original advert.",
    "Pick a deal and run it through the Deal Analyser for the numbers, the risks and what to check next.",
    "Browse the Deal Community for deals other sourcers have already spoken to the landlord or agent about.",
  ];
  const free = `Your Free plan includes ${FREE_SEARCHES_PER_WEEK} Deal Finder searches a week and ${FREE_ANALYSES} AI deal ${FREE_ANALYSES === 1 ? "analysis" : "analyses"}. You can upgrade any time from the Plans page.`;
  const foot = "You're getting this one-off email because you created a Deal Pro account. Deal Pro is run by Qp Digital.";
  const text = [hi, "", "Welcome to Deal Pro, and thanks for signing up. Your account is ready.", "", "Here's how to get started:", ...steps.map((s, i) => `${i + 1}. ${s}`), "", free, "", `Sign in: ${SITE}`, "", "Questions? Just reply to this email and we'll help.", "", "The Deal Pro team", "", foot].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#15171a;max-width:560px;line-height:1.5;font-size:15px">
<p>${esc(hi)}</p>
<p>Welcome to <b>Deal Pro</b>, and thanks for signing up. Your account is ready.</p>
<p style="margin-bottom:6px"><b>Here's how to get started:</b></p>
<ol style="margin-top:0;padding-left:20px">${steps.map((s) => `<li style="margin-bottom:6px">${esc(s)}</li>`).join("")}</ol>
<p>${esc(free)}</p>
<p><a href="${SITE}" style="display:inline-block;background:#e0142b;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold">Open Deal Pro</a></p>
<p>Questions? Just reply to this email and we'll help.</p>
<p>The Deal Pro team</p>
<p style="font-size:12px;color:#5b606a;margin-top:24px">${esc(foot)}</p></div>`;
  return { subject: "Welcome to Deal Pro", text, html };
}
