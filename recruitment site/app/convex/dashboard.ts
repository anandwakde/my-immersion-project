import { v } from "convex/values";
import { query, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { STAGES } from "./applicationStage";

// A candidate flagged as stalled hasn't moved stage (or been created, if it
// never has) in at least this many days.
const STUCK_THRESHOLD_DAYS = 5;
// Applications newer than this count as "new"; older undecided ones as
// "waiting for a decision".
const NEW_WINDOW_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Reads are bounded (Convex queries must be). Past this many applications
// the dashboard needs running counters instead — see the plan doc.
const MAX_APPLICATIONS = 1000;

export const ACTION_KEYS = [
  "new",
  "undecided",
  "client_pending",
  "needs_scheduling",
  "interviews_today",
  "awaiting_decision",
  "stalled",
] as const;
export type ActionKey = (typeof ACTION_KEYS)[number];

const viewValidator = v.union(
  v.literal("all"),
  v.literal("recent"),
  v.literal("top"),
  ...ACTION_KEYS.map((k) => v.literal(k)),
);

type Row = {
  applicationId: Id<"applications">;
  jobId: Id<"jobs">;
  jobTitle: string;
  candidateId: Id<"candidates">;
  name: string;
  stage: Doc<"applications">["stage"];
  rejected: boolean;
  appliedAt: number;
  score: number | null;
  interviewAt: number | null;
  interviewStatus: string | null;
  clientStatus: string | null;
  daysStuck: number;
  actions: ActionKey[];
};

// Loads every application once (bounded) with what the dashboard, the
// Action Required cards and the "View all" list need, and works out which
// action categories each application falls into.
async function loadRows(ctx: QueryCtx, now: number, tzOffsetMinutes: number): Promise<Row[]> {
  const jobs = await ctx.db.query("jobs").take(200);
  const jobTitleById = new Map<Id<"jobs">, string>(jobs.map((j) => [j._id, j.title]));
  const shareLinks = await ctx.db.query("shareLinks").take(500);
  const jobsWithShareLink = new Set(shareLinks.map((l) => l.jobId));
  const matches = await ctx.db.query("matches").take(MAX_APPLICATIONS);
  const scoreByApp = new Map(matches.map((m) => [m.applicationId, m.score]));
  const applications = await ctx.db.query("applications").order("desc").take(MAX_APPLICATIONS);

  // "Today" in the recruiter's own time zone (offset from the browser).
  const localNow = now - tzOffsetMinutes * 60 * 1000;
  const dayStart = localNow - (localNow % MS_PER_DAY) + tzOffsetMinutes * 60 * 1000;
  const dayEnd = dayStart + MS_PER_DAY;

  const candidateCache = new Map<Id<"candidates">, Doc<"candidates"> | null>();
  const rows: Row[] = [];
  for (const app of applications) {
    if (!candidateCache.has(app.candidateId)) {
      candidateCache.set(app.candidateId, await ctx.db.get("candidates", app.candidateId));
    }
    const candidate = candidateCache.get(app.candidateId) ?? null;
    const rejected = app.rejected ?? false;
    const lastChange = await ctx.db
      .query("stageHistory")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
      .order("desc")
      .first();
    const daysStuck = Math.floor((now - (lastChange?.changedAt ?? app._creationTime)) / MS_PER_DAY);
    const age = now - app._creationTime;
    const slots = [app.interviewSlotAt, app.interviewSlotAt2].filter((s): s is number => s !== undefined);

    const actions: ActionKey[] = [];
    if (!rejected) {
      if (app.stage === "applied" && age < NEW_WINDOW_DAYS * MS_PER_DAY) actions.push("new");
      if ((app.stage === "applied" || app.stage === "ai_screened") && age >= NEW_WINDOW_DAYS * MS_PER_DAY) {
        actions.push("undecided");
      }
      if (app.stage === "shortlisted" && app.clientStatus === undefined && jobsWithShareLink.has(app.jobId)) {
        actions.push("client_pending");
      }
      if (
        app.clientStatus === "accepted" &&
        app.stage !== "hired" &&
        (app.interviewStatus === undefined ||
          app.interviewStatus === "needs_new_slots" ||
          app.interviewStatus === "cancelled" ||
          (app.interviewStatus === "awaiting_candidate" && slots.every((s) => s <= now)))
      ) {
        actions.push("needs_scheduling");
      }
      if (app.interviewStatus === "confirmed" && app.interviewAt !== undefined) {
        if (app.interviewAt >= dayStart && app.interviewAt < dayEnd) actions.push("interviews_today");
        if (app.interviewAt < now && app.stage === "interview") actions.push("awaiting_decision");
      }
      if (app.stage !== "hired" && daysStuck >= STUCK_THRESHOLD_DAYS) actions.push("stalled");
    }

    rows.push({
      applicationId: app._id,
      jobId: app.jobId,
      jobTitle: jobTitleById.get(app.jobId) ?? "Unknown role",
      candidateId: app.candidateId,
      name: candidate?.name ?? "Unknown",
      stage: app.stage,
      rejected,
      appliedAt: app._creationTime,
      score: scoreByApp.get(app._id) ?? null,
      interviewAt: app.interviewAt ?? null,
      interviewStatus: app.interviewStatus ?? null,
      clientStatus: app.clientStatus ?? null,
      daysStuck,
      actions,
    });
  }
  return rows;
}

export const getOverview = query({
  args: { now: v.number(), tzOffsetMinutes: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const rows = await loadRows(ctx, args.now, args.tzOffsetMinutes ?? 0);
    const jobs = await ctx.db.query("jobs").take(200);
    const totalCandidates = (await ctx.db.query("candidates").take(MAX_APPLICATIONS)).length;

    const funnel = STAGES.map((s) => ({ stage: s.key, label: s.label, count: 0 }));
    const funnelByStage = new Map(funnel.map((f) => [f.stage, f]));
    let rejectedCount = 0;
    for (const row of rows) {
      if (row.rejected) rejectedCount++;
      else funnelByStage.get(row.stage)!.count++;
    }

    const actionCounts = Object.fromEntries(ACTION_KEYS.map((k) => [k, 0])) as Record<ActionKey, number>;
    for (const row of rows) for (const a of row.actions) actionCounts[a]++;

    return {
      kpis: {
        publishedJobs: jobs.filter((j) => j.status === "published").length,
        totalCandidates,
        totalApplications: rows.length,
        hired: funnelByStage.get("hired")!.count,
        rejected: rejectedCount,
      },
      funnel,
      actionCounts,
      recentCandidates: rows.slice(0, 6),
      topCandidates: rows
        .filter((r) => r.score !== null)
        .sort((a, b) => b.score! - a.score!)
        .slice(0, 6),
      stuckThresholdDays: STUCK_THRESHOLD_DAYS,
      newWindowDays: NEW_WINDOW_DAYS,
      truncated: rows.length >= MAX_APPLICATIONS,
    };
  },
});

// The "View all" page behind every dashboard box and Action Required card.
// Filters and sorts on the server; the page splits the result into pages.
export const listApplications = query({
  args: {
    now: v.number(),
    tzOffsetMinutes: v.optional(v.number()),
    view: viewValidator,
    jobId: v.optional(v.string()),
    stage: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("rejected"))),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    let rows = await loadRows(ctx, args.now, args.tzOffsetMinutes ?? 0);

    if (args.view === "top") rows = rows.filter((r) => r.score !== null);
    else if (args.view !== "all" && args.view !== "recent") {
      const key = args.view;
      rows = rows.filter((r) => r.actions.includes(key));
    }
    if (args.jobId) rows = rows.filter((r) => r.jobId === args.jobId);
    if (args.stage) rows = rows.filter((r) => r.stage === args.stage);
    if (args.status === "active") rows = rows.filter((r) => !r.rejected);
    if (args.status === "rejected") rows = rows.filter((r) => r.rejected);
    const term = args.search?.trim().toLowerCase();
    if (term) rows = rows.filter((r) => r.name.toLowerCase().includes(term) || r.jobTitle.toLowerCase().includes(term));

    if (args.view === "top") rows.sort((a, b) => b.score! - a.score!);
    else if (args.view === "stalled") rows.sort((a, b) => b.daysStuck - a.daysStuck);
    else if (args.view === "interviews_today" || args.view === "awaiting_decision") {
      rows.sort((a, b) => (a.interviewAt ?? 0) - (b.interviewAt ?? 0));
    }
    return rows;
  },
});
