import type { Config, Context } from "@netlify/functions";
import { jobs, refundJob, runAnalysis, runRank, type LevelId } from "../lib/ai.mts";

// Background function: runs the AI analysis for a job created by analyze-deal and
// stores the result. It can run for up to 15 minutes, so deep analyses don't time out.
export default async (request: Request, _context: Context) => {
  const body = await request.json().catch(() => null) as { jobId?: string; runToken?: string } | null;
  if (!body?.jobId || !body.runToken) return;
  const store = jobs();
  const job = await store.get(body.jobId, { type: "json" }) as Record<string, unknown> | null;
  // Only the server that created the job knows its run token.
  if (!job || job.runToken !== body.runToken || job.status !== "queued") return;
  await store.setJSON(body.jobId, { ...job, status: "running", startedAt: new Date().toISOString() });

  try {
    const run = job.kind === "rank" ? runRank : runAnalysis;
    const analysis = await run(String(job.input), job.level as LevelId);
    await store.setJSON(body.jobId, { ...job, status: "done", analysis, runToken: null, finishedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Deal analysis failed", error);
    await refundJob(body.jobId, job, "The analysis could not be completed. Your credits have not been used; please try again.");
  }
};

export const config: Config = {
  path: "/api/analyze-deal-run",
  method: "POST",
  background: true,
};
