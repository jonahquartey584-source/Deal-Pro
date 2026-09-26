import type { Config, Context } from "@netlify/functions";
import { jobs, refundJob, runAnalysis, runRank, newSearch, searchProgress, stepSearch, type LevelId, type SearchState } from "../lib/ai.mts";

// A background function can run for 15 minutes. Searches work for up to 13, save their
// progress and start a fresh run to continue, so an Expert search can take much longer.
const RUN_MS = 13 * 60_000;
const MAX_SEARCH_MS = 90 * 60_000;

// Background function: runs the AI work for a job created by analyze-deal and stores the result.
export default async (request: Request, _context: Context) => {
  const body = await request.json().catch(() => null) as { jobId?: string; runToken?: string } | null;
  if (!body?.jobId || !body.runToken) return;
  const jobId = body.jobId;
  const store = jobs();
  const job = await store.get(jobId, { type: "json" }) as Record<string, unknown> | null;
  // Only the server that queued this run knows its run token.
  if (!job || job.runToken !== body.runToken || job.status !== "queued") return;
  const level = job.level as LevelId;
  const heartbeat = () => new Date().toISOString();
  await store.setJSON(jobId, { ...job, status: "running", startedAt: job.startedAt || heartbeat(), heartbeat: heartbeat() });

  try {
    let analysis: unknown;
    if (job.kind === "search") {
      let st = (job.search as SearchState | undefined) || newSearch(String(job.input), level);
      const save = async (s: SearchState) => {
        await store.setJSON(jobId, { ...job, status: "running", search: s, progress: searchProgress(s), heartbeat: heartbeat() });
      };
      st = await stepSearch(st, level, Date.now() + RUN_MS, save);
      if (st.phase !== "done") {
        if (Date.now() - Date.parse(st.startedAt) > MAX_SEARCH_MS) throw new Error("Search ran too long");
        // Hand over to a fresh run with a new token.
        const runToken = crypto.randomUUID();
        await store.setJSON(jobId, { ...job, status: "queued", runToken, search: st, progress: searchProgress(st), heartbeat: heartbeat() });
        const next = await fetch(new URL("/api/analyze-deal-run", request.url), {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, runToken }),
        });
        if (next.status >= 400) throw new Error(`Could not continue the search (${next.status})`);
        return;
      }
      analysis = { listings: st.listings, sites: st.sites_status, ranking: st.ranking ?? null };
    } else {
      analysis = await (job.kind === "rank" ? runRank : runAnalysis)(String(job.input), level);
    }
    await store.setJSON(jobId, { ...job, status: "done", analysis, search: undefined, runToken: null, finishedAt: heartbeat() });
  } catch (error) {
    console.error("AI job failed", error);
    const latest = (await store.get(jobId, { type: "json" }) as Record<string, unknown> | null) || job;
    await refundJob(jobId, latest, "The search could not be completed. Your credits have not been used; please try again.");
  }
};

export const config: Config = {
  path: "/api/analyze-deal-run",
  method: "POST",
  background: true,
};
