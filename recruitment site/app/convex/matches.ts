import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getForApplication = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db
      .query("matches")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", args.applicationId))
      .unique();
  },
});

// Upsert — re-scoring an application (e.g. after a newer resume is parsed)
// replaces its previous match rather than accumulating duplicates.
export const save = internalMutation({
  args: {
    applicationId: v.id("applications"),
    jobId: v.id("jobs"),
    score: v.number(),
    strengths: v.array(v.string()),
    gaps: v.array(v.string()),
    evidence: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("matches")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", args.applicationId))
      .unique();
    const data = {
      applicationId: args.applicationId,
      jobId: args.jobId,
      score: args.score,
      strengths: args.strengths,
      gaps: args.gaps,
      evidence: args.evidence,
      computedAt: Date.now(),
    };
    if (existing !== null) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("matches", data);
    }
  },
});
