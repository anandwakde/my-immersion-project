import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import schema, { addressFieldsValidator } from "./schema";

export const save = mutation({
  args: {
    rawAddress: v.string(),
    fields: addressFieldsValidator,
    confidence: v.number(),
    missingRequiredFields: v.array(v.string()),
    status: v.union(v.literal("ready"), v.literal("needs_review")),
  },
  returns: v.id("addressChecks"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("addressChecks", {
      rawAddress: args.rawAddress,
      aiFields: args.fields,
      finalFields: args.fields,
      confidence: args.confidence,
      missingRequiredFields: args.missingRequiredFields,
      status: args.status,
      reviewed: false,
    });
  },
});

export const latest = query({
  args: {},
  returns: v.union(v.null(), schema.doc("addressChecks")),
  handler: async (ctx) => {
    const rows = await ctx.db.query("addressChecks").order("desc").take(1);
    return rows[0] ?? null;
  },
});

export const markReviewed = mutation({
  args: {
    id: v.id("addressChecks"),
    fields: addressFieldsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("addressChecks", args.id, {
      finalFields: args.fields,
      reviewed: true,
    });
    return null;
  },
});
