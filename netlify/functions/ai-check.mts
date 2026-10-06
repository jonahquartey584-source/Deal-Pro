import OpenAI from "openai";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

// Admin-only health check for the AI setup. Open /api/ai-check while signed in as the admin.
// It runs a tiny request for each model and search setup the site uses and reports which work.
// No keys or secrets are included in the response.
const ADMIN_EMAIL = "jonahquartey584@gmail.com";

const within = <T,>(ms: number, p: Promise<T>) => Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error(`timed out after ${ms / 1000}s`)), ms))]);
const describe = (error: unknown) => { const e = error as { status?: number; message?: string }; return `${e.status ? `${e.status} ` : ""}${String(e.message || error).slice(0, 400)}`; };

export default async (_request: Request, _context: Context) => {
  const user = await getUser();
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) return Response.json({ error: "Administrator access required." }, { status: 403 });

  const base = process.env.OPENAI_BASE_URL;
  const setup = {
    openaiKeySet: !!process.env.OPENAI_API_KEY,
    // Netlify's AI Gateway sets its own base URL; only the host is shown.
    endpoint: base ? (() => { try { return new URL(base).host; } catch { return "custom"; } })() : "api.openai.com (default)",
    modelOverrides: { quick: process.env.AI_MODEL_QUICK || null, standard: process.env.AI_MODEL_STANDARD || null, deep: process.env.AI_MODEL_DEEP || null },
  };
  if (base && !/(^|\.)openai\.com$/i.test(setup.endpoint)) return Response.json({ setup, results: [], summary: "OPENAI_API_KEY is Netlify's AI Gateway key, so the AI is switched off to avoid using Netlify credits. Add your own OpenAI key as OPENAI_API_KEY in the Netlify environment variables." });
  if (!setup.openaiKeySet) return Response.json({ setup, results: [], summary: "OPENAI_API_KEY is not set, so no AI features can work." });

  const client = new OpenAI();
  const chat = (model: string, reasoning: boolean) => client.chat.completions.create({
    model, messages: [{ role: "user", content: 'Reply with {"ok":true}' }], response_format: { type: "json_object" }, ...(reasoning ? { reasoning_effort: "low" as const } : {}),
  });
  const search = (model: string, tool: "web_search" | "web_search_preview", filters: boolean) => client.responses.create({
    model,
    tools: [tool === "web_search" ? { type: "web_search", ...(filters ? { filters: { allowed_domains: ["openrent.co.uk"] } } : {}) } : { type: "web_search_preview" }],
    input: "Find one flat to rent in Leeds on openrent.co.uk. Reply with its URL only.",
  });
  const tests: Array<[string, () => Promise<unknown>]> = [
    ["Analyser: gpt-5.4-mini (Scout)", () => chat("gpt-5.4-mini", true)],
    ["Analyser: gpt-5.5 (Analyst/Expert)", () => chat("gpt-5.5", true)],
    ["Analyser: gpt-5-mini (fallback)", () => chat("gpt-5-mini", true)],
    ["Analyser: gpt-4.1-mini (last resort)", () => chat("gpt-4.1-mini", false)],
    ["Search: gpt-5-mini + web_search with site filter", () => search("gpt-5-mini", "web_search", true)],
    ["Search: gpt-5-mini + web_search", () => search("gpt-5-mini", "web_search", false)],
    ["Search: gpt-4.1-mini + web_search_preview", () => search("gpt-4.1-mini", "web_search_preview", false)],
  ];
  const results = await Promise.all(tests.map(async ([name, run]) => {
    const t0 = Date.now();
    try { await within(22_000, run()); return { test: name, ok: true, ms: Date.now() - t0 }; }
    catch (error) { return { test: name, ok: false, ms: Date.now() - t0, error: describe(error) }; }
  }));
  const analyser = results.slice(0, 4).some((r) => r.ok), searching = results.slice(4).some((r) => r.ok);
  return Response.json({
    setup,
    summary: `Deal Analyser: ${analyser ? "working" : "NOT working"}. Deal Finder live search: ${searching ? "working" : "NOT working"}.`,
    results,
  }, { headers: { "Cache-Control": "no-store" } });
};

export const config: Config = { path: "/api/ai-check", method: "GET" };
