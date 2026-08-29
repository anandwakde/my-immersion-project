import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companyProfile")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const save = mutation({
  args: {
    userId: v.id("users"),
    legalEntityName: v.string(),
    customerType: v.string(),
    countries: v.array(v.string()),
    schemes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const legalEntityName = args.legalEntityName.trim();
    if (!legalEntityName) {
      throw new Error("Legal entity name is required.");
    }
    if (args.countries.length === 0) {
      throw new Error("Select at least one country of operation.");
    }
    if (args.schemes.length === 0) {
      throw new Error("Select at least one scheme.");
    }

    const existing = await ctx.db
      .query("companyProfile")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    const doc = {
      userId: args.userId,
      legalEntityName,
      customerType: args.customerType,
      countries: args.countries,
      schemes: args.schemes,
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("companyProfile", doc);
  },
});
