import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { TEAMS } from "./tasks";

export const create = internalMutation({
  args: {
    scheme: v.string(),
    title: v.string(),
    urgency: v.string(),
    deadline: v.string(),
    deadlineDate: v.optional(v.union(v.string(), v.null())),
    scope: v.string(),
    sourceUrl: v.string(),
    fileHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const circularId = await ctx.db.insert("circulars", args);

    await ctx.db.insert("auditLog", {
      circularId,
      action: "circular_ingested",
      detail: `"${args.title}" ingested from ${args.scheme} (${args.urgency})`,
    });

    for (const team of TEAMS) {
      const taskId = await ctx.db.insert("tasks", {
        circularId,
        team,
        deadline: args.deadlineDate ?? null,
        status: "open",
      });
      await ctx.db.insert("auditLog", {
        circularId,
        taskId,
        action: "task_created",
        detail: `Task created for ${team}`,
      });
    }

    return circularId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("circulars").order("desc").take(50);
  },
});

export const listForInbox = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("companyProfile")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) return [];

    const recent = await ctx.db.query("circulars").order("desc").take(200);
    const inScheme = recent.filter((c) => profile.schemes.includes(c.scheme));

    const withVerdicts = await Promise.all(
      inScheme.map(async (c) => {
        const verdict = await ctx.db
          .query("circularVerdicts")
          .withIndex("by_user_and_circular", (q) =>
            q.eq("userId", args.userId).eq("circularId", c._id)
          )
          .unique();
        return {
          ...c,
          appliesToCompany: verdict?.appliesToCompany,
          applicabilityReason: verdict?.applicabilityReason,
          financialImpactSummary: verdict?.financialImpactSummary,
        };
      })
    );

    // "Doesn't apply" circulars are filtered out entirely — a verdict of
    // exactly `false` hides it; undefined (not yet checked) or `true` (applies)
    // both stay visible.
    return withVerdicts.filter((c) => c.appliesToCompany !== false).slice(0, 50);
  },
});

export const getById = internalQuery({
  args: { circularId: v.id("circulars") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.circularId);
  },
});

export const findByFileHash = query({
  args: { fileHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("circulars")
      .withIndex("by_file_hash", (q) => q.eq("fileHash", args.fileHash))
      .unique();
  },
});

export const findBySourceUrl = query({
  args: { sourceUrl: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("circulars")
      .withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
      .unique();
  },
});
