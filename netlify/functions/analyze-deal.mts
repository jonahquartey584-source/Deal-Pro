import OpenAI from "openai";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in to analyse a deal." }, 401);

  const body = await request.json().catch(() => null) as { deal?: string } | null;
  const deal = body?.deal?.trim();
  if (!deal) return json({ error: "Paste the property advert or deal details first." }, 400);
  if (deal.length > 30_000) return json({ error: "Deal details must be under 30,000 characters." }, 413);

  const client = new OpenAI();
  const completion = await client.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are Deal Pro's UK property deal analyst. Analyse rent-to-rent and rent-to-serviced-accommodation opportunities conservatively. Never invent missing figures or claim that legal/planning/licensing checks are complete. Return valid JSON with exactly these keys: verdict (one of Strong, Potential, Weak, Insufficient information), summary (plain English, max 80 words), score (integer 0-100), monthly_profit (string), upfront_cash (string), break_even (string), risks (array of short strings), missing_information (array of short strings), next_actions (array of short strings). Clearly flag the London 90-night rule when relevant and tell the user to verify licensing, planning, lease/mortgage, insurance, landlord consent, and figures with qualified professionals.`,
      },
      { role: "user", content: deal },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return json({ error: "The AI did not return an analysis. Please try again." }, 502);
  return json({ analysis: JSON.parse(content) });
};

export const config: Config = {
  path: "/api/analyze-deal",
  method: "POST",
};
