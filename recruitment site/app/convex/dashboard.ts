import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { STAGES } from "./applicationStage";

// A candidate flagged here hasn't moved stage (or been created, if it never
// has) in at least this many days — confirmed with the recruiter as the
// right cadence for a "needs attention" nudge.
const STUCK_THRESHOLD_DAYS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Milestone 6: a single read-only aggregation over Milestones 1-5's data —
// no new writes, just KPI cards, a stage funnel, recent/top candidates, and
// an "attention required" list for applications stalled past the threshold
// above. `now` is passed in by the client (per the no-wall-clock-in-queries
// rule) instead of read here, so results stay reproducible/cacheable.
export const getOverview = query({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const jobs = await ctx.db.query("jobs").take(200);
    const jobTitleById = new Map<Id<"jobs">, string>(jobs.map((j) => [j._id, j.title]));
    const publishedJobs = jobs.filter((j) => j.status === "published").length;

    const totalCandidates = (await ctx.db.query("candidates").take(1000)).length;

    const applications = await ctx.db.query("applications").take(1000);

    const candidateCache = new Map<Id<"candidates">, Doc<"candidates"> | null>();
    async function getCandidate(candidateId: Id<"candidates">) {
      if (!candidateCache.has(candidateId)) {
        candidateCache.set(candidateId, await ctx.db.get("candidates", candidateId));
      }
      return candidateCache.get(candidateId)!;
    }

    const funnel = STAGES.map((s) => ({ stage: s.key, label: s.label, count: 0 }));
    const funnelByStage = new Map(funnel.map((f) => [f.stage, f]));
    let rejectedCount = 0;
    for (const app of applications) {
      if (app.rejected) {
        rejectedCount++;
      } else {
        funnelByStage.get(app.stage)!.count++;
      }
    }

    const recentApplications = [...applications]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 8);
    const recentCandidates = [];
    for (const app of recentApplications) {
      const candidate = await getCandidate(app.candidateId);
      recentCandidates.push({
        applicationId: app._id,
        name: candidate?.name ?? "Unknown",
        jobTitle: jobTitleById.get(app.jobId) ?? "Unknown role",
        stage: app.stage,
        appliedAt: app._creationTime,
      });
    }

    const matches = await ctx.db.query("matches").take(1000);
    const topMatches = [...matches].sort((a, b) => b.score - a.score).slice(0, 8);
    const topCandidates = [];
    for (const match of topMatches) {
      const app = applications.find((a) => a._id === match.applicationId);
      if (!app) continue;
      const candidate = await getCandidate(app.candidateId);
      topCandidates.push({
        applicationId: app._id,
        name: candidate?.name ?? "Unknown",
        jobTitle: jobTitleById.get(app.jobId) ?? "Unknown role",
        score: match.score,
      });
    }

    const attentionCandidates = applications.filter((a) => !a.rejected && a.stage !== "hired");
    const attentionRequired: {
      applicationId: Id<"applications">;
      name: string;
      jobTitle: string;
      stage: Doc<"applications">["stage"];
      daysStuck: number;
    }[] = [];
    for (const app of attentionCandidates) {
      const lastChange = await ctx.db
        .query("stageHistory")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
        .order("desc")
        .first();
      const since = lastChange?.changedAt ?? app._creationTime;
      const daysStuck = Math.floor((args.now - since) / MS_PER_DAY);
      if (daysStuck >= STUCK_THRESHOLD_DAYS) {
        const candidate = await getCandidate(app.candidateId);
        attentionRequired.push({
          applicationId: app._id,
          name: candidate?.name ?? "Unknown",
          jobTitle: jobTitleById.get(app.jobId) ?? "Unknown role",
          stage: app.stage,
          daysStuck,
        });
      }
    }
    attentionRequired.sort((a, b) => b.daysStuck - a.daysStuck);

    return {
      kpis: {
        publishedJobs,
        totalCandidates,
        totalApplications: applications.length,
        hired: funnelByStage.get("hired")!.count,
        rejected: rejectedCount,
      },
      funnel,
      recentCandidates,
      topCandidates,
      attentionRequired: attentionRequired.slice(0, 20),
      stuckThresholdDays: STUCK_THRESHOLD_DAYS,
    };
  },
});
