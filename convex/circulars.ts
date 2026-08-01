import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = internalMutation({
  args: {
    scheme: v.string(),
    title: v.string(),
    urgency: v.string(),
    deadline: v.string(),
    deadlineDate: v.optional(v.union(v.string(), v.null())),
    scope: v.string(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("circulars", args);
  },
});

export const createFailedAttempt = internalMutation({
  args: {
    sourceUrl: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("circulars", {
      sourceUrl: args.sourceUrl,
      errorMessage: args.errorMessage,
      failed: true,
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("circulars").order("desc").take(50);
  },
});
