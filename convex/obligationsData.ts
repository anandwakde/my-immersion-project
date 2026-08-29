import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const replaceForCircular = internalMutation({
  args: {
    userId: v.id("users"),
    circularId: v.id("circulars"),
    descriptions: v.array(v.string()),
    defaultDueDate: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const existingObligations = await ctx.db
      .query("obligations")
      .withIndex("by_user_and_circular", (q) =>
        q.eq("userId", args.userId).eq("circularId", args.circularId)
      )
      .collect();
    for (const ob of existingObligations) {
      const planItems = await ctx.db
        .query("planItems")
        .withIndex("by_obligation", (q) => q.eq("obligationId", ob._id))
        .collect();
      for (const item of planItems) {
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(ob._id);
    }

    for (const description of args.descriptions) {
      const obligationId = await ctx.db.insert("obligations", {
        userId: args.userId,
        circularId: args.circularId,
        description,
      });
      await ctx.db.insert("planItems", {
        userId: args.userId,
        obligationId,
        circularId: args.circularId,
        owner: "Unassigned",
        dueDate: args.defaultDueDate ?? undefined,
        signedOff: false,
      });
    }
  },
});

export const setFinancialImpact = internalMutation({
  args: { userId: v.id("users"), circularId: v.id("circulars"), summary: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("circularVerdicts")
      .withIndex("by_user_and_circular", (q) =>
        q.eq("userId", args.userId).eq("circularId", args.circularId)
      )
      .unique();
    if (!existing) {
      throw new Error("Check relevance first — no verdict exists to attach a financial impact to.");
    }
    await ctx.db.patch(existing._id, {
      financialImpactSummary: args.summary,
      financialImpactCheckedAt: Date.now(),
    });
  },
});

export const listForCircular = query({
  args: { userId: v.id("users"), circularId: v.id("circulars") },
  handler: async (ctx, args) => {
    const obligations = await ctx.db
      .query("obligations")
      .withIndex("by_user_and_circular", (q) =>
        q.eq("userId", args.userId).eq("circularId", args.circularId)
      )
      .collect();

    const result = [];
    for (const ob of obligations) {
      const planItem = await ctx.db
        .query("planItems")
        .withIndex("by_obligation", (q) => q.eq("obligationId", ob._id))
        .unique();
      const evidenceFileUrl = planItem?.evidenceFileId
        ? await ctx.storage.getUrl(planItem.evidenceFileId)
        : null;
      result.push({
        obligationId: ob._id,
        description: ob.description,
        planItem,
        evidenceFileUrl,
      });
    }
    return result;
  },
});

export const updatePlanItem = mutation({
  args: {
    userId: v.id("users"),
    planItemId: v.id("planItems"),
    owner: v.string(),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const planItem = await ctx.db.get(args.planItemId);
    if (!planItem || planItem.userId !== args.userId) {
      throw new Error("Plan item not found");
    }
    await ctx.db.patch(args.planItemId, {
      owner: args.owner,
      dueDate: args.dueDate,
    });
  },
});

export const generateEvidenceUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const submitEvidence = mutation({
  args: {
    userId: v.id("users"),
    planItemId: v.id("planItems"),
    evidenceType: v.union(v.literal("file"), v.literal("link"), v.literal("note")),
    evidenceContent: v.optional(v.string()),
    evidenceFileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const planItem = await ctx.db.get(args.planItemId);
    if (!planItem || planItem.userId !== args.userId) {
      throw new Error("Plan item not found");
    }
    if (args.evidenceType === "file" && !args.evidenceFileId) {
      throw new Error("A file upload is required for file evidence.");
    }
    if (args.evidenceType !== "file" && !args.evidenceContent?.trim()) {
      throw new Error("Evidence content is required.");
    }
    await ctx.db.patch(args.planItemId, {
      evidenceType: args.evidenceType,
      evidenceContent: args.evidenceContent?.trim(),
      evidenceFileId: args.evidenceFileId,
      signedOff: true,
      signedOffAt: Date.now(),
    });
  },
});
