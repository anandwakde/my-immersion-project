import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const subscribe = mutation({
  args: {
    email: v.string(),
    schemes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscribers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { schemes: args.schemes });
      return existing._id;
    }

    return await ctx.db.insert("subscribers", args);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("subscribers").take(500);
  },
});

export const unsubscribe = mutation({
  args: { subscriberId: v.id("subscribers") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.subscriberId);
    if (!existing) {
      return { alreadyGone: true };
    }
    await ctx.db.delete(args.subscriberId);
    return { email: existing.email };
  },
});
